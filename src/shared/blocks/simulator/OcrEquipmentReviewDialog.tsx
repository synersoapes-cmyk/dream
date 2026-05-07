'use client';

import type { PendingEquipment } from '@/features/simulator/store/gameTypes';
import { AlertCircle, CheckCircle2, Eye, ScanSearch } from 'lucide-react';

import { EquipmentImage } from '@/shared/blocks/simulator/EquipmentPanel/EquipmentImage';
import { EquipmentImageComparePanel } from '@/shared/blocks/simulator/EquipmentPanel/EquipmentImageComparePanel';
import { Badge } from '@/shared/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  getSimulatorEquipmentFieldLabel,
  SIMULATOR_EQUIPMENT_TYPE_OPTIONS,
} from '@/shared/lib/simulator-equipment-editor';
import { getEquipmentSpotlightTags } from '@/shared/lib/simulator-equipment-spotlight';
import { buildSimulatorEquipmentOcrReviewSummary } from '@/shared/lib/simulator-equipment-ocr-review';
import { readSimulatorEquipmentOcrImageHintMeta } from '@/shared/lib/simulator-ocr-image-hint';
import { getSimulatorStatLabel } from '@/shared/lib/simulator-stat-labels';

type OcrEquipmentReviewDialogProps = {
  item: PendingEquipment | null;
  open: boolean;
  title?: string;
  description?: string;
  destinationTitle: string;
  destinationDescription: string;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
  onClose: () => void;
  onPrimaryAction?: () => void;
};

function hasDisplayValue(value: unknown) {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
}

function formatDisplayValue(value: unknown) {
  if (typeof value === 'number') {
    return value.toLocaleString('zh-CN');
  }

  if (Array.isArray(value)) {
    return value.join(' / ');
  }

  return String(value ?? '');
}

function getEquipmentTypeLabel(type: PendingEquipment['equipment']['type']) {
  return (
    SIMULATOR_EQUIPMENT_TYPE_OPTIONS.find((item) => item.value === type)
      ?.label ?? type
  );
}

function buildVisibleFieldEntries(item: PendingEquipment) {
  const equipment = item.equipment;
  const baseEntries: Array<{ key: string; label: string; value: string }> = [
    {
      key: 'type',
      label: getSimulatorEquipmentFieldLabel('type'),
      value: getEquipmentTypeLabel(equipment.type),
    },
    {
      key: 'level',
      label: getSimulatorEquipmentFieldLabel('level'),
      value: formatDisplayValue(equipment.level),
    },
    {
      key: 'mainStat',
      label: getSimulatorEquipmentFieldLabel('mainStat'),
      value: formatDisplayValue(equipment.mainStat),
    },
    {
      key: 'extraStat',
      label: getSimulatorEquipmentFieldLabel('extraStat'),
      value: formatDisplayValue(equipment.extraStat),
    },
    {
      key: 'specialEffect',
      label: getSimulatorEquipmentFieldLabel('specialEffect'),
      value: formatDisplayValue(equipment.specialEffect),
    },
    {
      key: 'repairFailCount',
      label: getSimulatorEquipmentFieldLabel('repairFailCount'),
      value: formatDisplayValue(equipment.repairFailCount),
    },
    {
      key: 'luckyHoles',
      label: getSimulatorEquipmentFieldLabel('luckyHoles'),
      value: formatDisplayValue(equipment.luckyHoles),
    },
    {
      key: 'price',
      label: getSimulatorEquipmentFieldLabel('price'),
      value: formatDisplayValue(equipment.price),
    },
    {
      key: 'crossServerFee',
      label: getSimulatorEquipmentFieldLabel('crossServerFee'),
      value: formatDisplayValue(equipment.crossServerFee),
    },
  ];

  const statEntries = Object.entries(equipment.stats ?? {})
    .filter(([, value]) => typeof value === 'number' && Number(value) !== 0)
    .sort(([leftKey], [rightKey]) =>
      getSimulatorStatLabel(leftKey).localeCompare(
        getSimulatorStatLabel(rightKey),
        'zh-CN'
      )
    )
    .map(([key, value]) => ({
      key: `stat_${key}`,
      label: getSimulatorStatLabel(key),
      value: formatDisplayValue(value),
    }));

  return [...baseEntries, ...statEntries].filter((entry) =>
    hasDisplayValue(entry.value)
  );
}

