'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useGameStore } from '@/features/simulator/store/gameStore';

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
  const inputRef = useRef<HTMLInputElement>(null);

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

  // 更新 editValue 当 value 改变时
  useEffect(() => {
    setEditValue(value.toString());
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
    <div className="flex items-center justify-between rounded-lg border border-yellow-800/30 bg-slate-900/40 px-3 py-2">
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
              {value}
            </div>
          )}
          {diff !== 0 && !isEditing && (
            <div
              className={`text-xs font-bold whitespace-nowrap ${
                diff > 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {diff > 0 ? '+' : ''}
              {diff}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
