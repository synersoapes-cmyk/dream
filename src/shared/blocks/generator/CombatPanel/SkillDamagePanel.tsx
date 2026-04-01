// @ts-nocheck
import { DUNGEON_DATABASE } from '@/features/simulator/store/gameData';
import { useGameStore } from '@/features/simulator/store/gameStore';
import { Zap, Calculator, X, RefreshCw, ChevronDown } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';

// 统一的解码函数，用于处理中文显示
const decodeName = (name: string): string => {
  if (!name) return '';
  try {
    // 尝试使用 decodeURIComponent + escape 解码
    return decodeURIComponent(escape(name));
  } catch {
    // 如果解码失败，返回原始字符串
    return name;
  }
};

export function SkillDamagePanel({ isOpen, onClose }: { isOpen?: boolean, onClose?: () => void }) {
  const combatStats = useGameStore((state) => state.combatStats);
  const cultivation = useGameStore((state) => state.cultivation);
  const combatTarget = useGameStore((state) => state.combatTarget);
  const manualTargets = useGameStore((state) => state.manualTargets);
  const skills = useGameStore((state) => state.skills);
  const selectedSkill = useGameStore((state) => state.selectedSkill);
  const selectSkill = useGameStore((state) => state.selectSkill);
  const combatTab = useGameStore((state) => state.combatTab);
  
  const [showModal, setShowModal] = useState(false);
  const [modalSkillDetails, setModalSkillDetails] = useState<any>(null);
  
  const [activeTargetDisplay, setActiveTargetDisplay] = useState('手动设置');

  const [isCalculating, setIsCalculating] = useState(false);
  
  const [selectedDungeonId, setSelectedDungeonId] = useState<string>(DUNGEON_DATABASE[0]?.id || '');
  const [isDungeonSelectOpen, setIsDungeonSelectOpen] = useState(false);
  
  const handleRecalculate = () => {
    setIsCalculating(true);
    let targetDisplay = '';
    
    if (combatTab === 'manual') {
      targetDisplay = '手动设置';
    } else {
      try {
        const decodedName = decodeName(combatTarget.name || '');
        const decodedDungeon = combatTarget.dungeonName ? decodeName(combatTarget.dungeonName) : '';
        if (decodedDungeon) {
          targetDisplay = `${decodedDungeon} - ${decodedName}`;
        } else {
          targetDisplay = decodedName;
        }
      } catch {
        if (combatTarget.dungeonName) {
          targetDisplay = `${combatTarget.dungeonName} - ${combatTarget.name}`;
        } else {
          targetDisplay = combatTarget.name;
        }
      }
    }
    
    setActiveTargetDisplay(targetDisplay);
    setTimeout(() => setIsCalculating(false), 400);
  };

  useEffect(() => {
    handleRecalculate();
  }, [combatTarget.name, combatTarget.dungeonName, combatTab]); // Update when target info changes

  const [activeSkillId, setActiveSkillId] = useState<string>(skills[0]?.name || '');
  const [isSkillSelectOpen, setIsSkillSelectOpen] = useState(false);
  const [skillSearchQuery, setSkillSearchQuery] = useState('');

  const [targetCount, setTargetCount] = useState<number>(7);
  const [isTargetCountOpen, setIsTargetCountOpen] = useState(false);

  const activeSkill = useMemo(() => skills.find(s => s.name === activeSkillId) || skills[0], [skills, activeSkillId]);

  // 计算某个目标对特定技能受到的伤害
  const calculateDamageForTarget = (targetDef: number, skill: any, targets: number) => {
    const baseItem = (skill.level * skill.level / 145) + (skill.level * 1.4) + 39.5;
    const splitRatio = Math.max(0.5, 1 - targets * 0.1);
    const formationRatio = 1.0; 
    const cultDiff = cultivation.magicAttack; 
    const magicResult = 0; 
    
    let finalDamage = (baseItem + combatStats.magicDamage - targetDef) 
                      * formationRatio * splitRatio * (1 + cultDiff * 0.02) + cultDiff * 5 + magicResult;
    
    finalDamage = Math.max(1, Math.round(finalDamage));
    
    // 暴击伤害为普通伤害的1.5倍
    const critDamage = Math.round(finalDamage * 1.5);
    
    return {
      totalDamage: finalDamage * targets,
      singleTargetDamage: finalDamage,
      critDamage: critDamage,
      totalCritDamage: critDamage * targets,
      details: {
        baseItem: baseItem.toFixed(1),
        splitRatio: splitRatio.toFixed(2),
        magicDamage: combatStats.magicDamage,
        targetDef: targetDef,
        formationRatio: formationRatio.toFixed(2),
        cultDiff: cultDiff,
        magicResult: magicResult,
        finalDamage: finalDamage,
        critDamage: critDamage
      }
    };
  };

  // 生成展示数据：手动目标 + 选中的副本
  const damageDisplayData = useMemo(() => {
    if (!activeSkill) return [];

    const data: any[] = [];
    
    // 所有手动目标（解码名称）
    data.push({
      type: 'manual',
      groupName: '手动目标',
      targets: manualTargets.map(target => ({
        name: decodeName(target.name),
        defense: target.magicDefense,
        ...calculateDamageForTarget(target.magicDefense, activeSkill, targetCount)
      }))
    });

    // 选中的副本目标（解码名称）
    const selectedDungeon = DUNGEON_DATABASE.find(d => d.id === selectedDungeonId);
    if (selectedDungeon) {
      data.push({
        type: 'dungeon',
        groupName: decodeName(selectedDungeon.name),
        targets: selectedDungeon.targets.map((t: any) => ({
          name: decodeName(t.name),
          defense: t.magicDefense,
          isBoss: t.isBoss,
          ...calculateDamageForTarget(t.magicDefense, activeSkill, targetCount)
        }))
      });
    }

    return data;
  }, [activeSkill, manualTargets, selectedDungeonId, combatStats.magicDamage, cultivation.magicAttack, targetCount]);

  const handleSkillClick = (skillData: any, targetData?: any, groupName?: string) => {
    selectSkill(skillData);
    if (targetData && groupName) {
      setModalSkillDetails({
        ...skillData,
        targets: targetCount, // 使用当前选择的目标数量
        targetName: targetData.name,
        groupName: groupName,
        details: targetData.details,
        finalDamage: targetData.singleTargetDamage,
        critDamage: targetData.critDamage
      });
    } else {
      setModalSkillDetails(skillData);
    }
    setShowModal(true);
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl h-[80vh] flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-yellow-800/60 rounded-2xl shadow-2xl overflow-hidden relative">
        {/* 标题栏 */}
        <div className="bg-gradient-to-r from-yellow-900/50 to-yellow-800/30 border-b border-yellow-700/60 px-5 py-3.5 flex justify-between items-center z-50">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-yellow-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-slate-900" />
            </div>
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-sm font-bold text-yellow-100 flex items-center gap-2">技能伤害</h2>
              </div>
              <div className="relative">
                <div 
                  onClick={() => setIsSkillSelectOpen(!isSkillSelectOpen)}
                  className="bg-slate-900/80 border border-yellow-800/60 hover:border-yellow-600/60 rounded-lg px-3 py-1.5 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span className="text-sm text-yellow-300 font-medium">
                    {activeSkill?.name || '选择技能'}
                  </span>
                  <span className="text-xs text-yellow-500/70">Lv.{activeSkill?.level || 0}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-yellow-600/80 transition-transform ${isSkillSelectOpen ? 'rotate-180' : ''}`} />
                </div>
                
                {isSkillSelectOpen && (
                  <div className="absolute top-full left-0 mt-2 w-48 bg-slate-900 border border-yellow-800/80 rounded-xl shadow-2xl overflow-hidden flex flex-col z-50">
                    <div className="p-2 border-b border-yellow-800/40">
                      <input
                        type="text"
                        placeholder="搜索技能..."
                        value={skillSearchQuery}
                        onChange={(e) => setSkillSearchQuery(e.target.value)}
                        className="w-full bg-slate-950/50 border border-yellow-700/30 rounded-lg px-2 py-1 text-xs text-yellow-100 placeholder-yellow-700/50 focus:outline-none focus:border-yellow-500/50"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="p-1.5 max-h-48 overflow-y-auto">
                      {skills.filter(skill => skill.name.toLowerCase().includes(skillSearchQuery.toLowerCase())).map(skill => (
                        <div
                          key={skill.name}
                          onClick={() => {
                            setActiveSkillId(skill.name);
                            setIsSkillSelectOpen(false);
                            setSkillSearchQuery('');
                          }}
                          className={`px-3 py-2 rounded-lg cursor-pointer text-sm flex items-center justify-between ${
                            activeSkillId === skill.name 
                              ? 'bg-yellow-900/40 text-yellow-300' 
                              : 'text-yellow-100 hover:bg-slate-800'
                          }`}
                        >
                          <span>{skill.name}</span>
                          <span className="text-xs opacity-60">Lv.{skill.level}</span>
                        </div>
                      ))}
                      {skills.filter(skill => skill.name.toLowerCase().includes(skillSearchQuery.toLowerCase())).length === 0 && (
                        <div className="px-3 py-2 text-xs text-yellow-500/50 text-center">
                          未找到匹配的技能
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* 秒几选择器 */}
              <div className="relative">
                <div 
                  onClick={() => setIsTargetCountOpen(!isTargetCountOpen)}
                  className="bg-slate-900/80 border border-yellow-800/60 hover:border-yellow-600/60 rounded-lg px-3 py-1.5 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span className="text-sm text-yellow-300 font-medium">
                    秒{targetCount}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-yellow-600/80 transition-transform ${isTargetCountOpen ? 'rotate-180' : ''}`} />
                </div>
                
                {isTargetCountOpen && (
                  <div className="absolute top-full left-0 mt-2 w-28 bg-slate-900 border border-yellow-800/80 rounded-xl shadow-2xl overflow-hidden flex flex-col z-50">
                    <div className="p-1.5 max-h-64 overflow-y-auto">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(count => (
                        <div
                          key={count}
                          onClick={() => {
                            setTargetCount(count);
                            setIsTargetCountOpen(false);
                          }}
                          className={`px-3 py-2 rounded-lg cursor-pointer text-sm flex items-center justify-center ${
                            targetCount === count 
                              ? 'bg-yellow-900/40 text-yellow-300' 
                              : 'text-yellow-100 hover:bg-slate-800'
                          }`}
                        >
                          秒{count}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={handleRecalculate}
              disabled={isCalculating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-900/40 hover:bg-yellow-800/60 border border-yellow-700/50 rounded-lg text-yellow-100 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCalculating ? 'animate-spin' : ''}`} />
              重新计算
            </button>
            {onClose && (
              <button 
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-yellow-800/40 hover:border-yellow-600/60 flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4 text-yellow-400/80" />
              </button>
            )}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="space-y-4">
            {damageDisplayData.map((group, groupIdx) => (
              <div key={groupIdx} className="bg-slate-900/40 border border-yellow-900/30 rounded-xl overflow-hidden shadow-inner">
                <div className="bg-gradient-to-r from-slate-800/80 to-slate-900/80 border-b border-yellow-900/40 px-4 py-2.5 flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-4 rounded-full ${group.type === 'manual' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]'}`} />
                    <span className="text-sm font-bold text-yellow-100 tracking-wide">{group.groupName}</span>
                    {group.type === 'dungeon' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-500 border border-yellow-700/30">
                        副本目标
                      </span>
                    )}
                  </div>
                  
                  {/* 副本选择器 */}
                  {group.type === 'dungeon' && (
                    <div className="relative">
                      <div
                        onClick={() => setIsDungeonSelectOpen(!isDungeonSelectOpen)}
                        className="bg-slate-900/80 border border-yellow-800/60 hover:border-yellow-600/60 rounded-lg px-3 py-1 flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <span className="text-xs text-yellow-300 font-medium">
                          {decodeName(DUNGEON_DATABASE.find(d => d.id === selectedDungeonId)?.name || '选择副本')}
                        </span>
                        <ChevronDown className={`w-3 h-3 text-yellow-600/80 transition-transform ${isDungeonSelectOpen ? 'rotate-180' : ''}`} />
                      </div>
                      
                      {isDungeonSelectOpen && (
                        <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900 border border-yellow-800/80 rounded-xl shadow-2xl overflow-hidden flex flex-col z-50 max-h-96">
                          <div className="p-1.5 overflow-y-auto">
                            {DUNGEON_DATABASE.map(dungeon => (
                              <div
                                key={dungeon.id}
                                onClick={() => {
                                  setSelectedDungeonId(dungeon.id);
                                  setIsDungeonSelectOpen(false);
                                }}
                                className={`px-3 py-2 rounded-lg cursor-pointer text-xs flex items-center justify-between ${
                                  selectedDungeonId === dungeon.id
                                    ? 'bg-yellow-900/40 text-yellow-300'
                                    : 'text-yellow-100 hover:bg-slate-800'
                                }`}
                              >
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-medium">{dungeon.name}</span>
                                  <span className="text-[10px] text-yellow-500/60">
                                    {dungeon.level}级 · {dungeon.targets.length}个怪物 · {
                                      dungeon.difficulty === 'nightmare' ? '噩梦' :
                                      dungeon.difficulty === 'hard' ? '困难' :
                                      dungeon.difficulty === 'normal' ? '普通' : '简单'
                                    }
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="p-3 grid grid-cols-1 gap-2.5">
                  {group.targets.map((target: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => handleSkillClick(activeSkill, target, group.groupName)}
                      className={`
                        w-full text-left bg-gradient-to-r from-slate-800/60 to-slate-900/40 
                        border border-slate-700/50 hover:border-yellow-600/50 rounded-xl p-3.5 
                        transition-all duration-300 hover:shadow-[0_4px_20px_rgba(234,179,8,0.1)]
                        hover:-translate-y-0.5 group relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3
                      `}
                    >
                      {/* Hover Effect Layer */}
                      <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/5 to-yellow-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      
                      {/* Target Info */}
                      <div className="flex flex-col gap-1.5 relative z-10">
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-50 font-bold text-sm tracking-wide group-hover:text-yellow-300 transition-colors">{target.name}</span>
                          {target.isBoss && (
                            <span className="text-[10px] bg-red-900/40 text-red-300 px-1.5 py-0.5 rounded">BOSS</span>
                          )}
                          <span className="text-[10px] bg-slate-950/80 text-slate-300 px-1.5 py-0.5 rounded border border-slate-800 font-medium">
                            法防 {target.defense}
                          </span>
                        </div>
                      </div>
                      
                      {/* Damage Stats */}
                      <div className="flex items-stretch gap-3 relative z-10">
                        <div className="flex flex-col items-end justify-center bg-slate-950/40 px-3 py-1.5 rounded-lg border border-slate-800/60 min-w-[80px]">
                          <span className="text-slate-400 text-[10px] mb-0.5">普通伤害</span>
                          <span className="text-yellow-200 font-bold tabular-nums text-sm group-hover:text-yellow-400 transition-colors">
                            {target.singleTargetDamage.toLocaleString()}
                          </span>
                        </div>
                        
                        <div className="w-px bg-gradient-to-b from-transparent via-slate-700 to-transparent" />
                        
                        <div className="flex flex-col items-end justify-center bg-red-950/20 px-3 py-1.5 rounded-lg border border-red-900/30 min-w-[80px]">
                          <span className="text-red-400/80 text-[10px] mb-0.5">暴击伤害</span>
                          <span className="text-red-400 font-bold tabular-nums text-sm group-hover:text-red-300 transition-colors">
                            {target.critDamage.toLocaleString()}
                          </span>
                        </div>
                        
                        <div className="w-px bg-gradient-to-b from-transparent via-slate-700 to-transparent" />
                        
                        <div className="flex flex-col items-end justify-center bg-yellow-950/20 px-3 py-1.5 rounded-lg border border-yellow-900/30 min-w-[80px]">
                          <span className="text-yellow-600/80 text-[10px] mb-0.5">总伤 (×{targetCount})</span>
                          <span className="text-yellow-400 font-black tabular-nums text-base drop-shadow-[0_0_8px_rgba(234,179,8,0.3)]">
                            {target.totalDamage.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* 伤害计算公式详情弹窗 */}
      {showModal && modalSkillDetails && modalSkillDetails.details && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-2 border-yellow-700/60 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center bg-gradient-to-r from-yellow-900/50 to-yellow-800/30 px-5 py-4 border-b border-yellow-700/60">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-yellow-400" />
                <h3 className="text-yellow-100 font-bold">伤害计算公式 - {modalSkillDetails.name} <span className="text-yellow-500/80 text-xs font-normal ml-2">对 [{modalSkillDetails.groupName}] {modalSkillDetails.targetName}</span></h3>
              </div>
              <button 
                onClick={() => setShowModal(false)} 
                className="w-8 h-8 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-yellow-800/40 hover:border-yellow-600/60 flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4 text-yellow-400/80" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
               {/* Step 1 */}
               <div className="bg-slate-900/50 rounded-xl p-4 border border-yellow-800/30 shadow-inner">
                 <div className="text-sm font-bold text-yellow-400 mb-2 flex items-center gap-2">
                   <span className="bg-yellow-900/60 text-yellow-300 w-5 h-5 rounded flex items-center justify-center text-xs">1</span>
                   基础项计算
                 </div>
                 <div className="text-xs text-yellow-100/60 mb-3 bg-black/30 p-2 rounded">
                   公式：(技能等级² / 145) + (技能等级 * 1.4) + 39.5
                 </div>
                 <div className="text-sm text-green-400 font-mono tracking-wide leading-relaxed">
                   = ({modalSkillDetails.level}² / 145) + ({modalSkillDetails.level} * 1.4) + 39.5
                   <br/>
                   <span className="text-yellow-300 font-bold mt-1 inline-block">= {modalSkillDetails.details.baseItem}</span>
                 </div>
               </div>
               
               {/* Step 2 */}
               <div className="bg-slate-900/50 rounded-xl p-4 border border-yellow-800/30 shadow-inner">
                 <div className="text-sm font-bold text-yellow-400 mb-2 flex items-center gap-2">
                   <span className="bg-yellow-900/60 text-yellow-300 w-5 h-5 rounded flex items-center justify-center text-xs">2</span>
                   分灵系数计算
                 </div>
                 <div className="text-xs text-yellow-100/60 mb-3 bg-black/30 p-2 rounded">
                   公式：1 - 目标个数 * 0.1 <span className="text-yellow-500/60 ml-1">(下限0.5，秒5及以上恒定50%)</span>
                 </div>
                 <div className="text-sm text-green-400 font-mono tracking-wide leading-relaxed">
                   = 1 - {modalSkillDetails.targets} * 0.1
                   <br/>
                   <span className="text-yellow-300 font-bold mt-1 inline-block">= {modalSkillDetails.details.splitRatio}</span>
                 </div>
               </div>

               {/* Step 3 */}
               <div className="bg-slate-900/50 rounded-xl p-4 border border-yellow-800/30 shadow-inner">
                 <div className="text-sm font-bold text-yellow-400 mb-2 flex items-center gap-2">
                   <span className="bg-yellow-900/60 text-yellow-300 w-5 h-5 rounded flex items-center justify-center text-xs">3</span>
                   最终伤害计算
                 </div>
                 <div className="text-xs text-yellow-100/60 mb-3 bg-black/30 p-2 rounded leading-relaxed">
                   <div className="mb-2">公式：(基础项 + 面板法伤 - 实际目标法防) * 阵法系数 * 分灵系数 * (1 + 修炼差 * 0.02) + 修炼差 * 5 + 法伤结果</div>
                   <div className="border-t border-yellow-800/40 pt-2 mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-yellow-500/80">
                     <span>面板法伤: {modalSkillDetails.details.magicDamage}</span>
                     <span>目标法防: {modalSkillDetails.details.targetDef}</span>
                     <span>阵法系数: {modalSkillDetails.details.formationRatio}</span>
                     <span>修炼差: {modalSkillDetails.details.cultDiff}</span>
                     <span>法伤结果: {modalSkillDetails.details.magicResult}</span>
                   </div>
                 </div>
                 <div className="text-sm text-green-400 font-mono tracking-wide leading-relaxed">
                   = ({modalSkillDetails.details.baseItem} + {modalSkillDetails.details.magicDamage} - {modalSkillDetails.details.targetDef}) * {modalSkillDetails.details.formationRatio} * {modalSkillDetails.details.splitRatio} * (1 + {modalSkillDetails.details.cultDiff} * 0.02) + {modalSkillDetails.details.cultDiff} * 5 + {modalSkillDetails.details.magicResult}
                   <br/>
                   <div className="mt-3 flex items-center gap-3 flex-wrap">
                     <div className="text-base text-yellow-300 font-bold bg-yellow-900/30 px-4 py-2 rounded border border-yellow-600/40">
                       <span className="text-[10px] text-yellow-500/80 block mb-1">普通伤害</span>
                       {modalSkillDetails.details.finalDamage}
                     </div>
                     <div className="text-base text-red-300 font-bold bg-red-900/30 px-4 py-2 rounded border border-red-600/40">
                       <span className="text-[10px] text-red-500/80 block mb-1">暴击伤害 (×1.5)</span>
                       {modalSkillDetails.details.critDamage}
                     </div>
                   </div>
                 </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
