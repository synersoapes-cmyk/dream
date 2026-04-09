'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';

import { formatDateTimeValue } from '@/shared/lib/date';
import { Badge } from '@/shared/components/ui/badge';
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
import { Textarea } from '@/shared/components/ui/textarea';
import type { AdminBattleTargetTemplateItem } from '@/shared/models/simulator';

type Props = {
  canEdit?: boolean;
  initialItems: AdminBattleTargetTemplateItem[];
};

type EditableItem = AdminBattleTargetTemplateItem;

const MANUAL_PAYLOAD_FIELDS: Array<{
  key:
    | 'magicDamage'
    | 'spiritualPower'
    | 'magicCritLevel'
    | 'hit'
    | 'fixedDamage'
    | 'pierceLevel'
    | 'elementalMastery'
    | 'block'
    | 'antiCritLevel'
    | 'sealResistLevel'
    | 'dodge'
    | 'elementalResistance';
  label: string;
}> = [
  { key: 'magicDamage', label: '法术伤害' },
  { key: 'spiritualPower', label: '灵力' },
  { key: 'magicCritLevel', label: '法暴等级' },
  { key: 'hit', label: '命中' },
  { key: 'fixedDamage', label: '固定伤害' },
  { key: 'pierceLevel', label: '穿刺等级' },
  { key: 'elementalMastery', label: '五行克制能力' },
  { key: 'block', label: '格挡值' },
  { key: 'antiCritLevel', label: '暴击等级' },
  { key: 'sealResistLevel', label: '抗封等级' },
  { key: 'dodge', label: '躲避' },
  { key: 'elementalResistance', label: '五行抵御能力' },
];

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildFieldId(...parts: Array<string | number>) {
  return parts
    .map((part) => String(part).replace(/[^a-zA-Z0-9_-]+/g, '-'))
    .join('-');
}

function formatDate(timestamp: number) {
  return formatDateTimeValue(timestamp, {
    locale: 'zh-CN',
    empty: '未记录',
  });
}

function sortTargetTemplates(items: EditableItem[]) {
  return [...items].sort((left, right) => {
    if (left.sceneType !== right.sceneType) {
      return left.sceneType.localeCompare(right.sceneType, 'zh-CN');
    }

    if (left.dungeonName !== right.dungeonName) {
      return left.dungeonName.localeCompare(right.dungeonName, 'zh-CN');
    }

    return left.name.localeCompare(right.name, 'zh-CN');
  });
}

