'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { formatDateTimeValue } from '@/shared/lib/date';
import type {
  DamageModifierRule,
  DamageRuleEquipmentExtensionConfig,
  DamageRuleVersionDetail,
  DamageRuleVersionListItem,
  DamageSkillBonusRule,
} from '@/shared/models/damage-rules';

type RuleCenterPanelProps = {
  canEdit?: boolean;
  initialVersions: DamageRuleVersionListItem[];
  initialDetail: DamageRuleVersionDetail | null;
};

const EQUIPMENT_EXTENSION_SECTIONS = [
  {
    key: 'star_resonance_rules',
    title: '星相互合规则',
    description: '维护部位、组合名、颜色清单、单件奖励和 6 件全局奖励。',
  },
  {
    key: 'ornament_set_rules',
    title: '灵饰套装档位规则',
    description: '建议维护套装名、激活阈值、档位和每档位效果。',
  },
  {
    key: 'jade_attribute_pool',
    title: '玉魄属性池',
    description: '建议维护部位、允许词条、固定值区间和百分比区间。',
  },
  {
    key: 'jade_percent_semantics',
    title: '玉魄百分比语义',
    description: '建议维护百分比词条在公式中的生效时机和解释口径。',
  },
] as const;

function formatDate(value: Date | number | string | null | undefined) {
  return formatDateTimeValue(value, {
    locale: 'zh-CN',
    empty: '-',
  });
}

