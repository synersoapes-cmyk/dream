'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';

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
import { getSimulatorEquipmentFieldLabel } from '@/shared/lib/simulator-equipment-editor';
import { cn } from '@/shared/lib/utils';

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

type ReviewStatus = ReviewItem['status'] | 'all';

type Props = {
  canEdit?: boolean;
  initialItems: ReviewItem[];
  title?: string;
  description?: string;
  initialStatus?: ReviewStatus;
  availableStatuses?: ReviewStatus[];
  listEndpoint?: string;
  detailEndpointBase?: string;
  saveButtonLabel?: string;
  saveNotice?: string;
  emptyMessage?: string;
  loadLimit?: number;
  remoteSearch?: boolean;
};

const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  all: '全部',
  pending: '待确认',
  confirmed: '已确认',
  replaced: '已替换',
};

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildFieldId(...parts: Array<string | number>) {
  return parts
    .map((part) => String(part).replace(/[^a-zA-Z0-9_-]+/g, '-'))
    .join('-');
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
  title = '候选装备库管理',
  description = '支持按状态查看候选装备，搜索用户与角色，查看原图、OCR 原文并直接修改记录。',
  initialStatus = 'pending',
  availableStatuses = ['pending', 'confirmed', 'replaced'],
  listEndpoint = '/api/admin/simulator/candidate-equipment',
  detailEndpointBase = '/api/admin/simulator/candidate-equipment',
  saveButtonLabel = '保存候选装备',
  saveNotice = '当前修改会直接写回候选装备记录。',
  emptyMessage = '当前没有匹配的候选装备。',
  loadLimit = 100,
  remoteSearch = false,
}: Props) {
  const defaultActiveStatus = availableStatuses.includes(initialStatus)
    ? initialStatus
    : (availableStatuses[0] ?? 'pending');
  const [items, setItems] = useState(initialItems);
  const [activeStatus, setActiveStatus] =
    useState<ReviewStatus>(defaultActiveStatus);
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState(initialItems[0]?.id ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const didInitRemoteSearchRef = useRef(false);

  const filteredItems = useMemo(() => {
    if (remoteSearch) {
      return items;
    }

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
  }, [items, keyword, remoteSearch]);

  const selectedItem = useMemo(
    () => filteredItems.find((item) => item.id === selectedId) ?? null,
    [filteredItems, selectedId]
  );
  const selectedFieldId = (field: string) =>
    buildFieldId('candidate-equipment', selectedItem?.id ?? 'empty', field);

  const handleLoad = async (
    status: ReviewStatus,
    nextKeyword = keyword,
    options?: { preserveSelection?: boolean }
  ) => {
    setIsLoading(true);
    setNotice(null);
    setError(null);

    try {
      const query = new URLSearchParams();
      if (status !== 'all') {
        query.set('status', status);
      }
      if (remoteSearch) {
        const normalizedKeyword = nextKeyword.trim();
        if (normalizedKeyword) {
          query.set('keyword', normalizedKeyword);
        }
      }
      query.set('limit', String(loadLimit));

      const response = await fetch(`${listEndpoint}?${query.toString()}`, {
        method: 'GET',
        cache: 'no-store',
      });

      const payload = await response.json();
      if (
        !response.ok ||
        payload?.code !== 0 ||
        !Array.isArray(payload?.data)
      ) {
        throw new Error(payload?.message || '读取候选装备失败');
      }

      setItems(payload.data);
      setActiveStatus(status);
      setSelectedId((currentSelectedId) => {
        if (
          options?.preserveSelection &&
          currentSelectedId &&
          payload.data.some((item: ReviewItem) => item.id === currentSelectedId)
        ) {
          return currentSelectedId;
        }

        return payload.data[0]?.id ?? null;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '读取失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!remoteSearch) {
      return;
    }

    if (!didInitRemoteSearchRef.current) {
      didInitRemoteSearchRef.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      void handleLoad(activeStatus, keyword, { preserveSelection: true });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [activeStatus, keyword, remoteSearch]);

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
      const response = await fetch(`${detailEndpointBase}/${selectedItem.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: selectedItem.status,
          rawText: selectedItem.rawText,
          equipment: selectedItem.equipment,
        }),
      });

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
      const response = await fetch(`${detailEndpointBase}/${selectedItem.id}`, {
        method: 'DELETE',
      });
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
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex flex-wrap gap-2">
              {availableStatuses.map((status) => (
                <Button
                  key={status}
                  type="button"
                  variant={activeStatus === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    if (remoteSearch) {
                      setNotice(null);
                      setError(null);
                      setActiveStatus(status);
                      return;
                    }

                    void handleLoad(status);
                  }}
                  disabled={isLoading}
                >
                  {REVIEW_STATUS_LABELS[status]}
                </Button>
              ))}
            </div>
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                name="keyword"
                aria-label="搜索用户、邮箱、角色或装备"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="pl-9"
                placeholder={
                  remoteSearch
                    ? '搜索全部候选装备'
                    : '搜索用户、邮箱、角色或装备'
                }
              />
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border px-4 py-6 text-sm">
              {items.length === 0 ? emptyMessage : '当前筛选条件下没有结果。'}
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
                  <Badge variant="outline">
                    {REVIEW_STATUS_LABELS[item.status]}
                  </Badge>
                </div>
                <div className="text-muted-foreground mt-2 text-xs">
                  {item.userName} · {item.userEmail}
                </div>
                <div className="text-muted-foreground mt-1 text-xs">
                  角色：{item.characterName}
                </div>
                <div className="text-muted-foreground mt-1 text-xs">
                  来源：{item.source}
                </div>
                <div className="text-muted-foreground mt-1 text-xs">
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
                <Label htmlFor={selectedFieldId('name')}>装备名称</Label>
                <Input
                  id={selectedFieldId('name')}
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
                <Label htmlFor={selectedFieldId('status')}>状态</Label>
                <select
                  id={selectedFieldId('status')}
                  className={cn(
                    'border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none',
                    'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50'
                  )}
                  value={selectedItem.status}
                  onChange={(e) =>
                    updateSelectedItem((item) => ({
                      ...item,
                      status: (e.target.value ||
                        'pending') as ReviewItem['status'],
                    }))
                  }
                  disabled={!canEdit}
                >
                  <option value="pending">
                    {REVIEW_STATUS_LABELS.pending}
                  </option>
                  <option value="confirmed">
                    {REVIEW_STATUS_LABELS.confirmed}
                  </option>
                  <option value="replaced">
                    {REVIEW_STATUS_LABELS.replaced}
                  </option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={selectedFieldId('type')}>
                  {getSimulatorEquipmentFieldLabel('type')}
                </Label>
                <Input
                  id={selectedFieldId('type')}
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
                <Label htmlFor={selectedFieldId('slot')}>
                  {getSimulatorEquipmentFieldLabel('slot')}
                </Label>
                <Input
                  id={selectedFieldId('slot')}
                  value={String(selectedItem.equipment.slot ?? '')}
                  onChange={(e) =>
                    updateSelectedItem((item) => ({
                      ...item,
                      equipment: {
                        ...item.equipment,
                        slot: e.target.value
                          ? toNumber(e.target.value)
                          : undefined,
                      },
                    }))
                  }
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor={selectedFieldId('main-stat')}>
                  {getSimulatorEquipmentFieldLabel('mainStat')}
                </Label>
                <Input
                  id={selectedFieldId('main-stat')}
                  value={String(selectedItem.equipment.mainStat || '')}
                  onChange={(e) =>
                    updateSelectedItem((item) => ({
                      ...item,
                      equipment: {
                        ...item.equipment,
                        mainStat: e.target.value,
                      },
                    }))
                  }
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor={selectedFieldId('extra-stat')}>
                  {getSimulatorEquipmentFieldLabel('extraStat')}
                </Label>
                <Input
                  id={selectedFieldId('extra-stat')}
                  value={String(selectedItem.equipment.extraStat || '')}
                  onChange={(e) =>
                    updateSelectedItem((item) => ({
                      ...item,
                      equipment: {
                        ...item.equipment,
                        extraStat: e.target.value,
                      },
                    }))
                  }
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={selectedFieldId('price')}>
                  {getSimulatorEquipmentFieldLabel('price')}
                </Label>
                <Input
                  id={selectedFieldId('price')}
                  value={String(selectedItem.equipment.price ?? '')}
                  onChange={(e) =>
                    updateSelectedItem((item) => ({
                      ...item,
                      equipment: {
                        ...item.equipment,
                        price: e.target.value
                          ? toNumber(e.target.value)
                          : undefined,
                      },
                    }))
                  }
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={selectedFieldId('cross-server-fee')}>
                  {getSimulatorEquipmentFieldLabel('crossServerFee')}
                </Label>
                <Input
                  id={selectedFieldId('cross-server-fee')}
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
                <Label htmlFor={selectedFieldId('raw-text')}>
                  OCR 原始文本
                </Label>
                <Textarea
                  id={selectedFieldId('raw-text')}
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
                <div className="bg-muted/20 overflow-hidden rounded-lg border">
                  {getPreviewImageSrc(selectedItem.imagePreview) ? (
                    <img
                      src={getPreviewImageSrc(selectedItem.imagePreview)}
                      alt={String(
                        selectedItem.equipment.name || 'candidate-equipment'
                      )}
                      className="h-auto w-full object-cover"
                    />
                  ) : (
                    <div className="text-muted-foreground px-4 py-12 text-center text-sm">
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
                  <span className="text-muted-foreground">{saveNotice}</span>
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
                  {isSaving ? '保存中...' : saveButtonLabel}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
