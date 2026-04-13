'use client';

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useGameStore } from '@/features/simulator/store/gameStore';
import { AnimatePresence, motion } from 'motion/react';

interface AttributeDisplayProps {
  label: string;
  value: number;
  statKey?: string; // 用于查找属性差异
  onValueChange?: (newValue: number) => void; // 编辑回调
  editable?: boolean; // 是否可编辑
}

export function AttributeDisplay({
  label,
  value,
  statKey,
  onValueChange,
  editable = true,
}: AttributeDisplayProps) {
  const previewMode = useGameStore((state) => state.previewMode);
  const calculateStatsDiff = useGameStore((state) => state.calculateStatsDiff);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const [displayValue, setDisplayValue] = useState(value);
  const [flashDelta, setFlashDelta] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const previousValueRef = useRef(value);
  const displayValueRef = useRef(value);

  // 获取属性差异
  let diff = 0;
  if (previewMode && statKey) {
    try {
      if (calculateStatsDiff && typeof calculateStatsDiff === 'function') {
        const statsDiff = calculateStatsDiff();
        diff = statsDiff?.attributes?.[statKey] || 0;
      }
    } catch (error) {
      console.error('Error calculating stats diff:', error);
    }
  }

  // 当进入编辑模式时聚焦输入框
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value.toString());
  }, [value]);

  useEffect(() => {
    const previousValue = previousValueRef.current;
    const delta = value - previousValue;
    previousValueRef.current = value;

    if (delta === 0) {
      setDisplayValue(value);
      return;
    }

    const startedAt =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    const from = displayValueRef.current;
    const duration = 220;
    setFlashDelta(delta);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const animateFrame = (now: number) => {
      const elapsed = now - startedAt;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(from + (value - from) * eased);
      displayValueRef.current = nextValue;
      setDisplayValue(nextValue);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animateFrame);
      } else {
        displayValueRef.current = value;
        setDisplayValue(value);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animateFrame);

    const flashTimer = window.setTimeout(() => {
      setFlashDelta(0);
    }, 700);

    return () => {
      window.clearTimeout(flashTimer);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [value]);

  const handleStartEdit = () => {
    if (editable) {
      setIsEditing(true);
      setEditValue(value.toString());
    }
  };

  const handleSave = () => {
    const newValue = parseInt(editValue) || 0;
    if (newValue !== value && onValueChange) {
      onValueChange(newValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value.toString());
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <motion.div
      animate={{
        borderColor:
          flashDelta > 0
            ? 'rgba(74, 222, 128, 0.45)'
            : flashDelta < 0
              ? 'rgba(248, 113, 113, 0.45)'
              : 'rgba(133, 77, 14, 0.3)',
        backgroundColor:
          flashDelta > 0
            ? 'rgba(20, 83, 45, 0.14)'
            : flashDelta < 0
              ? 'rgba(127, 29, 29, 0.14)'
              : 'rgba(15, 23, 42, 0.4)',
      }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="flex items-center justify-between rounded-lg border px-3 py-2"
    >
      <span className="min-w-[80px] text-sm font-medium text-yellow-100/90">
        {label}
      </span>

      <div className="flex items-center gap-2">
        <div className="relative flex items-center gap-3">
          {isEditing ? (
            <input
              ref={inputRef}
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className="min-w-[64px] rounded border border-yellow-600/60 bg-yellow-900/40 px-3 py-1 text-center text-sm text-yellow-100 outline-none focus:border-yellow-500"
            />
          ) : (
            <div
              className={`min-w-[64px] rounded bg-slate-900/60 px-3 py-1 text-center text-sm text-yellow-100 ${
                editable
                  ? 'cursor-pointer transition-colors hover:border hover:border-yellow-600/40 hover:bg-slate-800/80'
                  : ''
              }`}
              onClick={handleStartEdit}
              title={editable ? '点击编辑' : ''}
            >
              <motion.span
                key={displayValue}
                initial={{ opacity: 0.55, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                className="inline-block tabular-nums"
              >
                {displayValue}
              </motion.span>
            </div>
          )}
          <AnimatePresence initial={false}>
            {diff !== 0 && !isEditing ? (
              <motion.div
                key={`${label}-${diff}`}
                initial={{ opacity: 0, y: 6, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.92 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className={`rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap ${
                  diff > 0
                    ? 'bg-emerald-500/14 text-emerald-300'
                    : 'bg-red-500/14 text-red-300'
                }`}
              >
                {diff > 0 ? '+' : ''}
                {diff}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
