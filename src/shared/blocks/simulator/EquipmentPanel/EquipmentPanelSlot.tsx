import type { ComponentType } from 'react';
import type { Equipment } from '@/features/simulator/store/gameTypes';
import { getEquipmentDefaultImage } from '@/features/simulator/utils/equipmentImage';
import { motion } from 'motion/react';

import type { SimulatorPrimaryEquipmentType } from '@/shared/lib/simulator-equipment';

type EquipmentPanelSlotTheme = 'yellow' | 'blue' | 'purple';
export type EquipmentPanelSlotInfo = {
  type: SimulatorPrimaryEquipmentType | 'trinket' | 'jade';
  name: string;
  icon: ComponentType<{ className?: string }>;
  slot?: number;
};

interface EquipmentPanelSlotProps {
  slotInfo: EquipmentPanelSlotInfo;
  equip: Equipment | undefined;
  onClick: () => void;
  theme?: EquipmentPanelSlotTheme;
}

const themeConfig: Record<
  EquipmentPanelSlotTheme,
  {
    border: string;
    bg: string;
    iconBg: string;
    iconColor: string;
    labelColor: string;
    nameColor: string;
    emptyColor: string;
    tooltipBorder: string;
  }
> = {
  yellow: {
    border: 'border-yellow-800/30 hover:border-yellow-600/50',
    bg: 'bg-slate-900/40 hover:bg-slate-900/60',
    iconBg:
      'from-yellow-900/40 to-yellow-800/20 border-yellow-700/40 group-hover:border-yellow-600/60',
    iconColor: 'text-yellow-500',
    labelColor: 'text-yellow-500/70',
    nameColor: 'text-yellow-100',
    emptyColor: 'text-yellow-700/50',
    tooltipBorder: 'border-yellow-700/60',
  },
  blue: {
    border: 'border-blue-700/30 hover:border-blue-500/50',
    bg: 'bg-slate-900/40 hover:bg-slate-900/60',
    iconBg:
      'from-blue-900/40 to-blue-800/20 border-blue-700/40 group-hover:border-blue-600/60',
    iconColor: 'text-blue-400',
    labelColor: 'text-blue-400/70',
    nameColor: 'text-blue-100',
    emptyColor: 'text-blue-700/50',
    tooltipBorder: 'border-blue-600/60',
  },
  purple: {
    border: 'border-purple-700/30 hover:border-purple-500/50',
    bg: 'bg-slate-900/40 hover:bg-slate-900/60',
    iconBg:
      'from-purple-900/40 to-purple-800/20 border-purple-700/40 group-hover:border-purple-600/60',
    iconColor: 'text-purple-400',
    labelColor: 'text-purple-400/70',
    nameColor: 'text-purple-100',
    emptyColor: 'text-purple-700/50',
    tooltipBorder: 'border-purple-600/60',
  },
};

function getForgeLabel(equipment: Equipment) {
  if (equipment.type === 'trinket') {
    return '星辉';
  }

  if (equipment.type === 'jade') {
    return '阶数';
  }

  return '锻';
}

export function EquipmentPanelSlot({
  slotInfo,
  equip,
  onClick,
  theme = 'yellow',
}: EquipmentPanelSlotProps) {
  const Icon = slotInfo.icon;
  const config = themeConfig[theme];

  return (
    <div className="relative">
      <motion.div
        whileHover={{ x: 2 }}
        className={`${config.bg} border ${config.border} group h-full cursor-pointer rounded-xl p-2.5 transition-all`}
        onClick={onClick}
      >
        <div className="flex gap-3">
          {equip ? (
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-yellow-800/30 bg-slate-950/50">
              <img
                src={equip.imageUrl || getEquipmentDefaultImage(equip.type)}
                alt={equip.name}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div
              className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg border bg-gradient-to-br transition-colors ${config.iconBg}`}
            >
              <Icon className={`h-6 w-6 ${config.iconColor}`} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              {equip ? (
                <>
                  <div
                    className={`${config.nameColor} max-w-[100px] truncate text-sm font-bold`}
                  >
                    {equip.name}
                  </div>
                  <span
                    className={`${config.nameColor.replace('-100', '-400')} rounded border bg-slate-800/50 px-1.5 py-0.5 text-[10px] font-medium ${config.tooltipBorder}`}
                  >
                    已装备
                  </span>
                </>
              ) : (
                <div className={`${config.labelColor} text-sm font-medium`}>
                  {slotInfo.name}
                </div>
              )}
            </div>

            {equip ? (
              <div className="mt-1 space-y-1">
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-yellow-500/70">
                  {equip.level && (
                    <span className="rounded bg-slate-800/60 px-1">
                      Lv.{equip.level}
                    </span>
                  )}
                  {equip.forgeLevel !== undefined && (
                    <span className="rounded bg-slate-800/60 px-1">
                      {getForgeLabel(equip)} {equip.forgeLevel}
                    </span>
                  )}
                  {equip.durability && (
                    <span className="rounded bg-slate-800/60 px-1">
                      耐久 {equip.durability}
                    </span>
                  )}
                </div>

                <div className="line-clamp-1 text-xs leading-snug break-all whitespace-pre-line text-slate-300">
                  {equip.mainStat}
                </div>
                {equip.extraStat && (
                  <div className="line-clamp-1 text-xs leading-snug break-all whitespace-pre-line text-green-400">
                    {equip.extraStat}
                  </div>
                )}

                {equip.highlights && equip.highlights.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {equip.highlights.map((highlight, index) => (
                      <span
                        key={`${equip.id}-${highlight}-${index}`}
                        className="rounded border border-red-500/50 bg-red-900/10 px-1 py-0.5 text-[10px] whitespace-nowrap text-red-400"
                      >
                        {highlight}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className={`${config.emptyColor} mt-1 text-xs italic`}>
                点击添加装备
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
