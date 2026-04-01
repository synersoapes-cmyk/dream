// @ts-nocheck
import { useGameStore } from '@/features/simulator/store/gameStore';
import type { Equipment } from '@/features/simulator/store/gameTypes';
import { X, Edit2 } from 'lucide-react';
import { useState, useRef } from 'react';
import { getEquipmentDefaultImage } from '@/features/simulator/utils/equipmentImage';
import { usePopper } from 'react-popper';

const AVAILABLE_RUNES = [
  { id: '1', name: '红符石', type: 'red', stats: { damage: 1.5 } },
  { id: '1-2', name: '红符石(精)', type: 'red', stats: { damage: 2 } },
  { id: '2', name: '蓝符石', type: 'blue', stats: { speed: 1.5 } },
  { id: '2-2', name: '蓝符石(精)', type: 'blue', stats: { speed: 2 } },
  { id: '3', name: '绿符石', type: 'green', stats: { defense: 1.5 } },
  { id: '3-2', name: '绿符石(精)', type: 'green', stats: { defense: 2 } },
  { id: '4', name: '黄符石', type: 'yellow', stats: { hit: 2 } },
  { id: '4-2', name: '黄符石(精)', type: 'yellow', stats: { hit: 3 } },
  { id: '5', name: '白符石', type: 'white', stats: { magic: 2 } },
  { id: '6', name: '黑符石', type: 'black', stats: { magicDamage: 1.5 } },
  { id: '7', name: '紫符石', type: 'purple', stats: { dodge: 2 } },
];

const AVAILABLE_STAR_POSITIONS = ['无', '伤害 +2.5', '气血 +10', '速度 +1.5', '防御 +2', '法伤 +2.5', '躲避 +2'];
const AVAILABLE_STAR_ALIGNMENTS = ['无', '体质 +2', '魔力 +2', '力量 +2', '耐力 +2', '敏捷 +2'];

const AVAILABLE_RUNE_SETS = [
  '隔山打牛', '回眸一笑', '万丈霞光', '飞檐走壁', '高山流水', '云随风舞'
];

const AVAILABLE_RUNE_SET_EFFECTS = [
  '锐不可当', '破血狂攻', '弱点击破'
];

interface EquipmentDetailModalProps {
  equipment: Equipment;
  onClose: () => void;
}

