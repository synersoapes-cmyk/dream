'use client';

import { useEffect, useMemo, useState } from 'react';

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
import { Textarea } from '@/shared/components/ui/textarea';
import { formatDateTimeValue } from '@/shared/lib/date';
import type {
  DamageRuleEquipmentExtensionConfig,
  DamageRuleVersionDetail,
  DamageRuleVersionListItem,
} from '@/shared/models/damage-rules';

type Props = {
  canEdit?: boolean;
  initialVersions: DamageRuleVersionListItem[];
  initialDetail: DamageRuleVersionDetail | null;
  starResonanceRuleCount: number;
};

const EDITABLE_CONFIG_SPECS = [
  {
    key: 'ornament_set_rules',
    title: '灵饰套装档位规则',
    description: '维护 4 件灵饰点化同名特效后的激活阈值、档位和每档效果。',
  },
  {
    key: 'regular_set_rules',
    title: '常规套装档位规则',
    description:
      '维护动物套 / 变身套等同名主装备套装的件数阈值、档位和属性效果。',
  },
  {
    key: 'jade_attribute_pool',
    title: '玉魄属性池',
    description: '维护各部位玉魄允许出现的固定值 / 百分比词条和上下限。',
  },
  {
    key: 'jade_percent_semantics',
    title: '玉魄百分比语义',
    description: '维护百分比词条在公式中的实际含义、生效时机与展示说明。',
  },
  {
    key: 'rune_stone_rules',
    title: 'PRD 符石基础属性',
    description: '维护 1-3 级符石颜色、名称和属性载荷。',
  },
  {
    key: 'star_stone_rules',
    title: 'PRD 星石基础属性',
    description: '维护星石类型、属性值和可翻转颜色。',
  },
  {
    key: 'rune_combo_rules',
    title: 'PRD 符石组合规则',
    description: '维护组合名称、颜色顺序、允许部位、效果和全身生效上限。',
  },
  {
    key: 'star_full_color_rules',
    title: 'PRD 星石全套同色奖励',
    description: '维护 6 件星位同色后的全套颜色奖励。',
  },
  {
    key: 'rune_optimizer_profiles',
    title: '符石默认最优解配置',
    description: '维护龙宫总伤目标、部位优先组合和符石属性权重。',
  },
] as const;

function formatDate(value: Date | number | string | null | undefined) {
  return formatDateTimeValue(value, {
    locale: 'zh-CN',
    empty: '-',
  });
}

function serializeConfigValue(value: unknown) {
  try {
    return JSON.stringify(value ?? [], null, 2);
  } catch {
    return '[]';
  }
}

function summarizeConfigValue(value: unknown) {
  if (Array.isArray(value)) {
    return `${value.length} 条`;
  }
  if (value && typeof value === 'object') {
    return `${Object.keys(value).length} 项`;
  }
  return '未配置';
}