function buildFieldId(...parts: Array<string | number>) {
  return parts
    .map((part) => String(part).replace(/[^a-zA-Z0-9_-]+/g, '-'))
    .join('-');
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createBlankModifier(): DamageModifierRule {
  return {
    id: `new-modifier-${Date.now()}`,
    versionId: '',
    modifierDomain: 'battle',
    modifierKey: '',
    modifierType: 'multiplier',
    sourceKey: '',
    targetKey: '',
    value: 0,
    valueLookup: {},
    condition: {},
    sort: 0,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createBlankSkillBonus(): DamageSkillBonusRule {
  return {
    id: `new-skill-bonus-${Date.now()}`,
    versionId: '',
    bonusGroup: 'skill',
    ruleCode: '',
    skillCode: '',
    skillName: '',
    bonusType: 'skill_level',
    bonusValue: 0,
    condition: {},
    conflictPolicy: 'take_max',
    limitPolicy: {},
    sort: 0,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function summarizeExtensionValue(
  value: DamageRuleEquipmentExtensionConfig['value'] | undefined
) {
  if (Array.isArray(value)) {
    return `${value.length} 条规则`;
  }

  if (value && typeof value === 'object') {
    return `${Object.keys(value).length} 个字段`;
  }

  if (value === null || value === undefined || value === '') {
    return '暂未配置';
  }

  return String(value);
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
      ''
  );
  const [detail, setDetail] = useState<DamageRuleVersionDetail | null>(
    initialDetail
  );
  const [modifierRows, setModifierRows] = useState<DamageModifierRule[]>(
    initialDetail?.modifiers ?? []
  );
  const [skillBonusRows, setSkillBonusRows] = useState<DamageSkillBonusRule[]>(
    initialDetail?.skillBonuses ?? []
  );
  const [equipmentExtensionRows, setEquipmentExtensionRows] = useState<
    DamageRuleEquipmentExtensionConfig[]
  >(initialDetail?.equipmentExtensionConfigs ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedVersion = useMemo(
    () => versions.find((item) => item.id === selectedId) || null,
    [versions, selectedId]
  );

  useEffect(() => {
    setModifierRows(detail?.modifiers ?? []);
    setSkillBonusRows(detail?.skillBonuses ?? []);
    setEquipmentExtensionRows(detail?.equipmentExtensionConfigs ?? []);
  }, [detail]);

  const loadDetail = async (versionId: string) => {
    setSelectedId(versionId);
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/admin/simulator/rule-versions/${versionId}`
      );
      const payload = await response.json();
      if (!response.ok || payload?.code !== 0) {
        throw new Error(payload?.message || '加载规则详情失败');
      }
      setDetail(payload.data);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : '加载规则详情失败'
      );
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
      const response = await fetch(
        `/api/admin/simulator/rule-versions/${selectedId}/publish`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            notes: 'Published from admin simulator rule center.',
          }),
        }
      );
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
        }))
      );
      setSuccess('规则版本已发布并切换为当前生效版本');
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : '发布规则版本失败'
      );
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
      setError(
        cloneError instanceof Error ? cloneError.message : '复制规则版本失败'
      );
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
      const response = await fetch(
        `/api/admin/simulator/rule-versions/${selectedId}/editable-sections`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            modifiers: modifierRows,
            skillBonuses: skillBonusRows,
            equipmentExtensionConfigs: equipmentExtensionRows.map((item) => ({
              id: item.id,
              configKey: item.configKey,
              value: item.value,
              enabled: item.enabled,
              sort: item.sort,
            })),
          }),
        }
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
            : item
        )
      );
      setSuccess('修正项、技能加成和装备扩展规则已保存');
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : '保存可编辑规则失败'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const patchModifierRow = (
    rowId: string,
    patch: Partial<DamageModifierRule>
  ) => {
    setModifierRows((current) =>
      current.map((item) => (item.id === rowId ? { ...item, ...patch } : item))
    );
  };

  const patchSkillBonusRow = (
    rowId: string,
    patch: Partial<DamageSkillBonusRule>
  ) => {
    setSkillBonusRows((current) =>
      current.map((item) => (item.id === rowId ? { ...item, ...patch } : item))
    );
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
          <div className="space-y-3 lg:sticky lg:top-6 lg:max-h-[calc(100vh-12rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
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
                    <span className="bg-muted text-foreground rounded-full px-2 py-0.5 text-[10px]">
                      {version.status}
                    </span>
                  )}
                </div>
                <div className="text-muted-foreground text-xs">
                  {version.versionCode}
                </div>
                <div className="text-muted-foreground mt-3 grid grid-cols-2 gap-2 text-xs">
                  <span>属性 {version.attributeRuleCount}</span>
                  <span>公式 {version.skillFormulaCount}</span>
                  <span>修正 {version.modifierCount}</span>
                  <span>加成 {version.skillBonusCount}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="rounded-xl border p-4">
            {isLoading && (
              <div className="text-muted-foreground text-sm">加载中...</div>
            )}

            {!isLoading && !detail && (
              <div className="text-muted-foreground text-sm">
                请选择一个规则版本查看详情。
              </div>
            )}

            {!isLoading && detail && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold">
                        {detail.version.versionName}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        {detail.version.versionCode} · {detail.version.status}
                      </div>
                    </div>
                    {detail.version.isActive ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
                        当前生效
                      </span>
                    ) : (
                      <span className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-xs">
                        未生效
                      </span>
                    )}
                  </div>
                  <div className="text-muted-foreground grid gap-2 text-sm md:grid-cols-2">
                    <div>来源文档：{detail.version.sourceDocUrl || '-'}</div>
                    <div>
                      发布时间：{formatDate(detail.version.publishedAt)}
                    </div>
                    <div>创建人：{detail.version.createdBy || '-'}</div>
                    <div>发布人：{detail.version.publishedBy || '-'}</div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <div className="mb-2 text-sm font-medium">属性转化</div>
                    <div className="text-muted-foreground space-y-1 text-xs">
                      {detail.attributeConversions.map((item) => (
                        <div key={item.id}>
                          {item.sourceAttr} → {item.targetAttr} ={' '}
                          {item.coefficient}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="mb-2 text-sm font-medium">技能公式</div>
                    <div className="text-muted-foreground space-y-1 text-xs">
                      {detail.skillFormulas.map((item) => (
                        <div key={item.id}>
                          {item.skillName} ({item.skillCode}) ·{' '}
                          {item.formulaKey}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">伤害修正项</div>
                      <div className="text-muted-foreground text-xs">
                        维护阵法、五行、卡片等会影响最终伤害的修正。
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!canEdit}
                      onClick={() =>
                        setModifierRows((current) => [
                          ...current,
                          createBlankModifier(),
                        ])
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      添加修正项
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {modifierRows.length === 0 ? (
                      <div className="text-muted-foreground text-sm">
                        当前版本没有修正项。
                      </div>
                    ) : (
                      modifierRows.map((item, index) => (
                        <div key={item.id} className="rounded-lg border p-3">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="text-sm font-medium">
                              修正项 {index + 1}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={!canEdit}
                              onClick={() =>
                                setModifierRows((current) =>
                                  current.filter((row) => row.id !== item.id)
                                )
                              }
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除
                            </Button>
                          </div>
                          <div className="grid gap-3 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label
                                htmlFor={buildFieldId(
                                  item.id,
                                  'modifier-domain'
                                )}
                              >
                                规则域
                              </Label>
                              <Input
                                id={buildFieldId(item.id, 'modifier-domain')}
                                value={item.modifierDomain}
                                disabled={!canEdit}
                                onChange={(event) =>
                                  patchModifierRow(item.id, {
                                    modifierDomain: event.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label
                                htmlFor={buildFieldId(item.id, 'modifier-key')}
                              >
                                规则键
                              </Label>
                              <Input
                                id={buildFieldId(item.id, 'modifier-key')}
                                value={item.modifierKey}
                                disabled={!canEdit}
                                onChange={(event) =>
                                  patchModifierRow(item.id, {
                                    modifierKey: event.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label
                                htmlFor={buildFieldId(item.id, 'modifier-type')}
                              >
                                生效方式
                              </Label>
                              <Input
                                id={buildFieldId(item.id, 'modifier-type')}
                                value={item.modifierType}
                                disabled={!canEdit}
                                onChange={(event) =>
                                  patchModifierRow(item.id, {
                                    modifierType: event.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label
                                htmlFor={buildFieldId(item.id, 'source-key')}
                              >
                                来源
                              </Label>
                              <Input
                                id={buildFieldId(item.id, 'source-key')}
                                value={item.sourceKey}
                                disabled={!canEdit}
                                onChange={(event) =>
                                  patchModifierRow(item.id, {
                                    sourceKey: event.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label
                                htmlFor={buildFieldId(item.id, 'target-key')}
                              >
                                目标
                              </Label>
                              <Input
                                id={buildFieldId(item.id, 'target-key')}
                                value={item.targetKey}
                                disabled={!canEdit}
                                onChange={(event) =>
                                  patchModifierRow(item.id, {
                                    targetKey: event.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={buildFieldId(item.id, 'value')}>
                                数值
                              </Label>
                              <Input
                                id={buildFieldId(item.id, 'value')}
                                type="number"
                                value={item.value}
                                disabled={!canEdit}
                                onChange={(event) =>
                                  patchModifierRow(item.id, {
                                    value: toNumber(event.target.value),
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">技能加成</div>
                      <div className="text-muted-foreground text-xs">
                        维护指定技能的等级、倍率或额外数值加成。
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!canEdit}
                      onClick={() =>
                        setSkillBonusRows((current) => [
                          ...current,
                          createBlankSkillBonus(),
                        ])
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      添加技能加成
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {skillBonusRows.length === 0 ? (
                      <div className="text-muted-foreground text-sm">
                        当前版本没有技能加成。
                      </div>
                    ) : (
                      skillBonusRows.map((item, index) => (
                        <div key={item.id} className="rounded-lg border p-3">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="text-sm font-medium">
                              技能加成 {index + 1}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={!canEdit}
                              onClick={() =>
                                setSkillBonusRows((current) =>
                                  current.filter((row) => row.id !== item.id)
                                )
                              }
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除
                            </Button>
                          </div>
                          <div className="grid gap-3 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label
                                htmlFor={buildFieldId(item.id, 'rule-code')}
                              >
                                规则编码
                              </Label>
                              <Input
                                id={buildFieldId(item.id, 'rule-code')}
                                value={item.ruleCode}
                                disabled={!canEdit}
                                onChange={(event) =>
                                  patchSkillBonusRow(item.id, {
                                    ruleCode: event.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label
                                htmlFor={buildFieldId(item.id, 'skill-code')}
                              >
                                技能编码
                              </Label>
                              <Input
                                id={buildFieldId(item.id, 'skill-code')}
                                value={item.skillCode}
                                disabled={!canEdit}
                                onChange={(event) =>
                                  patchSkillBonusRow(item.id, {
                                    skillCode: event.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label
                                htmlFor={buildFieldId(item.id, 'skill-name')}
                              >
                                技能名称
                              </Label>
                              <Input
                                id={buildFieldId(item.id, 'skill-name')}
                                value={item.skillName}
                                disabled={!canEdit}
                                onChange={(event) =>
                                  patchSkillBonusRow(item.id, {
                                    skillName: event.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label
                                htmlFor={buildFieldId(item.id, 'bonus-type')}
                              >
                                加成类型
                              </Label>
                              <Input
                                id={buildFieldId(item.id, 'bonus-type')}
                                value={item.bonusType}
                                disabled={!canEdit}
                                onChange={(event) =>
                                  patchSkillBonusRow(item.id, {
                                    bonusType: event.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label
                                htmlFor={buildFieldId(item.id, 'bonus-value')}
                              >
                                加成值
                              </Label>
                              <Input
                                id={buildFieldId(item.id, 'bonus-value')}
                                type="number"
                                value={item.bonusValue}
                                disabled={!canEdit}
                                onChange={(event) =>
                                  patchSkillBonusRow(item.id, {
                                    bonusValue: toNumber(event.target.value),
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label
                                htmlFor={buildFieldId(
                                  item.id,
                                  'conflict-policy'
                                )}
                              >
                                冲突处理
                              </Label>
                              <Input
                                id={buildFieldId(item.id, 'conflict-policy')}
                                value={item.conflictPolicy}
                                disabled={!canEdit}
                                onChange={(event) =>
                                  patchSkillBonusRow(item.id, {
                                    conflictPolicy: event.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium">装备扩展规则配置</div>
                    <div className="text-muted-foreground text-xs">
                      这里展示当前版本挂载的装备扩展配置。星相互合请到专门页面维护，其它配置暂不开放表单编辑。
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
                      <div
                        key={section.key}
                        className="space-y-2 rounded-lg border p-3"
                      >
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {section.title}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {section.description}
                          </div>
                        </div>
                        <div className="bg-muted/30 rounded-md px-3 py-2 text-sm">
                          {summarizeExtensionValue(
                            equipmentExtensionRows.find(
                              (item) => item.configKey === section.key
                            )?.value
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="mb-2 text-sm font-medium">发布日志</div>
                  <div className="text-muted-foreground space-y-2 text-xs">
                    {detail.publishLogs.length === 0 && <div>暂无发布日志</div>}
                    {detail.publishLogs.map((item) => (
                      <div key={item.id} className="bg-muted/40 rounded-md p-2">
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
        <div className="text-muted-foreground text-sm">
          {selectedVersion
            ? `当前查看版本：${selectedVersion.versionCode}`
            : '当前没有可查看的规则版本'}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {error && <span className="text-sm text-red-500">{error}</span>}
          {!error && success && (
            <span className="text-sm text-emerald-600">{success}</span>
          )}
          <Button
            onClick={handleClone}
            disabled={!canEdit || !selectedId || isCloning}
            variant="outline"
          >
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
            disabled={
              !canEdit ||
              !selectedId ||
              Boolean(detail?.version.isActive) ||
              isPublishing
            }
          >
            {isPublishing ? '发布中...' : '发布为当前版本'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
