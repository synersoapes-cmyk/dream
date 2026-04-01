// @ts-nocheck
import { useGameStore } from '../store/gameStore';
import type { Equipment } from '../store/gameTypes';
import { X, ArrowRight, Check, XIcon, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function EquipmentReplaceDialog() {
  const previewMode = useGameStore((state) => state.previewMode);
  const previewEquipment = useGameStore((state) => state.previewEquipment);
  const exitPreviewMode = useGameStore((state) => state.exitPreviewMode);
  const confirmReplacement = useGameStore((state) => state.confirmReplacement);
  const calculateStatsDiff = useGameStore((state) => state.calculateStatsDiff);
  const combatTarget = useGameStore((state) => state.combatTarget);
  const selectedSkill = useGameStore((state) => state.selectedSkill);
  
  if (!previewMode || !previewEquipment || !previewEquipment.new) return null;
  
  const { current, new: newEquip } = previewEquipment;
  
  let statsDiff = { attributes: {}, damageChange: { physical: 0, magic: 0, skill: 0 } };
  try {
    if (calculateStatsDiff && typeof calculateStatsDiff === 'function') {
      statsDiff = calculateStatsDiff();
    }
  } catch (error) {
    console.error('Error calculating stats diff:', error);
  }
  
  const damageDiff = statsDiff.damageChange;
  
  const handleConfirm = () => {
    confirmReplacement();
  };
  
  const handleCancel = () => {
    exitPreviewMode();
  };
  
  const statLabels: Record<string, string> = {
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
    <AnimatePresence>
      {previewMode && (
        <>
          {/* 遮罩层 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[10000]"
            onClick={handleCancel}
          />
          
          {/* 弹窗 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10001] w-[700px] max-h-[85vh] overflow-y-auto"
          >
            <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-2 border-yellow-700/60 rounded-2xl shadow-2xl overflow-hidden">
              {/* 标题栏 */}
              <div className="bg-gradient-to-r from-yellow-900/50 to-yellow-800/30 border-b border-yellow-700/60 px-6 py-4 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-yellow-100">装备替换预览</h2>
                  <p className="text-xs text-yellow-400/70 mt-0.5">Equipment Replacement Preview</p>
                </div>
                <button
                  onClick={handleCancel}
                  className="p-2 hover:bg-yellow-900/40 rounded-lg transition-all"
                >
                  <X className="w-5 h-5 text-yellow-400" />
                </button>
              </div>
              
              <div className="p-6 space-y-5">
                {/* 装备对比 */}
                <div className="grid grid-cols-[1fr_auto_1fr] gap-4">
                  {/* 当前装备 */}
                  <div className="bg-slate-900/60 border border-yellow-800/30 rounded-xl p-4">
                    <div className="text-yellow-400/60 text-xs mb-3 text-center">当前装备</div>
                    {current ? (
                      <>
                        <div className="text-yellow-100 font-bold text-center mb-2">{current.name}</div>
                        <div className="text-yellow-400/90 text-sm text-center mb-3 pb-3 border-b border-yellow-800/30">{current.mainStat}</div>
                        <div className="space-y-1.5">
                          {Object.entries(current.stats).map(([key, value]) => (
                            <div key={key} className="flex justify-between text-sm">
                              <span className="text-yellow-600/80">{statLabels[key]}</span>
                              <span className="text-yellow-300">+{value}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="text-yellow-600/40 text-sm italic text-center py-8">无装备</div>
                    )}
                  </div>
                  
                  {/* 箭头 */}
                  <div className="flex items-center justify-center">
                    <div className="bg-yellow-900/30 p-3 rounded-full border border-yellow-700/40">
                      <ArrowRight className="w-6 h-6 text-yellow-500" />
                    </div>
                  </div>
                  
                  {/* 新装备 */}
                  <div className="bg-gradient-to-br from-yellow-900/40 to-yellow-800/20 border-2 border-yellow-600/50 rounded-xl p-4 shadow-lg">
                    <div className="text-yellow-400 text-xs mb-3 text-center font-semibold">新装备</div>
                    <div className="text-yellow-100 font-bold text-center mb-2">{newEquip.name}</div>
                    <div className="text-yellow-400 text-sm text-center mb-3 pb-3 border-b border-yellow-700/40">{newEquip.mainStat}</div>
                    <div className="space-y-1.5">
                      {Object.entries(newEquip.stats).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-yellow-500/80">{statLabels[key]}</span>
                          <span className="text-green-400 font-semibold">+{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* 属性变化 */}
                <div className="bg-slate-900/40 border border-yellow-800/40 rounded-xl p-4">
                  <h3 className="text-yellow-400 text-sm font-bold mb-3 flex items-center gap-2 pb-2 border-b border-yellow-800/30">
                    <TrendingUp className="w-4 h-4" />
                    属性变化总览
                  </h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {Object.entries(statsDiff.attributes).map(([key, diff]) => {
                      if (diff === 0) return null;
                      return (
                        <div key={key} className="flex justify-between items-center text-sm py-1">
                          <span className="text-yellow-300">{statLabels[key]}</span>
                          <span className={`font-semibold flex items-center gap-1 ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {diff > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                            {diff > 0 ? '+' : ''}{diff}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* 伤害变化 */}
                <div className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/10 border border-yellow-700/50 rounded-xl p-4">
                  <h3 className="text-yellow-400 text-sm font-bold mb-3 flex items-center gap-2 pb-2 border-b border-yellow-700/40">
                    <Zap className="w-4 h-4" />
                    战斗力变化预测
                  </h3>
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div className="text-center bg-slate-900/50 rounded-lg p-3 border border-yellow-800/30">
                      <div className="text-yellow-400/70 text-xs mb-1.5">物理伤害</div>
                      <div className={`text-2xl font-bold ${damageDiff.physical > 0 ? 'text-green-400' : damageDiff.physical < 0 ? 'text-red-400' : 'text-yellow-300'}`}>
                        {damageDiff.physical > 0 ? '+' : ''}{damageDiff.physical}
                      </div>
                    </div>
                    <div className="text-center bg-slate-900/50 rounded-lg p-3 border border-yellow-800/30">
                      <div className="text-yellow-400/70 text-xs mb-1.5">法术伤害</div>
                      <div className={`text-2xl font-bold ${damageDiff.magic > 0 ? 'text-green-400' : damageDiff.magic < 0 ? 'text-red-400' : 'text-yellow-300'}`}>
                        {damageDiff.magic > 0 ? '+' : ''}{damageDiff.magic}
                      </div>
                    </div>
                    <div className="text-center bg-slate-900/50 rounded-lg p-3 border border-yellow-800/30">
                      <div className="text-yellow-400/70 text-xs mb-1.5">
                        {selectedSkill ? selectedSkill.name : '技能伤害'}
                      </div>
                      <div className={`text-2xl font-bold ${damageDiff.skill > 0 ? 'text-green-400' : damageDiff.skill < 0 ? 'text-red-400' : 'text-yellow-300'}`}>
                        {damageDiff.skill > 0 ? '+' : ''}{damageDiff.skill}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-yellow-500/60 text-center bg-slate-900/40 py-2 rounded-lg border border-yellow-800/20">
                    对战目标：{combatTarget.name} · 物防 {combatTarget.defense} · 法防 {combatTarget.magicDefense}
                  </div>
                </div>
              </div>
              
              {/* 操作按钮 */}
              <div className="bg-slate-900/60 border-t border-yellow-800/40 px-6 py-4 flex gap-3">
                <button
                  onClick={handleCancel}
                  className="flex-1 px-4 py-3 bg-slate-800/60 hover:bg-slate-700/60 border border-yellow-800/40 hover:border-yellow-700/60 rounded-xl text-yellow-300 font-medium transition-all flex items-center justify-center gap-2"
                >
                  <XIcon className="w-4 h-4" />
                  取消更换
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-500 hover:to-yellow-600 rounded-xl text-slate-900 font-bold transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-yellow-900/50"
                >
                  <Check className="w-5 h-5" />
                  确认替换
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
