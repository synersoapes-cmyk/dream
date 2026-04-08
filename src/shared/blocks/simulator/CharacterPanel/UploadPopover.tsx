// @ts-nocheck
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/features/simulator/store/gameStore';
import { validateImageFile } from '@/features/simulator/utils/fileValidation';
import { applySimulatorCandidateEquipmentToStore } from '@/features/simulator/utils/simulatorCandidateEquipment';
import { applySimulatorBundleToStore } from '@/features/simulator/utils/simulatorBundle';
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

interface UploadPopoverProps {
  type: 'attributes' | 'equipment';
  trigger: React.ReactNode;
}

export function UploadPopover({ type, trigger }: UploadPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const ocrLogs = useGameStore((state) => state.ocrLogs);
  const addOcrLog = useGameStore((state) => state.addOcrLog);

  // Handle pasting when popover is open
  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen]);

  const processFile = async (file: File) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error || '文件验证失败');
      return;
    }

    setIsProcessing(true);
    toast.info('正在识别...', {
      description: '图片会先上传到 R2，再交给 Gemini 解析',
    });

    try {
      const configResponse = await fetch(
        '/api/simulator/current/ocr/config',
        {
          method: 'GET',
          cache: 'no-store',
        }
      );
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

      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
        .getMinutes()
        .toString()
        .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

      if (type === 'attributes') {
        if (!payload?.data?.bundle) {
          throw new Error('属性识别结果不完整');
        }

        applySimulatorBundleToStore(payload.data.bundle, {
          preserveWorkbenchState: true,
        });

        const recognizedLevel = payload?.data?.recognized?.level;
        const recognizedFaction = payload?.data?.recognized?.faction;
        const summary = [recognizedFaction, recognizedLevel ? `等级 ${recognizedLevel}` : null]
          .filter(Boolean)
          .join(' · ');

        addOcrLog({
          type: 'success',
          message: `${timeStr}，已识别人物属性`,
          details: summary || '未识别出的字段已保留原值',
        });
        toast.success('人物属性已更新', {
          description: summary || '未识别出的字段已保留原值',
        });
        return;
      }

      if (!Array.isArray(payload?.data?.items)) {
        throw new Error('装备识别结果不完整');
      }

      applySimulatorCandidateEquipmentToStore(payload.data.items);

      const recognizedName = payload?.data?.item?.equipment?.name || '新装备';

      addOcrLog({
        type: 'success',
        message: `${timeStr}，识别到新物品${recognizedName}`,
      });
      toast.success('识别到新物品', {
        description: recognizedName,
      });
    } catch (error) {
      const description =
        error instanceof Error ? error.message : '请重试或更换清晰图片';
      toast.error('识别失败', { description });
      addOcrLog({
        type: 'error',
        message: '图片识别失败',
        details: description,
      });
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  return (
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
            {/* 上传区域 */}
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
                      识别成功后会直接更新当前角色属性。未识别出的字段会保留云端原值，不会被清空。
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* 识别记录展示区域 */}
            <div className="flex min-h-[120px] flex-1 flex-col overflow-hidden">
              <div className="mb-2 flex items-center gap-2">
                <FileText className="h-3 w-3 text-slate-400" />
                <h3 className="text-xs font-bold text-slate-300">识别记录</h3>
              </div>

              <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto pr-1">
                {ocrLogs.length === 0 ? (
                  <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-700/50 py-4 text-xs text-slate-500 italic">
                    暂无识别记录
                  </div>
                ) : (
                  // 只显示与当前类型相关的记录？ 这里保持展示所有也可以，或者可以加个过滤
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
                      <span className="leading-relaxed break-words text-slate-300">
                        {log.message}
                      </span>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