function getPayloadNumber(item: EditableItem, key: string) {
  const value = item.payload?.[key];
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createBlankItem(): EditableItem {
  return {
    id: '__new__',
    userId: null,
    scope: 'system',
    sceneType: 'dungeon',
    name: '',
    dungeonName: '',
    targetType: 'mob',
    school: '',
    level: 0,
    hp: 0,
    defense: 0,
    magicDefense: 0,
    magicDefenseCultivation: 0,
    speed: 0,
    element: '',
    formation: '普通阵',
    notes: '',
    payload: {},
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
  };
}

export function SimulatorTargetTemplatePanel({
  canEdit = false,
  initialItems,
}: Props) {
  const [items, setItems] = useState(sortTargetTemplates(initialItems));
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(
    initialItems[0]?.id ?? '__new__'
  );
  const [draftItem, setDraftItem] = useState<EditableItem>(createBlankItem());
  const [isCreating, setIsCreating] = useState(initialItems.length === 0);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return items;
    }

    return items.filter((item) =>
      [item.name, item.dungeonName, item.school, item.element, item.notes]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    );
  }, [items, keyword]);

  const selectedItem = useMemo(
    () => filteredItems.find((item) => item.id === selectedId) ?? null,
    [filteredItems, selectedId]
  );

  const currentItem = isCreating ? draftItem : selectedItem;
  const currentItemKey = currentItem ? (isCreating ? 'new' : currentItem.id) : null;
  const currentFieldId = (field: string) =>
    buildFieldId('target-template', currentItemKey ?? 'empty', field);

  const patchCurrentPayload = (key: string, value: number) => {
    if (!currentItem) {
      return;
    }

    patchCurrentItem({
      payload: {
        ...currentItem.payload,
        [key]: value,
      },
    });
  };

  const patchCurrentItem = (patch: Partial<EditableItem>) => {
    if (isCreating) {
      setDraftItem((current) => ({ ...current, ...patch }));
      return;
    }

    if (!selectedItem) {
      return;
    }

    setItems((current) =>
      current.map((item) =>
        item.id === selectedItem.id ? { ...item, ...patch } : item
      )
    );
  };

  const handleCreate = () => {
    setIsCreating(true);
    setSelectedId('__new__');
    setDraftItem(createBlankItem());
    setNotice(null);
    setError(null);
  };

  const handleSelect = (id: string) => {
    setIsCreating(false);
    setSelectedId(id);
    setNotice(null);
    setError(null);
  };

  const handleSave = async () => {
    if (!currentItem || !canEdit) {
      return;
    }

    setIsSaving(true);
    setNotice(null);
    setError(null);

    const payload = {
      sceneType: currentItem.sceneType,
      name: currentItem.name,
      dungeonName: currentItem.dungeonName,
      targetType: currentItem.targetType,
      school: currentItem.school,
      level: currentItem.level,
      hp: currentItem.hp,
      defense: currentItem.defense,
      magicDefense: currentItem.magicDefense,
      magicDefenseCultivation: currentItem.magicDefenseCultivation,
      speed: currentItem.speed,
      element: currentItem.element,
      formation: currentItem.formation,
      notes: currentItem.notes,
      payload: currentItem.payload,
      enabled: currentItem.enabled,
    };

    try {
      const response = await fetch(
        isCreating
          ? '/api/admin/simulator/target-templates'
          : `/api/admin/simulator/target-templates/${currentItem.id}`,
        {
          method: isCreating ? 'POST' : 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();
      if (!response.ok || result?.code !== 0 || !result?.data) {
        throw new Error(result?.message || '保存目标模板失败');
      }

      const saved = result.data as AdminBattleTargetTemplateItem;
      setItems((current) => {
        const next = current.filter((item) => item.id !== saved.id);
        next.push(saved);
        return sortTargetTemplates(next);
      });
      setIsCreating(false);
      setSelectedId(saved.id);
      setNotice(isCreating ? '目标模板已创建' : '目标模板已保存');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem || !canEdit) {
      return;
    }

    setIsDeleting(true);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/simulator/target-templates/${selectedItem.id}`,
        {
          method: 'DELETE',
        }
      );
      const result = await response.json();
      if (!response.ok || result?.code !== 0) {
        throw new Error(result?.message || '删除目标模板失败');
      }

      const next = items.filter((item) => item.id !== selectedItem.id);
      setItems(next);
      setSelectedId(next[0]?.id ?? '__new__');
      setIsCreating(next.length === 0);
      if (next.length === 0) {
        setDraftItem(createBlankItem());
      }
      setNotice('目标模板已删除');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除失败');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>目标怪模板管理</CardTitle>
        <CardDescription>
          维护副本怪、法防、防御、五行和阵法预设，后续可直接回填到当前状态和实验室。
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="keyword"
                aria-label="搜索副本、目标名、门派"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="pl-9"
                placeholder="搜索副本、目标名、门派"
              />
            </div>
            <Button type="button" variant="outline" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              新建
            </Button>
          </div>

          {filteredItems.length === 0 && !isCreating ? (
            <div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
              当前没有匹配的目标模板。
            </div>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`w-full rounded-lg border p-4 text-left transition ${
                  !isCreating && selectedId === item.id
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-primary/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-semibold">
                    {item.dungeonName ? `${item.dungeonName} - ${item.name}` : item.name}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {item.sceneType === 'manual' ? '手动目标' : '副本目标'}
                    </Badge>
                    <Badge variant={item.enabled ? 'secondary' : 'outline'}>
                      {item.enabled ? '启用中' : '停用'}
                    </Badge>
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {item.targetType} · {item.level} 级 · {item.formation || '普通阵'}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  法防 {item.magicDefense} · 防御 {item.defense}
                </div>
              </button>
            ))
          )}
        </div>

        {currentItem ? (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">
                {isCreating ? '新建目标模板' : currentItem.name || '未命名模板'}
              </h3>
              <Badge variant={currentItem.enabled ? 'secondary' : 'outline'}>
                {currentItem.enabled ? '启用中' : '停用'}
              </Badge>
              {!isCreating ? (
                <span className="text-xs text-muted-foreground">
                  更新于 {formatDate(currentItem.updatedAt)}
                </span>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={currentFieldId('scene-type')}>用途</Label>
                <select
                  id={currentFieldId('scene-type')}
                  value={currentItem.sceneType}
                  onChange={(e) =>
                    patchCurrentItem({
                      sceneType: e.target.value === 'manual' ? 'manual' : 'dungeon',
                    })
                  }
                  disabled={!canEdit}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="dungeon">副本目标</option>
                  <option value="manual">手动目标</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={currentFieldId('name')}>目标名称</Label>
                <Input
                  id={currentFieldId('name')}
                  value={currentItem.name}
                  onChange={(e) => patchCurrentItem({ name: e.target.value })}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={currentFieldId('dungeon-name')}>副本名</Label>
                <Input
                  id={currentFieldId('dungeon-name')}
                  value={currentItem.dungeonName}
                  onChange={(e) =>
                    patchCurrentItem({ dungeonName: e.target.value })
                  }
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={currentFieldId('target-type')}>目标类型</Label>
                <Input
                  id={currentFieldId('target-type')}
                  value={currentItem.targetType}
                  onChange={(e) =>
                    patchCurrentItem({ targetType: e.target.value })
                  }
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={currentFieldId('school')}>门派</Label>
                <Input
                  id={currentFieldId('school')}
                  value={currentItem.school}
                  onChange={(e) => patchCurrentItem({ school: e.target.value })}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={currentFieldId('level')}>等级</Label>
                <Input
                  id={currentFieldId('level')}
                  value={String(currentItem.level)}
                  onChange={(e) => patchCurrentItem({ level: toNumber(e.target.value) })}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={currentFieldId('speed')}>速度</Label>
                <Input
                  id={currentFieldId('speed')}
                  value={String(currentItem.speed)}
                  onChange={(e) => patchCurrentItem({ speed: toNumber(e.target.value) })}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={currentFieldId('hp')}>气血</Label>
                <Input
                  id={currentFieldId('hp')}
                  value={String(currentItem.hp)}
                  onChange={(e) => patchCurrentItem({ hp: toNumber(e.target.value) })}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={currentFieldId('defense')}>防御</Label>
                <Input
                  id={currentFieldId('defense')}
                  value={String(currentItem.defense)}
                  onChange={(e) =>
                    patchCurrentItem({ defense: toNumber(e.target.value) })
                  }
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={currentFieldId('magic-defense')}>法防</Label>
                <Input
                  id={currentFieldId('magic-defense')}
                  value={String(currentItem.magicDefense)}
                  onChange={(e) =>
                    patchCurrentItem({ magicDefense: toNumber(e.target.value) })
                  }
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={currentFieldId('magic-defense-cultivation')}>
                  法防修炼
                </Label>
                <Input
                  id={currentFieldId('magic-defense-cultivation')}
                  value={String(currentItem.magicDefenseCultivation)}
                  onChange={(e) =>
                    patchCurrentItem({
                      magicDefenseCultivation: toNumber(e.target.value),
                    })
                  }
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={currentFieldId('element')}>五行</Label>
                <Input
                  id={currentFieldId('element')}
                  value={currentItem.element}
                  onChange={(e) => patchCurrentItem({ element: e.target.value })}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={currentFieldId('formation')}>阵法</Label>
                <Input
                  id={currentFieldId('formation')}
                  value={currentItem.formation}
                  onChange={(e) =>
                    patchCurrentItem({ formation: e.target.value })
                  }
                  disabled={!canEdit}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={currentFieldId('notes')}>备注</Label>
              <Textarea
                id={currentFieldId('notes')}
                value={currentItem.notes}
                onChange={(e) => patchCurrentItem({ notes: e.target.value })}
                disabled={!canEdit}
                rows={4}
              />
            </div>

            {currentItem.sceneType === 'manual' ? (
              <div className="space-y-3 rounded-lg border border-dashed p-4">
                <div>
                  <h4 className="text-sm font-semibold">手动目标扩展属性</h4>
                  <p className="text-xs text-muted-foreground">
                    这些字段会写入模板的 `payload_json`，首页手动目标页会直接读取。
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  {MANUAL_PAYLOAD_FIELDS.map(({ key, label }) => (
                    <div className="space-y-2" key={key}>
                      <Label htmlFor={currentFieldId(key)}>{label}</Label>
                      <Input
                        id={currentFieldId(key)}
                        value={String(getPayloadNumber(currentItem, key))}
                        onChange={(e) =>
                          patchCurrentPayload(key, toNumber(e.target.value))
                        }
                        disabled={!canEdit}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  name="enabled"
                  type="checkbox"
                  checked={currentItem.enabled}
                  onChange={(e) =>
                    patchCurrentItem({ enabled: e.target.checked })
                  }
                  disabled={!canEdit}
                />
                启用模板
              </label>
              <Button type="button" onClick={handleSave} disabled={!canEdit || isSaving}>
                {isSaving ? '保存中...' : isCreating ? '创建模板' : '保存模板'}
              </Button>
              {!isCreating ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDelete}
                  disabled={!canEdit || isDeleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isDeleting ? '删除中...' : '删除模板'}
                </Button>
              ) : null}
            </div>

            {notice ? (
              <div className="rounded-lg border border-emerald-300/50 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {notice}
              </div>
            ) : null}
            {error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
            选择一个目标模板查看详情，或新建一条模板。
          </div>
        )}
      </CardContent>
    </Card>
  );
}
