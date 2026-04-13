'use client';

import { useState } from 'react';

import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import type { AdminSimulatorOcrMetrics } from '@/shared/models/simulator-types';

type Props = {
  initialMetrics: AdminSimulatorOcrMetrics;
};

const DRAFT_STATUS_LABELS: Record<string, string> = {
  pending: '待确认',
  approved: '已同步候选',
  rejected: '已驳回',
  edited: '已编辑',
};

const CANDIDATE_STATUS_LABELS: Record<string, string> = {
  pending: '候选待确认',
  confirmed: '已入候选',
  replaced: '已替换',
  unsynced: '未同步候选',
};

function formatBreakdownLabel(value: string, type: 'draft' | 'candidate') {
  if (type === 'draft') {
    return DRAFT_STATUS_LABELS[value] ?? value;
  }

  return CANDIDATE_STATUS_LABELS[value] ?? value;
}

export function SimulatorOcrMetricsAdminPanel({ initialMetrics }: Props) {
  const [metrics, setMetrics] = useState(initialMetrics);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/simulator/ocr-metrics', {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok || payload?.code !== 0 || !payload?.data) {
        throw new Error(payload?.message || '读取 OCR 质量统计失败');
      }

      setMetrics(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '读取失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>OCR 质量概览</CardTitle>
            <CardDescription>
              聚合查看成功率、失败原因、缺失字段和草稿同步结果，用于持续优化识别提示词和审核规则。
            </CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={handleRefresh} disabled={isLoading}>
            {isLoading ? '刷新中...' : '刷新统计'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-5">
          <div className="rounded-xl border p-4">
            <div className="text-muted-foreground text-xs">总任务数</div>
            <div className="mt-2 text-2xl font-semibold">{metrics.totals.totalJobs}</div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-muted-foreground text-xs">成功数</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-600">
              {metrics.totals.successJobs}
            </div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-muted-foreground text-xs">失败数</div>
            <div className="mt-2 text-2xl font-semibold text-red-500">
              {metrics.totals.failedJobs}
            </div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-muted-foreground text-xs">排队 / 审计</div>
            <div className="mt-2 text-2xl font-semibold">
              {metrics.totals.pendingJobs + metrics.totals.reviewingJobs}
            </div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-muted-foreground text-xs">成功率</div>
            <div className="mt-2 text-2xl font-semibold">
              {metrics.totals.successRate}%
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-xl border p-4">
            <div className="text-sm font-medium">按场景拆分</div>
            <div className="mt-3 space-y-2">
              {metrics.sceneBreakdown.map((item) => (
                <div
                  key={item.sceneType}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                >
                  <div>{item.sceneType}</div>
                  <div className="text-muted-foreground">
                    {item.success}/{item.total} 成功 · {item.successRate}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="text-sm font-medium">最近 14 天趋势</div>
            <div className="mt-3 space-y-2">
              {metrics.recentDailyTrend.map((item) => (
                <div
                  key={item.date}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                >
                  <div>{item.date}</div>
                  <div className="text-muted-foreground">
                    总 {item.total} / 成功 {item.success} / 失败 {item.failed}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-xl border p-4">
            <div className="text-sm font-medium">高频失败原因</div>
            <div className="mt-3 space-y-2">
              {metrics.failureReasons.length === 0 ? (
                <div className="text-muted-foreground rounded-lg border px-3 py-4 text-sm">
                  暂无失败任务。
                </div>
              ) : (
                metrics.failureReasons.map((item) => (
                  <div
                    key={item.reason}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                  >
                    <div>{item.reason}</div>
                    <div className="text-muted-foreground">{item.count} 次</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="text-sm font-medium">高频缺失字段</div>
            <div className="mt-3 space-y-2">
              {metrics.missingFields.length === 0 ? (
                <div className="text-muted-foreground rounded-lg border px-3 py-4 text-sm">
                  当前没有统计到明显缺失字段。
                </div>
              ) : (
                metrics.missingFields.map((item) => (
                  <div
                    key={item.field}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                  >
                    <div>{item.field}</div>
                    <div className="text-muted-foreground">{item.count} 次</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-xl border p-4">
            <div className="text-sm font-medium">草稿审核分布</div>
            <div className="mt-3 space-y-2">
              {metrics.draftReviewBreakdown.map((item) => (
                <div
                  key={item.status}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                >
                  <div>{formatBreakdownLabel(item.status, 'draft')}</div>
                  <div className="text-muted-foreground">{item.count}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="text-sm font-medium">候选同步分布</div>
            <div className="mt-3 space-y-2">
              {metrics.candidateSyncBreakdown.map((item) => (
                <div
                  key={item.status}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                >
                  <div>{formatBreakdownLabel(item.status, 'candidate')}</div>
                  <div className="text-muted-foreground">{item.count}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-300/50 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
