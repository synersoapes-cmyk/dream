'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Trash2, Upload } from 'lucide-react';

type BulkDeleteDialogProps = {
  open: boolean;
  selectedCount: number;
  onClose: () => void;
  onConfirm: () => void;
};

export function LaboratoryBulkDeleteDialog({
  open,
  selectedCount,
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
            <h3 className="mb-1 text-lg font-bold text-red-400">确认删除</h3>
            <p className="text-sm text-slate-300">
              确定要删除选中的{' '}
              <span className="font-bold text-red-400">{selectedCount}</span>{' '}
              件装备吗？此操作无法撤销。
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
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}

type OverwriteDialogProps = {
  equipmentSetName: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function LaboratoryOverwriteConfirmDialog({
  equipmentSetName,
  onClose,
  onConfirm,
}: OverwriteDialogProps) {
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
              <Upload className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="flex-1">
              <h3 className="mb-1 text-lg font-bold text-yellow-100">
                确认覆盖当前装备
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
              确认覆盖
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
