// @ts-nocheck
import type { Equipment } from '@/features/simulator/store/gameTypes';
import { EquipmentImage } from '@/shared/blocks/simulator/EquipmentPanel/EquipmentImage';

interface PendingEquipmentCardProps {
  equipment: Equipment;
  onClick: () => void;
  formatPrice: (price: number | undefined) => string;
}

export function PendingEquipmentCard({ equipment, onClick, formatPrice }: PendingEquipmentCardProps) {
  return (
    <div 
      onClick={onClick}
      className="bg-slate-900/60 border border-yellow-800/40 rounded-xl p-2.5 cursor-pointer hover:border-yellow-600/60 hover:bg-slate-900/80 transition-all"
    >
      <div className="flex gap-3">
        <EquipmentImage equipment={equipment} size="md" />
        {/* 左列：装备信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="text-yellow-100 font-bold text-sm">{equipment.name}</div>
            <span className="text-orange-400 border border-orange-600/50 bg-orange-900/20 rounded px-1.5 py-0.5 text-[10px] font-medium">待确认</span>
          </div>
          
          <div className="text-slate-300 text-xs leading-snug break-all whitespace-pre-line line-clamp-1">{equipment.mainStat}</div>
          
          {equipment.extraStat && (
            <div className="text-red-400 text-xs leading-snug break-all whitespace-pre-line line-clamp-1">{equipment.extraStat}</div>
          )}
          
          {equipment.highlights && equipment.highlights.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {equipment.highlights.map((hl, idx) => (
                <span key={idx} className="text-red-400 border border-red-500/50 rounded px-1 py-0.5 text-[10px]">
                  {hl}
                </span>
              ))}
            </div>
          )}
        </div>
        
        {/* 右列：价格信息 - 固定宽度容纳8位数 */}
        <div className="flex flex-col gap-1.5 shrink-0 border-l border-slate-700/50 pl-3 w-28">
          <div className="text-right">
            <div className="text-[9px] text-slate-500 mb-0.5">售价</div>
            <div className="text-sm font-bold whitespace-nowrap text-[#fff064]">¥ {formatPrice(equipment.price)}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-slate-500 mb-0.5">跨服</div>
            <div className="text-sm font-bold whitespace-nowrap text-[#fff064]">¥ {formatPrice(equipment.crossServerFee)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