export function EquipmentExtensionAdminPanel({
  canEdit = false,
  initialVersions,
  initialDetail,
  starResonanceRuleCount,
}: Props) {
  const [versions, setVersions] = useState(initialVersions);
  const [selectedId, setSelectedId] = useState(
    initialDetail?.version.id ??
      initialVersions.find((item) => item.isActive)?.id ??
      initialVersions[0]?.id ??
      ''
  );
  const [detail, setDetail] = useState<DamageRuleVersionDetail | null>(
    initialDetail
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!detail) {
      setDrafts({});
      return;
    }

    const nextDrafts = Object.fromEntries(
      detail.equipmentExtensionConfigs.map((item) => [
        item.configKey,
        serializeConfigValue(item.value),
      ])
    );
    setDrafts(nextDrafts);
  }, [detail]);

  const selectedVersion = useMemo(
    () => versions.find((item) => item.id === selectedId) ?? null,
    [versions, selectedId]
  );
  const canSaveCurrentVersion = Boolean(
    canEdit &&
      detail &&
      detail.version.status === 'draft' &&
      !detail.version.isActive
  );

  const loadDetail = async (versionId: string) => {
    setSelectedId(versionId);
    setIsLoading(true);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/simulator/rule-versions/${versionId}`
      );
      const payload = await response.json();
      if (!response.ok || payload?.code !== 0 || !payload?.data) {
        throw new Error(payload?.message || '读取规则详情失败');
      }

      setDetail(payload.data);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : '读取规则详情失败'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!detail || !selectedId || !canEdit) {
      return;
    }

    setIsSaving(true);
    setNotice(null);
    setError(null);

    try {
      const equipmentExtensionConfigs = detail.equipmentExtensionConfigs.map(
        (item) => {
          if (
            !EDITABLE_CONFIG_SPECS.some((spec) => spec.key === item.configKey)
          ) {
            return {
              id: item.id,
              configKey: item.configKey,
              value: item.value,
              enabled: item.enabled,
              sort: item.sort,
            };
          }

          const rawValue =
            drafts[item.configKey] ?? serializeConfigValue(item.value);
          return {
            id: item.id,
            configKey: item.configKey,
            value: JSON.parse(rawValue),
            enabled: item.enabled,
            sort: item.sort,
          };
        }
      );

      const response = await fetch(
        `/api/admin/simulator/rule-versions/${selectedId}/editable-sections`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            modifiers: detail.modifiers,
            skillBonuses: detail.skillBonuses,
            equipmentExtensionConfigs,
          }),
        }
      );
      const payload = await response.json();
      if (!response.ok || payload?.code !== 0 || !payload?.data) {
        throw new Error(payload?.message || '保存装备扩展规则失败');
      }

      setDetail(payload.data);
      setNotice('装备扩展规则已保存到当前规则版本');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedId || !canEdit) {
      return;
    }

    setIsPublishing(true);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/simulator/rule-versions/${selectedId}/publish`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            notes: 'Published from equipment extension admin page.',
          }),
        }
      );
      const payload = await response.json();
      if (!response.ok || payload?.code !== 0 || !payload?.data) {
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
      setNotice('当前规则版本已发布并切换为生效版本');
    } catch (publishError) {
      setError(
        publishError instanceof Error ? publishError.message : '发布失败'
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const handleClone = async () => {
    if (!selectedId || !canEdit) {
      return;
    }

    setIsCloning(true);
    setNotice(null);
    setError(null);

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
      if (!response.ok || payload?.code !== 0 || !payload?.data?.detail) {
        throw new Error(payload?.message || '复制规则版本失败');
      }

      setVersions(payload.data.versions ?? versions);
      setDetail(payload.data.detail);
      setSelectedId(payload.data.detail.version.id);
      setNotice('已基于当前版本复制出新的草稿版本');
    } catch (cloneError) {
      setError(cloneError instanceof Error ? cloneError.message : '复制失败');
    } finally {
      setIsCloning(false);
    }
  };

  const getConfig = (configKey: string) =>
    detail?.equipmentExtensionConfigs.find(
      (item) => item.configKey === configKey
    ) ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>装备扩展规则工作台</CardTitle>
        <CardDescription>
          在规则版本维度维护灵饰套装、常规套装、玉魄属性池与百分比语义；星相互合继续走独立工作台。
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-3 lg:sticky lg:top-6 lg:self-start">
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
                <span className="bg-muted rounded-full px-2 py-0.5 text-[10px]">
                  {version.isActive ? 'ACTIVE' : version.status}
                </span>
              </div>
              <div className="text-muted-foreground text-xs">
                {version.versionCode}
              </div>
              <div className="text-muted-foreground mt-2 text-xs">
                更新时间：{formatDate(version.updatedAt)}
              </div>
            </button>
          ))}
        </div>

        <div className="space-y-5">
          {isLoading ? (
            <div className="text-muted-foreground rounded-xl border px-4 py-8 text-sm">
              正在加载规则版本详情...
            </div>
          ) : null}

          {!isLoading && !detail ? (
            <div className="text-muted-foreground rounded-xl border px-4 py-8 text-sm">
              当前还没有可编辑的伤害规则版本。
            </div>
          ) : null}

          {!isLoading && detail ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border p-4">
                  <div className="text-sm font-medium">
                    {detail.version.versionName}
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">
                    {detail.version.versionCode} · {detail.version.status}
                  </div>
                  <div className="text-muted-foreground mt-3 space-y-1 text-sm">
                    <div>
                      当前状态：{detail.version.isActive ? '生效中' : '未生效'}
                    </div>
                    <div>创建人：{detail.version.createdBy || '-'}</div>
                    <div>发布人：{detail.version.publishedBy || '-'}</div>
                    <div>
                      发布时间：{formatDate(detail.version.publishedAt)}
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border p-4">
                  <div className="text-sm font-medium">星相互合工作台</div>
                  <div className="text-muted-foreground mt-2 text-sm">
                    星相互合规则已独立后台化，和星石链路共用正式表；这里保留联动入口，避免和玉魄
                    / 灵饰配置混在同一个大表单里。
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span className="rounded-full border px-2 py-1 text-xs">
                      {starResonanceRuleCount} 条
                    </span>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/admin/simulator/star-resonance-rules">
                        打开星相互合规则页
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                {EDITABLE_CONFIG_SPECS.map((spec) => {
                  const config = getConfig(spec.key);

                  return (
                    <div key={spec.key} className="rounded-xl border p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">
                            {spec.title}
                          </div>
                          <div className="text-muted-foreground mt-1 text-xs">
                            {spec.description}
                          </div>
                        </div>
                        <div className="text-muted-foreground text-xs">
                          当前摘要：{summarizeConfigValue(config?.value)}
                        </div>
                      </div>
                      <Textarea
                        value={drafts[spec.key] ?? '[]'}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [spec.key]: event.target.value,
                          }))
                        }
                        rows={12}
                        disabled={!canEdit}
                        className="font-mono text-xs"
                      />
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      </CardContent>
      <CardFooter className="justify-between">
        <div className="text-muted-foreground text-sm">
          {selectedVersion
            ? `当前查看版本：${selectedVersion.versionCode}`
            : '当前没有可查看的规则版本'}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {detail && !canSaveCurrentVersion ? (
            <span className="text-muted-foreground text-sm">
              当前版本已发布，只读查看。请先复制为草稿再编辑。
            </span>
          ) : null}
          {error ? <span className="text-sm text-red-500">{error}</span> : null}
          {!error && notice ? (
            <span className="text-sm text-emerald-600">{notice}</span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={handleClone}
            disabled={!canEdit || !selectedId || isCloning}
          >
            {isCloning ? '复制中...' : '复制为草稿'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSave}
            disabled={!canSaveCurrentVersion || !selectedId || isSaving}
          >
            {isSaving ? '保存中...' : '保存装备扩展'}
          </Button>
          <Button
            type="button"
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