function readPendingEquipmentOcrHintMeta(item: PendingEquipment | null) {
  if (!item?.rawText?.trim()) {
    return null;
  }

  try {
    return readSimulatorEquipmentOcrImageHintMeta(JSON.parse(item.rawText));
  } catch {
    return null;
  }
}

export function OcrEquipmentReviewDialog({
  item,
  open,
  title = '确认装备 OCR 结果',
  description = '这次识别出的字段已写入候选装备待确认区，请先快速核对关键信息。',
  destinationTitle,
  destinationDescription,
  primaryActionLabel = '我知道了',
  secondaryActionLabel = '关闭',
  onClose,
  onPrimaryAction,
}: OcrEquipmentReviewDialogProps) {
  const spotlightTags = item ? getEquipmentSpotlightTags(item.equipment) : [];
  const visibleFieldEntries = item ? buildVisibleFieldEntries(item) : [];
  const ocrHintMeta = readPendingEquipmentOcrHintMeta(item);
  const ocrReview = item ? buildSimulatorEquipmentOcrReviewSummary(item) : null;

  const confidenceBadgeClassName =
    ocrReview?.confidenceTone === 'high'
      ? 'border-emerald-600/50 bg-emerald-500/10 text-emerald-200'
      : ocrReview?.confidenceTone === 'medium'
        ? 'border-amber-600/50 bg-amber-500/10 text-amber-200'
        : 'border-rose-600/50 bg-rose-500/10 text-rose-200';

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}
    >
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[calc(100vh-2rem)] max-w-3xl flex-col overflow-hidden border-yellow-700/60 bg-slate-950 p-0 text-slate-100 shadow-2xl"
      >
        <DialogHeader className="border-b border-yellow-800/40 bg-slate-950/80 px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-yellow-100">
            <ScanSearch className="h-5 w-5 text-yellow-500" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {item ? (
            <>
              <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="mb-3 text-xs font-medium text-slate-400">
                    OCR 识别物品
                  </div>
                  <div className="flex items-start gap-3">
                    <EquipmentImage
                      equipment={{
                        ...item.equipment,
                        imageUrl: item.imagePreview || item.equipment.imageUrl,
                      }}
                      size="xl"
                      preferArtwork={false}
                      showHoverCompare={false}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-yellow-100">
                        {item.equipment.name || '未命名装备'}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {getEquipmentTypeLabel(item.equipment.type)}
                        {item.equipment.level
                          ? ` · ${item.equipment.level}级`
                          : ''}
                      </div>
                      {ocrHintMeta ? (
                        <div className="mt-3 flex flex-wrap gap-1">
                          <Badge
                            variant="outline"
                            className="border-sky-600/50 bg-sky-500/10 text-[10px] text-sky-200"
                          >
                            {ocrHintMeta.label}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="border-slate-700/70 bg-slate-900/70 text-[10px] text-slate-300"
                          >
                            {ocrHintMeta.routingMode === 'manual'
                              ? '手动指定'
                              : '自动识别'}
                          </Badge>
                        </div>
                      ) : null}
                      {spotlightTags.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {spotlightTags.slice(0, 4).map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="border-red-600/40 bg-red-500/10 text-[10px] text-red-300"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-cyan-800/30 bg-cyan-950/10 p-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                    <div>
                      <div className="text-sm font-semibold text-cyan-100">
                        {destinationTitle}
                      </div>
                      <div className="mt-1 text-xs leading-6 text-slate-300">
                        {destinationDescription}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {ocrReview ? (
                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-xl border border-amber-700/30 bg-amber-950/10 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-amber-100">
                      <ScanSearch className="h-4 w-4 text-amber-300" />
                      OCR 结果解释
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className={confidenceBadgeClassName}
                      >
                        {ocrReview.confidenceLabel}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-slate-700/70 bg-slate-900/70 text-slate-200"
                      >
                        有效字段 {ocrReview.recognizedFieldCount}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-cyan-700/50 bg-cyan-500/10 text-cyan-200"
                      >
                        数值属性 {ocrReview.recognizedStatCount}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-rose-700/50 bg-rose-500/10 text-rose-200"
                      >
                        缺失关键项 {ocrReview.missingFields.length}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-2 text-xs leading-6 text-slate-300">
                      {ocrReview.summaryLines.map((line) => (
                        <div key={line}>{line}</div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-rose-800/30 bg-rose-950/10 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-rose-100">
                      <AlertCircle className="h-4 w-4 text-rose-300" />
                      建议优先核对
                    </div>
                    {ocrReview.recognizedCoreFields.length > 0 ? (
                      <div className="mt-3">
                        <div className="text-[11px] text-slate-400">
                          已识别关键项
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {ocrReview.recognizedCoreFields.map((field) => (
                            <Badge
                              key={field.key}
                              variant="outline"
                              className="border-emerald-600/40 bg-emerald-500/10 text-[10px] text-emerald-200"
                            >
                              {field.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {ocrReview.missingFields.length > 0 ? (
                      <div className="mt-3">
                        <div className="text-[11px] text-slate-400">
                          缺失关键项
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {ocrReview.missingFields.map((field) => (
                            <Badge
                              key={field.key}
                              variant="outline"
                              className="border-rose-600/40 bg-rose-500/10 text-[10px] text-rose-200"
                              title={field.reason}
                            >
                              {field.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {ocrReview.missingSuggestedStats.length > 0 ? (
                      <div className="mt-3">
                        <div className="text-[11px] text-slate-400">
                          疑似漏识别属性
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {ocrReview.missingSuggestedStats.map((field) => (
                            <Badge
                              key={field.key}
                              variant="outline"
                              className="border-amber-600/40 bg-amber-500/10 text-[10px] text-amber-200"
                              title={field.reason}
                            >
                              {field.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-3 space-y-2 text-xs leading-6 text-slate-300">
                      {ocrReview.recommendedChecks.map((line) => (
                        <div key={line}>{line}</div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border border-slate-800 bg-slate-900/60">
                <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-yellow-100">
                  本次识别到的有效字段
                </div>
                {visibleFieldEntries.length > 0 ? (
                  <div className="grid gap-3 p-4 sm:grid-cols-2">
                    {visibleFieldEntries.map((entry) => (
                      <div
                        key={entry.key}
                        className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-3"
                      >
                        <div className="text-[11px] text-slate-500">
                          {entry.label}
                        </div>
                        <div className="mt-1 text-sm text-slate-100">
                          {entry.value}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">
                    当前没有识别出可展示字段，建议进入待确认详情手动补录。
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="mb-3 text-sm font-semibold text-yellow-100">
                  审核对照图
                </div>
                <EquipmentImageComparePanel
                  equipment={item.equipment}
                  imagePreview={item.imagePreview}
                  artworkHeightClassName="h-36"
                  previewHeightClassName="h-36"
                />
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter className="border-t border-slate-800 px-6 py-4 sm:justify-between">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-600 hover:text-white"
          >
            {secondaryActionLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              if (onPrimaryAction) {
                onPrimaryAction();
                return;
              }
              onClose();
            }}
            className="inline-flex items-center justify-center rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-yellow-400"
          >
            <Eye className="mr-2 h-4 w-4" />
            {primaryActionLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
