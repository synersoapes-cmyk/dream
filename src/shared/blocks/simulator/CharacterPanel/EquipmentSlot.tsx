import { useEffect, useRef, useState } from 'react';
import type { Equipment } from '@/features/simulator/store/gameTypes';
import { Circle, Crown, Footprints, Shield, Shirt, Sword } from 'lucide-react';

import type { SimulatorPrimaryEquipmentType } from '@/shared/lib/simulator-equipment';
import {
  findSimulatorSlotDefinition,
  getSimulatorSlotLabel,
} from '@/shared/lib/simulator-slot-config';
import { getSimulatorStatLabel } from '@/shared/lib/simulator-stat-labels';

interface EquipmentSlotProps {
  type: SimulatorPrimaryEquipmentType;
  equipment: Equipment | null;
  onUpload?: () => void;
}

const iconMap: Record<
  SimulatorPrimaryEquipmentType,
  React.ComponentType<{ className?: string }>
> = {
  weapon: Sword,
  helmet: Crown,
  necklace: Circle,
  armor: Shirt,
  belt: Circle,
  shoes: Footprints,
};

export function EquipmentSlot({
  type,
  equipment,
  onUpload,
}: EquipmentSlotProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<'right' | 'left'>(
    'right'
  );
  const slotRef = useRef<HTMLDivElement>(null);
  const Icon = iconMap[type] || Shield;

  useEffect(() => {
    if (showTooltip && slotRef.current) {
      const rect = slotRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;

      // 如果装备在右半部分，浮层显示在左侧
      if (rect.right + 320 > viewportWidth) {
        setTooltipPosition('left');
      } else {
        setTooltipPosition('right');
      }
    }
  }, [showTooltip]);

  return (
    <div className="relative" ref={slotRef}>
      <div
        className={`group cursor-pointer rounded-xl border-2 bg-slate-900/60 p-3 transition-all ${
          equipment
            ? 'border-yellow-700/50 hover:border-yellow-600/70'
            : 'border-yellow-800/30 hover:border-yellow-600/40'
        }`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={onUpload}
      >
        <div className="flex flex-col items-center gap-1.5">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-lg border bg-gradient-to-br from-slate-800 to-slate-900 transition-transform group-hover:scale-105 ${
              equipment ? 'border-yellow-700/40' : 'border-yellow-700/20'
            }`}
          >
            <Icon
              className={`h-7 w-7 ${equipment ? 'text-yellow-500/80' : 'text-yellow-600/40'}`}
            />
          </div>
          <span className="text-xs font-medium text-yellow-400/70">
            {getSimulatorSlotLabel(
              findSimulatorSlotDefinition(type) ?? {
                id: type,
                type,
                category: 'equipment',
                labels: { default: type },
              },
              'laboratory'
            )}
          </span>
          {equipment ? (
            <span className="line-clamp-1 text-center text-xs font-semibold text-yellow-100/90">
              {equipment.name}
            </span>
          ) : (
            <span className="text-xs text-slate-600 italic">未装备</span>
          )}
        </div>
      </div>

      {/* Tooltip */}
      {showTooltip && equipment && (
        <div
          className={`pointer-events-none fixed z-[9999] ${
            tooltipPosition === 'right' ? 'ml-3' : 'mr-3'
          }`}
          style={{
            top: slotRef.current
              ? `${slotRef.current.getBoundingClientRect().top}px`
              : '0',
            [tooltipPosition === 'right' ? 'left' : 'right']:
              tooltipPosition === 'right'
                ? slotRef.current
                  ? `${slotRef.current.getBoundingClientRect().right}px`
                  : '0'
                : slotRef.current
                  ? `${window.innerWidth - slotRef.current.getBoundingClientRect().left}px`
                  : '0',
          }}
        >
          <div className="min-w-[280px] rounded-lg border-2 border-yellow-700/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 shadow-2xl">
            <div className="mb-3 border-b border-yellow-800/40 pb-2 text-base font-bold text-yellow-100">
              {equipment.name}
            </div>
            <div className="mb-3 text-sm font-semibold text-yellow-400/90">
              {equipment.mainStat}
            </div>
            <div className="space-y-2">
              {Object.entries(equipment.stats).map(([key, value]) => {
                return (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-yellow-600/80">
                      {getSimulatorStatLabel(key, 'equipment')}
                    </span>
                    <span className="font-medium text-green-400">+{value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
