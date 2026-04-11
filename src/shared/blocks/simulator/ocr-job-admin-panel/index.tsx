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
  reviewing: '审计中',
};

const JOB_RESULT_STATUS_LABELS: Record<string, string> = {
  pending: '排队中',
  success: '成功',
  failed: '失败',
  reviewing: '审计中',
};

const DRAFT_STATUS_LABELS: Record<string, string> = {
  pending: '待确认',
  approved: '已同步候选',
  rejected: '已驳回',
  edited: '已编辑',
};

const CANDIDATE_STATUS_LABELS: Record<string, string> = {
  pending: '待确认',
  confirmed: '已确认',
  replaced: '已替换',
};

function formatJobStatusLabel(status: string) {
  return JOB_RESULT_STATUS_LABELS[status] ?? status;
}

function formatDraftStatusLabel(status: string) {
  return DRAFT_STATUS_LABELS[status] ?? status;
}

function formatCandidateStatusLabel(status: string | null) {
  if (!status) {
    return null;
  }

  return CANDIDATE_STATUS_LABELS[status] ?? status;
}

function formatTimestamp(timestamp: number) {
  return formatDateTimeValue(timestamp, {
    locale: 'zh-CN',
    empty: '未记录',
  });
}

function formatOcrValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '未识别';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '未识别';
  }

  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return `${value.length} 项`;
  }

  if (typeof value === 'object') {
    return `${Object.keys(value).length} 个字段`;
  }

  return String(value);
}

function getOcrSummaryRows(rawResult: Record<string, unknown>) {
  const preferredKeys = [
    'name',
    'slot',
    'level',
    'quality',
    'price',
    'score',
    'school',
    'faction',
    'magicDamage',
    'speed',
    'defense',
    'magicDefense',
  ];

  const source =
    (rawResult.recognized &&
    typeof rawResult.recognized === 'object' &&
    !Array.isArray(rawResult.recognized)
      ? (rawResult.recognized as Record<string, unknown>)
      : rawResult) ?? {};

  const rows = preferredKeys
    .filter((key) => key in source)
    .map((key) => ({
      label: key,
      value: formatOcrValue(source[key]),
    }));

  if (rows.length > 0) {
    return rows;
  }

  return Object.entries(source)
    .slice(0, 12)
    .map(([key, value]) => ({
      label: key,
      value: formatOcrValue(value),
    }));
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
      if (
        !response.ok ||
        payload?.code !== 0 ||
        !Array.isArray(payload?.data)
      ) {
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
          查看上传识图任务的成功率、失败原因、原图地址，以及草稿留痕和候选同步情况。
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-3 lg:sticky lg:top-6 lg:self-start">
          <div className="flex flex-wrap gap-2 rounded-lg border p-3">
            {(
              ['all', 'pending', 'success', 'failed', 'reviewing'] as const
            ).map((status) => (
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
            ))}
          </div>

          <div className="space-y-3 lg:max-h-[calc(100vh-15rem)] lg:overflow-y-auto lg:pr-1">
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
                    <Badge variant="outline">
                      {formatJobStatusLabel(item.status)}
                    </Badge>
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
        </div>

        {selectedItem ? (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-4">
                <div className="text-sm font-medium">任务信息</div>
                <div className="text-muted-foreground mt-3 space-y-1 text-sm">
                  <div>状态：{formatJobStatusLabel(selectedItem.status)}</div>
                  <div>场景：{selectedItem.sceneType}</div>
                  <div>用户：{selectedItem.userName}</div>
                  <div>角色：{selectedItem.characterName}</div>
                  <div>创建时间：{formatTimestamp(selectedItem.createdAt)}</div>
                  <div>更新时间：{formatTimestamp(selectedItem.updatedAt)}</div>
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-sm font-medium">草稿与同步结果</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedItem.draftItems.length > 0 ? (
                    selectedItem.draftItems.map((draft) => (
                      <Badge key={draft.id} variant="outline">
                        {draft.itemType} /{' '}
                        {formatDraftStatusLabel(draft.reviewStatus)}
                        {formatCandidateStatusLabel(draft.candidateStatus)
                          ? ` / 候选:${formatCandidateStatusLabel(draft.candidateStatus)}`
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
                  <div className="border-destructive/30 bg-destructive/5 text-destructive mt-3 rounded-lg border px-3 py-2 text-sm">
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
                <div className="text-sm font-medium">识别摘要</div>
                <div className="bg-muted/20 rounded-lg border">
                  {getOcrSummaryRows(selectedItem.rawResult).length > 0 ? (
                    <div className="divide-y">
                      {getOcrSummaryRows(selectedItem.rawResult).map((row) => (
                        <div
                          key={row.label}
                          className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 px-3 py-2 text-sm"
                        >
                          <div className="text-muted-foreground">
                            {row.label}
                          </div>
                          <div className="font-medium break-words">
                            {row.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground px-4 py-12 text-center text-sm">
                      暂无可展示的识别字段
                    </div>
                  )}
                </div>
              </div>
            </div>

            {error ? (
              <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm">
                {error}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
