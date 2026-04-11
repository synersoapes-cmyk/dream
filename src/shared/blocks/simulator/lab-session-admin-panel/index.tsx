'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { formatDateTimeValue } from '@/shared/lib/date';
import type { AdminSimulatorLabSessionItem } from '@/shared/models/simulator-types';

type Props = {
  initialItems: AdminSimulatorLabSessionItem[];
};

function formatDate(timestamp: number) {
  return formatDateTimeValue(timestamp, {
    locale: 'zh-CN',
    empty: '未记录',
  });
}

export function SimulatorLabSessionAdminPanel({ initialItems }: Props) {
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState(
    initialItems[0]?.sessionId ?? null
  );

  const filteredItems = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return initialItems;
    }

    return initialItems.filter((item) => {
      const haystack = [
        item.sessionName,
        item.characterName,
        item.userName,
        item.userEmail,
        item.notes,
        ...item.seats.flatMap((seat) => [seat.name, ...seat.equipmentNames]),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [initialItems, keyword]);

  const selectedItem = useMemo(
    () => filteredItems.find((item) => item.sessionId === selectedId) ?? null,
    [filteredItems, selectedId]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>实验室记录查看</CardTitle>
        <CardDescription>
          后台集中查看用户实验室会话、样本席位与对比席位，方便排查“为什么他算出来不对”。
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-3 lg:sticky lg:top-6 lg:self-start">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              name="keyword"
              aria-label="搜索用户、角色、实验室或装备"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="pl-9"
              placeholder="搜索用户、角色、实验室或装备"
            />
          </div>

          <div className="space-y-3 lg:max-h-[calc(100vh-15rem)] lg:overflow-y-auto lg:pr-1">
            {filteredItems.length === 0 ? (
              <div className="text-muted-foreground rounded-lg border px-4 py-6 text-sm">
                当前没有匹配的实验室记录。
              </div>
            ) : (
              filteredItems.map((item) => (
                <button
                  key={item.sessionId}
                  type="button"
                  onClick={() => setSelectedId(item.sessionId)}
                  className={`w-full rounded-lg border p-4 text-left transition ${
                    selectedId === item.sessionId
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold">
                      {item.sessionName}
                    </div>
                    <Badge variant="outline">{item.status}</Badge>
                  </div>
                  <div className="text-muted-foreground mt-2 text-xs">
                    {item.userName} · {item.userEmail}
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">
                    角色：{item.characterName}
                  </div>
                  <div className="text-muted-foreground mt-2 flex flex-wrap gap-2 text-xs">
                    <span>席位 {item.seatCount}</span>
                    <span>对比 {item.compareSeatCount}</span>
                    <span>{formatDate(item.updatedAt)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {selectedItem ? (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">
                {selectedItem.sessionName}
              </h3>
              <Badge variant="outline">{selectedItem.status}</Badge>
              <Badge variant="secondary">
                角色 {selectedItem.characterName}
              </Badge>
            </div>

            <div className="grid gap-3 text-sm md:grid-cols-2">
              <div className="rounded-lg border p-3">
                <div className="font-medium">用户信息</div>
                <div className="text-muted-foreground mt-2">
                  {selectedItem.userName} · {selectedItem.userEmail}
                </div>
                <div className="text-muted-foreground mt-1 text-xs">
                  User ID: {selectedItem.userId}
                </div>
                <div className="text-muted-foreground mt-1 text-xs">
                  Character ID: {selectedItem.characterId}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="font-medium">会话信息</div>
                <div className="text-muted-foreground mt-2">
                  创建于 {formatDate(selectedItem.createdAt)}
                </div>
                <div className="text-muted-foreground mt-1">
                  更新于 {formatDate(selectedItem.updatedAt)}
                </div>
                <div className="text-muted-foreground mt-1 text-xs">
                  Baseline Snapshot: {selectedItem.baselineSnapshotId}
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <div className="font-medium">备注</div>
              <div className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">
                {selectedItem.notes || '当前没有备注。'}
              </div>
            </div>

            <div className="space-y-3">
              {selectedItem.seats.map((seat) => (
                <div key={seat.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium">{seat.name}</div>
                    <Badge variant={seat.isSample ? 'secondary' : 'outline'}>
                      {seat.isSample ? '样本席位' : '对比席位'}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      装备 {seat.equipmentCount}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {seat.equipmentNames.length > 0 ? (
                      seat.equipmentNames.map((name) => (
                        <Badge key={`${seat.id}-${name}`} variant="outline">
                          {name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        当前席位没有已命名装备快照。
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground rounded-lg border px-4 py-6 text-sm">
            选择一条实验室记录查看详情。
          </div>
        )}
      </CardContent>
    </Card>
  );
}
