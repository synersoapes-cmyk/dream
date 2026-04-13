'use client';

import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react';
import { useGameStore } from '@/features/simulator/store/gameStore';
import type { OcrLog } from '@/features/simulator/store/gameTypes';
import { validateImageFile } from '@/features/simulator/utils/fileValidation';
import {
  applySimulatorBundleToStore,
  buildSimulatorBundleStorePreview,
} from '@/features/simulator/utils/simulatorBundle';
import { applySimulatorCandidateEquipmentToStore } from '@/features/simulator/utils/simulatorCandidateEquipment';
import * as Popover from '@radix-ui/react-popover';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Upload,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import type { SimulatorCharacterBundle } from '@/shared/models/simulator-types';

interface UploadPopoverProps {
  type: 'attributes' | 'equipment';
  trigger: ReactNode;
}

type ProfileReviewChange = {
  key: string;
  label: string;
  before: number | string;
  after: number | string;
  delta?: number;
};

type PendingProfileReview = {
  bundle: SimulatorCharacterBundle;
  summary: string;
  changes: ProfileReviewChange[];
};

const PROFILE_REVIEW_FIELDS: Array<{
  key: string;
  label: string;
  getBefore: (state: {
    baseAttributes: ReturnType<typeof useGameStore.getState>['baseAttributes'];
    combatStats: ReturnType<typeof useGameStore.getState>['combatStats'];
  }) => number | string;
  getAfter: (state: {
    baseAttributes: ReturnType<
      typeof buildSimulatorBundleStorePreview
    >['baseAttributes'];
    combatStats: ReturnType<
      typeof buildSimulatorBundleStorePreview
    >['combatStats'];
  }) => number | string;
}> = [
  {
    key: 'faction',
    label: '门派',
    getBefore: ({ baseAttributes }) => baseAttributes.faction,
    getAfter: ({ baseAttributes }) => baseAttributes.faction,
  },
  {
    key: 'level',
    label: '等级',
    getBefore: ({ baseAttributes }) => baseAttributes.level,
    getAfter: ({ baseAttributes }) => baseAttributes.level,
  },
  {
    key: 'physique',
    label: '体质',
    getBefore: ({ baseAttributes }) => baseAttributes.physique,
    getAfter: ({ baseAttributes }) => baseAttributes.physique,
  },
  {
    key: 'potentialPoints',
    label: '潜力点',
    getBefore: ({ baseAttributes }) => baseAttributes.potentialPoints,
    getAfter: ({ baseAttributes }) => baseAttributes.potentialPoints,
  },
  {
    key: 'magicPower',
    label: '魔力',
    getBefore: ({ baseAttributes }) => baseAttributes.magicPower,
    getAfter: ({ baseAttributes }) => baseAttributes.magicPower,
  },
  {
    key: 'strength',
    label: '力量',
    getBefore: ({ baseAttributes }) => baseAttributes.strength,
    getAfter: ({ baseAttributes }) => baseAttributes.strength,
  },
  {
    key: 'endurance',
    label: '耐力',
    getBefore: ({ baseAttributes }) => baseAttributes.endurance,
    getAfter: ({ baseAttributes }) => baseAttributes.endurance,
  },
  {
    key: 'agility',
    label: '敏捷',
    getBefore: ({ baseAttributes }) => baseAttributes.agility,
    getAfter: ({ baseAttributes }) => baseAttributes.agility,
  },
  {
    key: 'hp',
    label: '气血',
    getBefore: ({ combatStats }) => combatStats.hp,
    getAfter: ({ combatStats }) => combatStats.hp,
  },
  {
    key: 'magic',
    label: '魔法',
    getBefore: ({ combatStats }) => combatStats.magic,
    getAfter: ({ combatStats }) => combatStats.magic,
  },
  {
    key: 'damage',
    label: '伤害',
    getBefore: ({ combatStats }) => combatStats.damage,
    getAfter: ({ combatStats }) => combatStats.damage,
  },
  {
    key: 'defense',
    label: '防御',
    getBefore: ({ combatStats }) => combatStats.defense,
    getAfter: ({ combatStats }) => combatStats.defense,
  },
  {
    key: 'magicDamage',
    label: '法伤',
    getBefore: ({ combatStats }) => combatStats.magicDamage,
    getAfter: ({ combatStats }) => combatStats.magicDamage,
  },
  {
    key: 'magicDefense',
    label: '法防',
    getBefore: ({ combatStats }) => combatStats.magicDefense,
    getAfter: ({ combatStats }) => combatStats.magicDefense,
  },
  {
    key: 'speed',
    label: '速度',
    getBefore: ({ combatStats }) => combatStats.speed,
    getAfter: ({ combatStats }) => combatStats.speed,
  },
  {
    key: 'hit',
    label: '命中',
    getBefore: ({ combatStats }) => combatStats.hit,
    getAfter: ({ combatStats }) => combatStats.hit,
  },
  {
    key: 'dodge',
    label: '躲避',
    getBefore: ({ combatStats }) => combatStats.dodge,
    getAfter: ({ combatStats }) => combatStats.dodge,
  },
  {
    key: 'sealHit',
    label: '封印命中',
    getBefore: ({ combatStats }) => combatStats.sealHit ?? 0,
    getAfter: ({ combatStats }) => combatStats.sealHit ?? 0,
  },
];

