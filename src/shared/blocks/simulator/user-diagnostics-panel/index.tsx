'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

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
import type { AdminSimulatorUserDiagnosticItem } from '@/shared/models/simulator-types';

type Props = {
  initialItems: AdminSimulatorUserDiagnosticItem[];
};

function formatDate(timestamp: number | null) {
  return formatDateTimeValue(timestamp, {
    locale: 'zh-CN',
    empty: '未记录',
  });
}

export function SimulatorUserDiagnosticsPanel({ initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(
    initialItems[0]?.characterId ?? null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedItem = useMemo(
    () => items.find((item) => item.characterId === selectedId) ?? null,
    [items, selectedId]
  );

  const handleSearch = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/simulator/user-diagnostics?keyword=${encodeURIComponent(
          keyword
        )}&limit=30`,
        {
          method: 'GET',
          cache: 'no-store',
        }
      );

      const payload = await response.json();
      if (!response.ok || payload?.code !== 0 || !Array.isArray(payload?.data)) {
        throw new Error(payload?.message || '读取用户排障数据失败');
      }

      setItems(payload.data);
      setSelectedId(payload.data[0]?.characterId ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '读取失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>用户 Simulator 数据排障</CardTitle>
        <CardDescription>
          按用户、邮箱或角色名查看当前角色、战斗参数、候选装备和实验室摘要，快速定位线上问题。
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="keyword"
                aria-label="搜索用户、邮箱、角色"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void handleSearch();
                  }
                }}
                className="pl-9"
                placeholder="搜索用户、邮箱、角色"
              />
            </div>
            <Button type="button" variant="outline" onClick={() => void handleSearch()} disabled={isLoading}>
              {isLoading ? '搜索中...' : '搜索'}
            </Button>
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {items.length === 0 ? (
            <div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
              当前没有匹配的用户记录。
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.characterId}
                type="button"
                onClick={() => setSelectedId(item.characterId)}
                className={`w-full rounded-lg border p-4 text-left transition ${
                  selectedId === item.characterId
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-primary/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-semibold">
                    {item.userName}
                  </div>
                  <Badge variant="outline">{item.school}</Badge>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {item.userEmail}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  角色：{item.characterName} · {item.roleType} · {item.level}级
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  候选 {item.candidateSummary.total} · 实验室{' '}
                  {item.labSummary.hasActiveSession ? '已开启' : '未开启'}
                </div>
              </button>
            ))
          )}
        </div>

        {selectedItem ? (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">
                {selectedItem.userName} · {selectedItem.characterName}
              </h3>
              <Badge variant="outline">{selectedItem.school}</Badge>
              <Badge variant="secondary">{selectedItem.roleType}</Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border p-3">
                <div className="font-medium">用户信息</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {selectedItem.userEmail}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  注册于 {formatDate(selectedItem.userCreatedAt)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  User ID: {selectedItem.userId}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="font-medium">角色与快照</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {selectedItem.characterName} · {selectedItem.level}级
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Character ID: {selectedItem.characterId}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Snapshot: {selectedItem.snapshotName || '未命名'} ·{' '}
                  {selectedItem.snapshotId || '缺失'}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border p-3">
                <div className="font-medium">当前属性摘要</div>
                {selectedItem.profileSummary ? (
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <div>气血：{selectedItem.profileSummary.hp}</div>
                    <div>魔法：{selectedItem.profileSummary.mp}</div>
                    <div>法伤：{selectedItem.profileSummary.magicDamage}</div>
                    <div>法防：{selectedItem.profileSummary.magicDefense}</div>
                    <div>速度：{selectedItem.profileSummary.speed}</div>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-muted-foreground">
                    当前没有角色属性快照。
                  </div>
                )}
              </div>
              <div className="rounded-lg border p-3">
                <div className="font-medium">战斗参数摘要</div>
                {selectedItem.battleContextSummary ? (
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <div>
                      我方：{selectedItem.battleContextSummary.selfFormation} ·{' '}
                      {selectedItem.battleContextSummary.selfElement}
                    </div>
                    <div>
                      目标：{selectedItem.battleContextSummary.targetName} ·{' '}
                      {selectedItem.battleContextSummary.targetFormation}
                    </div>
                    <div>
                      五行：{selectedItem.battleContextSummary.targetElement || '未设置'}
                    </div>
                    <div>
                      法防：{selectedItem.battleContextSummary.targetMagicDefense}
                    </div>
                    <div>
                      分灵目标数：{selectedItem.battleContextSummary.splitTargetCount}
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-muted-foreground">
                    当前没有战斗参数快照。
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border p-3">
                <div className="font-medium">候选装备摘要</div>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <div>总数：{selectedItem.candidateSummary.total}</div>
                  <div>待确认：{selectedItem.candidateSummary.pending}</div>
                  <div>已入库：{selectedItem.candidateSummary.confirmed}</div>
                  <div>已替换：{selectedItem.candidateSummary.replaced}</div>
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="font-medium">实验室摘要</div>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <div>
                    状态：{selectedItem.labSummary.hasActiveSession ? '已开启' : '未开启'}
                  </div>
                  <div>
                    会话：{selectedItem.labSummary.sessionName || '当前没有实验室会话'}
                  </div>
                  <div>对比席位：{selectedItem.labSummary.compareSeatCount}</div>
                  <div>
                    更新时间：{formatDate(selectedItem.labSummary.updatedAt)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
            选择一位用户查看 simulator 数据摘要。
          </div>
        )}
      </CardContent>
    </Card>
  );
}
