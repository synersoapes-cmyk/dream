'use client';

import { useMemo, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';

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

type ReviewItem = {
  id: string;
  characterId: string;
  characterName: string;
  userId: string;
  userName: string;
  userEmail: string;
  source: string;
  timestamp: number;
  imagePreview?: string;
  rawText?: string;
  status: 'pending' | 'confirmed' | 'replaced';
  equipment: Record<string, unknown>;
};

type Props = {
  canEdit?: boolean;
  initialItems: ReviewItem[];
};

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatTimestamp(timestamp: number) {
  return formatDateTimeValue(timestamp, {
    locale: 'zh-CN',
    empty: '未记录',
  });
}

function getPreviewImageSrc(imagePreview?: string) {
  if (!imagePreview) {
    return undefined;
  }

  if (/^https?:\/\//i.test(imagePreview)) {
    return `/api/proxy/file?url=${encodeURIComponent(imagePreview)}`;
  }

  if (imagePreview.startsWith('/')) {
    return imagePreview;
  }

  return `/api/proxy/file?key=${encodeURIComponent(imagePreview)}`;
}

export function SimulatorPendingReviewPanel({
  canEdit = false,
  initialItems,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [activeStatus, setActiveStatus] =
    useState<ReviewItem['status']>('pending');
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState(initialItems[0]?.id ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return items;
    }

    return items.filter((item) => {
      const haystack = [
        item.userName,
        item.userEmail,
        item.characterName,
        String(item.equipment.name || ''),
        String(item.equipment.mainStat || ''),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [items, keyword]);

  const selectedItem = useMemo(
    () => filteredItems.find((item) => item.id === selectedId) ?? null,
    [filteredItems, selectedId]
  );

  const handleLoad = async (status: ReviewItem['status']) => {
    setIsLoading(true);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/simulator/pending-equipment?status=${encodeURIComponent(
          status
        )}&limit=100`,
        {
          method: 'GET',
          cache: 'no-store',
        }
      );

      const payload = await response.json();
      if (!response.ok || payload?.code !== 0 || !Array.isArray(payload?.data)) {
        throw new Error(payload?.message || '读取候选装备失败');
      }

      setItems(payload.data);
      setActiveStatus(status);
      setSelectedId(payload.data[0]?.id ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '读取失败');
    } finally {
      setIsLoading(false);
    }
  };

  const updateSelectedItem = (updater: (item: ReviewItem) => ReviewItem) => {
    setItems((current) =>
      current.map((item) => (item.id === selectedId ? updater(item) : item))
    );
  };

  const handleSave = async () => {
    if (!selectedItem || !canEdit) {
      return;
    }

    setIsSaving(true);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/simulator/pending-equipment/${selectedItem.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: selectedItem.status,
            rawText: selectedItem.rawText,
            equipment: selectedItem.equipment,
          }),
        }
      );

      const payload = await response.json();
      if (!response.ok || payload?.code !== 0 || !payload?.data) {
        throw new Error(payload?.message || '保存审核结果失败');
      }

      setItems((current) =>
        current.map((item) =>
          item.id === selectedItem.id ? payload.data : item
        )
      );
      setNotice('审核结果已保存');
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
        `/api/admin/simulator/pending-equipment/${selectedItem.id}`,
        {
          method: 'DELETE',
        }
      );
      const payload = await response.json();
      if (!response.ok || payload?.code !== 0) {
        throw new Error(payload?.message || '删除失败');
      }

      const nextItems = items.filter((item) => item.id !== selectedItem.id);
      setItems(nextItems);
      setSelectedId(nextItems[0]?.id ?? null);
      setNotice('候选装备已删除');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除失败');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>OCR 审核与候选装备管理</CardTitle>
        <CardDescription>
          支持按状态查看候选装备，搜索用户与角色，查看原图、OCR 原文并直接修改记录。
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex flex-wrap gap-2">
              {(['pending', 'confirmed', 'replaced'] as const).map((status) => (
                <Button
                  key={status}
                  type="button"
                  variant={activeStatus === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => void handleLoad(status)}
                  disabled={isLoading}
                >
                  {status}
                </Button>
              ))}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="pl-9"
                placeholder="搜索用户、邮箱、角色或装备"
              />
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
              {items.length === 0 ? '当前没有匹配的候选装备。' : '当前筛选条件下没有结果。'}
            </div>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedId(item.id);
                  setNotice(null);
                  setError(null);
                }}
                className={`w-full rounded-lg border p-4 text-left transition ${
                  selectedId === item.id
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-primary/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-semibold">
                    {String(item.equipment.name || '未命名装备')}
                  </div>
                  <Badge variant="outline">{item.status}</Badge>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {item.userName} · {item.userEmail}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  角色：{item.characterName}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  来源：{item.source}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  时间：{formatTimestamp(item.timestamp)}
                </div>
              </button>
            ))
          )}
        </div>

        {selectedItem ? (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>装备名称</Label>
                <Input
                  value={String(selectedItem.equipment.name || '')}
                  onChange={(e) =>
                    updateSelectedItem((item) => ({
                      ...item,
                      equipment: { ...item.equipment, name: e.target.value },
                    }))
                  }
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label>状态</Label>
                <Input
                  value={selectedItem.status}
                  onChange={(e) =>
                    updateSelectedItem((item) => ({
                      ...item,
                      status: (e.target.value || 'pending') as ReviewItem['status'],
                    }))
                  }
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label>类型</Label>
                <Input
                  value={String(selectedItem.equipment.type || '')}
                  onChange={(e) =>
                    updateSelectedItem((item) => ({
                      ...item,
                      equipment: { ...item.equipment, type: e.target.value },
                    }))
                  }
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label>槽位</Label>
                <Input
                  value={String(selectedItem.equipment.slot ?? '')}
                  onChange={(e) =>
                    updateSelectedItem((item) => ({
                      ...item,
                      equipment: {
                        ...item.equipment,
                        slot: e.target.value ? toNumber(e.target.value) : undefined,
                      },
                    }))
                  }
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>主属性</Label>
                <Input
                  value={String(selectedItem.equipment.mainStat || '')}
                  onChange={(e) =>
                    updateSelectedItem((item) => ({
                      ...item,
                      equipment: { ...item.equipment, mainStat: e.target.value },
                    }))
                  }
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>附加描述</Label>
                <Input
                  value={String(selectedItem.equipment.extraStat || '')}
                  onChange={(e) =>
                    updateSelectedItem((item) => ({
                      ...item,
                      equipment: { ...item.equipment, extraStat: e.target.value },
                    }))
                  }
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label>价格</Label>
                <Input
                  value={String(selectedItem.equipment.price ?? '')}
                  onChange={(e) =>
                    updateSelectedItem((item) => ({
                      ...item,
                      equipment: {
                        ...item.equipment,
                        price: e.target.value ? toNumber(e.target.value) : undefined,
                      },
                    }))
                  }
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label>跨服费</Label>
                <Input
                  value={String(selectedItem.equipment.crossServerFee ?? '')}
                  onChange={(e) =>
                    updateSelectedItem((item) => ({
                      ...item,
                      equipment: {
                        ...item.equipment,
                        crossServerFee: e.target.value
                          ? toNumber(e.target.value)
                          : undefined,
                      },
                    }))
                  }
                  disabled={!canEdit}
                />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-2">
                <Label>OCR 原始文本</Label>
                <Textarea
                  rows={14}
                  value={selectedItem.rawText || ''}
                  onChange={(e) =>
                    updateSelectedItem((item) => ({
                      ...item,
                      rawText: e.target.value,
                    }))
                  }
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label>原图预览</Label>
                <div className="overflow-hidden rounded-lg border bg-muted/20">
                  {getPreviewImageSrc(selectedItem.imagePreview) ? (
                    <img
                      src={getPreviewImageSrc(selectedItem.imagePreview)}
                      alt={String(selectedItem.equipment.name || 'pending-equipment')}
                      className="h-auto w-full object-cover"
                    />
                  ) : (
                    <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                      暂无原图
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-sm">
                {error ? (
                  <span className="text-red-600">{error}</span>
                ) : notice ? (
                  <span className="text-emerald-600">{notice}</span>
                ) : (
                  <span className="text-muted-foreground">
                    当前修改会直接写回候选装备审核记录。
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDelete}
                  disabled={!canEdit || isDeleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isDeleting ? '删除中...' : '删除记录'}
                </Button>
                <Button onClick={handleSave} disabled={!canEdit || isSaving}>
                  {isSaving ? '保存中...' : '保存审核结果'}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
