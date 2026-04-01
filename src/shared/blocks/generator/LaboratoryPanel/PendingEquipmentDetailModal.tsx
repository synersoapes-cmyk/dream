// @ts-nocheck
import type { Equipment } from '@/features/simulator/store/gameTypes';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { EquipmentImage } from '@/shared/blocks/generator/EquipmentPanel/EquipmentImage';

interface PendingEquipmentDetailModalProps {
  equipment: Equipment;
  onClose: () => void;
  onDelete: () => void;
  onConfirm: () => void;
  onReplaceToCurrentState: () => void;
}

export function PendingEquipmentDetailModal({
  equipment,
  onClose,
  onDelete,
  onConfirm,
  onReplaceToCurrentState,
}: PendingEquipmentDetailModalProps) {
  // 格式化金额显示：默认不显示小数，有小数时最多显示2位
  const formatPrice = (price: number | undefined) => {
    if (price === undefined) return '-';
    const hasDecimal = price % 1 !== 0;
    return hasDecimal ? price.toFixed(2) : price.toString();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/95 z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-yellow-700/60 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* 顶部标题栏 */}
        <div className="bg-gradient-to-r from-yellow-900/50 to-yellow-800/30 border-b border-yellow-700/60 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-yellow-100">{equipment.name}</h2>
            <p className="text-xs text-yellow-400/80 mt-1">装备详细信息</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {/* 装备名称和图片 */}
          <div className="bg-slate-950/40 rounded-lg p-4 border border-yellow-800/30">
            <div className="flex gap-4 items-start mb-3">
              <EquipmentImage equipment={equipment} size="xl" />
              <div className="flex-1">
                <div className="text-2xl font-bold text-yellow-400 mb-2">{equipment.name}</div>
                {/* 主属性描述 */}
                {equipment.mainStat && (
                  <div className="text-slate-200 text-sm leading-relaxed whitespace-pre-line">
                    {equipment.mainStat}
                  </div>
                )}
              </div>
            </div>
            
            {/* 额外红字属性 */}
            {equipment.extraStat && (
              <div className="text-red-400 text-sm leading-relaxed whitespace-pre-line mt-2">
                {equipment.extraStat}
              </div>
            )}
            
            {/* 亮点标签 */}
            {equipment.highlights && equipment.highlights.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {equipment.highlights.map((hl, idx) => (
                  <span
                    key={idx}
                    className="text-red-400 border border-red-500/50 rounded px-2 py-1 text-xs font-medium"
                  >
                    {hl}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 符石信息 */}
          {equipment.runeStoneSets && equipment.runeStoneSets.length > 0 && (
            <div className="bg-slate-950/40 rounded-lg p-4 border border-yellow-800/30">
              <div className="text-sm font-bold text-yellow-400 mb-2">符石信息</div>
              {equipment.runeStoneSets.map((set, idx) => (
                <div key={idx} className="mb-3 last:mb-0">
                  {equipment.runeStoneSetsNames?.[idx] && (
                    <div className="text-xs text-purple-400 font-medium mb-1">
                      {equipment.runeStoneSetsNames[idx]}
                    </div>
                  )}
                  <div className="space-y-1">
                    {set.map((stone, sIdx) => (
                      <div key={sIdx} className="text-xs text-green-400 leading-relaxed">
                        符石: {stone.name || '未命名'} {stone.description || ''}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 价格信息 */}
          <div className="bg-slate-950/40 rounded-lg p-4 border border-yellow-800/30">
            <div className="text-sm font-bold text-yellow-400 mb-3">价格信息</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-400 mb-1">售价</div>
                <div className="text-lg font-bold text-red-400">
                  ¥ {formatPrice(equipment.price)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">跨服费用</div>
                <div className="text-lg font-bold text-orange-400">
                  ¥ {formatPrice(equipment.crossServerFee)}
                </div>
              </div>
            </div>
          </div>

          {/* 属性统计 */}
          <div className="bg-slate-950/40 rounded-lg p-4 border border-yellow-800/30">
            <div className="text-sm font-bold text-yellow-400 mb-3">属性统计</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {Object.entries(equipment.stats || {}).map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-slate-400">{getStatName(key)}:</span>
                  <span className="text-slate-200 font-medium">{value}</span>
                </div>
              ))}
              {(!equipment.stats || Object.keys(equipment.stats).length === 0) && (
                <div className="col-span-2 text-slate-500 text-xs italic">暂无属性数据</div>
              )}
            </div>
          </div>
        </div>

        {/* 底部操作按钮 */}
        <div className="bg-slate-900/80 border-t border-yellow-700/60 px-6 py-4 flex gap-3">
          <button
            onClick={onDelete}
            className="flex-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-700/50 px-4 py-2.5 rounded-lg font-medium transition-colors"
          >
            删除
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-green-900/30 hover:bg-green-900/50 text-green-400 border border-green-700/50 px-4 py-2.5 rounded-lg font-medium transition-colors"
          >
            确认入库
          </button>
          <button
            onClick={onReplaceToCurrentState}
            className="flex-1 bg-yellow-900/30 hover:bg-yellow-900/50 text-yellow-400 border border-yellow-700/50 px-4 py-2.5 rounded-lg font-medium transition-colors"
          >
            替换到当前状态
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// 属性名称映射
function getStatName(key: string): string {
  const statNames: Record<string, string> = {
    hp: '气血',
    magic: '魔法',
    hit: '命中',
    damage: '伤害',
    magicDamage: '法伤',
    defense: '防御',
    magicDefense: '法防',
    speed: '速度',
    dodge: '躲避',
    physique: '体质',
    magicPower: '魔力',
    strength: '力量',
    endurance: '耐力',
    agility: '敏捷',
  };
  return statNames[key] || key;
}
