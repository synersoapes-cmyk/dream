// @ts-nocheck
import { Sword, Shield, Crown, Shirt, Circle, Footprints } from 'lucide-react';
import type { Equipment } from '@/features/simulator/store/gameTypes';
import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '@/features/simulator/store/gameStore';

interface EquipmentSlotProps {
  type: Equipment['type'];
  equipment: Equipment | null;
  onUpload?: () => void;
}

const iconMap: Record<Equipment['type'], any> = {
  weapon: Sword,
  helmet: Crown,
  necklace: Circle,
  armor: Shirt,
  belt: Circle,
  shoes: Footprints
};

const slotNames: Record<Equipment['type'], string> = {
  weapon: '武器',
  helmet: '头盔',
  necklace: '项链',
  armor: '衣服',
  belt: '腰带',
  shoes: '鞋子'
};

export function EquipmentSlot({ type, equipment, onUpload }: EquipmentSlotProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<'right' | 'left'>('right');
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
        className={`bg-slate-900/60 border-2 rounded-xl p-3 transition-all cursor-pointer group ${
          equipment 
            ? 'border-yellow-700/50 hover:border-yellow-600/70' 
            : 'border-yellow-800/30 hover:border-yellow-600/40'
        }`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={onUpload}
      >
        <div className="flex flex-col items-center gap-1.5">
          <div className={`w-14 h-14 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border flex items-center justify-center group-hover:scale-105 transition-transform ${
            equipment ? 'border-yellow-700/40' : 'border-yellow-700/20'
          }`}>
            <Icon className={`w-7 h-7 ${equipment ? 'text-yellow-500/80' : 'text-yellow-600/40'}`} />
          </div>
          <span className="text-xs text-yellow-400/70 font-medium">{slotNames[type]}</span>
          {equipment ? (
            <span className="text-xs text-yellow-100/90 font-semibold text-center line-clamp-1">{equipment.name}</span>
          ) : (
            <span className="text-xs text-slate-600 italic">未装备</span>
          )}
        </div>
      </div>

      {/* Tooltip */}
      {showTooltip && equipment && (
        <div 
          className={`fixed z-[9999] pointer-events-none ${
            tooltipPosition === 'right' ? 'ml-3' : 'mr-3'
          }`}
          style={{
            top: slotRef.current ? `${slotRef.current.getBoundingClientRect().top}px` : '0',
            [tooltipPosition === 'right' ? 'left' : 'right']: 
              tooltipPosition === 'right' 
                ? slotRef.current ? `${slotRef.current.getBoundingClientRect().right}px` : '0'
                : slotRef.current ? `${window.innerWidth - slotRef.current.getBoundingClientRect().left}px` : '0'
          }}
        >
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-2 border-yellow-700/60 rounded-lg p-5 shadow-2xl min-w-[280px]">
            <div className="text-yellow-100 font-bold text-base mb-3 border-b border-yellow-800/40 pb-2">
              {equipment.name}
            </div>
            <div className="text-yellow-400/90 text-sm font-semibold mb-3">
              {equipment.mainStat}
            </div>
            <div className="space-y-2">
              {Object.entries(equipment.stats).map(([key, value]) => {
                const labels: Record<string, string> = {
                  hit: '命中',
                  damage: '伤害',
                  defense: '防御',
                  speed: '速度',
                  magicDamage: '法伤',
                  magicDefense: '法防',
                  strength: '力量',
                  agility: '敏捷',
                  physique: '体质',
                  magic: '魔力',
                  endurance: '耐力'
                };
                return (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-yellow-600/80">{labels[key] || key}</span>
                    <span className="text-green-400 font-medium">+{value}</span>
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
