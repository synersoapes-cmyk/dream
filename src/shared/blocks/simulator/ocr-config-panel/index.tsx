'use client';

import { useState } from 'react';
import { DatabaseZap, KeyRound, ScanText, UploadCloud } from 'lucide-react';

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
import { SimulatorOcrHealthPanel } from '@/shared/blocks/simulator/ocr-health-panel';

type Props = {
  canEdit?: boolean;
  initialConfig: {
    geminiApiKey: string;
    r2AccountId: string;
    r2Endpoint: string;
    r2AccessKey: string;
    r2SecretKey: string;
    r2BucketName: string;
    r2UploadPath: string;
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
};

export function SimulatorOcrConfigPanel({
  canEdit = false,
  initialConfig,
}: Props) {
  const [config, setConfig] = useState(initialConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!canEdit) {
      return;
    }

    setIsSaving(true);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch('/api/admin/simulator/ocr-config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      const payload = await response.json();
      if (!response.ok || payload?.code !== 0 || !payload?.data) {
        throw new Error(payload?.message || '保存 OCR 配置失败');
      }

      setConfig(payload.data);
      setNotice('OCR 上传配置已保存');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>OCR 上传配置</CardTitle>
          <CardDescription>
            这里集中维护模拟器 OCR 使用的 Gemini Key、R2 存储凭证、桶名和上传路径。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant="outline"
              className={
                config.status.ready
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-700'
              }
            >
              {config.status.ready ? 'OCR 可用' : 'OCR 仍缺配置'}
            </Badge>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ScanText className="h-4 w-4" />
              <span>识别服务：Gemini</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UploadCloud className="h-4 w-4" />
              <span>上传目标：Cloudflare R2</span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="simulator-ocr-gemini-api-key">
                Gemini API Key
              </Label>
              <Input
                id="simulator-ocr-gemini-api-key"
                type="password"
                value={config.geminiApiKey}
                onChange={(e) =>
                  setConfig((current) => ({
                    ...current,
                    geminiApiKey: e.target.value,
                  }))
                }
                disabled={!canEdit}
                placeholder="AIza..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="simulator-ocr-r2-bucket-name">R2 Bucket</Label>
              <Input
                id="simulator-ocr-r2-bucket-name"
                value={config.r2BucketName}
                onChange={(e) =>
                  setConfig((current) => ({
                    ...current,
                    r2BucketName: e.target.value,
                  }))
                }
                disabled={!canEdit}
                placeholder="dream-assets"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="simulator-ocr-r2-account-id">
                Cloudflare Account ID
              </Label>
              <Input
                id="simulator-ocr-r2-account-id"
                value={config.r2AccountId}
                onChange={(e) =>
                  setConfig((current) => ({
                    ...current,
                    r2AccountId: e.target.value,
                  }))
                }
                disabled={!canEdit}
                placeholder="account-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="simulator-ocr-r2-endpoint">
                自定义 Endpoint
              </Label>
              <Input
                id="simulator-ocr-r2-endpoint"
                value={config.r2Endpoint}
                onChange={(e) =>
                  setConfig((current) => ({
                    ...current,
                    r2Endpoint: e.target.value,
                  }))
                }
                disabled={!canEdit}
                placeholder="https://<account-id>.r2.cloudflarestorage.com"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="simulator-ocr-r2-access-key">R2 Access Key</Label>
              <Input
                id="simulator-ocr-r2-access-key"
                type="password"
                value={config.r2AccessKey}
                onChange={(e) =>
                  setConfig((current) => ({
                    ...current,
                    r2AccessKey: e.target.value,
                  }))
                }
                disabled={!canEdit}
                placeholder="access-key"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="simulator-ocr-r2-secret-key">R2 Secret Key</Label>
              <Input
                id="simulator-ocr-r2-secret-key"
                type="password"
                value={config.r2SecretKey}
                onChange={(e) =>
                  setConfig((current) => ({
                    ...current,
                    r2SecretKey: e.target.value,
                  }))
                }
                disabled={!canEdit}
                placeholder="secret-key"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="simulator-ocr-r2-upload-path">上传路径</Label>
              <Input
                id="simulator-ocr-r2-upload-path"
                value={config.r2UploadPath}
                onChange={(e) =>
                  setConfig((current) => ({
                    ...current,
                    r2UploadPath: e.target.value,
                  }))
                }
                disabled={!canEdit}
                placeholder="uploads/simulator"
              />
            </div>
            <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                <DatabaseZap className="h-4 w-4" />
                R2 链路说明
              </div>
              <div>若已填写自定义 Endpoint，则可不依赖 Account ID 自动拼接。</div>
              <div>上传路径会作为 OCR 原图默认前缀，便于后续按目录清理。</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button type="button" onClick={handleSave} disabled={!canEdit || isSaving}>
              {isSaving ? '保存中...' : '保存 OCR 配置'}
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <KeyRound className="h-4 w-4" />
              <span>当前页面会直接写入后台配置表</span>
            </div>
          </div>

          {notice ? (
            <div className="rounded-lg border border-emerald-300/50 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {notice}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <SimulatorOcrHealthPanel status={config.status} />
    </div>
  );
}
