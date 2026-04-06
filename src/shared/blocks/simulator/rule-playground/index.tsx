'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import type { DamageRuleVersionListItem } from '@/shared/models/damage-rules';

type RuleSimulationCase = {
  id: string;
  name: string;
  versionId: string | null;
  input: Record<string, unknown>;
  expectedResult: Record<string, unknown>;
  notes: string;
  createdBy: string;
  enabled: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type RulePlaygroundPanelProps = {
  canEdit: boolean;
  initialVersions: DamageRuleVersionListItem[];
  initialCases: RuleSimulationCase[];
};

type PlaygroundResult = {
  ruleVersion: {
    id: string;
    versionCode: string;
    versionName: string;
  };
  skill: {
    skillCode: string;
    skillName: string;
    finalLevel: number;
  };
  targets: Array<{
    damage: number;
    critDamage: number;
    totalDamage: number;
    breakdown: Record<string, unknown>;
  }>;
};

const FORMATION_COUNTER_OPTIONS = [
  '大克',
  '小克',
  '无克/普通',
  '被小克',
  '被大克',
];

const ELEMENT_RELATION_OPTIONS = ['克制', '无克/普通', '被克制'];

function toNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function normalizeString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function simulationInputFromForm(params: {
  selectedVersionId: string;
  skillCode: string;
  targetCount: string;
  targetMagicDefense: string;
  formationCounterState: string;
  elementRelation: string;
  shenmuValue: string;
  magicResult: string;
  transformCardFactor: string;
  panelMagicDamageOverride: string;
}) {
  return {
    ruleVersionId: params.selectedVersionId,
    skillCode: params.skillCode,
    targetCount: toNumber(params.targetCount, 1),
    targetMagicDefense: toNumber(params.targetMagicDefense, 0),
    formationCounterState: params.formationCounterState,
    elementRelation: params.elementRelation,
    shenmuValue: toNumber(params.shenmuValue, 0),
    magicResult: toNumber(params.magicResult, 0),
    transformCardFactor: toNumber(params.transformCardFactor, 1),
    panelMagicDamageOverride:
      params.panelMagicDamageOverride.trim() === ''
        ? undefined
        : toNumber(params.panelMagicDamageOverride, 0),
  };
}

async function runDamageSimulation(payload: Record<string, unknown>) {
  const response = await fetch('/api/simulator/calculate-damage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json();
  if (!response.ok || body?.code !== 0) {
    throw new Error(body?.message || '规则试算失败');
  }

  return body.data as PlaygroundResult;
}

async function createSimulationCase(payload: {
  name: string;
  versionId?: string;
  input: Record<string, unknown>;
  expectedResult: Record<string, unknown>;
  notes?: string;
}) {
  const response = await fetch('/api/admin/simulator/rule-simulation-cases', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json();
  if (!response.ok || body?.code !== 0) {
    throw new Error(body?.message || '保存试算样例失败');
  }

  return body.data as RuleSimulationCase;
}

async function removeSimulationCase(id: string) {
  const response = await fetch(`/api/admin/simulator/rule-simulation-cases/${id}`, {
    method: 'DELETE',
  });

  const body = await response.json();
  if (!response.ok || body?.code !== 0) {
    throw new Error(body?.message || '删除试算样例失败');
  }
}

export function RulePlaygroundPanel({
  canEdit,
  initialVersions,
  initialCases,
}: RulePlaygroundPanelProps) {
  const activeVersion = useMemo(
    () => initialVersions.find((item) => item.isActive) ?? initialVersions[0] ?? null,
    [initialVersions],
  );

  const [selectedVersionId, setSelectedVersionId] = useState(activeVersion?.id || '');
  const [skillCode, setSkillCode] = useState('dragon_roll');
  const [targetCount, setTargetCount] = useState('7');
  const [targetMagicDefense, setTargetMagicDefense] = useState('1200');
  const [formationCounterState, setFormationCounterState] = useState('无克/普通');
  const [elementRelation, setElementRelation] = useState('无克/普通');
  const [shenmuValue, setShenmuValue] = useState('0');
  const [magicResult, setMagicResult] = useState('0');
  const [transformCardFactor, setTransformCardFactor] = useState('1');
  const [panelMagicDamageOverride, setPanelMagicDamageOverride] = useState('');

  const [saveCaseName, setSaveCaseName] = useState('');
  const [saveCaseNotes, setSaveCaseNotes] = useState('');
  const [cases, setCases] = useState(initialCases);

  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingCaseId, setDeletingCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<PlaygroundResult | null>(null);
  const [activeResult, setActiveResult] = useState<PlaygroundResult | null>(null);

  const selectedVersion = useMemo(
    () => initialVersions.find((item) => item.id === selectedVersionId) || null,
    [initialVersions, selectedVersionId],
  );

  const currentInputPayload = useMemo(
    () =>
      simulationInputFromForm({
        selectedVersionId,
        skillCode,
        targetCount,
        targetMagicDefense,
        formationCounterState,
        elementRelation,
        shenmuValue,
        magicResult,
        transformCardFactor,
        panelMagicDamageOverride,
      }),
    [
      elementRelation,
      formationCounterState,
      magicResult,
      panelMagicDamageOverride,
      selectedVersionId,
      shenmuValue,
      skillCode,
      targetCount,
      targetMagicDefense,
      transformCardFactor,
    ],
  );

  const handleRun = async () => {
    if (!selectedVersionId) {
      return;
    }

    setIsRunning(true);
    setError(null);

    try {
      const selectedPromise = runDamageSimulation(currentInputPayload);
      const activePromise =
        activeVersion && activeVersion.id !== selectedVersionId
          ? runDamageSimulation({
              ...currentInputPayload,
              ruleVersionId: activeVersion.id,
            })
          : Promise.resolve(null);

      const [selectedData, activeData] = await Promise.all([
        selectedPromise,
        activePromise,
      ]);

      setSelectedResult(selectedData);
      setActiveResult(activeData);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : '规则试算失败');
      setSelectedResult(null);
      setActiveResult(null);
    } finally {
      setIsRunning(false);
    }
  };

  const handleApplyCase = (savedCase: RuleSimulationCase) => {
    const input = savedCase.input ?? {};

    setSelectedVersionId(
      normalizeString(input.ruleVersionId, savedCase.versionId ?? activeVersion?.id ?? ''),
    );
    setSkillCode(normalizeString(input.skillCode, 'dragon_roll'));
    setTargetCount(String(input.targetCount ?? 7));
    setTargetMagicDefense(String(input.targetMagicDefense ?? 1200));
    setFormationCounterState(
      normalizeString(input.formationCounterState, '无克/普通'),
    );
    setElementRelation(normalizeString(input.elementRelation, '无克/普通'));
    setShenmuValue(String(input.shenmuValue ?? 0));
    setMagicResult(String(input.magicResult ?? 0));
    setTransformCardFactor(String(input.transformCardFactor ?? 1));

    const override = input.panelMagicDamageOverride;
    setPanelMagicDamageOverride(
      override === undefined || override === null ? '' : String(override),
    );

    setSaveCaseName(savedCase.name);
    setSaveCaseNotes(savedCase.notes || '');
    setError(null);
  };

  const handleSaveCase = async () => {
    if (!canEdit) {
      return;
    }

    if (!selectedResult) {
      setError('请先运行一次试算，再保存样例。');
      return;
    }

    const caseName = saveCaseName.trim();
    if (!caseName) {
      setError('请先填写样例名称。');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const savedCase = await createSimulationCase({
        name: caseName,
        versionId: selectedVersionId || undefined,
        input: currentInputPayload,
        expectedResult: selectedResult,
        notes: saveCaseNotes.trim(),
      });

      setCases((current) => [savedCase, ...current]);
      setSaveCaseName('');
      setSaveCaseNotes('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存试算样例失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCase = async (id: string) => {
    if (!canEdit) {
      return;
    }

    setDeletingCaseId(id);
    setError(null);

    try {
      await removeSimulationCase(id);
      setCases((current) => current.filter((item) => item.id !== id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除试算样例失败');
    } finally {
      setDeletingCaseId(null);
    }
  };

  const renderResultCard = (title: string, result: PlaygroundResult | null) => {
    if (!result) {
      return (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">
          暂无结果
        </div>
      );
    }

    const target = result.targets[0];
    const breakdown = (target?.breakdown ?? {}) as Record<string, unknown>;

    return (
      <div className="rounded-lg border p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="font-medium">{title}</div>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            {result.ruleVersion.versionCode}
          </span>
        </div>
        <div className="grid gap-2 text-sm md:grid-cols-2">
          <div>技能：{result.skill.skillName}</div>
          <div>最终等级：{result.skill.finalLevel}</div>
          <div>单目标伤害：{target?.damage ?? '-'}</div>
          <div>暴击伤害：{target?.critDamage ?? '-'}</div>
          <div>总伤害：{target?.totalDamage ?? '-'}</div>
          <div>分灵系数：{String(breakdown.splitFactor ?? '-')}</div>
          <div>阵法系数：{String(breakdown.combinedFormationFactor ?? '-')}</div>
          <div>五行系数：{String(breakdown.elementFactor ?? '-')}</div>
          <div>修炼差：{String(breakdown.cultivationDiff ?? '-')}</div>
          <div>神木符：{String(breakdown.shenmuValue ?? '-')}</div>
          <div>法伤结果：{String(breakdown.magicResult ?? '-')}</div>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rule Playground</CardTitle>
        <CardDescription>
          直接输入战斗参数，对比当前选中版本与当前生效版本的试算结果，并支持保存回归样例。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_360px]">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>试算版本</Label>
                <Select value={selectedVersionId} onValueChange={setSelectedVersionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择版本" />
                  </SelectTrigger>
                  <SelectContent>
                    {initialVersions.map((version) => (
                      <SelectItem key={version.id} value={version.id}>
                        {version.versionCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>技能代码</Label>
                <Input value={skillCode} onChange={(e) => setSkillCode(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>目标数量</Label>
                <Input
                  value={targetCount}
                  onChange={(e) => setTargetCount(e.target.value)}
                  type="number"
                />
              </div>
              <div className="space-y-2">
                <Label>目标法防</Label>
                <Input
                  value={targetMagicDefense}
                  onChange={(e) => setTargetMagicDefense(e.target.value)}
                  type="number"
                />
              </div>
              <div className="space-y-2">
                <Label>阵法克制</Label>
                <Select value={formationCounterState} onValueChange={setFormationCounterState}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择阵法克制" />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATION_COUNTER_OPTIONS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>五行关系</Label>
                <Select value={elementRelation} onValueChange={setElementRelation}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择五行关系" />
                  </SelectTrigger>
                  <SelectContent>
                    {ELEMENT_RELATION_OPTIONS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>神木符</Label>
                <Input
                  value={shenmuValue}
                  onChange={(e) => setShenmuValue(e.target.value)}
                  type="number"
                />
              </div>
              <div className="space-y-2">
                <Label>法伤结果</Label>
                <Input
                  value={magicResult}
                  onChange={(e) => setMagicResult(e.target.value)}
                  type="number"
                />
              </div>
              <div className="space-y-2">
                <Label>变身卡系数</Label>
                <Input
                  value={transformCardFactor}
                  onChange={(e) => setTransformCardFactor(e.target.value)}
                  type="number"
                  step="0.01"
                />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label>面板法伤覆盖值</Label>
                <Input
                  value={panelMagicDamageOverride}
                  onChange={(e) => setPanelMagicDamageOverride(e.target.value)}
                  placeholder="留空则使用当前角色面板"
                  type="number"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleRun} disabled={!selectedVersionId || isRunning}>
                {isRunning ? '试算中...' : '运行规则试算'}
              </Button>
              {selectedVersion && (
                <span className="text-sm text-muted-foreground">
                  当前选中：{selectedVersion.versionCode}
                </span>
              )}
              {activeVersion && (
                <span className="text-sm text-muted-foreground">
                  当前生效：{activeVersion.versionCode}
                </span>
              )}
            </div>

            {error && <div className="text-sm text-red-500">{error}</div>}

            <div className="grid gap-4 lg:grid-cols-2">
              {renderResultCard('选中版本结果', selectedResult)}
              {renderResultCard(
                activeVersion && activeVersion.id !== selectedVersionId
                  ? '当前生效版本结果'
                  : '当前生效版本结果',
                activeVersion && activeVersion.id !== selectedVersionId
                  ? activeResult
                  : selectedResult,
              )}
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <div>
                <div className="font-medium">保存回归样例</div>
                <div className="text-sm text-muted-foreground">
                  将当前输入参数和试算结果保存下来，后续改规则时可以直接回放验证。
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>样例名称</Label>
                  <Input
                    value={saveCaseName}
                    onChange={(e) => setSaveCaseName(e.target.value)}
                    placeholder="例如：龙卷雨击-7目标-基准样例"
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label>备注</Label>
                  <Textarea
                    value={saveCaseNotes}
                    onChange={(e) => setSaveCaseNotes(e.target.value)}
                    placeholder="可选：记录这个样例为什么重要"
                    disabled={!canEdit}
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleSaveCase} disabled={!canEdit || isSaving}>
                  {isSaving ? '保存中...' : '保存为试算样例'}
                </Button>
                {!canEdit && (
                  <span className="text-sm text-muted-foreground">
                    当前账号只有查看权限，不能保存或删除样例。
                  </span>
                )}
              </div>
              {selectedResult && (
                <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                  <div>当前保存输入：</div>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap">
                    {prettyJson(currentInputPayload)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-lg border p-4">
            <div>
              <div className="font-medium">已保存样例</div>
              <div className="text-sm text-muted-foreground">
                点击“载入”可将样例参数回填到表单，直接重新试算。
              </div>
            </div>
            {cases.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                还没有保存过样例。
              </div>
            ) : (
              <ScrollArea className="h-[520px] pr-3">
                <div className="space-y-3">
                  {cases.map((savedCase) => {
                    const target = (savedCase.expectedResult?.targets as Array<Record<string, unknown>> | undefined)?.[0];
                    const versionLabel =
                      initialVersions.find((item) => item.id === savedCase.versionId)
                        ?.versionCode ?? '未绑定版本';

                    return (
                      <div key={savedCase.id} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">{savedCase.name}</div>
                            <div className="text-xs text-muted-foreground">
                              绑定版本：{versionLabel}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleApplyCase(savedCase)}
                            >
                              载入
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={!canEdit || deletingCaseId === savedCase.id}
                              onClick={() => handleDeleteCase(savedCase.id)}
                            >
                              {deletingCaseId === savedCase.id ? '删除中...' : '删除'}
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                          <div>技能：{String(savedCase.input.skillCode ?? '-')}</div>
                          <div>目标数量：{String(savedCase.input.targetCount ?? '-')}</div>
                          <div>目标法防：{String(savedCase.input.targetMagicDefense ?? '-')}</div>
                          <div>预期单目标伤害：{String(target?.damage ?? '-')}</div>
                        </div>
                        {savedCase.notes ? (
                          <div className="mt-3 rounded bg-muted/40 p-2 text-xs text-muted-foreground">
                            {savedCase.notes}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
