// @ts-nocheck
import type { Equipment } from '@/features/simulator/store/gameTypes';
import { EquipmentImage } from '@/shared/blocks/generator/EquipmentPanel/EquipmentImage';

interface LibraryEquipmentCardProps {
  equipment: Equipment;
  onClick: () => void;
  formatPrice: (price: number | undefined) => string;
  isSelected?: boolean;
  isSelectionMode?: boolean;
}

export function LibraryEquipmentCard({ equipment, onClick, formatPrice, isSelected = false, isSelectionMode = false }: LibraryEquipmentCardProps) {
  const totalPrice = (equipment.price || 0) + (equipment.crossServerFee || 0);
  
  return (
    <div 
      onClick={onClick}
      className={`bg-slate-900/60 border rounded-xl p-3 cursor-pointer transition-colors flex flex-col gap-1.5 shadow-sm relative overflow-hidden group ${
        isSelected 
          ? 'border-yellow-600 bg-yellow-900/20' 
          : 'border-yellow-800/40 hover:border-yellow-600/60'
      }`}
    >
      {/* 选中状态指示器 */}
      {isSelectionMode && (
        <div className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-all z-10 ${
          isSelected 
            ? 'bg-yellow-600 border-yellow-600' 
            : 'bg-slate-800/50 border-slate-600'
        }`}>
          {isSelected && (
            <svg className="w-3 h-3 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      )}
      
      {/* 装备图片 */}
      <div className={`${isSelectionMode ? 'ml-7' : ''} mb-2`}>
        <EquipmentImage equipment={equipment} size="lg" />
      </div>
      
      {/* 右上角总价标签 */}
      <div className="absolute top-0 right-0 bg-yellow-900/60 border-b border-l border-yellow-700/50 px-2 py-0.5 rounded-bl-lg">
        <div className="text-[10px] text-yellow-500/80 font-medium leading-none mb-0.5">总价</div>
        <div className="text-xs font-bold text-[#fff064]">¥ {formatPrice(totalPrice)}</div>
      </div>
      
      <div className={`text-yellow-100 font-bold text-sm truncate ${isSelectionMode ? 'pl-7' : ''} pr-16`}>{equipment.name}</div>
      <div className={`text-slate-300 text-xs truncate mt-1 ${isSelectionMode ? 'pl-7' : ''}`}>{equipment.mainStat.split('\n')[0]}</div>
      {equipment.extraStat && (
        <div className={`text-red-400 text-xs truncate ${isSelectionMode ? 'pl-7' : ''}`}>{equipment.extraStat.split('\n')[0]}</div>
      )}
      {equipment.highlights && equipment.highlights.length > 0 && (
        <div className={`flex flex-wrap gap-1 mt-auto ${isSelectionMode ? 'pl-7' : ''}`}>
          {equipment.highlights.slice(0, 2).map((hl, idx) => (
            <span key={idx} className="text-red-400 border border-red-500/50 rounded px-1 text-[10px]">
              {hl}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
