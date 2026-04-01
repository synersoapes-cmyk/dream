// @ts-nocheck
import { useGameStore } from '@/features/simulator/store/gameStore';
import { useState, useRef, useEffect } from 'react';

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
  editable = true
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div className="flex items-center justify-between py-2 px-3 bg-slate-900/40 border border-yellow-800/30 rounded-lg">
      <span className="text-sm text-yellow-100/90 font-medium min-w-[80px]">{label}</span>
      
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
              className="min-w-[64px] text-center bg-yellow-900/40 border border-yellow-600/60 text-yellow-100 text-sm rounded px-3 py-1 outline-none focus:border-yellow-500"
            />
          ) : (
            <div 
              className={`min-w-[64px] text-center bg-slate-900/60 text-yellow-100 text-sm rounded px-3 py-1 ${
                editable ? 'cursor-pointer hover:bg-slate-800/80 hover:border hover:border-yellow-600/40 transition-colors' : ''
              }`}
              onClick={handleStartEdit}
              title={editable ? '点击编辑' : ''}
            >
              {value}
            </div>
          )}
          {diff !== 0 && !isEditing && (
            <div className={`text-xs font-bold whitespace-nowrap ${
              diff > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {diff > 0 ? '+' : ''}{diff}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
