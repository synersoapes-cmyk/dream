// @ts-nocheck
import { useState } from 'react';
import { applySimulatorBundleToStore } from '@/features/simulator/utils/simulatorBundle';
import {
  ArrowRight,
  Check,
  TrendingDown,
  TrendingUp,
  X,
  XIcon,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { useGameStore } from '../store/gameStore';

export function EquipmentReplaceDialog() {
  const previewMode = useGameStore((state) => state.previewMode);
  const previewEquipment = useGameStore((state) => state.previewEquipment);
  const exitPreviewMode = useGameStore((state) => state.exitPreviewMode);
  const calculateStatsDiff = useGameStore((state) => state.calculateStatsDiff);
  const combatTarget = useGameStore((state) => state.combatTarget);
  const selectedSkill = useGameStore((state) => state.selectedSkill);
  const equipment = useGameStore((state) => state.equipment);
  const equipmentSets = useGameStore((state) => state.equipmentSets);
  const activeSetIndex = useGameStore((state) => state.activeSetIndex);
  const addHistorySnapshot = useGameStore((state) => state.addHistorySnapshot);

  const [isSavingReplacement, setIsSavingReplacement] = useState(false);
  const [saveReplacementError, setSaveReplacementError] = useState<
    string | null
  >(null);

  if (!previewMode || !previewEquipment || !previewEquipment.new) {
    return null;
  }

  const { current, new: newEquip } = previewEquipment;

  let statsDiff = {
    attributes: {},
    damageChange: { physical: 0, magic: 0, skill: 0 },
  };
  try {
    if (calculateStatsDiff && typeof calculateStatsDiff === 'function') {
      statsDiff = calculateStatsDiff();
    }
  } catch (error) {
    console.error('Error calculating stats diff:', error);
  }

  const damageDiff = statsDiff.damageChange;

  const handleConfirm = async () => {
    setIsSavingReplacement(true);
    setSaveReplacementError(null);

    try {
      const nextEquipment = (() => {
        const existingIndex = equipment.findIndex(
          (item) =>
            item.type === newEquip.type &&
            (newEquip.slot === undefined || item.slot === newEquip.slot)
        );

        if (existingIndex === -1) {
          return [...equipment, newEquip];
        }

        const cloned = [...equipment];
        cloned[existingIndex] = newEquip;
        return cloned;
      })();

      const resp = await fetch('/api/simulator/current/equipment', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          equipment: nextEquipment,
          equipmentSets,
          activeSetIndex,
        }),
      });

      const payload = await resp.json();
      if (!resp.ok || payload?.code !== 0 || !payload?.data) {
        throw new Error(payload?.message || '替换失败');
      }

      applySimulatorBundleToStore(payload.data, {
        preserveWorkbenchState: true,
      });
      addHistorySnapshot('equipment', `更换装备：${newEquip.name}`, []);
      exitPreviewMode();
    } catch (error) {
      console.error('Failed to replace simulator equipment:', error);
      setSaveReplacementError(
        error instanceof Error ? error.message : '替换失败'
      );
    } finally {
      setIsSavingReplacement(false);
    }
  };

  const handleCancel = () => {
    if (isSavingReplacement) {
      return;
    }
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
    endurance: '耐力',
  };

  return (
    <AnimatePresence>
      {previewMode && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-md"
            onClick={handleCancel}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.3 }}
            className="fixed top-1/2 left-1/2 z-[10001] max-h-[85vh] w-[700px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto"
          >
            <div className="overflow-hidden rounded-2xl border-2 border-yellow-700/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl">
              <div className="flex items-center justify-between border-b border-yellow-700/60 bg-gradient-to-r from-yellow-900/50 to-yellow-800/30 px-6 py-4">
                <div>
                  <h2 className="text-xl font-bold text-yellow-100">
                    装备替换预览
                  </h2>
                  <p className="mt-0.5 text-xs text-yellow-400/70">
                    Equipment Replacement Preview
                  </p>
                </div>
                <button
                  onClick={handleCancel}
                  className="rounded-lg p-2 transition-all hover:bg-yellow-900/40"
                  disabled={isSavingReplacement}
                >
                  <X className="h-5 w-5 text-yellow-400" />
                </button>
              </div>

              <div className="space-y-5 p-6">
                <div className="grid grid-cols-[1fr_auto_1fr] gap-4">
                  <div className="rounded-xl border border-yellow-800/30 bg-slate-900/60 p-4">
                    <div className="mb-3 text-center text-xs text-yellow-400/60">
                      当前装备
                    </div>
                    {current ? (
                      <>
                        <div className="mb-2 text-center font-bold text-yellow-100">
                          {current.name}
                        </div>
                        <div className="mb-3 border-b border-yellow-800/30 pb-3 text-center text-sm text-yellow-400/90">
                          {current.mainStat}
                        </div>
                        <div className="space-y-1.5">
                          {Object.entries(current.stats).map(([key, value]) => (
                            <div
                              key={key}
                              className="flex justify-between text-sm"
                            >
                              <span className="text-yellow-600/80">
                                {statLabels[key]}
                              </span>
                              <span className="text-yellow-300">+{value}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="py-8 text-center text-sm text-yellow-600/40 italic">
                        无装备
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-center">
                    <div className="rounded-full border border-yellow-700/40 bg-yellow-900/30 p-3">
                      <ArrowRight className="h-6 w-6 text-yellow-500" />
                    </div>
                  </div>

                  <div className="rounded-xl border-2 border-yellow-600/50 bg-gradient-to-br from-yellow-900/40 to-yellow-800/20 p-4 shadow-lg">
                    <div className="mb-3 text-center text-xs font-semibold text-yellow-400">
                      新装备
                    </div>
                    <div className="mb-2 text-center font-bold text-yellow-100">
                      {newEquip.name}
                    </div>
                    <div className="mb-3 border-b border-yellow-700/40 pb-3 text-center text-sm text-yellow-400">
                      {newEquip.mainStat}
                    </div>
                    <div className="space-y-1.5">
                      {Object.entries(newEquip.stats).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-yellow-500/80">
                            {statLabels[key]}
                          </span>
                          <span className="font-semibold text-green-400">
                            +{value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-yellow-800/40 bg-slate-900/40 p-4">
                  <h3 className="mb-3 flex items-center gap-2 border-b border-yellow-800/30 pb-2 text-sm font-bold text-yellow-400">
                    <TrendingUp className="h-4 w-4" />
                    属性变化总览
                  </h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {Object.entries(statsDiff.attributes).map(([key, diff]) => {
                      if (diff === 0) return null;
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between py-1 text-sm"
                        >
                          <span className="text-yellow-300">
                            {statLabels[key]}
                          </span>
                          <span
                            className={`flex items-center gap-1 font-semibold ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}
                          >
                            {diff > 0 ? (
                              <TrendingUp className="h-3.5 w-3.5" />
                            ) : (
                              <TrendingDown className="h-3.5 w-3.5" />
                            )}
                            {diff > 0 ? '+' : ''}
                            {diff}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-yellow-700/50 bg-gradient-to-br from-yellow-900/20 to-yellow-800/10 p-4">
                  <h3 className="mb-3 flex items-center gap-2 border-b border-yellow-700/40 pb-2 text-sm font-bold text-yellow-400">
                    <Zap className="h-4 w-4" />
                    战斗力变化预估
                  </h3>
                  <div className="mb-3 grid grid-cols-3 gap-4">
                    <div className="rounded-lg border border-yellow-800/30 bg-slate-900/50 p-3 text-center">
                      <div className="mb-1.5 text-xs text-yellow-400/70">
                        物理伤害
                      </div>
                      <div
                        className={`text-2xl font-bold ${damageDiff.physical > 0 ? 'text-green-400' : damageDiff.physical < 0 ? 'text-red-400' : 'text-yellow-300'}`}
                      >
                        {damageDiff.physical > 0 ? '+' : ''}
                        {damageDiff.physical}
                      </div>
                    </div>
                    <div className="rounded-lg border border-yellow-800/30 bg-slate-900/50 p-3 text-center">
                      <div className="mb-1.5 text-xs text-yellow-400/70">
                        法术伤害
                      </div>
                      <div
                        className={`text-2xl font-bold ${damageDiff.magic > 0 ? 'text-green-400' : damageDiff.magic < 0 ? 'text-red-400' : 'text-yellow-300'}`}
                      >
                        {damageDiff.magic > 0 ? '+' : ''}
                        {damageDiff.magic}
                      </div>
                    </div>
                    <div className="rounded-lg border border-yellow-800/30 bg-slate-900/50 p-3 text-center">
                      <div className="mb-1.5 text-xs text-yellow-400/70">
                        {selectedSkill ? selectedSkill.name : '技能伤害'}
                      </div>
                      <div
                        className={`text-2xl font-bold ${damageDiff.skill > 0 ? 'text-green-400' : damageDiff.skill < 0 ? 'text-red-400' : 'text-yellow-300'}`}
                      >
                        {damageDiff.skill > 0 ? '+' : ''}
                        {damageDiff.skill}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-yellow-800/20 bg-slate-900/40 py-2 text-center text-xs text-yellow-500/60">
                    对战目标：{combatTarget.name} | 物防 {combatTarget.defense}{' '}
                    | 法防 {combatTarget.magicDefense}
                  </div>
                </div>
              </div>

              <div className="border-t border-yellow-800/40 bg-slate-900/60 px-6 py-4">
                {saveReplacementError && (
                  <div className="mb-3 text-center text-xs text-red-300">
                    {saveReplacementError}
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={handleCancel}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-yellow-800/40 bg-slate-800/60 px-4 py-3 font-medium text-yellow-300 transition-all hover:border-yellow-700/60 hover:bg-slate-700/60"
                    disabled={isSavingReplacement}
                  >
                    <XIcon className="h-4 w-4" />
                    取消替换
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-600 to-yellow-700 px-4 py-3 font-bold text-slate-900 shadow-lg transition-all hover:from-yellow-500 hover:to-yellow-600 hover:shadow-yellow-900/50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSavingReplacement}
                  >
                    <Check className="h-5 w-5" />
                    {isSavingReplacement ? '保存中...' : '确认替换'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
