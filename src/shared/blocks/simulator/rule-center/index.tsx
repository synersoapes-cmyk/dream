'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link } from '@/core/i18n/navigation';

import { formatDateTimeValue } from '@/shared/lib/date';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Label } from '@/shared/components/ui/label';
import type {
  DamageRuleEquipmentExtensionConfig,
  DamageRuleVersionDetail,
  DamageRuleVersionListItem,
} from '@/shared/models/damage-rules';

type RuleCenterPanelProps = {
  canEdit?: boolean;
  initialVersions: DamageRuleVersionListItem[];
  initialDetail: DamageRuleVersionDetail | null;
};

const EQUIPMENT_EXTENSION_SECTIONS = [
  {
    key: 'star_resonance_rules',
    title: '星相互合规则 JSON',
    description:
      '建议维护部位、组合名、颜色清单、单件奖励和 6 件全局奖励。',
    example: [
      {
        slot: 'helmet',
        comboName: '九龙诀',
        colors: ['白', '红', '黄', '蓝', '绿'],
        singleBonus: {
          attrType: 'magicDamage',
          value: 2,
        },
        fullSetBonus: {
          allBaseAttributes: 2,
        },
      },
    ],
  },
  {
    key: 'ornament_set_rules',
    title: '灵饰套装档位规则 JSON',
    description: '建议维护套装名、激活阈值、档位和每档位效果。',
    example: [
      {
        setName: '163',
        minTotalLevel: 8,
        tiers: [
          { level: 8, effect: '基础激活' },
          { level: 16, effect: '中档强化' },
          { level: 24, effect: '高档强化' },
        ],
      },
    ],
  },
  {
    key: 'jade_attribute_pool',
    title: '玉魄属性池 JSON',
    description: '建议维护部位、允许词条、固定值区间和百分比区间。',
    example: [
      {
        slot: 'jade1',
        allowedAttributes: [
          {
            code: 'spell_ignore_percent',
            label: '法术忽视%',
            valueType: 'percent',
            min: 0.01,
            max: 0.08,
          },
        ],
      },
    ],
  },
  {
    key: 'jade_percent_semantics',
    title: '玉魄百分比语义 JSON',
    description: '建议维护百分比词条在公式中的生效时机和解释口径。',
    example: [
      {
        code: 'spell_damage_percent',
        label: '基础法术伤害%',
        applyStage: 'panel_magic_damage',
        formula: 'panelMagicDamageBeforePercent * (1 + value)',
      },
    ],
  },
] as const;

type EquipmentExtensionDraftState = Record<
  (typeof EQUIPMENT_EXTENSION_SECTIONS)[number]['key'],
  string
>;

function formatDate(value: Date | number | string | null | undefined) {
  return formatDateTimeValue(value, {
    locale: 'zh-CN',
    empty: '-',
  });
}

function stringifyPretty(value: unknown) {
  return JSON.stringify(value ?? [], null, 2);
}

function buildEquipmentExtensionDrafts(
  configs: DamageRuleEquipmentExtensionConfig[] | null | undefined,
): EquipmentExtensionDraftState {
  const configByKey = new Map(configs?.map((config) => [config.configKey, config]) ?? []);

  return {
    star_resonance_rules: stringifyPretty(
      configByKey.get('star_resonance_rules')?.value ?? [],
    ),
    ornament_set_rules: stringifyPretty(
      configByKey.get('ornament_set_rules')?.value ?? [],
    ),
    jade_attribute_pool: stringifyPretty(
      configByKey.get('jade_attribute_pool')?.value ?? [],
    ),
    jade_percent_semantics: stringifyPretty(
      configByKey.get('jade_percent_semantics')?.value ?? [],
    ),
  };
}

function buildFieldId(...parts: Array<string | number>) {
  return parts
    .map((part) => String(part).replace(/[^a-zA-Z0-9_-]+/g, '-'))
    .join('-');
}

