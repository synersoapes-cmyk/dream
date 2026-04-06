// @ts-nocheck
"use client";
import type { Equipment } from '@/features/simulator/store/gameTypes';
import { motion, AnimatePresence } from 'motion/react';
import { X, Package } from 'lucide-react';
import { useState } from 'react';
import { getEquipmentDefaultImage } from '@/features/simulator/utils/equipmentImage';

interface EquipmentLibraryModalProps {
  slotType: Equipment['type'];
  slotName: string;
  slotSlot?: number;
  onSelect: (equipment: Equipment) => void;
  onClose: () => void;
  availableEquipments: Equipment[];
}

export function EquipmentLibraryModal({
  slotType,
  slotName,
  slotSlot,
  onSelect,
  onClose,
  availableEquipments
}: EquipmentLibraryModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 筛选匹配的装备
  const filteredEquipments = availableEquipments.filter(eq => {
    if (eq.type !== slotType) return false;
    if (slotSlot !== undefined && eq.slot !== slotSlot) return false;
    return true;
  });

  // 主题配置
  const getThemeConfig = () => {
    if (slotType === 'trinket') {
      return {
        border: 'border-blue-600/60',
        titleBg: 'from-blue-900/50 to-blue-800/30',
        titleText: 'text-blue-100',
        accentColor: 'text-blue-400',
        buttonBg: 'bg-blue-600 hover:bg-blue-500',
        cardBorder: 'border-blue-700/40 hover:border-blue-500/60',
        selectedBorder: 'border-blue-500',
        selectedBg: 'bg-blue-900/30'
      };
    } else if (slotType === 'jade') {
      return {
        border: 'border-purple-600/60',
        titleBg: 'from-purple-900/50 to-purple-800/30',
        titleText: 'text-purple-100',
        accentColor: 'text-purple-400',
        buttonBg: 'bg-purple-600 hover:bg-purple-500',
        cardBorder: 'border-purple-700/40 hover:border-purple-500/60',
        selectedBorder: 'border-purple-500',
        selectedBg: 'bg-purple-900/30'
      };
    } else {
      return {
        border: 'border-yellow-700/60',
        titleBg: 'from-yellow-900/50 to-yellow-800/30',
        titleText: 'text-yellow-100',
        accentColor: 'text-yellow-400',
        buttonBg: 'bg-yellow-600 hover:bg-yellow-500',
        cardBorder: 'border-yellow-800/40 hover:border-yellow-600/60',
        selectedBorder: 'border-yellow-500',
        selectedBg: 'bg-yellow-900/30'
      };
    }
  };

  const theme = getThemeConfig();

  const handleSelect = () => {
    const equipment = filteredEquipments.find(eq => eq.id === selectedId);
    if (equipment) {
      onSelect(equipment);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* 背景遮罩 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* 弹窗内容 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={`relative w-full max-w-4xl max-h-[85vh] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-2 ${theme.border} rounded-2xl shadow-2xl flex flex-col overflow-hidden`}
        >
          {/* 标题栏 */}
          <div className={`bg-gradient-to-r ${theme.titleBg} border-b ${theme.border} px-6 py-4 flex justify-between items-center`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${theme.buttonBg} flex items-center justify-center`}>
                <Package className="w-5 h-5 text-slate-900" />
              </div>
              <div>
                <h2 className={`text-lg font-bold ${theme.titleText}`}>选择{slotName}</h2>
                <p className={`text-xs ${theme.accentColor}/80`}>从装备库中选择一件装备</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* 装备列表 */}
          <div className="flex-1 overflow-y-auto p-6">
            {filteredEquipments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12">
                <Package className={`w-16 h-16 ${theme.accentColor}/30 mb-4`} />
                <p className="text-slate-400 text-sm">暂无{slotName}装备</p>
                <p className="text-slate-500 text-xs mt-1">请先在实验室的新品装备库中添加装备</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredEquipments.map((equipment) => (
                  <motion.div
                    key={equipment.id}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setSelectedId(equipment.id)}
                    className={`bg-slate-900/40 border-2 rounded-xl p-3 cursor-pointer transition-all ${
                      selectedId === equipment.id
                        ? `${theme.selectedBorder} ${theme.selectedBg}`
                        : theme.cardBorder
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* 装备图片 */}
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-950/50 border border-yellow-800/30 shrink-0">
                        <img 
                          src={equipment.imageUrl || getEquipmentDefaultImage(equipment.type)} 
                          alt={equipment.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      
                      {/* 装备信息 */}
                      <div className="flex-1 min-w-0">
                        <div className={`font-bold text-sm ${theme.titleText} mb-1 truncate`}>
                          {equipment.name}
                        </div>
                        
                        {/* 基础信息 */}
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-yellow-500/70 mb-1">
                          {equipment.level && <span className="bg-slate-800/60 px-1 rounded">Lv.{equipment.level}</span>}
                          {equipment.forgeLevel !== undefined && (
                            <span className="bg-slate-800/60 px-1 rounded">
                              {equipment.type === 'trinket' ? '星辉' : equipment.type === 'jade' ? '阶数' : '锻'} {equipment.forgeLevel}
                            </span>
                          )}
                          {equipment.durability && <span className="bg-slate-800/60 px-1 rounded">耐久 {equipment.durability}</span>}
                        </div>
                        
                        {/* 主属性 */}
                        <div className="text-slate-300 text-xs mb-1">{equipment.mainStat}</div>
                        
                        {/* 价格 */}
                        {equipment.price && (
                          <div className="text-green-400 text-xs">¥{equipment.price}</div>
                        )}
                        
                        {/* 亮点信息 */}
                        {equipment.highlights && equipment.highlights.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {equipment.highlights.map((hl, idx) => (
                              <span key={idx} className="text-red-400 border border-red-500/50 bg-red-900/10 rounded px-1 py-0.5 text-[10px] whitespace-nowrap">
                                {hl}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* 底部按钮 */}
          <div className={`border-t ${theme.border} bg-slate-900/60 px-6 py-4 flex justify-end gap-3`}>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 text-sm font-medium transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSelect}
              disabled={!selectedId}
              className={`px-4 py-2 rounded-lg text-slate-900 text-sm font-medium transition-all ${
                selectedId
                  ? `${theme.buttonBg} shadow-lg`
                  : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
              }`}
            >
              装备
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
