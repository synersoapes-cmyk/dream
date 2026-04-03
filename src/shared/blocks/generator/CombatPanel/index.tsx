// @ts-nocheck
"use client";
import { DUNGEON_DATABASE } from '@/features/simulator/store/gameData';
import { useGameStore } from '@/features/simulator/store/gameStore';
import type { Dungeon, EnemyTarget } from '@/features/simulator/store/gameTypes';
import { Label } from '@/shared/components/ui/label';
import { Slider } from './Slider';
import { SimpleSelect } from './SimpleSelect';
import { Input } from '@/shared/components/ui/input';
import { Target, Zap, Sparkles, TrendingUp, Sword, Shield, RefreshCw, Flame, ChevronDown, Plus, Minus, Edit2, Check, X } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';

import { SkillDamagePanel } from './SkillDamagePanel';

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
  const skills = useGameStore((state) => state.skills);
  const selectedSkill = useGameStore((state) => state.selectedSkill);
  const selectSkill = useGameStore((state) => state.selectSkill);
  const baseAttributes = useGameStore((state) => state.baseAttributes);
  const combatStats = useGameStore((state) => state.combatStats);
  const cultivation = useGameStore((state) => state.cultivation);
  const selectedDungeonIds = useGameStore((state) => state.selectedDungeonIds);
  const setSelectedDungeonIds = useGameStore((state) => state.setSelectedDungeonIds);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDungeonTarget, setSelectedDungeonTarget] = useState<Dungeon['targets'][0] | null>(null);
  const [isDungeonSelectOpen, setIsDungeonSelectOpen] = useState(false);
  const [expandedTargetIds, setExpandedTargetIds] = useState<Set<string>>(new Set([manualTargets[0]?.id]));
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [expandedDungeonIds, setExpandedDungeonIds] = useState<Set<string>>(new Set());
  const [dungeonTargetDefense, setDungeonTargetDefense] = useState<Record<string, { defense: number; magicDefense: number }>>({});
  
  const damage = useMemo(() => {
    const physicalDamage = Math.max(0, 
      combatStats.damage + baseAttributes.strength * 0.8 - combatTarget.defense * 0.6
    );
    const magicDamage = Math.max(0,
      combatStats.magicDamage + baseAttributes.magic * 0.9 - combatTarget.magicDefense * 0.5
    );
    
    let skillDamage = 0;
    if (selectedSkill) {
      const baseDamage = selectedSkill.type === 'physical' ? physicalDamage : magicDamage;
      const cultivationBonus = selectedSkill.type === 'physical' 
        ? (cultivation.physicalAttack || 0) / 10 
        : (cultivation.magicAttack || 0) / 10;
      skillDamage = Math.floor(baseDamage * (1 + cultivationBonus) * selectedSkill.targets * selectedSkill.level / 10);
    }
    
    return {
      physical: Math.floor(physicalDamage),
      magic: Math.floor(magicDamage),
      skillDamage
    };
  }, [
    baseAttributes.strength, baseAttributes.magic, combatStats.damage, combatStats.magicDamage,
    cultivation.physicalAttack, cultivation.magicAttack, combatTarget.defense, combatTarget.magicDefense,
    selectedSkill?.name, selectedSkill?.level, selectedSkill?.targets, selectedSkill?.type
  ]);
  
  useEffect(() => {
    // 移除默认选中逻辑，因为现在是多选，且不强制选中
  }, [selectedDungeonIds]);

  const toggleDungeonSelection = (id: string) => {
    if (selectedDungeonIds.includes(id)) {
      setSelectedDungeonIds(selectedDungeonIds.filter(dId => dId !== id));
    } else {
      if (selectedDungeonIds.length < 5) {
        setSelectedDungeonIds([...selectedDungeonIds, id]);
      }
    }
  };
  
  const handleDungeonTargetSelect = (target: Dungeon['targets'][0], dungeonName: string) => {
    updateCombatTarget({
      name: target.name,
      defense: target.defense,
      magicDefense: target.magicDefense,
      element: target.element,
      formation: target.formation,
      dungeonName: dungeonName,
    });
    setSelectedDungeonTarget(target);
    setSearchQuery('');
  };
  
  const updatePlayerSetup = (updates: Partial<typeof playerSetup>) => {
    useGameStore.setState((state) => ({
      playerSetup: { ...state.playerSetup, ...updates }
    }));
  };
  
  const handleRefreshDamage = () => {
    // 强制重新计算伤害 - 如果有选中的技能，重新选择它来刷新
    if (selectedSkill) {
      selectSkill(selectedSkill);
    }
  };

  const selectedDungeonTags = useMemo(() => {
    return selectedDungeonIds.map(id => {
      let foundTarget: any = null;
      let foundDungeon: any = null;
      for (const d of DUNGEON_DATABASE) {
        const t = d.targets.find((target: any) => target.id === id);
        if (t) {
          foundTarget = t;
          foundDungeon = d;
          break;
        }
      }
      if (!foundTarget) return null;
      return { id, foundTarget, foundDungeon };
    }).filter(Boolean);
  }, [selectedDungeonIds]);

  const selectedDungeonGroups = useMemo(() => {
    const selectedDungeonsMap = new Map<string, any>();
    selectedDungeonIds.forEach(targetId => {
      for (const dungeon of DUNGEON_DATABASE) {
        const target = dungeon.targets.find(t => t.id === targetId);
        if (target) {
          if (!selectedDungeonsMap.has(dungeon.id)) {
            selectedDungeonsMap.set(dungeon.id, { dungeon, targets: [] });
          }
          selectedDungeonsMap.get(dungeon.id).targets.push(target);
          break;
        }
      }
    });
    return Array.from(selectedDungeonsMap.values());
  }, [selectedDungeonIds]);
  
  return (
    <>
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-yellow-800/60 rounded-2xl shadow-2xl overflow-hidden">
      {/* 标题栏 */}
      <div className="bg-gradient-to-r from-yellow-900/50 to-yellow-800/30 border-b border-yellow-700/60 px-5 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-yellow-600 flex items-center justify-center">
            <Target className="w-5 h-5 text-slate-900" />
          </div>
          <div>
            <h2 className="text-base font-bold text-yellow-100">战斗参数</h2>
            <p className="text-xs text-yellow-400/80">Combat Parameters</p>
          </div>
        </div>
        
        {/* 标签页 */}
        <div className="flex bg-slate-900/80 rounded-lg p-1 border border-yellow-800/40">
          <button 
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${activeTab === 'manual' ? 'bg-yellow-600 text-slate-900 font-bold' : 'text-yellow-100/60 hover:text-yellow-100'}`} 
            onClick={() => setActiveTab('manual')}
          >
            手动目标
          </button>
          <button 
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${activeTab === 'dungeon' ? 'bg-yellow-600 text-slate-900 font-bold' : 'text-yellow-100/60 hover:text-yellow-100'}`} 
            onClick={() => setActiveTab('dungeon')}
          >
            副本目标
          </button>
        </div>
      </div>
      
      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-5 h-full flex flex-col">
          {/* 手动目标设置 */}
          {activeTab === 'manual' && (
            <div className="space-y-4">
              {/* 我方设置 */}
              <div className="bg-slate-900/40 border border-yellow-800/40 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-yellow-800/30">
                  <Flame className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm text-yellow-400 font-bold">我方设置</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-yellow-100 text-xs mb-2 block">我方五行</Label>
                    <SimpleSelect 
                      value={playerSetup.element}
                      onValueChange={(val) => updatePlayerSetup({ element: val as any })}
                      className="h-9 py-1 text-sm"
                    >
                      {['金', '木', '水', '火', '土'].map(e => <option key={e} value={e}>{e}</option>)}
                    </SimpleSelect>
                  </div>
                  
                  <div>
                    <Label className="text-yellow-100 text-xs mb-2 block">我方阵法</Label>
                    <SimpleSelect
                      value={playerSetup.formation}
                      onValueChange={(val) => updatePlayerSetup({ formation: val })}
                      className="h-9 py-1 text-sm"
                    >
                      {['天覆阵', '地载阵', '虎翼阵', '鸟翔阵', '龙飞阵', '云垂阵', '蛇蟠阵'].map(f => <option key={f} value={f}>{f}</option>)}
                    </SimpleSelect>
                  </div>
                </div>
              </div>

              {/* 敌方目标列表 */}
              <div className="bg-slate-900/40 border border-yellow-800/40 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-yellow-800/30">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-red-400" />
                    <h3 className="text-sm text-yellow-400 font-bold">敌方目标</h3>
                  </div>
                  <button
                    onClick={addManualTarget}
                    className="flex items-center gap-1 px-2 py-1 bg-green-900/30 hover:bg-green-900/50 text-green-400 rounded-lg text-xs transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>添加目标</span>
                  </button>
                </div>
                
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {manualTargets.map((target) => (
                    <div key={target.id} className="bg-slate-950/60 border border-yellow-800/30 rounded-lg">
                      {/* 目标头部 */}
                      <div className="flex items-center justify-between p-3 border-b border-yellow-800/20">
                        <div className="flex items-center gap-2 flex-1">
                          {editingTargetId === target.id ? (
                            <div className="flex items-center gap-2 flex-1">
                              <Input
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="h-8 text-sm flex-1 bg-slate-900/80 border-yellow-700/50"
                                autoFocus
                              />
                              <button
                                onClick={() => {
                                  if (editingName.trim()) {
                                    updateManualTarget(target.id, { name: editingName.trim() });
                                  }
                                  setEditingTargetId(null);
                                }}
                                className="p-1.5 bg-green-900/30 hover:bg-green-900/50 text-green-400 rounded transition-colors"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingTargetId(null)}
                                className="p-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  const newExpanded = new Set(expandedTargetIds);
                                  if (newExpanded.has(target.id)) {
                                    newExpanded.delete(target.id);
                                  } else {
                                    newExpanded.add(target.id);
                                  }
                                  setExpandedTargetIds(newExpanded);
                                }}
                                className="text-yellow-100 font-medium text-sm hover:text-yellow-400 transition-colors"
                              >
                                <ChevronDown className={`w-4 h-4 inline transition-transform ${expandedTargetIds.has(target.id) ? '' : '-rotate-90'}`} />
                                {target.name}
                              </button>
                              <button
                                onClick={() => {
                                  setEditingTargetId(target.id);
                                  setEditingName(target.name);
                                }}
                                className="p-1 hover:bg-blue-900/30 text-blue-400/70 rounded transition-colors"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded text-xs">{target.element}</span>
                          <span className="bg-blue-900/40 text-blue-400 px-2 py-0.5 rounded text-xs">{target.formation}</span>
                          {manualTargets.length > 1 && (
                            <button
                              onClick={() => removeManualTarget(target.id)}
                              className="p-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* 目标详细属性 */}
                      {expandedTargetIds.has(target.id) && (
                        <div className="p-3 space-y-3">
                          {/* 五行和阵法 */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-yellow-100 text-xs mb-1.5 block">五行</Label>
                              <SimpleSelect
                                value={target.element}
                                onValueChange={(val) => updateManualTarget(target.id, { element: val as any })}
                                className="h-8 py-1 text-xs"
                              >
                                {['金', '木', '水', '火', '土'].map(e => <option key={e} value={e}>{e}</option>)}
                              </SimpleSelect>
                            </div>
                            <div>
                              <Label className="text-yellow-100 text-xs mb-1.5 block">阵法</Label>
                              <SimpleSelect
                                value={target.formation}
                                onValueChange={(val) => updateManualTarget(target.id, { formation: val })}
                                className="h-8 py-1 text-xs"
                              >
                                {['天覆阵', '地载阵', '虎翼阵', '鸟翔阵', '龙飞阵', '云垂阵', '蛇蟠阵'].map(f => <option key={f} value={f}>{f}</option>)}
                              </SimpleSelect>
                            </div>
                          </div>
                          
                          {/* 攻击属性 */}
                          <div className="bg-red-900/10 border border-red-700/30 rounded-lg p-2">
                            <div className="text-red-400 text-xs font-medium mb-2 flex items-center gap-1">
                              <Sword className="w-3 h-3" />
                              攻击属性
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { key: 'magicDamage', label: '法术伤害', max: 2000 },
                                { key: 'spiritualPower', label: '灵力', max: 1000 },
                                { key: 'magicCritLevel', label: '法术暴击等级', max: 500 },
                                { key: 'speed', label: '速度', max: 1500 },
                                { key: 'hit', label: '命中', max: 2000 },
                                { key: 'fixedDamage', label: '固定伤害', max: 500 },
                                { key: 'pierceLevel', label: '穿刺等级', max: 500 },
                                { key: 'elementalMastery', label: '五行克制能力', max: 300 },
                              ].map(({ key, label, max }) => (
                                <div key={key}>
                                  <Label className="text-yellow-100/80 text-[10px] mb-1 flex justify-between">
                                    <span>{label}</span>
                                    <span className="text-yellow-400 font-bold">{(target as any)[key]}</span>
                                  </Label>
                                  <Slider
                                    value={[(target as any)[key]]}
                                    onValueChange={([val]) => updateManualTarget(target.id, { [key]: val })}
                                    min={0}
                                    max={max}
                                    step={10}
                                    className="mt-0.5"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* 防御属性 */}
                          <div className="bg-blue-900/10 border border-blue-700/30 rounded-lg p-2">
                            <div className="text-blue-400 text-xs font-medium mb-2 flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              防御属性
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { key: 'hp', label: '气血', max: 200000 },
                                { key: 'magicDefense', label: '法术防御', max: 3000 },
                                { key: 'defense', label: '物理防御', max: 3000 },
                                { key: 'block', label: '格挡值', max: 1000 },
                                { key: 'antiCritLevel', label: '暴击等级', max: 500 },
                                { key: 'sealResistLevel', label: '抵抗封印等级', max: 500 },
                                { key: 'dodge', label: '躲避', max: 1500 },
                                { key: 'elementalResistance', label: '五行克制抵御能力', max: 300 },
                              ].map(({ key, label, max }) => (
                                <div key={key}>
                                  <Label className="text-yellow-100/80 text-[10px] mb-1 flex justify-between">
                                    <span>{label}</span>
                                    <span className="text-yellow-400 font-bold">{(target as any)[key]}</span>
                                  </Label>
                                  <Slider
                                    value={[(target as any)[key]]}
                                    onValueChange={([val]) => updateManualTarget(target.id, { [key]: val })}
                                    min={0}
                                    max={max}
                                    step={key === 'hp' ? 1000 : 10}
                                    className="mt-0.5"
                                  />
                                </div>
                              ))}
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
            <div className="space-y-3 flex-1 overflow-y-auto">
              {DUNGEON_DATABASE.map(dungeon => {
                const isExpanded = expandedDungeonIds.has(dungeon.id);
                
                return (
                  <div key={dungeon.id} className="bg-slate-900/40 border border-yellow-800/40 rounded-xl overflow-hidden">
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
                      className="w-full flex items-center justify-between p-4 hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <ChevronDown className={`w-4 h-4 text-yellow-400 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                        <Sword className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm font-bold text-yellow-100">{dungeon.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-yellow-500/70">{dungeon.level}级</span>
                        <span className="text-xs bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded">
                          {dungeon.difficulty === 'nightmare' ? '噩梦' :
                           dungeon.difficulty === 'hard' ? '困难' :
                           dungeon.difficulty === 'normal' ? '普通' : '简单'}
                        </span>
                      </div>
                    </button>
                    
                    {/* 野怪列表 */}
                    {isExpanded && (
                      <div className="border-t border-yellow-800/30 p-3 bg-slate-950/40 space-y-2">
                        {dungeon.targets.map(target => {
                          const currentDefense = dungeonTargetDefense[target.id] || {
                            defense: target.defense,
                            magicDefense: target.magicDefense
                          };
                          
                          return (
                            <div key={target.id} className="bg-slate-900/60 border border-yellow-800/30 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-yellow-100">{target.name}</span>
                                  {target.isBoss && (
                                    <span className="text-[10px] bg-red-900/40 text-red-300 px-1.5 py-0.5 rounded">BOSS</span>
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
                                  <Label className="text-yellow-100 text-[10px] mb-1.5 flex justify-between">
                                    <span>物理防御</span>
                                    <span className="text-yellow-400 font-bold">{currentDefense.defense}</span>
                                  </Label>
                                  <Slider
                                    value={[currentDefense.defense]}
                                    onValueChange={([val]) => {
                                      setDungeonTargetDefense(prev => ({
                                        ...prev,
                                        [target.id]: {
                                          ...currentDefense,
                                          defense: val
                                        }
                                      }));
                                    }}
                                    min={0}
                                    max={3000}
                                    step={10}
                                    className="mt-0.5"
                                  />
                                </div>
                                
                                {/* 法术防御 */}
                                <div>
                                  <Label className="text-yellow-100 text-[10px] mb-1.5 flex justify-between">
                                    <span>法术防御</span>
                                    <span className="text-yellow-400 font-bold">{currentDefense.magicDefense}</span>
                                  </Label>
                                  <Slider
                                    value={[currentDefense.magicDefense]}
                                    onValueChange={([val]) => {
                                      setDungeonTargetDefense(prev => ({
                                        ...prev,
                                        [target.id]: {
                                          ...currentDefense,
                                          magicDefense: val
                                        }
                                      }));
                                    }}
                                    min={0}
                                    max={3000}
                                    step={10}
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
      <div className="flex-shrink-0 bg-gradient-to-r from-yellow-900/30 via-yellow-800/20 to-yellow-900/30 border-t-2 border-yellow-700/60 px-5 py-4">
        <button 
          onClick={() => setIsSkillModalOpen(true)} 
          className="relative overflow-hidden w-full bg-gradient-to-br from-yellow-600 to-yellow-700 hover:from-yellow-500 hover:to-yellow-600 rounded-xl p-4 transition-all shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] group cursor-pointer"
        >
          {/* 背景装饰 */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="relative flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-900/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6 text-slate-900" />
            </div>
            <div className="text-center">
              <div className="text-base font-bold text-slate-900">查看技能伤害</div>
              <div className="text-xs text-slate-800/80 mt-0.5">计算技能对目标造成的伤害值</div>
            </div>
          </div>
        </button>
      </div>
      
      {/* 技能伤害弹窗 */}
      <SkillDamagePanel isOpen={isSkillModalOpen} onClose={() => setIsSkillModalOpen(false)} />
    </div>
    </>
  );
}