function formatReviewValue(value: number | string) {
  return typeof value === 'number' ? value.toLocaleString('zh-CN') : value;
}

function buildProfileReviewChanges(params: {
  currentBaseAttributes: ReturnType<typeof useGameStore.getState>['baseAttributes'];
  currentCombatStats: ReturnType<typeof useGameStore.getState>['combatStats'];
  bundle: SimulatorCharacterBundle;
}): PendingProfileReview {
  const preview = buildSimulatorBundleStorePreview(params.bundle);
  const changes = PROFILE_REVIEW_FIELDS.map((field) => {
    const before = field.getBefore({
      baseAttributes: params.currentBaseAttributes,
      combatStats: params.currentCombatStats,
    });
    const after = field.getAfter(preview);

    return {
      key: field.key,
      label: field.label,
      before,
      after,
      delta:
        typeof before === 'number' && typeof after === 'number'
          ? after - before
          : undefined,
    };
  }).filter((item) => item.before !== item.after);

  return {
    bundle: params.bundle,
    summary: [
      preview.currentCharacter.school,
      preview.currentCharacter.level
        ? `等级 ${preview.currentCharacter.level}`
        : null,
    ]
      .filter(Boolean)
      .join(' · '),
    changes,
  };
}

export function UploadPopover({ type, trigger }: UploadPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingProfileReview, setPendingProfileReview] =
    useState<PendingProfileReview | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const baseAttributes = useGameStore((state) => state.baseAttributes);
  const combatStats = useGameStore((state) => state.combatStats);
  const [ocrLogs, setOcrLogs] = useState<OcrLog[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [ocrHistoryError, setOcrHistoryError] = useState<string | null>(null);

  const loadOcrHistory = async () => {
    setIsLoadingHistory(true);
    setOcrHistoryError(null);

    try {
      const sceneType = type === 'attributes' ? 'profile' : 'equipment';
      const response = await fetch(
        `/api/simulator/current/ocr-history?sceneType=${sceneType}&limit=20`,
        {
          method: 'GET',
          cache: 'no-store',
        }
      );
      const payload = await response.json();
      if (!response.ok || payload?.code !== 0 || !Array.isArray(payload?.data)) {
        throw new Error(payload?.message || '读取 OCR 历史失败');
      }

      setOcrLogs(payload.data as OcrLog[]);
    } catch (error) {
      setOcrHistoryError(
        error instanceof Error ? error.message : '读取 OCR 历史失败'
      );
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Handle pasting when popover is open
  useEffect(() => {
    if (!isOpen) return;

    void loadOcrHistory();

    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const file = new File([blob], 'pasted-image.png', {
              type: blob.type,
            });
            processFile(file);
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [isOpen, type]);

  const processFile = async (file: File): Promise<void> => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error || '文件验证失败');
      return;
    }

    setIsProcessing(true);

    try {
      const configResponse = await fetch('/api/simulator/current/ocr/config', {
        method: 'GET',
        cache: 'no-store',
      });
      const configPayload = await configResponse.json();
      if (
        !configResponse.ok ||
        configPayload?.code !== 0 ||
        !configPayload?.data?.ready
      ) {
        const missing = Array.isArray(configPayload?.data?.missing)
          ? configPayload.data.missing.join(', ')
          : configPayload?.message || 'OCR 配置未完成';
        throw new Error(`OCR 配置未完成：${missing}`);
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        type === 'attributes'
          ? '/api/simulator/current/profile/ocr'
          : '/api/simulator/current/candidate-equipment/ocr',
        {
          method: 'POST',
          body: formData,
        }
      );

      const payload = await response.json();
      if (!response.ok || payload?.code !== 0) {
        throw new Error(payload?.message || '识别失败');
      }

      if (type === 'attributes') {
        if (!payload?.data?.bundle) {
          throw new Error('属性识别结果不完整');
        }

        setPendingProfileReview(
          buildProfileReviewChanges({
            currentBaseAttributes: baseAttributes,
            currentCombatStats: combatStats,
            bundle: payload.data.bundle as SimulatorCharacterBundle,
          })
        );
        await loadOcrHistory();
        return;
      }

      if (!Array.isArray(payload?.data?.items)) {
        throw new Error('装备识别结果不完整');
      }

      applySimulatorCandidateEquipmentToStore(payload.data.items);

      const recognizedName = payload?.data?.item?.equipment?.name || '新装备';

      await loadOcrHistory();
      toast.success('识别到新物品', {
        description: recognizedName,
      });
    } catch (error) {
      const description =
        error instanceof Error ? error.message : '请重试或更换清晰图片';
      toast.error('识别失败', { description });
      await loadOcrHistory();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    processFile(files[0]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleConfirmProfileReview = () => {
    if (!pendingProfileReview) {
      return;
    }

    applySimulatorBundleToStore(pendingProfileReview.bundle, {
      preserveWorkbenchState: true,
    });
    toast.success('人物属性已更新', {
      description:
        pendingProfileReview.summary || '未识别出的字段已保留原值',
    });
    setPendingProfileReview(null);
    setIsOpen(false);
  };

  const handleCancelProfileReview = (open: boolean) => {
    if (open) {
      return;
    }
    setPendingProfileReview(null);
  };

  return (
    <>
      <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger asChild>{trigger}</Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-[9999] flex w-[var(--radix-popover-trigger-width)] flex-col overflow-hidden rounded-xl border border-yellow-700/60 bg-slate-900 shadow-2xl focus:outline-none"
            sideOffset={8}
            align="start"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-yellow-800/40 bg-slate-950/40 px-4 py-3">
              <h2 className="flex items-center gap-2 text-base font-bold text-yellow-100">
                <Upload className="h-4 w-4 text-yellow-500" />
                {type === 'attributes' ? '上传属性截图' : '上传装备截图'}
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-red-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex max-h-[60vh] flex-col gap-4 overflow-hidden p-4">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 transition-all ${
                  isDragging
                    ? 'border-yellow-500 bg-yellow-900/20'
                    : 'border-yellow-800/50 bg-slate-900/40 hover:border-yellow-700/70 hover:bg-slate-800/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                />

                {isProcessing ? (
                  <div className="flex flex-col items-center py-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: 'linear',
                      }}
                      className="mb-2 h-6 w-6 rounded-full border-2 border-yellow-600/30 border-t-yellow-600"
                    />
                    <p className="text-xs font-medium text-yellow-400">
                      智能识别中...
                    </p>
                  </div>
                ) : (
                  <div className="py-2 text-center">
                    <Upload
                      className={`mx-auto mb-2 h-8 w-8 ${isDragging ? 'text-yellow-400' : 'text-yellow-600/60'}`}
                    />
                    <p className="mb-1 text-xs font-medium text-yellow-100">
                      点击或拖拽图片到此处
                    </p>
                    <p className="text-[10px] text-slate-400">
                      支持直接使用 Ctrl+V / Cmd+V 粘贴截图
                    </p>
                  </div>
                )}
              </div>

              {type === 'attributes' ? (
                <div className="shrink-0 rounded-lg border border-amber-600/40 bg-amber-950/30 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    <div>
                      <h3 className="text-xs font-bold text-amber-100">
                        人物属性 OCR 已接入云端链路
                      </h3>
                      <p className="mt-1 text-[10px] leading-relaxed text-amber-200/80">
                        识别成功后会先展示变更确认，再决定是否同步到当前角色属性。未识别出的字段会保留原值。
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex min-h-[120px] flex-1 flex-col overflow-hidden">
                <div className="mb-2 flex items-center gap-2">
                  <FileText className="h-3 w-3 text-slate-400" />
                  <h3 className="text-xs font-bold text-slate-300">识别记录</h3>
                </div>

                <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto pr-1">
                  {isLoadingHistory ? (
                    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-700/50 py-4 text-xs text-slate-400">
                      正在读取识别记录...
                    </div>
                  ) : ocrLogs.length === 0 ? (
                    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-700/50 py-4 text-xs text-slate-500 italic">
                      暂无识别记录
                    </div>
                  ) : (
                    ocrLogs.map((log) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-2 rounded-lg border border-slate-700/50 bg-slate-800/50 p-2 text-[10px]"
                      >
                        {log.type === 'success' ? (
                          <CheckCircle className="mt-0.5 h-3 w-3 shrink-0 text-green-500" />
                        ) : log.type === 'error' ? (
                          <X className="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
                        ) : (
                          <Clock className="mt-0.5 h-3 w-3 shrink-0 text-blue-400" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="leading-relaxed break-words text-slate-300">
                            {log.message}
                          </div>
                          {log.details ? (
                            <div className="mt-1 text-[10px] leading-relaxed break-words text-slate-500">
                              {log.details}
                            </div>
                          ) : null}
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
                {!isLoadingHistory && ocrHistoryError ? (
                  <div className="mt-2 text-[10px] text-red-300">
                    {ocrHistoryError}
                  </div>
                ) : null}
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <Dialog
        open={Boolean(pendingProfileReview)}
        onOpenChange={handleCancelProfileReview}
      >
        <DialogContent
          showCloseButton={false}
          className="max-w-2xl border-yellow-700/60 bg-slate-950 p-0 text-slate-100 shadow-2xl"
        >
          <DialogHeader className="border-b border-yellow-800/40 bg-slate-950/80 px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-yellow-100">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              确认人物属性变更
            </DialogTitle>
            <DialogDescription className="text-slate-300">
              {pendingProfileReview?.summary || '请确认 OCR 识别结果后再应用到当前档案'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            <div className="rounded-xl border border-yellow-800/40 bg-yellow-950/20 p-4 text-sm text-slate-200">
              系统已根据识别结果生成档案差异。绿色表示提升，红色表示下降；关闭弹窗不会改动当前属性。
            </div>

            <div className="max-h-[360px] overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/60">
              {pendingProfileReview?.changes.length ? (
                <div className="divide-y divide-slate-800">
                  {pendingProfileReview.changes.map((change) => {
                    const isIncrease =
                      typeof change.delta === 'number' && change.delta > 0;
                    const isDecrease =
                      typeof change.delta === 'number' && change.delta < 0;
                    const deltaText =
                      typeof change.delta === 'number' && change.delta !== 0
                        ? `${change.delta > 0 ? '+' : ''}${change.delta.toLocaleString('zh-CN')}`
                        : null;

                    return (
                      <div
                        key={change.key}
                        className="grid grid-cols-[120px_1fr_auto_1fr] items-center gap-3 px-4 py-3 text-sm"
                      >
                        <div className="font-medium text-slate-200">
                          {change.label}
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-400">
                          {formatReviewValue(change.before)}
                        </div>
                        <div
                          className={`text-xs font-semibold ${
                            isIncrease
                              ? 'text-emerald-400'
                              : isDecrease
                                ? 'text-rose-400'
                                : 'text-slate-500'
                          }`}
                        >
                          {deltaText || '已变更'}
                        </div>
                        <div
                          className={`rounded-lg border px-3 py-2 font-medium ${
                            isIncrease
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                              : isDecrease
                                ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                                : 'border-slate-700 bg-slate-950/60 text-slate-200'
                          }`}
                        >
                          {formatReviewValue(change.after)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-sm text-slate-400">
                  当前没有识别出实际变更，确认后会按云端结果重新同步一次当前档案。
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t border-slate-800 px-6 py-4 sm:justify-between">
            <button
              type="button"
              onClick={() => setPendingProfileReview(null)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-600 hover:text-white"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleConfirmProfileReview}
              className="inline-flex items-center justify-center rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-yellow-400"
            >
              确认更新
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
