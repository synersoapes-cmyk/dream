'use client';

import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Trash2, Upload } from 'lucide-react';

import type { LaboratoryRuneGuardSummary } from '@/shared/lib/simulator-rune-guard';

type BulkDeleteDialogProps = {
  open: boolean;
  selectedCount: number;
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function LaboratoryBulkDeleteDialog({
  open,
  selectedCount,
  title = '确认删除',
  description,
  confirmLabel = '确认删除',
  onClose,
  onConfirm,
}: BulkDeleteDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-md rounded-xl border-2 border-red-600/60 bg-slate-900 p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-red-600/20">
            <Trash2 className="h-5 w-5 text-red-400" />
          </div>
          <div className="flex-1">
            <h3 className="mb-1 text-lg font-bold text-red-400">{title}</h3>
            <p className="text-sm text-slate-300">
              {description ?? (
                <>
                  确定要删除选中的{' '}
                  <span className="font-bold text-red-400">
                    {selectedCount}
                  </span>{' '}
                  件装备吗？此操作无法撤销。
                </>
              )}
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 font-medium text-slate-300 transition-colors hover:bg-slate-700"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg border border-red-500 bg-red-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-red-500"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

type OverwriteDialogProps = {
  equipmentSetName: string;
  guardSummary?: LaboratoryRuneGuardSummary | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function LaboratoryOverwriteConfirmDialog({
  equipmentSetName,
  guardSummary,
  onClose,
  onConfirm,
}: OverwriteDialogProps) {
  const hasGuardWarnings = Boolean(
    guardSummary &&
      (guardSummary.warnings.length > 0 ||
        guardSummary.conflicts.length > 0 ||
        guardSummary.skillChanges.length > 0)
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', duration: 0.3 }}
          className="mx-4 w-full max-w-md rounded-2xl border-2 border-yellow-600/60 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-yellow-600/20">
              {hasGuardWarnings ? (
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
              ) : (
                <Upload className="h-5 w-5 text-yellow-400" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="mb-1 text-lg font-bold text-yellow-100">
                {hasGuardWarnings ? '应用前请确认符石风险' : '确认覆盖当前装备'}
              </h3>
              <p className="text-sm leading-relaxed text-slate-300">
                确认将{' '}
                <span className="font-bold text-yellow-400">
                  {equipmentSetName}
                </span>{' '}
                的所有装备覆盖到【当前装备】吗？
              </p>
              <p className="mt-2 text-xs text-slate-400">
                此操作会将当前装备替换为对比席位中的装备配置
              </p>
            </div>
          </div>
          {hasGuardWarnings && (
            <div className="space-y-3 rounded-xl border border-yellow-700/40 bg-yellow-950/10 p-4">
              {guardSummary?.skillChanges && guardSummary.skillChanges.length > 0 && (
                <div>
                  <div className="mb-1 text-sm font-semibold text-yellow-300">
                    符石技能变化
                  </div>
                  <div className="space-y-1 text-xs text-slate-300">
                    {guardSummary.skillChanges.map((item) => (
                      <div key={item.comboName}>
                        {item.comboName}
                        {item.deltaBonusValue > 0 ? ' +' : ' '}
                        {item.deltaBonusValue}，应用后生效等级 {item.nextBonusValue}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {guardSummary?.warnings && guardSummary.warnings.length > 0 && (
                <div>
                  <div className="mb-1 text-sm font-semibold text-red-300">
                    跌落预警
                  </div>
                  <div className="space-y-1 text-xs text-red-200">
                    {guardSummary.warnings.map((warning) => (
                      <div key={warning}>{warning}</div>
                    ))}
                  </div>
                </div>
              )}
              {guardSummary?.conflicts && guardSummary.conflicts.length > 0 && (
                <div>
                  <div className="mb-1 text-sm font-semibold text-amber-300">
                    组合冲突提示
                  </div>
                  <div className="space-y-1 text-xs text-amber-200">
                    {guardSummary.conflicts.map((conflict) => (
                      <div key={conflict.equipmentId}>
                        {conflict.slotLabel} · {conflict.equipmentName}：{conflict.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="mt-6 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 font-medium text-slate-300 transition-colors hover:bg-slate-700"
            >
              取消
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 rounded-lg border border-yellow-500 bg-yellow-600 px-4 py-2.5 font-medium text-slate-900 transition-colors hover:bg-yellow-500"
            >
              {hasGuardWarnings ? '仍然应用' : '确认覆盖'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
