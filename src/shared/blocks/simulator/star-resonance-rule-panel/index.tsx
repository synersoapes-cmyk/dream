'use client';

import { useMemo, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';

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
import { formatDateTimeValue } from '@/shared/lib/date';
import type { AdminSimulatorStarResonanceRuleItem } from '@/shared/models/simulator-types';

type Props = {
  canEdit?: boolean;
  initialItems: AdminSimulatorStarResonanceRuleItem[];
};

type EditableItem = AdminSimulatorStarResonanceRuleItem;

function createBlankItem(): EditableItem {
  return {
    id: '__new__',
    scope: 'system',
    slot: 'weapon',
    comboName: '',
    requiredColors: [],
    bonusAttrType: '',
    bonusAttrValue: 0,
    globalBonus: { fullSetAttributeBonus: 2 },
    sort: 0,
    enabled: true,
    notes: '',
    createdAt: 0,
    updatedAt: 0,
  };
}

function sortItems(items: EditableItem[]) {
  return [...items].sort((left, right) => {
    if (left.enabled !== right.enabled) {
      return left.enabled ? -1 : 1;
    }

    if (left.sort !== right.sort) {
      return left.sort - right.sort;
    }

    if (left.slot !== right.slot) {
      return left.slot.localeCompare(right.slot, 'zh-CN');
    }

    return left.comboName.localeCompare(right.comboName, 'zh-CN');
  });
}

function formatDate(timestamp: number) {
  return formatDateTimeValue(timestamp, {
    locale: 'zh-CN',
    empty: '未记录',
  });
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function SimulatorStarResonanceRulePanel({
  canEdit = false,
  initialItems,
}: Props) {
  const [items, setItems] = useState(sortItems(initialItems));
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState(
    initialItems[0]?.id ?? '__new__'
  );
  const [isCreating, setIsCreating] = useState(initialItems.length === 0);
  const [draftItem, setDraftItem] = useState<EditableItem>(createBlankItem());
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
      [item.slot, item.comboName, item.bonusAttrType, item.notes]
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

  const handleSelect = (id: string) => {
    setIsCreating(false);
    setSelectedId(id);
    setNotice(null);
    setError(null);
  };

  const handleCreate = () => {
    const blank = createBlankItem();
    setIsCreating(true);
    setDraftItem(blank);
    setSelectedId('__new__');
    setNotice(null);
    setError(null);
  };

  const patchGlobalBonusNumber = (key: string, value: string) => {
    if (!currentItem) {
      return;
    }

    patchCurrentItem({
      globalBonus: {
        ...(currentItem.globalBonus ?? {}),
        [key]: toNumber(value),
      },
    });
  };

  const getGlobalBonusNumber = (key: string) => {
    const value = currentItem?.globalBonus?.[key];
    return typeof value === 'number' ? value : 0;
  };

  const handleSave = async () => {
    if (!currentItem || !canEdit) {
      return;
    }

    setIsSaving(true);
    setNotice(null);
    setError(null);

    const payload = {
      scope: currentItem.scope,
      slot: currentItem.slot,
      comboName: currentItem.comboName,
      requiredColors: currentItem.requiredColors,
      bonusAttrType: currentItem.bonusAttrType,
      bonusAttrValue: currentItem.bonusAttrValue,
      globalBonus: currentItem.globalBonus ?? {},
      sort: currentItem.sort,
      enabled: currentItem.enabled,
      notes: currentItem.notes,
    };

    try {
      const response = await fetch(
        isCreating
          ? '/api/admin/simulator/star-resonance-rules'
          : `/api/admin/simulator/star-resonance-rules/${currentItem.id}`,
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
        throw new Error(result?.message || '保存星相互合规则失败');
      }

      const saved = result.data as AdminSimulatorStarResonanceRuleItem;
      setItems((current) =>
        sortItems([...current.filter((item) => item.id !== saved.id), saved])
      );
      setSelectedId(saved.id);
      setIsCreating(false);
      setNotice('星相互合规则已保存');
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : '保存星相互合规则失败'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem || isCreating || !canEdit) {
      return;
    }

    const confirmed = window.confirm(
      `确认删除规则「${selectedItem.comboName}」吗？`
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/simulator/star-resonance-rules/${selectedItem.id}`,
        {
          method: 'DELETE',
        }
      );
      const result = await response.json();
      if (!response.ok || result?.code !== 0) {
        throw new Error(result?.message || '删除星相互合规则失败');
      }

      const nextItems = items.filter((item) => item.id !== selectedItem.id);
      setItems(nextItems);
      if (nextItems[0]) {
        setSelectedId(nextItems[0].id);
      } else {
        handleCreate();
      }
      setNotice('星相互合规则已删除');
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : '删除星相互合规则失败'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="lg:sticky lg:top-6 lg:self-start">
        <CardHeader>
          <CardTitle>规则列表</CardTitle>
          <CardDescription>按部位、组合名和启用状态快速筛选。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={keyword}
            placeholder="搜索部位 / 组合名 / 说明"
            onChange={(event) => setKeyword(event.target.value)}
          />
          <Button
            type="button"
            className="w-full"
            onClick={handleCreate}
            disabled={!canEdit}
          >
            <Plus className="mr-2 h-4 w-4" />
            新建规则
          </Button>
          <div className="space-y-2 lg:max-h-[calc(100vh-17rem)] lg:overflow-y-auto lg:pr-1">
            {filteredItems.map((item) => {
              const isActive = !isCreating && selectedId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                    isActive
                      ? 'border-cyan-500 bg-cyan-950/30'
                      : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold text-slate-100">
                      {item.comboName}
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        item.enabled ? 'text-emerald-300' : 'text-slate-400'
                      }
                    >
                      {item.enabled ? '启用' : '停用'}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {item.slot} · {item.requiredColors.join(' / ')}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {isCreating ? '新建星相互合规则' : '编辑星相互合规则'}
          </CardTitle>
          <CardDescription>
            单件奖励用于当前部位命中时加成，全套奖励用于六件都命中后的额外加成。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!currentItem ? (
            <div className="text-sm text-slate-400">
              请选择一条规则开始编辑。
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>部位</Label>
                  <Input
                    value={currentItem.slot}
                    onChange={(event) =>
                      patchCurrentItem({ slot: event.target.value })
                    }
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label>组合名</Label>
                  <Input
                    value={currentItem.comboName}
                    onChange={(event) =>
                      patchCurrentItem({ comboName: event.target.value })
                    }
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label>单件奖励属性</Label>
                  <Input
                    value={currentItem.bonusAttrType}
                    onChange={(event) =>
                      patchCurrentItem({ bonusAttrType: event.target.value })
                    }
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label>单件奖励值</Label>
                  <Input
                    value={String(currentItem.bonusAttrValue)}
                    onChange={(event) =>
                      patchCurrentItem({
                        bonusAttrValue: toNumber(event.target.value),
                      })
                    }
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>所需颜色</Label>
                  <Input
                    value={currentItem.requiredColors.join(',')}
                    onChange={(event) =>
                      patchCurrentItem({
                        requiredColors: event.target.value
                          .split(',')
                          .map((item) => item.trim())
                          .filter(Boolean),
                      })
                    }
                    disabled={!canEdit}
                    placeholder="例如：白,红,黄,蓝,绿"
                  />
                </div>
                <div className="space-y-2">
                  <Label>排序</Label>
                  <Input
                    value={String(currentItem.sort)}
                    onChange={(event) =>
                      patchCurrentItem({ sort: toNumber(event.target.value) })
                    }
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label>启用状态</Label>
                  <button
                    type="button"
                    className={`inline-flex h-10 items-center rounded-md border px-3 text-sm ${currentItem.enabled ? 'border-emerald-700/50 text-emerald-300' : 'border-slate-700 text-slate-400'}`}
                    onClick={() =>
                      canEdit &&
                      patchCurrentItem({ enabled: !currentItem.enabled })
                    }
                    disabled={!canEdit}
                  >
                    {currentItem.enabled ? '已启用' : '已停用'}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>六件全套奖励</Label>
                <div className="grid gap-4 rounded-lg border p-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>全基础属性 +</Label>
                    <Input
                      type="number"
                      value={String(
                        getGlobalBonusNumber('fullSetAttributeBonus')
                      )}
                      onChange={(event) =>
                        patchGlobalBonusNumber(
                          'fullSetAttributeBonus',
                          event.target.value
                        )
                      }
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>额外法伤 +</Label>
                    <Input
                      type="number"
                      value={String(
                        getGlobalBonusNumber('fullSetMagicDamageBonus')
                      )}
                      onChange={(event) =>
                        patchGlobalBonusNumber(
                          'fullSetMagicDamageBonus',
                          event.target.value
                        )
                      }
                      disabled={!canEdit}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>备注</Label>
                <Textarea
                  value={currentItem.notes}
                  onChange={(event) =>
                    patchCurrentItem({ notes: event.target.value })
                  }
                  disabled={!canEdit}
                />
              </div>

              {!isCreating && (
                <div className="text-xs text-slate-400">
                  创建时间：{formatDate(currentItem.createdAt)}
                  <br />
                  更新时间：{formatDate(currentItem.updatedAt)}
                </div>
              )}

              {notice && (
                <div className="text-sm text-emerald-400">{notice}</div>
              )}
              {error && <div className="text-sm text-red-400">{error}</div>}

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={!canEdit || isSaving}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? '保存中...' : '保存规则'}
                </Button>
                {!isCreating && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDelete}
                    disabled={!canEdit || isDeleting}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {isDeleting ? '删除中...' : '删除规则'}
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
