import { AlertTriangle, CheckCircle2, Cpu, DatabaseZap } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';

type OcrHealthPanelProps = {
  status: {
    ready: boolean;
    missing: string[];
    checks?: Array<{
      key: string;
      label: string;
      configured: boolean;
    }>;
    providers?: {
      ocr?: string;
      storage?: string;
    };
  };
};

export function SimulatorOcrHealthPanel({ status }: OcrHealthPanelProps) {
  const checks = status.checks ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>OCR 配置与健康检查</CardTitle>
        <CardDescription>
          检查模拟器图片识别链路依赖的 Gemini 与 Cloudflare R2 配置是否完整。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Badge
            variant="outline"
            className={
              status.ready
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-700'
            }
          >
            {status.ready ? 'OCR 可用' : 'OCR 配置未完成'}
          </Badge>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Cpu className="h-4 w-4" />
            <span>识别模型：{status.providers?.ocr || 'Gemini'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DatabaseZap className="h-4 w-4" />
            <span>图片存储：{status.providers?.storage || 'Cloudflare R2'}</span>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {checks.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-lg border px-4 py-3"
            >
              <div>
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.key}</div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {item.configured ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span className="text-emerald-700">已配置</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-amber-700">缺失</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {!status.ready ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-800">
            缺失配置：{status.missing.join('、')}
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-800">
            当前 OCR 链路已经满足运行条件，可以执行“图片上传 - R2 - Gemini 识别”。
          </div>
        )}
      </CardContent>
    </Card>
  );
}
