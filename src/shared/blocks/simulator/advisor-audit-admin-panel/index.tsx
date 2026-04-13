'use client';

import { useMemo, useState } from 'react';

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
import { formatDateTimeValue } from '@/shared/lib/date';
import type { AdminSimulatorAdvisorAuditItem } from '@/shared/models/simulator-types';

type Props = {
  initialItems: AdminSimulatorAdvisorAuditItem[];
};

type AuditStatus = 'all' | 'success' | 'failed';

const STATUS_LABELS: Record<AuditStatus, string> = {
  all: '全部',
  success: '成功',
  failed: '失败',
};

function formatDate(timestamp: number) {
  return formatDateTimeValue(timestamp, {
    locale: 'zh-CN',
    empty: '未记录',
  });
}

function formatJsonSummary(summary: Record<string, unknown>) {
  return JSON.stringify(summary, null, 2);
}

export function SimulatorAdvisorAuditAdminPanel({ initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [activeStatus, setActiveStatus] = useState<AuditStatus>('all');
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState(initialItems[0]?.id ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  const handleLoad = async (status = activeStatus, nextKeyword = keyword) => {
    setIsLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams({
        status,
        keyword: nextKeyword,
        limit: '100',
      });
      const response = await fetch(`/api/admin/simulator/advisor-audit?${query}`, {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok || payload?.code !== 0 || !Array.isArray(payload?.data)) {
        throw new Error(payload?.message || '读取顾问审计失败');
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>顾问问答审计</CardTitle>
        <CardDescription>
          查看用户提问、顾问回答、失败原因、命中模型和上下文摘要，便于后台排查与知识沉淀。
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-3 lg:sticky lg:top-6 lg:self-start">
          <div className="flex flex-wrap gap-2 rounded-lg border p-3">
            {(['all', 'success', 'failed'] as const).map((status) => (
              <Button
                key={status}
                type="button"
                variant={activeStatus === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => void handleLoad(status, keyword)}
                disabled={isLoading}
              >
                {STATUS_LABELS[status]}
              </Button>
            ))}
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索用户 / 角色 / 提问 / 模型"
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void handleLoad(activeStatus, keyword)}
              disabled={isLoading}
            >
              {isLoading ? '查询中...' : '执行搜索'}
            </Button>
          </div>

          <div className="space-y-3 lg:max-h-[calc(100vh-18rem)] lg:overflow-y-auto lg:pr-1">
            {items.length === 0 ? (
              <div className="text-muted-foreground rounded-lg border px-4 py-6 text-sm">
                当前筛选条件下没有顾问审计记录。
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full rounded-lg border p-4 text-left transition ${
                    selectedId === item.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold">
                      {item.userName}
                      {item.characterName ? ` · ${item.characterName}` : ''}
                    </div>
                    <Badge variant="outline">
                      {item.status === 'success' ? '成功' : '失败'}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground mt-2 line-clamp-2 text-xs">
                    {item.question}
                  </div>
                  <div className="text-muted-foreground mt-2 text-xs">
                    {item.provider} / {item.model || '未记录模型'}
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">
                    {formatDate(item.createdAt)}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {selectedItem ? (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border p-4">
                <div className="text-sm font-medium">请求信息</div>
                <div className="text-muted-foreground mt-3 space-y-1 text-sm">
                  <div>用户：{selectedItem.userName}</div>
                  <div>邮箱：{selectedItem.userEmail}</div>
                  <div>角色：{selectedItem.characterName || '未绑定角色'}</div>
                  <div>状态：{selectedItem.status === 'success' ? '成功' : '失败'}</div>
                  <div>模型：{selectedItem.provider} / {selectedItem.model || '-'}</div>
                  <div>时间：{formatDate(selectedItem.createdAt)}</div>
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="text-sm font-medium">上下文摘要</div>
                <pre className="bg-muted/30 mt-3 overflow-x-auto rounded-lg p-3 text-xs leading-6">
                  {formatJsonSummary(selectedItem.contextSummary)}
                </pre>
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <div className="text-sm font-medium">用户问题</div>
              <div className="mt-3 rounded-lg border px-3 py-3 text-sm leading-7">
                {selectedItem.question}
              </div>
            </div>

            {selectedItem.status === 'success' ? (
              <div className="rounded-xl border p-4">
                <div className="text-sm font-medium">顾问回答</div>
                <div className="mt-3 rounded-lg border px-3 py-3 text-sm leading-7 whitespace-pre-wrap">
                  {selectedItem.answer || '未记录回答内容'}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-red-300/40 bg-red-50/40 p-4">
                <div className="text-sm font-medium text-red-600">失败原因</div>
                <div className="mt-3 text-sm text-red-600">
                  {selectedItem.errorMessage || '未记录失败原因'}
                </div>
              </div>
            )}

            <div className="rounded-xl border p-4">
              <div className="text-sm font-medium">最近对话上下文</div>
              <div className="mt-3 space-y-2">
                {selectedItem.history.length === 0 ? (
                  <div className="text-muted-foreground rounded-lg border px-3 py-4 text-sm">
                    本次请求没有附带历史消息。
                  </div>
                ) : (
                  selectedItem.history.map((message, index) => (
                    <div key={`${message.role}_${index}`} className="rounded-lg border px-3 py-3 text-sm">
                      <div className="text-muted-foreground mb-1 text-xs">
                        {message.role === 'user' ? '用户' : '顾问'}
                      </div>
                      <div className="whitespace-pre-wrap leading-7">{message.content}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border border-red-300/50 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-muted-foreground rounded-xl border px-4 py-8 text-sm">
            请选择一条顾问审计记录查看详情。
          </div>
        )}
      </CardContent>
    </Card>
  );
}