export function EquipmentDetailModal({ equipment, onClose }: EquipmentDetailModalProps) {
  const updateEquipment = useGameStore((state) => state.updateEquipment);
  const removeEquipment = useGameStore((state) => state.removeEquipment);
  const [simulatedLibEquip, setSimulatedLibEquip] = useState<Equipment>(equipment);

  // 符石和星石编辑相关状态
  const [runePopover, setRunePopover] = useState<{
    type: 'rune' | 'starPosition' | 'starAlignment' | 'luckyHoles' | 'runeSet' | 'runeSetEffect';
    index?: number;
  } | null>(null);

  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null);
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: 'bottom-start',
    strategy: 'fixed',
    modifiers: [
      { name: 'preventOverflow', options: { padding: 8 } },
      { name: 'flip', options: { fallbackPlacements: ['top-start', 'right-start', 'left-start'] } },
      { name: 'offset', options: { offset: [0, 4] } }
    ]
  });

  const formatPrice = (price: number | undefined) => {
    if (price === undefined) return '-';
    const hasDecimal = price % 1 !== 0;
    return hasDecimal ? price.toFixed(2) : price.toString();
  };

  const handleSave = () => {
    updateEquipment(simulatedLibEquip);
    onClose();
  };

  const handleUnequip = () => {
    removeEquipment(equipment.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-950 border border-yellow-700/60 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden relative">
        <div className="flex justify-between items-center mb-4 flex-shrink-0 p-5 pb-0">
          <h3 className="text-yellow-100 font-bold">装备详情</h3>
          <button 
            onClick={onClose}
            className="text-yellow-400 hover:text-yellow-300 text-sm flex items-center gap-1"
          >
            <X className="w-5 h-5" /> 返回
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 pt-0 mb-4">
          <div className="space-y-3">
            {/* 装备名称和状态 */}
            <div className="bg-slate-900 border border-yellow-800/40 rounded-xl p-4">
              <div className="flex gap-6">
                {/* 装备图片 */}
                <div className="w-24 h-24 rounded-lg overflow-hidden bg-slate-950/50 border border-yellow-800/30 shrink-0">
                  <img src={simulatedLibEquip.imageUrl || getEquipmentDefaultImage(simulatedLibEquip.type)} alt={simulatedLibEquip.name} className="w-full h-full object-cover" />
                </div>
                
                {/* 左列：装备信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <div className="text-2xl font-bold text-yellow-400">{simulatedLibEquip.name}</div>
                    <div className="text-[10px] text-green-400 border border-green-600/50 bg-green-900/20 rounded px-2 py-0.5 font-medium">已装备</div>
                  </div>
                  
                  {/* 亮点标签 */}
                  {simulatedLibEquip.highlights && simulatedLibEquip.highlights.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {simulatedLibEquip.highlights.map((hl, j) => (
                        <span key={j} className="text-red-400 border border-red-500/50 rounded px-2 py-0.5 text-xs font-medium">
                          {hl}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {simulatedLibEquip.description && (
                    <div className="text-sm text-slate-300 leading-relaxed mb-2">{simulatedLibEquip.description}</div>
                  )}
                  
                  {simulatedLibEquip.equippableRoles && (
                    <div>
                      <span className="text-green-400 text-xs">【装备角色】</span>
                      <span className="text-slate-300 text-xs ml-1">{simulatedLibEquip.equippableRoles}</span>
                    </div>
                  )}
                </div>
                
                {/* 右列：价格信息 */}
                <div className="flex flex-col gap-3 shrink-0 border-l border-yellow-800/30 pl-6">
                  <div className="text-right">
                     <div className="text-[10px] text-slate-500 mb-1">售价</div>
                     <div className="text-xl font-bold text-[#fff064]">¥ {formatPrice(simulatedLibEquip.price)}</div>
                  </div>
                  <div className="text-right">
                     <div className="text-[10px] text-slate-500 mb-1">跨服费用</div>
                     <div className="text-xl font-bold text-[#fff064]">¥ {formatPrice(simulatedLibEquip.crossServerFee)}</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 基础信息 */}
            <div className="bg-slate-900 border border-yellow-800/40 rounded-xl p-4">
              <div className="flex gap-6 mb-3">
                {simulatedLibEquip.level && (
                  <div>
                    <span className="text-yellow-400 text-sm font-bold">等级 {simulatedLibEquip.level}</span>
                  </div>
                )}
                {simulatedLibEquip.element && simulatedLibEquip.element !== '无' && (
                  <div>
                    <span className="text-yellow-400 text-sm">五行 </span>
                    <span className="text-yellow-400 text-sm font-bold">{simulatedLibEquip.element}</span>
                  </div>
                )}
              </div>
              
              <div className="text-sm text-yellow-100 mb-2">{simulatedLibEquip.mainStat}</div>
              
              {simulatedLibEquip.durability && (
                <div className="text-sm text-slate-300">耐久度 {simulatedLibEquip.durability}</div>
              )}
              
              {simulatedLibEquip.forgeLevel !== undefined && simulatedLibEquip.gemstone && (
                <div className="text-sm text-slate-300 mt-1">
                  {simulatedLibEquip.type === 'trinket' ? '星辉石等级 ' : (simulatedLibEquip.type === 'jade' ? '玉魄阶数 ' : '锻炼等级 ')}
                  {simulatedLibEquip.forgeLevel} 
                  {simulatedLibEquip.type !== 'jade' && <> 镶嵌宝石 <span className="text-red-400">{simulatedLibEquip.gemstone}</span></>}
                </div>
              )}
              
              {simulatedLibEquip.extraStat && (
                <div className="text-sm text-green-400 mt-1">{simulatedLibEquip.extraStat}</div>
              )}
            </div>
            
            {/* 符石信息 / 特效 */}
            {simulatedLibEquip.type === 'trinket' && simulatedLibEquip.specialEffect && (
              <div className="bg-slate-900 border border-yellow-800/40 rounded-xl p-4 space-y-2">
                <div className="text-sm text-purple-400">特效：{simulatedLibEquip.specialEffect}</div>
              </div>
            )}
            
            {simulatedLibEquip.type !== 'trinket' && simulatedLibEquip.type !== 'jade' && simulatedLibEquip.runeStoneSets && simulatedLibEquip.runeStoneSets.length > 0 && (
              <div className="bg-slate-900 border border-yellow-800/40 rounded-xl p-4 space-y-2">
                {/* 开运孔数 - 可点击修改 */}
                <div className="relative">
                  <div 
                    ref={runePopover?.type === 'luckyHoles' ? setReferenceElement : null}
                    className="text-sm text-green-400 cursor-pointer hover:bg-slate-800/80 px-2 py-1 -mx-2 rounded transition-colors inline-flex items-center gap-1.5"
                    onClick={() => setRunePopover({ type: 'luckyHoles' })}
                  >
                    开运孔数：{simulatedLibEquip.luckyHoles || '0'}
                    <Edit2 className="w-3 h-3 text-green-400/60" />
                  </div>
                  
                  {/* 开运孔数选择浮层 */}
                  {runePopover?.type === 'luckyHoles' && (
                    <div 
                      ref={setPopperElement}
                      style={{ ...styles.popper, zIndex: 9999 }}
                      {...attributes.popper}
                      className="w-32 bg-slate-800 border border-yellow-700/50 rounded-lg shadow-xl overflow-hidden"
                    >
                      <div className="p-1">
                        <div className="text-xs text-yellow-500/80 px-2 py-1.5 border-b border-yellow-900/30 mb-1">选择孔数</div>
                        {[0, 1, 2, 3, 4, 5].map((num) => (
                          <div 
                            key={num}
                            className="px-3 py-2 text-sm hover:bg-slate-700 cursor-pointer text-green-400 transition-colors rounded"
                            onClick={() => {
                              const newEquip = { ...simulatedLibEquip, luckyHoles: num.toString() };
                              
                              // 调整符石数组长度以匹配新的开孔数
                              if (newEquip.runeStoneSets && newEquip.runeStoneSets.length > 0) {
                                newEquip.runeStoneSets = [...newEquip.runeStoneSets];
                                const currentRunes = [...(newEquip.runeStoneSets[0] || [])];
                                
                                if (num < currentRunes.length) {
                                  // 减少孔数，截断符石数组
                                  newEquip.runeStoneSets[0] = currentRunes.slice(0, num);
                                } else if (num > currentRunes.length) {
                                  // 增加孔数，用默认符石填充
                                  const defaultRune = AVAILABLE_RUNES[0]; // 使用第一个符石作为默认
                                  while (newEquip.runeStoneSets[0].length < num) {
                                    newEquip.runeStoneSets[0].push({ ...defaultRune });
                                  }
                                }
                              }
                              
                              setSimulatedLibEquip(newEquip);
                              setRunePopover(null);
                            }}
                          >
                            {num} 个孔
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {runePopover && (
                  <div className="fixed inset-0 z-40" onClick={() => setRunePopover(null)} />
                )}
                
                {simulatedLibEquip.runeStoneSets[0].map((stone: any, idx: number) => (
                  <div key={idx} className="relative">
                    <div 
                      ref={runePopover?.type === 'rune' && runePopover.index === idx ? setReferenceElement : null}
                      className="text-sm text-green-400 cursor-pointer hover:bg-slate-800/80 px-2 py-1 -mx-2 rounded transition-colors inline-flex items-center gap-1.5"
                      onClick={() => setRunePopover({ type: 'rune', index: idx })}
                    >
                      <span>
                        符石{idx + 1}：{stone?.name || ''} {stone?.description || ''}
                      </span>
                      <Edit2 className="w-3 h-3 text-green-400/60" />
                    </div>
                    
                    {/* 符石选择浮层 */}
                    {runePopover?.type === 'rune' && runePopover.index === idx && (
                      <div 
                        ref={setPopperElement}
                        style={{ ...styles.popper, zIndex: 9999 }}
                        {...attributes.popper}
                        className="w-64 bg-slate-800 border border-yellow-700/50 rounded-lg shadow-xl overflow-hidden"
                      >
                        <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                          <div className="text-xs text-yellow-500/80 px-2 py-1.5 border-b border-yellow-900/30 mb-1">选择要替换的符石</div>
                          {AVAILABLE_RUNES.map(r => (
                            <div 
                              key={r.id}
                              className="px-3 py-2 text-sm hover:bg-slate-700 cursor-pointer transition-colors flex justify-between items-center rounded"
                              onClick={() => {
                                const newEquip = { ...simulatedLibEquip };
                                newEquip.runeStoneSets = [...newEquip.runeStoneSets!];
                                newEquip.runeStoneSets[0] = [...newEquip.runeStoneSets[0]];
                                newEquip.runeStoneSets[0][idx] = { ...r };
                                setSimulatedLibEquip(newEquip);
                                setRunePopover(null);
                              }}
                            >
                              <span className="text-green-400 font-medium">{r.name}</span>
                              <span className="text-xs text-slate-300">
                                {Object.entries(r?.stats || {}).map(([k,v]) => {
                                  const localStatNames: Record<string, string> = {
                                    hp: '气血', magic: '魔法', damage: '伤害', hit: '命中',
                                    defense: '防御', magicDefense: '法防', speed: '速度',
                                    dodge: '躲避', magicDamage: '法伤', physique: '体质',
                                    magicPower: '魔力', strength: '力量', endurance: '耐力', agility: '敏捷'
                                  };
                                  return `${localStatNames[k] || k} +${v}`;
                                }).join(' ')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                <div className="relative">
                  {simulatedLibEquip.starPosition && (
                    <div 
                      ref={runePopover?.type === 'starPosition' ? setReferenceElement : null}
                      className="text-sm text-green-400 cursor-pointer hover:bg-slate-800/80 px-2 py-1 -mx-2 rounded transition-colors inline-flex items-center gap-1.5"
                      onClick={() => setRunePopover({ type: 'starPosition' })}
                    >
                      星位：{simulatedLibEquip.starPosition}
                      <Edit2 className="w-3 h-3 text-green-400/60" />
                    </div>
                  )}
                  
                  {/* 星位选择浮层 */}
                  {runePopover?.type === 'starPosition' && (
                    <div 
                      ref={setPopperElement}
                      style={{ ...styles.popper, zIndex: 9999 }}
                      {...attributes.popper}
                      className="w-48 bg-slate-800 border border-yellow-700/50 rounded-lg shadow-xl overflow-hidden"
                    >
                      <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                        <div className="text-xs text-yellow-500/80 px-2 py-1.5 border-b border-yellow-900/30 mb-1">选择星位属性</div>
                        {AVAILABLE_STAR_POSITIONS.map((sp, i) => (
                          <div 
                            key={i}
                            className="px-3 py-2 text-sm hover:bg-slate-700 cursor-pointer text-green-400 transition-colors rounded"
                            onClick={() => {
                              setSimulatedLibEquip({ ...simulatedLibEquip, starPosition: sp });
                              setRunePopover(null);
                            }}
                          >
                            {sp}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="relative">
                  {simulatedLibEquip.starAlignment && (
                    <div 
                      ref={runePopover?.type === 'starAlignment' ? setReferenceElement : null}
                      className="text-sm text-green-400 cursor-pointer hover:bg-slate-800/80 px-2 py-1 -mx-2 rounded transition-colors inline-flex items-center gap-1.5"
                      onClick={() => setRunePopover({ type: 'starAlignment' })}
                    >
                      星相互合：{simulatedLibEquip.starAlignment}
                      <Edit2 className="w-3 h-3 text-green-400/60" />
                    </div>
                  )}
                  
                  {/* 星相互合选择浮层 */}
                  {runePopover?.type === 'starAlignment' && (
                    <div 
                      ref={setPopperElement}
                      style={{ ...styles.popper, zIndex: 9999 }}
                      {...attributes.popper}
                      className="w-48 bg-slate-800 border border-yellow-700/50 rounded-lg shadow-xl overflow-hidden"
                    >
                      <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                        <div className="text-xs text-yellow-500/80 px-2 py-1.5 border-b border-yellow-900/30 mb-1">选择星相互合属性</div>
                        {AVAILABLE_STAR_ALIGNMENTS.map((sa, i) => (
                          <div 
                            key={i}
                            className="px-3 py-2 text-sm hover:bg-slate-700 cursor-pointer text-green-400 transition-colors rounded"
                            onClick={() => {
                              setSimulatedLibEquip({ ...simulatedLibEquip, starAlignment: sa });
                              setRunePopover(null);
                            }}
                          >
                            {sa}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* 符石组合 - 可点击修改 */}
                {simulatedLibEquip.runeStoneSetsNames && simulatedLibEquip.runeStoneSetsNames.length > 0 && (
                  <div className="relative">
                    <div 
                      ref={runePopover?.type === 'runeSet' ? setReferenceElement : null}
                      className="text-sm text-purple-400 mt-1 cursor-pointer hover:bg-slate-800/80 px-2 py-1 -mx-2 rounded transition-colors inline-flex items-center gap-1.5"
                      onClick={() => setRunePopover({ type: 'runeSet' })}
                    >
                      符石组合：{simulatedLibEquip.runeStoneSetsNames[0]}
                      <Edit2 className="w-3 h-3 text-purple-400/60" />
                    </div>
                    
                    {/* 符石组合选择浮层 */}
                    {runePopover?.type === 'runeSet' && (
                      <div 
                        ref={setPopperElement}
                        style={{ ...styles.popper, zIndex: 9999 }}
                        {...attributes.popper}
                        className="w-48 bg-slate-800 border border-yellow-700/50 rounded-lg shadow-xl overflow-hidden"
                      >
                        <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                          <div className="text-xs text-yellow-500/80 px-2 py-1.5 border-b border-yellow-900/30 mb-1">选择符石组合</div>
                          {AVAILABLE_RUNE_SETS.map((rsName, i) => (
                            <div 
                              key={i}
                              className="px-3 py-2 text-sm hover:bg-slate-700 cursor-pointer text-purple-400 transition-colors rounded"
                              onClick={() => {
                                const newEquip = { ...simulatedLibEquip };
                                newEquip.runeStoneSetsNames = [rsName, ...(newEquip.runeStoneSetsNames?.slice(1) || [])];
                                setSimulatedLibEquip(newEquip);
                                setRunePopover(null);
                              }}
                            >
                              {rsName}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* 符石套装效果 - 可点击修改 */}
                <div className="relative">
                  <div 
                    ref={runePopover?.type === 'runeSetEffect' ? setReferenceElement : null}
                    className="text-sm text-orange-400 mt-1 cursor-pointer hover:bg-slate-800/80 px-2 py-1 -mx-2 rounded transition-colors inline-flex items-center gap-1.5"
                    onClick={() => setRunePopover({ type: 'runeSetEffect' })}
                  >
                    符石套装效果：{simulatedLibEquip.runeSetEffect || '无'}
                    <Edit2 className="w-3 h-3 text-orange-400/60" />
                  </div>
                  
                  {/* 符石套装效果选择浮层 */}
                  {runePopover?.type === 'runeSetEffect' && (
                    <div 
                      ref={setPopperElement}
                      style={{ ...styles.popper, zIndex: 9999 }}
                      {...attributes.popper}
                      className="w-48 bg-slate-800 border border-yellow-700/50 rounded-lg shadow-xl overflow-hidden"
                    >
                      <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                        <div className="text-xs text-yellow-500/80 px-2 py-1.5 border-b border-yellow-900/30 mb-1">选择套装效果</div>
                        {['无', ...AVAILABLE_RUNE_SET_EFFECTS].map((effectName, i) => (
                          <div 
                            key={i}
                            className="px-3 py-2 text-sm hover:bg-slate-700 cursor-pointer text-orange-400 transition-colors rounded"
                            onClick={() => {
                              setSimulatedLibEquip({ ...simulatedLibEquip, runeSetEffect: effectName === '无' ? undefined : effectName });
                              setRunePopover(null);
                            }}
                          >
                            {effectName}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 底部操作区 */}
        <div className="flex-shrink-0 border-t border-yellow-800/30 p-5 pt-4 bg-slate-900">
          <div className="flex gap-4">
            <button
              onClick={handleUnequip}
              className="flex-1 text-center bg-red-900/30 hover:bg-red-900/50 border border-red-600/40 rounded-lg p-3 flex flex-col justify-center items-center transition-colors"
            >
              <span className="text-red-400 text-sm font-medium">卸下装备</span>
            </button>
            <button
              onClick={handleSave}
              className="flex-1 text-center bg-yellow-600 hover:bg-yellow-500 text-slate-900 rounded-lg p-3 flex flex-col justify-center items-center transition-colors"
            >
              <span className="text-sm font-bold">保存修改</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
