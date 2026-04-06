// @ts-nocheck
import type { ComponentType } from 'react';
import { motion } from 'motion/react';

import type { Equipment } from '@/features/simulator/store/gameTypes';
import { getEquipmentDefaultImage } from '@/features/simulator/utils/equipmentImage';

type EquipmentPanelSlotTheme = 'yellow' | 'blue' | 'purple';

interface EquipmentPanelSlotProps {
  slotInfo: { type: Equipment['type']; name: string; icon: ComponentType<{ className?: string }>; slot?: number };
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
    iconBg: 'from-yellow-900/40 to-yellow-800/20 border-yellow-700/40 group-hover:border-yellow-600/60',
    iconColor: 'text-yellow-500',
    labelColor: 'text-yellow-500/70',
    nameColor: 'text-yellow-100',
    emptyColor: 'text-yellow-700/50',
    tooltipBorder: 'border-yellow-700/60',
  },
  blue: {
    border: 'border-blue-700/30 hover:border-blue-500/50',
    bg: 'bg-slate-900/40 hover:bg-slate-900/60',
    iconBg: 'from-blue-900/40 to-blue-800/20 border-blue-700/40 group-hover:border-blue-600/60',
    iconColor: 'text-blue-400',
    labelColor: 'text-blue-400/70',
    nameColor: 'text-blue-100',
    emptyColor: 'text-blue-700/50',
    tooltipBorder: 'border-blue-600/60',
  },
  purple: {
    border: 'border-purple-700/30 hover:border-purple-500/50',
    bg: 'bg-slate-900/40 hover:bg-slate-900/60',
    iconBg: 'from-purple-900/40 to-purple-800/20 border-purple-700/40 group-hover:border-purple-600/60',
    iconColor: 'text-purple-400',
    labelColor: 'text-purple-400/70',
    nameColor: 'text-purple-100',
    emptyColor: 'text-purple-700/50',
    tooltipBorder: 'border-purple-600/60',
  },
};

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
        className={`${config.bg} border ${config.border} rounded-xl p-2.5 cursor-pointer transition-all group h-full`}
        onClick={onClick}
      >
        <div className="flex gap-3">
          {equip ? (
            <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-950/50 border border-yellow-800/30 shrink-0">
              <img
                src={equip.imageUrl || getEquipmentDefaultImage(equip.type)}
                alt={equip.name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className={`w-14 h-14 flex-shrink-0 bg-gradient-to-br ${config.iconBg} border rounded-lg flex items-center justify-center transition-colors`}>
              <Icon className={`w-6 h-6 ${config.iconColor}`} />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {equip ? (
                <>
                  <div className={`${config.nameColor} font-bold text-sm truncate max-w-[100px]`}>{equip.name}</div>
                  <span className={`${config.nameColor.replace('text-', 'text-').replace('-100', '-400')} border ${config.tooltipBorder} bg-slate-800/50 rounded px-1.5 py-0.5 text-[10px] font-medium`}>
                    已装备
                  </span>
                </>
              ) : (
                <div className={`${config.labelColor} text-sm font-medium`}>{slotInfo.name}</div>
              )}
            </div>

            {equip ? (
              <div className="space-y-1 mt-1">
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-yellow-500/70">
                  {equip.level && <span className="bg-slate-800/60 px-1 rounded">Lv.{equip.level}</span>}
                  {equip.forgeLevel !== undefined && (
                    <span className="bg-slate-800/60 px-1 rounded">
                      {equip.type === 'trinket' ? '星辉' : equip.type === 'jade' ? '阶数' : '锻'} {equip.forgeLevel}
                    </span>
                  )}
                  {equip.durability && <span className="bg-slate-800/60 px-1 rounded">耐久 {equip.durability}</span>}
                </div>

                <div className="text-slate-300 text-xs leading-snug break-all whitespace-pre-line line-clamp-1">{equip.mainStat}</div>
                {equip.extraStat && (
                  <div className="text-green-400 text-xs leading-snug break-all whitespace-pre-line line-clamp-1">{equip.extraStat}</div>
                )}

                {equip.highlights && equip.highlights.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {equip.highlights.map((highlight, index) => (
                      <span key={index} className="text-red-400 border border-red-500/50 bg-red-900/10 rounded px-1 py-0.5 text-[10px] whitespace-nowrap">
                        {highlight}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className={`${config.emptyColor} text-xs italic mt-1`}>点击添加装备</div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
