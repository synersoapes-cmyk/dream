'use client';

import { useEffect, useMemo, useState } from 'react';
import { DUNGEON_DATABASE } from '@/features/simulator/store/gameData';
import { useGameStore } from '@/features/simulator/store/gameStore';
import type {
  Dungeon,
  DungeonTarget,
  EnemyTarget,
} from '@/features/simulator/store/gameTypes';
import { applySimulatorBundleToStore } from '@/features/simulator/utils/simulatorBundle';
import { buildDungeonDatabaseFromTemplates } from '@/features/simulator/utils/targetTemplates';
import {
  Check,
  ChevronDown,
  Edit2,
  Flame,
  Minus,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  Sword,
  Target,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';

import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

import { SimpleSelect } from './SimpleSelect';
import { SkillDamagePanel } from './SkillDamagePanel';
import { Slider } from './Slider';

type ManualAttackStatKey =
  | 'magicDamage'
  | 'spiritualPower'
  | 'magicCritLevel'
  | 'speed'
  | 'hit'
  | 'fixedDamage'
  | 'pierceLevel'
  | 'elementalMastery';

type ManualDefenseStatKey =
  | 'hp'
  | 'magicDefense'
  | 'defense'
  | 'block'
  | 'antiCritLevel'
  | 'sealResistLevel'
  | 'dodge'
  | 'elementalResistance';

const MANUAL_ATTACK_STAT_FIELDS: Array<{
  key: ManualAttackStatKey;
  label: string;
  max: number;
}> = [
  { key: 'magicDamage', label: '法术伤害', max: 2000 },
  { key: 'spiritualPower', label: '灵力', max: 1000 },
  { key: 'magicCritLevel', label: '法术暴击等级', max: 500 },
  { key: 'speed', label: '速度', max: 1500 },
  { key: 'hit', label: '命中', max: 2000 },
  { key: 'fixedDamage', label: '固定伤害', max: 500 },
  { key: 'pierceLevel', label: '穿刺等级', max: 500 },
  { key: 'elementalMastery', label: '五行克制能力', max: 300 },
];

const MANUAL_DEFENSE_STAT_FIELDS: Array<{
  key: ManualDefenseStatKey;
  label: string;
  max: number;
}> = [
  { key: 'hp', label: '气血', max: 200000 },
  { key: 'magicDefense', label: '法术防御', max: 3000 },
  { key: 'defense', label: '物理防御', max: 3000 },
  { key: 'block', label: '格挡值', max: 1000 },
  { key: 'antiCritLevel', label: '暴击等级', max: 500 },
  { key: 'sealResistLevel', label: '抵抗封印等级', max: 500 },
  { key: 'dodge', label: '躲避', max: 1500 },
  { key: 'elementalResistance', label: '五行克制抵御能力', max: 300 },
];

export function CombatPanel() {
  const [activeTab, setActiveTab] = useState<'manual' | 'dungeon'>('manual');
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const combatTarget = useGameStore((state) => state.combatTarget);
  const updateCombatTarget = useGameStore((state) => state.updateCombatTarget);
  const manualTargets = useGameStore((state) => state.manualTargets);
  const addManualTarget = useGameStore((state) => state.addManualTarget);
  const removeManualTarget = useGameStore((state) => state.removeManualTarget);
  const updateManualTarget = useGameStore((state) => state.updateManualTarget);
  const playerSetup = useGameStore((state) => state.playerSetup);
  const selectedSkill = useGameStore((state) => state.selectedSkill);
  const selectedDungeonIds = useGameStore((state) => state.selectedDungeonIds);
  const setCombatTab = useGameStore((state) => state.setCombatTab);
  const setSelectedDungeonIds = useGameStore(
    (state) => state.setSelectedDungeonIds
  );

  const [expandedTargetIds, setExpandedTargetIds] = useState<Set<string>>(
    new Set([manualTargets[0]?.id])
  );
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [expandedDungeonIds, setExpandedDungeonIds] = useState<Set<string>>(
    new Set()
  );
  const [dungeonTargetDefense, setDungeonTargetDefense] = useState<
    Record<string, { defense: number; magicDefense: number }>
  >({});
  const [isSavingBattleContext, setIsSavingBattleContext] = useState(false);
  const [saveBattleContextMessage, setSaveBattleContextMessage] = useState<
    string | null
  >(null);
  const [saveBattleContextError, setSaveBattleContextError] = useState<
    string | null
  >(null);
  const [targetDungeons, setTargetDungeons] =
    useState<Dungeon[]>(DUNGEON_DATABASE);

  useEffect(() => {
    let cancelled = false;

    const loadTemplates = async () => {
      try {
        const response = await fetch('/api/simulator/target-templates', {
          method: 'GET',
          cache: 'no-store',
        });
        const payload = await response.json();
        if (
          !response.ok ||
          payload?.code !== 0 ||
          !Array.isArray(payload?.data)
        ) {
          return;
        }

        if (!cancelled) {
          setTargetDungeons(buildDungeonDatabaseFromTemplates(payload.data));
        }
      } catch {
        // Keep local dungeon fallback when remote templates are unavailable.
      }
    };

    void loadTemplates();

    return () => {
      cancelled = true;
    };
  }, []);

  const elementRelation = useMemo(() => {
    const selfElement = playerSetup.element;
    const targetElement = combatTarget.element;

    if (!selfElement || !targetElement) return '无克/普通';

    const relationMap: Record<string, string> = {
      '金-木': '克制',
      '木-土': '克制',
      '土-水': '克制',
      '水-火': '克制',
      '火-金': '克制',
      '木-金': '被克制',
      '土-木': '被克制',
      '水-土': '被克制',
      '火-水': '被克制',
      '金-火': '被克制',
    };

    return relationMap[`${selfElement}-${targetElement}`] || '无克/普通';
  }, [playerSetup.element, combatTarget.element]);

  useEffect(() => {
    // 移除默认选中逻辑，因为现在是多选，且不强制选中
  }, [selectedDungeonIds]);

  const toggleDungeonSelection = (id: string) => {
    if (selectedDungeonIds.includes(id)) {
      setSelectedDungeonIds(selectedDungeonIds.filter((dId) => dId !== id));
    } else {
      if (selectedDungeonIds.length < 5) {
        setSelectedDungeonIds([...selectedDungeonIds, id]);
      }
    }
  };

  const updatePlayerSetup = (updates: Partial<typeof playerSetup>) => {
    useGameStore.setState((state) => ({
      playerSetup: { ...state.playerSetup, ...updates },
    }));
  };

  const updateTargetNumericStat = <K extends keyof EnemyTarget>(
    id: string,
    key: K,
    value: EnemyTarget[K]
  ) => {
    updateManualTarget(id, { [key]: value } as Partial<EnemyTarget>);
  };

  const handleSaveBattleContext = async () => {
    setIsSavingBattleContext(true);
    setSaveBattleContextMessage(null);
    setSaveBattleContextError(null);

    try {
      const response = await fetch('/api/simulator/current/battle-context', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selfFormation: playerSetup.formation,
          selfElement: playerSetup.element,
          formationCounterState: '无克/普通',
          elementRelation,
          transformCardFactor: 1,
          splitTargetCount: selectedSkill?.targets || 1,
          shenmuValue: 0,
          magicResult: 0,
          targetTemplateId: combatTarget.templateId || null,
          targetName: combatTarget.name,
          targetLevel: combatTarget.level || 0,
          targetHp: combatTarget.hp || 0,
          targetDefense: combatTarget.defense || 0,
          targetMagicDefense: combatTarget.magicDefense || 0,
          targetSpeed: combatTarget.speed || 0,
          targetMagicDefenseCultivation: 0,
          targetElement: combatTarget.element || '',
          targetFormation: combatTarget.formation || '普通阵',
        }),
      });

      const payload = await response.json();
      if (!response.ok || payload?.code !== 0 || !payload?.data) {
        throw new Error(payload?.message || '保存失败');
      }

      applySimulatorBundleToStore(payload.data, {
        preserveWorkbenchState: true,
      });
      setSaveBattleContextMessage('战斗参数已保存到云端');
    } catch (error) {
      console.error('Failed to save simulator battle context:', error);
      setSaveBattleContextError(
        error instanceof Error ? error.message : '保存失败'
      );
    } finally {
      setIsSavingBattleContext(false);
    }
  };

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-yellow-800/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl">
        {/* 标题栏 */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-yellow-700/60 bg-gradient-to-r from-yellow-900/50 to-yellow-800/30 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-600">
              <Target className="h-5 w-5 text-slate-900" />
            </div>
            <div>
              <h2 className="text-base font-bold text-yellow-100">战斗参数</h2>
              <p className="text-xs text-yellow-400/80">Combat Parameters</p>
            </div>
          </div>

          {/* 标签页 */}
          <div className="flex rounded-lg border border-yellow-800/40 bg-slate-900/80 p-1">
            <button
              className={`rounded-md px-3 py-1.5 text-xs transition-colors ${activeTab === 'manual' ? 'bg-yellow-600 font-bold text-slate-900' : 'text-yellow-100/60 hover:text-yellow-100'}`}
              onClick={() => {
                setActiveTab('manual');
                setCombatTab('manual');
              }}
            >
              手动目标
            </button>
            <button
              className={`rounded-md px-3 py-1.5 text-xs transition-colors ${activeTab === 'dungeon' ? 'bg-yellow-600 font-bold text-slate-900' : 'text-yellow-100/60 hover:text-yellow-100'}`}
              onClick={() => {
                setActiveTab('dungeon');
                setCombatTab('dungeon');
              }}
            >
              副本目标
            </button>
          </div>
        </div>

        {(saveBattleContextMessage || saveBattleContextError) && (
          <div className="px-5 pt-3">
            {saveBattleContextMessage ? (
              <div className="rounded-lg border border-emerald-700/40 bg-emerald-900/20 px-3 py-2 text-xs text-emerald-300">
                {saveBattleContextMessage}
              </div>
            ) : null}
            {saveBattleContextError ? (
              <div className="rounded-lg border border-red-700/40 bg-red-900/20 px-3 py-2 text-xs text-red-300">
                {saveBattleContextError}
              </div>
            ) : null}
          </div>
        )}

        {/* 内容区域 */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex h-full flex-col p-5">
            {/* 手动目标设置 */}
            {activeTab === 'manual' && (
              <div className="space-y-4">
                {/* 我方设置 */}
                <div className="rounded-xl border border-yellow-800/40 bg-slate-900/40 p-4">
                  <div className="mb-3 flex items-center gap-2 border-b border-yellow-800/30 pb-2">
                    <Flame className="h-4 w-4 text-blue-400" />
                    <h3 className="text-sm font-bold text-yellow-400">
                      我方设置
                    </h3>
                    <button
                      onClick={handleSaveBattleContext}
                      disabled={isSavingBattleContext}
                      className="ml-auto flex items-center gap-1 rounded-lg border border-yellow-700/40 bg-yellow-900/20 px-2 py-1 text-xs text-yellow-200 transition-colors hover:bg-yellow-900/40 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RefreshCw
                        className={`h-3 w-3 ${isSavingBattleContext ? 'animate-spin' : ''}`}
                      />
                      <span>
                        {isSavingBattleContext ? '保存中' : '保存参数'}
                      </span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label
                        id="player-element-label"
                        className="mb-2 block text-xs text-yellow-100"
                      >
                        我方五行
                      </Label>
                      <SimpleSelect
                        triggerId="player-element-select"
                        ariaLabelledBy="player-element-label"
                        value={playerSetup.element}
                        onValueChange={(val) =>
                          updatePlayerSetup({
                            element: val as typeof playerSetup.element,
                          })
                        }
                        className="h-9 py-1 text-sm"
                      >
                        {['金', '木', '水', '火', '土'].map((e) => (
                          <option key={e} value={e}>
                            {e}
                          </option>
                        ))}
                      </SimpleSelect>
                    </div>

                    <div>
                      <Label
                        id="player-formation-label"
                        className="mb-2 block text-xs text-yellow-100"
                      >
                        我方阵法
                      </Label>
                      <SimpleSelect
                        triggerId="player-formation-select"
                        ariaLabelledBy="player-formation-label"
                        value={playerSetup.formation}
                        onValueChange={(val) =>
                          updatePlayerSetup({ formation: val })
                        }
                        className="h-9 py-1 text-sm"
                      >
                        {[
                          '天覆阵',
                          '地载阵',
                          '虎翼阵',
                          '鸟翔阵',
                          '龙飞阵',
                          '云垂阵',
                          '蛇蟠阵',
                        ].map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </SimpleSelect>
                    </div>
                  </div>
                </div>

                {/* 敌方目标列表 */}
                <div className="rounded-xl border border-yellow-800/40 bg-slate-900/40 p-4">
                  <div className="mb-3 flex items-center justify-between border-b border-yellow-800/30 pb-2">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-red-400" />
                      <h3 className="text-sm font-bold text-yellow-400">
                        敌方目标
                      </h3>
                    </div>
                    <button
                      onClick={addManualTarget}
                      className="flex items-center gap-1 rounded-lg bg-green-900/30 px-2 py-1 text-xs text-green-400 transition-colors hover:bg-green-900/50"
                    >
                      <Plus className="h-3 w-3" />
                      <span>添加目标</span>
                    </button>
                  </div>

                  <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
                    {manualTargets.map((target) => (
                      <div
                        key={target.id}
                        className="rounded-lg border border-yellow-800/30 bg-slate-950/60"
                      >
                        {/* 目标头部 */}
                        <div className="flex items-center justify-between border-b border-yellow-800/20 p-3">
                          <div className="flex flex-1 items-center gap-2">
                            {editingTargetId === target.id ? (
                              <div className="flex flex-1 items-center gap-2">
                                <Input
                                  id={`manual-target-name-${target.id}`}
                                  name={`manual-target-name-${target.id}`}
                                  value={editingName}
                                  onChange={(e) =>
                                    setEditingName(e.target.value)
                                  }
                                  className="h-8 flex-1 border-yellow-700/50 bg-slate-900/80 text-sm"
                                  autoFocus
                                />
                                <button
                                  onClick={() => {
                                    if (editingName.trim()) {
                                      updateManualTarget(target.id, {
                                        name: editingName.trim(),
                                      });
                                    }
                                    setEditingTargetId(null);
                                  }}
                                  className="rounded bg-green-900/30 p-1.5 text-green-400 transition-colors hover:bg-green-900/50"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setEditingTargetId(null)}
                                  className="rounded bg-red-900/30 p-1.5 text-red-400 transition-colors hover:bg-red-900/50"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    const newExpanded = new Set(
                                      expandedTargetIds
                                    );
                                    if (newExpanded.has(target.id)) {
                                      newExpanded.delete(target.id);
                                    } else {
                                      newExpanded.add(target.id);
                                    }
                                    setExpandedTargetIds(newExpanded);
                                  }}
                                  className="text-sm font-medium text-yellow-100 transition-colors hover:text-yellow-400"
                                >
                                  <ChevronDown
                                    className={`inline h-4 w-4 transition-transform ${expandedTargetIds.has(target.id) ? '' : '-rotate-90'}`}
                                  />
                                  {target.name}
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingTargetId(target.id);
                                    setEditingName(target.name);
                                  }}
                                  className="rounded p-1 text-blue-400/70 transition-colors hover:bg-blue-900/30"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </button>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-yellow-900/40 px-2 py-0.5 text-xs text-yellow-400">
                              {target.element}
                            </span>
                            <span className="rounded bg-blue-900/40 px-2 py-0.5 text-xs text-blue-400">
                              {target.formation}
                            </span>
                            {manualTargets.length > 1 && (
                              <button
                                onClick={() => removeManualTarget(target.id)}
                                className="rounded bg-red-900/30 p-1.5 text-red-400 transition-colors hover:bg-red-900/50"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 目标详细属性 */}
                        {expandedTargetIds.has(target.id) && (
                          <div className="space-y-3 p-3">
                            {/* 五行和阵法 */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label
                                  id={`manual-target-element-label-${target.id}`}
                                  className="mb-1.5 block text-xs text-yellow-100"
                                >
                                  五行
                                </Label>
                                <SimpleSelect
                                  triggerId={`manual-target-element-select-${target.id}`}
                                  ariaLabelledBy={`manual-target-element-label-${target.id}`}
                                  value={target.element}
                                  onValueChange={(val) =>
                                    updateManualTarget(target.id, {
                                      element: val as EnemyTarget['element'],
                                    })
                                  }
                                  className="h-8 py-1 text-xs"
                                >
                                  {['金', '木', '水', '火', '土'].map((e) => (
                                    <option key={e} value={e}>
                                      {e}
                                    </option>
                                  ))}
                                </SimpleSelect>
                              </div>
                              <div>
                                <Label
                                  id={`manual-target-formation-label-${target.id}`}
                                  className="mb-1.5 block text-xs text-yellow-100"
                                >
                                  阵法
                                </Label>
                                <SimpleSelect
                                  triggerId={`manual-target-formation-select-${target.id}`}
                                  ariaLabelledBy={`manual-target-formation-label-${target.id}`}
                                  value={target.formation}
                                  onValueChange={(val) =>
                                    updateManualTarget(target.id, {
                                      formation: val,
                                    })
                                  }
                                  className="h-8 py-1 text-xs"
                                >
                                  {[
                                    '天覆阵',
                                    '地载阵',
                                    '虎翼阵',
                                    '鸟翔阵',
                                    '龙飞阵',
                                    '云垂阵',
                                    '蛇蟠阵',
                                  ].map((f) => (
                                    <option key={f} value={f}>
                                      {f}
                                    </option>
                                  ))}
                                </SimpleSelect>
                              </div>
                            </div>

                            {/* 攻击属性 */}
                            <div className="rounded-lg border border-red-700/30 bg-red-900/10 p-2">
                              <div className="mb-2 flex items-center gap-1 text-xs font-medium text-red-400">
                                <Sword className="h-3 w-3" />
                                攻击属性
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {MANUAL_ATTACK_STAT_FIELDS.map(
                                  ({ key, label, max }) => (
                                    <div key={key}>
                                      <Label className="mb-1 flex justify-between text-[10px] text-yellow-100/80">
                                        <span>{label}</span>
                                        <span className="font-bold text-yellow-400">
                                          {target[key]}
                                        </span>
                                      </Label>
                                      <Slider
                                        value={[target[key]]}
                                        onValueChange={([val]) =>
                                          updateTargetNumericStat(
                                            target.id,
                                            key,
                                            val
                                          )
                                        }
                                        min={0}
                                        max={max}
                                        step={10}
                                        aria-label={`${target.name} ${label}`}
                                        className="mt-0.5"
                                      />
                                    </div>
                                  )
                                )}
                              </div>
                            </div>

                            {/* 防御属性 */}
                            <div className="rounded-lg border border-blue-700/30 bg-blue-900/10 p-2">
                              <div className="mb-2 flex items-center gap-1 text-xs font-medium text-blue-400">
                                <Shield className="h-3 w-3" />
                                防御属性
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {MANUAL_DEFENSE_STAT_FIELDS.map(
                                  ({ key, label, max }) => (
                                    <div key={key}>
                                      <Label className="mb-1 flex justify-between text-[10px] text-yellow-100/80">
                                        <span>{label}</span>
                                        <span className="font-bold text-yellow-400">
                                          {target[key]}
                                        </span>
                                      </Label>
                                      <Slider
                                        value={[target[key]]}
                                        onValueChange={([val]) =>
                                          updateTargetNumericStat(
                                            target.id,
                                            key,
                                            val
                                          )
                                        }
                                        min={0}
                                        max={max}
                                        step={key === 'hp' ? 1000 : 10}
                                        aria-label={`${target.name} ${label}`}
                                        className="mt-0.5"
                                      />
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 副本目标设置 */}
            {activeTab === 'dungeon' && (
              <div className="flex-1 space-y-3 overflow-y-auto">
                {targetDungeons.map((dungeon) => {
                  const isExpanded = expandedDungeonIds.has(dungeon.id);

                  return (
                    <div
                      key={dungeon.id}
                      className="overflow-hidden rounded-xl border border-yellow-800/40 bg-slate-900/40"
                    >
                      {/* 副本头部 */}
                      <button
                        onClick={() => {
                          const newExpanded = new Set(expandedDungeonIds);
                          if (newExpanded.has(dungeon.id)) {
                            newExpanded.delete(dungeon.id);
                          } else {
                            newExpanded.add(dungeon.id);
                          }
                          setExpandedDungeonIds(newExpanded);
                        }}
                        className="flex w-full items-center justify-between p-4 transition-colors hover:bg-slate-800/40"
                      >
                        <div className="flex items-center gap-3">
                          <ChevronDown
                            className={`h-4 w-4 text-yellow-400 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                          />
                          <Sword className="h-4 w-4 text-yellow-400" />
                          <span className="text-sm font-bold text-yellow-100">
                            {dungeon.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-yellow-500/70">
                            {dungeon.level}级
                          </span>
                          <span className="rounded bg-yellow-900/40 px-2 py-0.5 text-xs text-yellow-400">
                            {dungeon.difficulty === 'nightmare'
                              ? '噩梦'
                              : dungeon.difficulty === 'hard'
                                ? '困难'
                                : dungeon.difficulty === 'normal'
                                  ? '普通'
                                  : '简单'}
                          </span>
                        </div>
                      </button>

                      {/* 野怪列表 */}
                      {isExpanded && (
                        <div className="space-y-2 border-t border-yellow-800/30 bg-slate-950/40 p-3">
                          {dungeon.targets.map((target) => {
                            const currentDefense = dungeonTargetDefense[
                              target.id
                            ] || {
                              defense: target.defense,
                              magicDefense: target.magicDefense,
                            };

                            return (
                              <div
                                key={target.id}
                                onClick={() => {
                                  updateCombatTarget({
                                    templateId: target.templateId || target.id,
                                    name: target.name,
                                    defense: currentDefense.defense,
                                    magicDefense: currentDefense.magicDefense,
                                    speed: target.speed || 0,
                                    hp: target.hp,
                                    level: target.level,
                                    element: target.element,
                                    formation: target.formation,
                                    dungeonName: dungeon.name,
                                  });
                                  setCombatTab('dungeon');
                                }}
                                className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                                  combatTarget.dungeonName === dungeon.name &&
                                  combatTarget.name === target.name
                                    ? 'border-yellow-500 bg-yellow-900/10'
                                    : 'border-yellow-800/30 bg-slate-900/60 hover:border-yellow-600/50 hover:bg-slate-900/80'
                                }`}
                              >
                                <div className="mb-2 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-yellow-100">
                                      {target.name}
                                    </span>
                                    {target.isBoss && (
                                      <span className="rounded bg-red-900/40 px-1.5 py-0.5 text-[10px] text-red-300">
                                        BOSS
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-yellow-500/70">
                                    <span>等级 {target.level}</span>
                                    <span>气血 {target.hp}</span>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  {/* 物理防御 */}
                                  <div>
                                    <Label className="mb-1.5 flex justify-between text-[10px] text-yellow-100">
                                      <span>物理防御</span>
                                      <span className="font-bold text-yellow-400">
                                        {currentDefense.defense}
                                      </span>
                                    </Label>
                                    <Slider
                                      value={[currentDefense.defense]}
                                      onValueChange={([val]) => {
                                        setDungeonTargetDefense((prev) => ({
                                          ...prev,
                                          [target.id]: {
                                            ...currentDefense,
                                            defense: val,
                                          },
                                        }));
                                      }}
                                      min={0}
                                      max={3000}
                                      step={10}
                                      aria-label={`${dungeon.name} ${target.name} 物理防御`}
                                      className="mt-0.5"
                                    />
                                  </div>

                                  {/* 法术防御 */}
                                  <div>
                                    <Label className="mb-1.5 flex justify-between text-[10px] text-yellow-100">
                                      <span>法术防御</span>
                                      <span className="font-bold text-yellow-400">
                                        {currentDefense.magicDefense}
                                      </span>
                                    </Label>
                                    <Slider
                                      value={[currentDefense.magicDefense]}
                                      onValueChange={([val]) => {
                                        setDungeonTargetDefense((prev) => ({
                                          ...prev,
                                          [target.id]: {
                                            ...currentDefense,
                                            magicDefense: val,
                                          },
                                        }));
                                      }}
                                      min={0}
                                      max={3000}
                                      step={10}
                                      aria-label={`${dungeon.name} ${target.name} 法术防御`}
                                      className="mt-0.5"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 技能伤害入口按钮 - 固定底部 */}
        <div className="flex-shrink-0 border-t-2 border-yellow-700/60 bg-gradient-to-r from-yellow-900/30 via-yellow-800/20 to-yellow-900/30 px-5 py-4">
          <button
            onClick={() => setIsSkillModalOpen(true)}
            className="group relative w-full cursor-pointer overflow-hidden rounded-xl bg-gradient-to-br from-yellow-600 to-yellow-700 p-4 shadow-xl transition-all hover:scale-[1.02] hover:from-yellow-500 hover:to-yellow-600 hover:shadow-2xl active:scale-[0.98]"
          >
            {/* 背景装饰 */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

            <div className="relative flex items-center justify-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/20 transition-transform group-hover:scale-110">
                <Zap className="h-6 w-6 text-slate-900" />
              </div>
              <div className="text-center">
                <div className="text-base font-bold text-slate-900">
                  查看技能伤害
                </div>
                <div className="mt-0.5 text-xs text-slate-800/80">
                  计算技能对目标造成的伤害值
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* 技能伤害弹窗 */}
        <SkillDamagePanel
          isOpen={isSkillModalOpen}
          onClose={() => setIsSkillModalOpen(false)}
        />
      </div>
    </>
  );
}
