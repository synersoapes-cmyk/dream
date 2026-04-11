'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

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
import { formatDateTimeValue } from '@/shared/lib/date';
import { cn } from '@/shared/lib/utils';

type DictionaryItem = {
  id: string;
  dictType: string;
  rawText: string;
  normalizedText: string;
  priority: number;
  enabled: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};

type DictType =
  | 'all'
  | 'equipment_name'
  | 'skill_name'
  | 'attr_name'
  | 'set_name';

type Props = {
  canEdit?: boolean;
  initialItems: DictionaryItem[];
};

const DICT_TYPE_LABELS: Record<DictType, string> = {
  all: '全部',
  equipment_name: '装备名',
  skill_name: '技能名',
  attr_name: '属性词',
  set_name: '套装词',
};

function formatTimestamp(timestamp: number) {
  return formatDateTimeValue(timestamp, {
    locale: 'zh-CN',
    empty: '未记录',
  });
}

export function SimulatorOcrDictionaryPanel({
  canEdit = false,
  initialItems,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [activeType, setActiveType] = useState<DictType>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    dictType: 'equipment_name',
    rawText: '',
    normalizedText: '',
    priority: 100,
    enabled: true,
  });

  const visibleItems = useMemo(() => {
    if (activeType === 'all') {
      return items;
    }

    return items.filter((item) => item.dictType === activeType);
  }, [activeType, items]);

  const handleLoad = async (dictType: DictType) => {
    setIsLoading(true);
    setError(null);
    setNotice(null);

    try {
      const query = new URLSearchParams({
        dictType,
        limit: '200',
      });
      const response = await fetch(
        `/api/admin/simulator/ocr-dictionary?${query}`,
        {
          method: 'GET',
          cache: 'no-store',
        }
      );
      const payload = await response.json();
      if (
        !response.ok ||
        payload?.code !== 0 ||
        !Array.isArray(payload?.data)
      ) {
        throw new Error(payload?.message || '读取 OCR 字典失败');
      }

      setItems(payload.data);
      setActiveType(dictType);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '读取失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!canEdit) {
      return;
    }

    setIsCreating(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch('/api/admin/simulator/ocr-dictionary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(draft),
      });
      const payload = await response.json();
      if (!response.ok || payload?.code !== 0 || !payload?.data) {
        throw new Error(payload?.message || '创建 OCR 字典失败');
      }

      setItems((current) => [payload.data, ...current]);
      setDraft({
        dictType: draft.dictType,
        rawText: '',
        normalizedText: '',
        priority: 100,
        enabled: true,
      });
      setNotice('OCR 字典已新增');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '创建失败');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSave = async (item: DictionaryItem) => {
    if (!canEdit) {
      return;
    }

    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/admin/simulator/ocr-dictionary/${item.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(item),
        }
      );
      const payload = await response.json();
      if (!response.ok || payload?.code !== 0 || !payload?.data) {
        throw new Error(payload?.message || '保存 OCR 字典失败');
      }

      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? payload.data : entry))
      );
      setNotice('OCR 字典已保存');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!canEdit) {
      return;
    }

    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/admin/simulator/ocr-dictionary/${id}`,
        {
          method: 'DELETE',
        }
      );
      const payload = await response.json();
      if (!response.ok || payload?.code !== 0) {
        throw new Error(payload?.message || '删除 OCR 字典失败');
      }

      setItems((current) => current.filter((item) => item.id !== id));
      setNotice('OCR 字典已删除');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除失败');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>OCR 纠错字典</CardTitle>
        <CardDescription>
          通过映射表统一修正装备名、属性词、套装词，减少 OCR 偶发误识别。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {(
            [
              'all',
              'equipment_name',
              'skill_name',
              'attr_name',
              'set_name',
            ] as const
          ).map((dictType) => (
            <Button
              key={dictType}
              type="button"
              variant={activeType === dictType ? 'default' : 'outline'}
              size="sm"
              onClick={() => void handleLoad(dictType)}
              disabled={isLoading}
            >
              {DICT_TYPE_LABELS[dictType]}
            </Button>
          ))}
        </div>

        <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="ocr-dict-type">字典类型</Label>
            <select
              id="ocr-dict-type"
              className={cn(
                'border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none',
                'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'
              )}
              value={draft.dictType}
              onChange={(e) =>
                setDraft((current) => ({
                  ...current,
                  dictType: e.target.value as Exclude<DictType, 'all'>,
                }))
              }
              disabled={!canEdit}
            >
              <option value="equipment_name">装备名</option>
              <option value="skill_name">技能名</option>
              <option value="attr_name">属性词</option>
              <option value="set_name">套装词</option>
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="ocr-dict-raw">OCR 原文</Label>
            <Input
              id="ocr-dict-raw"
              value={draft.rawText}
              onChange={(e) =>
                setDraft((current) => ({ ...current, rawText: e.target.value }))
              }
              disabled={!canEdit}
              placeholder="例如：晶凊诀"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="ocr-dict-normalized">标准文案</Label>
            <Input
              id="ocr-dict-normalized"
              value={draft.normalizedText}
              onChange={(e) =>
                setDraft((current) => ({
                  ...current,
                  normalizedText: e.target.value,
                }))
              }
              disabled={!canEdit}
              placeholder="例如：晶清诀"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ocr-dict-priority">优先级</Label>
            <Input
              id="ocr-dict-priority"
              value={String(draft.priority)}
              onChange={(e) =>
                setDraft((current) => ({
                  ...current,
                  priority: Number(e.target.value) || 0,
                }))
              }
              disabled={!canEdit}
            />
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2 md:self-end">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) =>
                setDraft((current) => ({
                  ...current,
                  enabled: e.target.checked,
                }))
              }
              disabled={!canEdit}
            />
            启用这条映射
          </label>
          <div className="md:col-span-2 md:self-end">
            <Button
              type="button"
              onClick={handleCreate}
              disabled={!canEdit || isCreating}
            >
              <Plus className="mr-2 h-4 w-4" />
              {isCreating ? '新增中...' : '新增映射'}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {visibleItems.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border px-4 py-6 text-sm">
              当前筛选下还没有 OCR 字典配置。
            </div>
          ) : (
            visibleItems.map((item) => (
              <div
                key={item.id}
                className="grid gap-3 rounded-lg border p-4 lg:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)_100px_110px_160px]"
              >
                <div className="space-y-2">
                  <Label>类型</Label>
                  <select
                    className={cn(
                      'border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none',
                      'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'
                    )}
                    value={item.dictType}
                    onChange={(e) =>
                      setItems((current) =>
                        current.map((entry) =>
                          entry.id === item.id
                            ? { ...entry, dictType: e.target.value }
                            : entry
                        )
                      )
                    }
                    disabled={!canEdit}
                  >
                    <option value="equipment_name">装备名</option>
                    <option value="skill_name">技能名</option>
                    <option value="attr_name">属性词</option>
                    <option value="set_name">套装词</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>OCR 原文</Label>
                  <Input
                    value={item.rawText}
                    onChange={(e) =>
                      setItems((current) =>
                        current.map((entry) =>
                          entry.id === item.id
                            ? { ...entry, rawText: e.target.value }
                            : entry
                        )
                      )
                    }
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label>标准文案</Label>
                  <Input
                    value={item.normalizedText}
                    onChange={(e) =>
                      setItems((current) =>
                        current.map((entry) =>
                          entry.id === item.id
                            ? { ...entry, normalizedText: e.target.value }
                            : entry
                        )
                      )
                    }
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label>优先级</Label>
                  <Input
                    value={String(item.priority)}
                    onChange={(e) =>
                      setItems((current) =>
                        current.map((entry) =>
                          entry.id === item.id
                            ? {
                                ...entry,
                                priority: Number(e.target.value) || 0,
                              }
                            : entry
                        )
                      )
                    }
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label>状态</Label>
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(e) =>
                        setItems((current) =>
                          current.map((entry) =>
                            entry.id === item.id
                              ? { ...entry, enabled: e.target.checked }
                              : entry
                          )
                        )
                      }
                      disabled={!canEdit}
                    />
                    {item.enabled ? '启用' : '停用'}
                  </label>
                </div>
                <div className="space-y-2">
                  <Label>操作</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{item.createdBy}</Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void handleSave(item)}
                      disabled={!canEdit}
                    >
                      保存
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void handleDelete(item.id)}
                      disabled={!canEdit}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      删除
                    </Button>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    更新于 {formatTimestamp(item.updatedAt)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {notice ? (
          <div className="rounded-lg border border-emerald-300/50 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm">
            {error}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
