'use client';

import { useState } from 'react';
import { Bot, Sparkles } from 'lucide-react';

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

type Props = {
  canEdit?: boolean;
  initialConfig: {
    enabled: boolean;
    model: string;
    systemPrompt: string;
    temperature: number;
    hasGeminiKey: boolean;
  };
};

export function SimulatorAdvisorConfigPanel({
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
      const response = await fetch('/api/admin/simulator/advisor-config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      const payload = await response.json();
      if (!response.ok || payload?.code !== 0 || !payload?.data) {
        throw new Error(payload?.message || '保存顾问配置失败');
      }

      setConfig(payload.data);
      setNotice('AI 顾问配置已保存');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI 顾问配置</CardTitle>
        <CardDescription>
          管理模拟器顾问的启用状态、Gemini 模型、系统提示词和生成温度。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Badge
            variant="outline"
            className={
              config.enabled
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-700'
            }
          >
            {config.enabled ? '顾问已启用' : '顾问已停用'}
          </Badge>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bot className="h-4 w-4" />
            <span>模型：{config.model}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            <span>{config.hasGeminiKey ? 'Gemini Key 已配置' : 'Gemini Key 缺失'}</span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>顾问模型</Label>
            <Input
              value={config.model}
              onChange={(e) =>
                setConfig((current) => ({ ...current, model: e.target.value }))
              }
              disabled={!canEdit}
              placeholder="gemini-2.5-flash"
            />
          </div>
          <div className="space-y-2">
            <Label>生成温度</Label>
            <Input
              value={String(config.temperature)}
              onChange={(e) =>
                setConfig((current) => ({
                  ...current,
                  temperature: Number(e.target.value) || 0,
                }))
              }
              disabled={!canEdit}
              placeholder="0.3"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>系统提示词</Label>
          <Textarea
            value={config.systemPrompt}
            onChange={(e) =>
              setConfig((current) => ({
                ...current,
                systemPrompt: e.target.value,
              }))
            }
            disabled={!canEdit}
            rows={10}
            placeholder="输入顾问需要遵守的回答规则"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) =>
              setConfig((current) => ({ ...current, enabled: e.target.checked }))
            }
            disabled={!canEdit}
          />
          启用模拟器 AI 顾问
        </label>

        {!config.hasGeminiKey ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-800">
            当前缺少 `gemini_api_key`，即使启用顾问也无法正常回答。
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <Button type="button" onClick={handleSave} disabled={!canEdit || isSaving}>
            {isSaving ? '保存中...' : '保存顾问配置'}
          </Button>
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
  );
}
