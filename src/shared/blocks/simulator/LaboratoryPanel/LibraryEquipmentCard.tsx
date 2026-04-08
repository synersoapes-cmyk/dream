import type { Equipment } from '@/features/simulator/store/gameTypes';

import { EquipmentImage } from '@/shared/blocks/simulator/EquipmentPanel/EquipmentImage';

interface LibraryEquipmentCardProps {
  equipment: Equipment;
  onClick: () => void;
  formatPrice: (price: number | undefined) => string;
  isSelected?: boolean;
  isSelectionMode?: boolean;
}

export function LibraryEquipmentCard({
  equipment,
  onClick,
  formatPrice,
  isSelected = false,
  isSelectionMode = false,
}: LibraryEquipmentCardProps) {
  const totalPrice = (equipment.price || 0) + (equipment.crossServerFee || 0);

  return (
    <div
      onClick={onClick}
      className={`group relative flex cursor-pointer flex-col gap-1.5 overflow-hidden rounded-xl border bg-slate-900/60 p-3 shadow-sm transition-colors ${
        isSelected
          ? 'border-yellow-600 bg-yellow-900/20'
          : 'border-yellow-800/40 hover:border-yellow-600/60'
      }`}
    >
      {/* 选中状态指示器 */}
      {isSelectionMode && (
        <div
          className={`absolute top-2 left-2 z-10 flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${
            isSelected
              ? 'border-yellow-600 bg-yellow-600'
              : 'border-slate-600 bg-slate-800/50'
          }`}
        >
          {isSelected && (
            <svg
              className="h-3 w-3 text-slate-900"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>
      )}

      <div className={`${isSelectionMode ? 'ml-7' : ''} mb-2`}>
        <EquipmentImage equipment={equipment} size="lg" />
      </div>

      <div className="absolute top-0 right-0 rounded-bl-lg border-b border-l border-yellow-700/50 bg-yellow-900/60 px-2 py-0.5">
        <div className="mb-0.5 text-[10px] leading-none font-medium text-yellow-500/80">
          总价
        </div>
        <div className="text-xs font-bold text-[#fff064]">
          ¥ {formatPrice(totalPrice)}
        </div>
      </div>

      <div
        className={`text-sm font-bold text-yellow-100 ${isSelectionMode ? 'pl-7' : ''} truncate pr-16`}
      >
        {equipment.name}
      </div>
      <div
        className={`mt-1 truncate text-xs text-slate-300 ${isSelectionMode ? 'pl-7' : ''}`}
      >
        {equipment.mainStat.split('\n')[0]}
      </div>
      {equipment.extraStat && (
        <div
          className={`truncate text-xs text-red-400 ${isSelectionMode ? 'pl-7' : ''}`}
        >
          {equipment.extraStat.split('\n')[0]}
        </div>
      )}
      {equipment.highlights && equipment.highlights.length > 0 && (
        <div
          className={`mt-auto flex flex-wrap gap-1 ${isSelectionMode ? 'pl-7' : ''}`}
        >
          {equipment.highlights.slice(0, 2).map((hl, idx) => (
            <span
              key={`${equipment.id}-${hl}-${idx}`}
              className="rounded border border-red-500/50 px-1 text-[10px] text-red-400"
            >
              {hl}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
