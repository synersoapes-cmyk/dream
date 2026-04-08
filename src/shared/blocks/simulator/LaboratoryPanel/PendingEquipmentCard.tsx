import type { Equipment } from '@/features/simulator/store/gameTypes';

import { EquipmentImage } from '@/shared/blocks/simulator/EquipmentPanel/EquipmentImage';

interface PendingEquipmentCardProps {
  equipment: Equipment;
  onClick: () => void;
  formatPrice: (price: number | undefined) => string;
}

export function PendingEquipmentCard({
  equipment,
  onClick,
  formatPrice,
}: PendingEquipmentCardProps) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-xl border border-yellow-800/40 bg-slate-900/60 p-2.5 transition-all hover:border-yellow-600/60 hover:bg-slate-900/80"
    >
      <div className="flex gap-3">
        <EquipmentImage equipment={equipment} size="md" />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <div className="text-sm font-bold text-yellow-100">
              {equipment.name}
            </div>
            <span className="rounded border border-orange-600/50 bg-orange-900/20 px-1.5 py-0.5 text-[10px] font-medium text-orange-400">
              待确认
            </span>
          </div>

          <div className="line-clamp-1 text-xs leading-snug break-all whitespace-pre-line text-slate-300">
            {equipment.mainStat}
          </div>

          {equipment.extraStat && (
            <div className="line-clamp-1 text-xs leading-snug break-all whitespace-pre-line text-red-400">
              {equipment.extraStat}
            </div>
          )}

          {equipment.highlights && equipment.highlights.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {equipment.highlights.map((hl, idx) => (
                <span
                  key={`${equipment.id}-${hl}-${idx}`}
                  className="rounded border border-red-500/50 px-1 py-0.5 text-[10px] text-red-400"
                >
                  {hl}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex w-28 shrink-0 flex-col gap-1.5 border-l border-slate-700/50 pl-3">
          <div className="text-right">
            <div className="mb-0.5 text-[9px] text-slate-500">售价</div>
            <div className="text-sm font-bold whitespace-nowrap text-[#fff064]">
              ¥ {formatPrice(equipment.price)}
            </div>
          </div>
          <div className="text-right">
            <div className="mb-0.5 text-[9px] text-slate-500">跨服</div>
            <div className="text-sm font-bold whitespace-nowrap text-[#fff064]">
              ¥ {formatPrice(equipment.crossServerFee)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
