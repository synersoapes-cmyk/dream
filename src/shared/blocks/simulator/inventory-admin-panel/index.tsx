'use client';

import { useState } from 'react';

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

type InventoryEntryItem = {
  id: string;
  characterId: string;
  characterName: string;
  userId: string;
  userName: string;
  userEmail: string;
  itemType: string;
  itemRefId: string;
  sourceCandidateId: string | null;
  sourceDraftId: string | null;
  folderKey: string;
  price: number | null;
  status: string;
  createdAt: number;
  updatedAt: number;
  equipmentName: string;
  equipmentType: string;
  candidateStatus: string | null;
};

type InventoryStatus = 'all' | 'active' | 'sold' | 'discarded';

const STATUS_LABELS: Record<InventoryStatus, string> = {
  all: '全部',
  active: '已入库',
  sold: '已售出',
  discarded: '已作废',
};

function formatTimestamp(timestamp: number) {
  return formatDateTimeValue(timestamp, {
    locale: 'zh-CN',
    empty: '未记录',
  });
}

function formatPrice(price: number | null) {
  if (price === null || price === undefined) {
    return '未填写';
  }

  return `${price.toLocaleString('zh-CN')} 梦幻币`;
}

export function SimulatorInventoryAdminPanel({
  initialItems,
  canEdit = false,
}: {
  initialItems: InventoryEntryItem[];
  canEdit?: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [activeStatus, setActiveStatus] = useState<InventoryStatus>('all');
  const [keyword, setKeyword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = async (status: InventoryStatus, nextKeyword = keyword) => {
    setIsLoading(true);
    setError(null);
    setNotice(null);

    try {
      const query = new URLSearchParams({
        status,
        limit: '200',
      });
      if (nextKeyword.trim()) {
        query.set('keyword', nextKeyword.trim());
      }
      const response = await fetch(`/api/admin/simulator/inventory?${query}`, {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = await response.json();
      if (
        !response.ok ||
        payload?.code !== 0 ||
        !Array.isArray(payload?.data)
      ) {
        throw new Error(payload?.message || '读取入库台账失败');
      }

      setItems(payload.data);
      setActiveStatus(status);
      setKeyword(nextKeyword);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '读取失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (item: InventoryEntryItem) => {
    if (!canEdit) {
      return;
    }

    setSavingId(item.id);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/admin/simulator/inventory/${item.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            folderKey: item.folderKey,
            price: item.price,
            status: item.status,
          }),
        }
      );
      const payload = await response.json();
      if (!response.ok || payload?.code !== 0 || !payload?.data) {
        throw new Error(payload?.message || '保存入库台账失败');
      }

      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? payload.data : entry))
      );
      setNotice('入库台账已保存');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>正式入库台账</CardTitle>
        <CardDescription>
          这里展示候选装备确认后同步产生的正式库存记录，用于核对入库动作是否完成。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {(['all', 'active', 'sold', 'discarded'] as const).map((status) => (
            <Button
              key={status}
              type="button"
              variant={activeStatus === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => void handleLoad(status)}
              disabled={isLoading}
            >
              {STATUS_LABELS[status]}
            </Button>
          ))}
        </div>

        <div className="flex flex-col gap-3 md:flex-row">
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索用户、邮箱、角色、装备或分类键"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleLoad(activeStatus, keyword)}
            disabled={isLoading}
          >
            搜索
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border px-4 py-6 text-sm">
            当前筛选下还没有正式入库记录。
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="grid gap-3 rounded-lg border p-4 lg:grid-cols-[minmax(0,1.3fr)_180px_160px_160px_180px]"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium">{item.equipmentName}</div>
                    <Badge variant="outline">{item.status}</Badge>
                    {item.candidateStatus ? (
                      <Badge variant="outline">
                        候选:{item.candidateStatus}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    {item.userName} · {item.userEmail}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    角色：{item.characterName} · 类型：
                    {item.equipmentType || item.itemType}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    folder_key：{item.folderKey}
                  </div>
                  <div className="text-muted-foreground text-sm break-all">
                    正式资产：{item.itemRefId}
                  </div>
                  <div className="text-muted-foreground text-sm break-all">
                    候选来源：{item.sourceCandidateId || '无'}
                  </div>
                </div>
                <div className="text-sm">
                  <Label className="font-medium">价格</Label>
                  <Input
                    className="mt-2"
                    value={item.price ?? ''}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((entry) =>
                          entry.id === item.id
                            ? {
                                ...entry,
                                price: event.target.value
                                  ? Number(event.target.value) || 0
                                  : null,
                              }
                            : entry
                        )
                      )
                    }
                    disabled={!canEdit}
                    placeholder="留空表示未填写"
                  />
                  {!canEdit ? (
                    <div className="text-muted-foreground mt-2">
                      {formatPrice(item.price)}
                    </div>
                  ) : null}
                </div>
                <div className="text-sm">
                  <div className="font-medium">来源草稿</div>
                  <div className="text-muted-foreground mt-2 break-all">
                    {item.sourceDraftId || '无'}
                  </div>
                </div>
                <div className="text-sm">
                  <Label className="font-medium">分类键</Label>
                  <Input
                    className="mt-2"
                    value={item.folderKey}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((entry) =>
                          entry.id === item.id
                            ? { ...entry, folderKey: event.target.value }
                            : entry
                        )
                      )
                    }
                    disabled={!canEdit}
                  />
                  <div className="text-muted-foreground mt-2">
                    创建于 {formatTimestamp(item.createdAt)}
                  </div>
                </div>
                <div className="text-sm">
                  <Label className="font-medium">台账状态</Label>
                  <select
                    className={cn(
                      'border-input bg-background mt-2 flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none',
                      'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                      'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50'
                    )}
                    value={item.status}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((entry) =>
                          entry.id === item.id
                            ? {
                                ...entry,
                                status: event.target.value,
                              }
                            : entry
                        )
                      )
                    }
                    disabled={!canEdit}
                  >
                    <option value="active">已入库</option>
                    <option value="sold">已售出</option>
                    <option value="discarded">已作废</option>
                  </select>
                  <div className="text-muted-foreground mt-2">
                    更新于 {formatTimestamp(item.updatedAt)}
                  </div>
                  {canEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => void handleSave(item)}
                      disabled={savingId === item.id}
                    >
                      {savingId === item.id ? '保存中...' : '保存'}
                    </Button>
                  ) : null}
                  {canEdit && item.status !== 'active' ? (
                    <div className="text-muted-foreground mt-2 text-xs">
                      台账状态改为{item.status === 'sold' ? '已售出' : '已作废'}
                      后， 候选装备会同步标记为 `replaced`。
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

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