export function RuleCenterPanel({
  canEdit = false,
  initialVersions,
  initialDetail,
}: RuleCenterPanelProps) {
  const [versions, setVersions] = useState(initialVersions);
  const [selectedId, setSelectedId] = useState(
    initialDetail?.version.id ||
      initialVersions.find((item) => item.isActive)?.id ||
      initialVersions[0]?.id ||
      '',
  );
  const [detail, setDetail] = useState<DamageRuleVersionDetail | null>(initialDetail);
  const [modifierDraft, setModifierDraft] = useState(
    stringifyPretty(initialDetail?.modifiers ?? []),
  );
  const [skillBonusDraft, setSkillBonusDraft] = useState(
    stringifyPretty(initialDetail?.skillBonuses ?? []),
  );
  const [equipmentExtensionDrafts, setEquipmentExtensionDrafts] = useState(
    buildEquipmentExtensionDrafts(initialDetail?.equipmentExtensionConfigs),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedVersion = useMemo(
    () => versions.find((item) => item.id === selectedId) || null,
    [versions, selectedId],
  );

  useEffect(() => {
    setModifierDraft(stringifyPretty(detail?.modifiers ?? []));
    setSkillBonusDraft(stringifyPretty(detail?.skillBonuses ?? []));
    setEquipmentExtensionDrafts(
      buildEquipmentExtensionDrafts(detail?.equipmentExtensionConfigs),
    );
  }, [detail]);

  const loadDetail = async (versionId: string) => {
    setSelectedId(versionId);
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/simulator/rule-versions/${versionId}`);
      const payload = await response.json();
      if (!response.ok || payload?.code !== 0) {
        throw new Error(payload?.message || '加载规则详情失败');
      }
      setDetail(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载规则详情失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedId) {
      return;
    }

    setIsPublishing(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/simulator/rule-versions/${selectedId}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notes: 'Published from admin simulator rule center.',
        }),
      });
      const payload = await response.json();
      if (!response.ok || payload?.code !== 0) {
        throw new Error(payload?.message || '发布规则版本失败');
      }

      setDetail(payload.data);
      setVersions((current) =>
        current.map((item) => ({
          ...item,
          isActive: item.id === selectedId,
          status: item.id === selectedId ? 'published' : item.status,
        })),
      );
      setSuccess('规则版本已发布并切换为当前生效版本');
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : '发布规则版本失败');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleClone = async () => {
    if (!selectedId) {
      return;
    }

    setIsCloning(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/simulator/rule-versions/clone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceVersionId: selectedId,
        }),
      });
      const payload = await response.json();
      if (!response.ok || payload?.code !== 0) {
        throw new Error(payload?.message || '复制规则版本失败');
      }

      setVersions(payload.data.versions || []);
      setDetail(payload.data.detail || null);
      setSelectedId(payload.data.detail?.version.id || '');
      setSuccess('已基于当前版本复制出一个新的草稿版本');
    } catch (cloneError) {
      setError(cloneError instanceof Error ? cloneError.message : '复制规则版本失败');
    } finally {
      setIsCloning(false);
    }
  };

  const handleSaveEditableSections = async () => {
    if (!selectedId) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const modifiers = JSON.parse(modifierDraft);
      const skillBonuses = JSON.parse(skillBonusDraft);
      const equipmentExtensionConfigs = EQUIPMENT_EXTENSION_SECTIONS.map(
        (section) => ({
          configKey: section.key,
          value: JSON.parse(equipmentExtensionDrafts[section.key]),
        }),
      );

      const response = await fetch(
        `/api/admin/simulator/rule-versions/${selectedId}/editable-sections`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            modifiers,
            skillBonuses,
            equipmentExtensionConfigs,
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok || payload?.code !== 0) {
        throw new Error(payload?.message || '保存可编辑规则失败');
      }

      setDetail(payload.data);
      setVersions((current) =>
        current.map((item) =>
          item.id === selectedId
            ? {
                ...item,
                modifierCount: payload.data.modifiers.length,
                skillBonusCount: payload.data.skillBonuses.length,
              }
            : item,
        ),
      );
      setSuccess('修正项、技能加成和装备扩展规则已保存');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存可编辑规则失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Damage Rule Center</CardTitle>
        <CardDescription>
          查看规则版本、复制草稿、发布当前版本，并编辑修正项、技能加成以及装备扩展规则。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-3">
            {versions.map((version) => (
              <button
                key={version.id}
                type="button"
                onClick={() => loadDetail(version.id)}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  version.id === selectedId
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-background hover:bg-muted/50'
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="font-medium">{version.versionName}</div>
                  {version.isActive ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
                      ACTIVE
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-foreground">
                      {version.status}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{version.versionCode}</div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>属性 {version.attributeRuleCount}</span>
                  <span>公式 {version.skillFormulaCount}</span>
                  <span>修正 {version.modifierCount}</span>
                  <span>加成 {version.skillBonusCount}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="rounded-xl border p-4">
            {isLoading && <div className="text-sm text-muted-foreground">加载中...</div>}

            {!isLoading && !detail && (
              <div className="text-sm text-muted-foreground">请选择一个规则版本查看详情。</div>
            )}

            {!isLoading && detail && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold">{detail.version.versionName}</div>
                      <div className="text-sm text-muted-foreground">
                        {detail.version.versionCode} · {detail.version.status}
                      </div>
                    </div>
                    {detail.version.isActive ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
                        当前生效
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                        未生效
                      </span>
                    )}
                  </div>
                  <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                    <div>来源文档：{detail.version.sourceDocUrl || '-'}</div>
                    <div>发布时间：{formatDate(detail.version.publishedAt)}</div>
                    <div>创建人：{detail.version.createdBy || '-'}</div>
                    <div>发布人：{detail.version.publishedBy || '-'}</div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <div className="mb-2 text-sm font-medium">属性转化</div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {detail.attributeConversions.map((item) => (
                        <div key={item.id}>
                          {item.sourceAttr} → {item.targetAttr} = {item.coefficient}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="mb-2 text-sm font-medium">技能公式</div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {detail.skillFormulas.map((item) => (
                        <div key={item.id}>
                          {item.skillName} ({item.skillCode}) · {item.formulaKey}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor={buildFieldId('rule-center', detail.version.id, 'modifier-draft')}
                      className="text-sm font-medium"
                    >
                      修正项 JSON
                    </Label>
                    <textarea
                      id={buildFieldId('rule-center', detail.version.id, 'modifier-draft')}
                      name={buildFieldId('rule-center', detail.version.id, 'modifier-draft')}
                      className="min-h-[320px] w-full rounded-lg border bg-background p-3 font-mono text-xs outline-none"
                      value={modifierDraft}
                      onChange={(event) => setModifierDraft(event.target.value)}
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor={buildFieldId('rule-center', detail.version.id, 'skill-bonus-draft')}
                      className="text-sm font-medium"
                    >
                      技能加成 JSON
                    </Label>
                    <textarea
                      id={buildFieldId('rule-center', detail.version.id, 'skill-bonus-draft')}
                      name={buildFieldId('rule-center', detail.version.id, 'skill-bonus-draft')}
                      className="min-h-[320px] w-full rounded-lg border bg-background p-3 font-mono text-xs outline-none"
                      value={skillBonusDraft}
                      onChange={(event) => setSkillBonusDraft(event.target.value)}
                      disabled={!canEdit}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium">装备扩展规则配置</div>
                    <div className="text-xs text-muted-foreground">
                      用于维护当前仍未完全沉淀到规则中心 UI 的星相互合、灵饰套装档位和玉魄属性池口径。
                    </div>
                    <div className="mt-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href="/admin/simulator/star-resonance-rules">
                          打开星相互合规则工作台
                        </Link>
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {EQUIPMENT_EXTENSION_SECTIONS.map((section) => (
                      <div key={section.key} className="space-y-2 rounded-lg border p-3">
                        <div className="space-y-1">
                          <Label
                            htmlFor={buildFieldId(
                              'rule-center',
                              detail.version.id,
                              section.key,
                            )}
                            className="text-sm font-medium"
                          >
                            {section.title}
                          </Label>
                          <div className="text-xs text-muted-foreground">
                            {section.description}
                          </div>
                          <pre className="bg-muted/30 overflow-auto rounded-md p-2 text-[11px] leading-5 whitespace-pre-wrap">
                            {stringifyPretty(section.example)}
                          </pre>
                        </div>
                        <textarea
                          id={buildFieldId(
                            'rule-center',
                            detail.version.id,
                            section.key,
                          )}
                          name={buildFieldId(
                            'rule-center',
                            detail.version.id,
                            section.key,
                          )}
                          className="min-h-[240px] w-full rounded-lg border bg-background p-3 font-mono text-xs outline-none"
                          value={equipmentExtensionDrafts[section.key]}
                          onChange={(event) =>
                            setEquipmentExtensionDrafts((current) => ({
                              ...current,
                              [section.key]: event.target.value,
                            }))
                          }
                          disabled={!canEdit}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="mb-2 text-sm font-medium">发布日志</div>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    {detail.publishLogs.length === 0 && <div>暂无发布日志</div>}
                    {detail.publishLogs.map((item) => (
                      <div key={item.id} className="rounded-md bg-muted/40 p-2">
                        <div>
                          {item.action} · {formatDate(item.createdAt)}
                        </div>
                        <div>{item.notes || '-'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-between">
        <div className="text-sm text-muted-foreground">
          {selectedVersion
            ? `当前查看版本：${selectedVersion.versionCode}`
            : '当前没有可查看的规则版本'}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {error && <span className="text-sm text-red-500">{error}</span>}
          {!error && success && <span className="text-sm text-emerald-600">{success}</span>}
          <Button onClick={handleClone} disabled={!canEdit || !selectedId || isCloning} variant="outline">
            {isCloning ? '复制中...' : '复制为草稿'}
          </Button>
          <Button
            onClick={handleSaveEditableSections}
            disabled={!canEdit || !selectedId || isSaving}
            variant="outline"
          >
            {isSaving ? '保存中...' : '保存可编辑区'}
          </Button>
          <Button
            onClick={handlePublish}
            disabled={!canEdit || !selectedId || Boolean(detail?.version.isActive) || isPublishing}
          >
            {isPublishing ? '发布中...' : '发布为当前版本'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
