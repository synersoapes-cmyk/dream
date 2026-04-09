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
import { formatDateTimeValue } from '@/shared/lib/date';

type OcrJobItem = {
  id: string;
  characterId: string;
  characterName: string;
  userId: string;
  userName: string;
  userEmail: string;
  sceneType: string;
  status: string;
  imageUrl: string;
  errorMessage: string;
  rawResult: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  draftItems: Array<{
    id: string;
    itemType: string;
    reviewStatus: string;
    confidenceScore: number;
    candidateStatus: string | null;
  }>;
};

type Props = {
  initialItems: OcrJobItem[];
};

type JobStatus = 'all' | 'pending' | 'success' | 'failed' | 'reviewing';

const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  all: '全部',
  pending: '排队中',
  success: '成功',
  failed: '失败',
  reviewing: '待审核',
};

function formatTimestamp(timestamp: number) {
  return formatDateTimeValue(timestamp, {
    locale: 'zh-CN',
    empty: '未记录',
  });
}

export function SimulatorOcrJobAdminPanel({ initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [activeStatus, setActiveStatus] = useState<JobStatus>('all');
  const [selectedId, setSelectedId] = useState(initialItems[0]?.id ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  const handleLoad = async (status: JobStatus) => {
    setIsLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams({
        status,
        limit: '100',
      });
      const response = await fetch(`/api/admin/simulator/ocr-jobs?${query}`, {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok || payload?.code !== 0 || !Array.isArray(payload?.data)) {
        throw new Error(payload?.message || '读取 OCR 任务失败');
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
        <CardTitle>OCR 任务链路</CardTitle>
        <CardDescription>
          查看上传识图任务的成功率、失败原因、原图地址以及草稿分发情况。
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 rounded-lg border p-3">
            {(['all', 'pending', 'success', 'failed', 'reviewing'] as const).map(
              (status) => (
                <Button
                  key={status}
                  type="button"
                  variant={activeStatus === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => void handleLoad(status)}
                  disabled={isLoading}
                >
                  {JOB_STATUS_LABELS[status]}
                </Button>
              )
            )}
          </div>

          {items.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border px-4 py-6 text-sm">
              当前筛选条件下没有 OCR 任务。
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
                    {item.characterName} · {item.sceneType}
                  </div>
                  <Badge variant="outline">{item.status}</Badge>
                </div>
                <div className="text-muted-foreground mt-2 text-xs">
                  {item.userName} · {item.userEmail}
                </div>
                <div className="text-muted-foreground mt-1 text-xs">
                  草稿数：{item.draftItems.length}
                </div>
                <div className="text-muted-foreground mt-1 text-xs">
                  更新时间：{formatTimestamp(item.updatedAt)}
                </div>
              </button>
            ))
          )}
        </div>

        {selectedItem ? (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-4">
                <div className="text-sm font-medium">任务信息</div>
                <div className="text-muted-foreground mt-3 space-y-1 text-sm">
                  <div>状态：{selectedItem.status}</div>
                  <div>场景：{selectedItem.sceneType}</div>
                  <div>用户：{selectedItem.userName}</div>
                  <div>角色：{selectedItem.characterName}</div>
                  <div>创建时间：{formatTimestamp(selectedItem.createdAt)}</div>
                  <div>更新时间：{formatTimestamp(selectedItem.updatedAt)}</div>
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-sm font-medium">任务结果</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedItem.draftItems.length > 0 ? (
                    selectedItem.draftItems.map((draft) => (
                      <Badge key={draft.id} variant="outline">
                        {draft.itemType} / {draft.reviewStatus}
                        {draft.candidateStatus
                          ? ` / 候选:${draft.candidateStatus}`
                          : ''}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      暂无草稿分发记录
                    </span>
                  )}
                </div>
                {selectedItem.errorMessage ? (
                  <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {selectedItem.errorMessage}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="space-y-2">
                <div className="text-sm font-medium">原图预览</div>
                <div className="bg-muted/20 overflow-hidden rounded-lg border">
                  {selectedItem.imageUrl ? (
                    <img
                      src={`/api/proxy/file?url=${encodeURIComponent(selectedItem.imageUrl)}`}
                      alt={`ocr-job-${selectedItem.id}`}
                      className="h-auto w-full object-cover"
                    />
                  ) : (
                    <div className="text-muted-foreground px-4 py-12 text-center text-sm">
                      暂无原图地址
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">原始 OCR JSON</div>
                <pre className="bg-muted/20 max-h-[420px] overflow-auto rounded-lg border p-4 text-xs leading-6 whitespace-pre-wrap">
                  {JSON.stringify(selectedItem.rawResult, null, 2)}
                </pre>
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
