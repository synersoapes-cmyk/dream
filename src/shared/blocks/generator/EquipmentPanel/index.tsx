// @ts-nocheck
"use client";
import { useGameStore } from '@/features/simulator/store/gameStore';
import { applySimulatorBundleToStore } from '@/features/simulator/utils/simulatorBundle';
import type { Equipment } from '@/features/simulator/store/gameTypes';
import { Sword, Shield, Gem, Sparkles, Settings, Edit2, Package, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { EquipmentDetailModal } from './EquipmentDetailModal';
import { EquipmentImage } from './EquipmentImage';
import { EquipmentLibraryModal } from './EquipmentLibraryModal';
import { MOCK_LIBRARY_EQUIPMENT } from './mockLibraryEquipment';
import { getConsolidatedRuneStoneSetInfo, VALID_RUNE_SETS } from './RuneStoneHelper';
import { EquipmentPanelSlot } from './EquipmentPanelSlot';

// 模拟生成新装备
function generateMockEquipment(type: Equipment['type'], slot?: number): Equipment {
  // 为每个装备类型生成独特的随机值
  const generateUniqueStats = (type: Equipment['type']) => {
    let generatedStats: any = {};
    
    switch (type) {
      case 'weapon':
        generatedStats = { 
          magicDamage: Math.floor(Math.random() * 100) + 340, 
          hit: Math.floor(Math.random() * 50) + 110, 
          magic: Math.floor(Math.random() * 15) + 20 
        };
        break;
      case 'helmet':
        generatedStats = { 
          magicDefense: Math.floor(Math.random() * 30) + 130, 
          magic: Math.floor(Math.random() * 10) + 15, 
          defense: Math.floor(Math.random() * 20) + 40 
        };
        break;
      case 'necklace':
        generatedStats = { 
          magicDamage: Math.floor(Math.random() * 20) + 85, 
          magic: Math.floor(Math.random() * 8) + 12 
        };
        break;
      case 'armor':
        generatedStats = { 
          magicDefense: Math.floor(Math.random() * 30) + 140, 
          defense: Math.floor(Math.random() * 30) + 75, 
          physique: Math.floor(Math.random() * 10) + 18 
        };
        break;
      case 'belt':
        generatedStats = { 
          speed: Math.floor(Math.random() * 15) + 55, 
          agility: Math.floor(Math.random() * 8) + 10, 
          defense: Math.floor(Math.random() * 15) + 30 
        };
        break;
      case 'shoes':
        generatedStats = { 
          agility: Math.floor(Math.random() * 6) + 18, 
          speed: Math.floor(Math.random() * 15) + 45, 
          defense: Math.floor(Math.random() * 15) + 28 
        };
        break;
      case 'runeStone':
      case 'rune':
        // 符石属性：根据颜色类型生成不同属性
        const runeTypes = ['red', 'blue', 'yellow', 'green', 'purple', 'black', 'white', 'orange'];
        const randomType = runeTypes[Math.floor(Math.random() * runeTypes.length)];
        
        // 根据符石颜色生成对应属性
        switch (randomType) {
          case 'red': // 红色符石 - 伤害类
            generatedStats = { 
              damage: Math.floor(Math.random() * 15) + 10,
              magicDamage: Math.floor(Math.random() * 12) + 8
            };
            break;
          case 'blue': // 蓝色符石 - 防御类
            generatedStats = { 
              defense: Math.floor(Math.random() * 20) + 15,
              magicDefense: Math.floor(Math.random() * 18) + 12
            };
            break;
          case 'yellow': // 黄色符石 - 速度类
            generatedStats = { 
              speed: Math.floor(Math.random() * 12) + 8,
              agility: Math.floor(Math.random() * 8) + 5
            };
            break;
          case 'green': // 绿色符石 - 气血类
            generatedStats = { 
              hp: Math.floor(Math.random() * 80) + 60,
              physique: Math.floor(Math.random() * 6) + 4
            };
            break;
          case 'purple': // 紫色符石 - 灵力类
            generatedStats = { 
              magic: Math.floor(Math.random() * 10) + 8,
              magicPower: Math.floor(Math.random() * 8) + 5
            };
            break;
          case 'black': // 黑色符石 - 命中类
            generatedStats = { 
              hit: Math.floor(Math.random() * 15) + 10,
              damage: Math.floor(Math.random() * 8) + 5
            };
            break;
          case 'white': // 白色符石 - 躲避类
            generatedStats = { 
              dodge: Math.floor(Math.random() * 15) + 10,
              speed: Math.floor(Math.random() * 8) + 5
            };
            break;
          case 'orange': // 橙色符石 - 综合类
            generatedStats = { 
              magicDamage: Math.floor(Math.random() * 10) + 6,
              defense: Math.floor(Math.random() * 12) + 8,
              speed: Math.floor(Math.random() * 8) + 5
            };
            break;
        }
        break;
      default:
        generatedStats = {};
    }
    
    // 同时返回 stats 和 baseStats，确保它们相同
    return {
      stats: { ...generatedStats },
      baseStats: { ...generatedStats },
      extraStat: Math.random() > 0.5 ? `随机属性 +${Math.floor(Math.random() * 20)}` : undefined,
      highlights: Math.random() > 0.5 ? ['特效', '特技'].slice(0, Math.floor(Math.random() * 2) + 1) : []
    };
  };

  const uniqueStats = generateUniqueStats(type);

  const templates: Record<Equipment['type'], any> = {
    weapon: {
      names: ['烈焰神杖', '龙啸破天杖', '冰魄灵杖'],
      mainStats: ['法伤 +380', '法伤 +360', '法伤 +350'],
      ...uniqueStats
    },
    helmet: {
      names: ['玄冰护盔', '龙魂宝冠', '极寒之冠'],
      mainStats: ['法防 +150', '法防 +140', '法防 +145'],
      ...uniqueStats
    },
    necklace: {
      names: ['龙珠项链', '深海明珠', '九天星链'],
      mainStats: ['法伤 +100', '法伤 +95', '法 +90'],
      ...uniqueStats
    },
    armor: {
      names: ['水龙战袍', '极寒护甲', '玄冰战衣'],
      mainStats: ['法防 +160', '法防 +155', '法防 +150'],
      ...uniqueStats
    },
    belt: {
      names: ['破军腰带', '疾风之带', '流云宝带'],
      mainStats: ['速度 +65', '速度 +60', '速度 +58'],
      ...uniqueStats
    },
    shoes: {
      names: ['御风神靴', '流光飞靴', '凌波微步'],
      mainStats: ['敏捷 +22', '敏捷 +20', '敏捷 +19'],
      ...uniqueStats
    },
    runeStone: {
      // 符石 - 根据类型生成名称
      names: (() => {
        const runeNames: Record<string, string[]> = {
          red: ['赤炎符石', '烈焰符石', '炽热符石'],
          blue: ['冰晶符石', '寒霜符石', '玄冰符石'],
          yellow: ['疾风符石', '雷霆符石', '极速符石'],
          green: ['生命符石', '翠绿符石', '自然符石'],
          purple: ['灵魂符石', '神秘符石', '紫晶符石'],
          black: ['暗影符石', '幽冥符石', '黑曜符石'],
          white: ['光明符石', '圣洁符石', '明光符石'],
          orange: ['混沌符石', '万象符石', '元素符石']
        };
        
        // 从 uniqueStats 中判断符石类型
        const stats = uniqueStats.stats || {};
        let runeType = 'red';
        if (stats.defense || stats.magicDefense) runeType = 'blue';
        else if (stats.speed && stats.agility) runeType = 'yellow';
        else if (stats.hp || stats.physique) runeType = 'green';
        else if (stats.magic || stats.magicPower) runeType = 'purple';
        else if (stats.hit) runeType = 'black';
        else if (stats.dodge) runeType = 'white';
        else if (stats.magicDamage && stats.defense && stats.speed) runeType = 'orange';
        
        return runeNames[runeType];
      })(),
      mainStats: (() => {
        const stats = uniqueStats.stats || {};
        const entries = Object.entries(stats);
        if (entries.length > 0) {
          const [key, value] = entries[0] as [string, number];
          const labels: Record<string, string> = {
            damage: '伤害',
            magicDamage: '法伤',
            defense: '防御',
            magicDefense: '法防',
            speed: '速度',
            hp: '气血',
            magic: '魔力',
            hit: '命中',
            dodge: '躲避',
            agility: '敏捷',
            physique: '体质',
            magicPower: '灵力'
          };
          return [`${labels[key] || key} +${value}`];
        }
        return ['属性 +10'];
      })(),
      ...uniqueStats,
      // 添加符石特有的属性
      runeType: (() => {
        const stats = uniqueStats.stats || {};
        if (stats.defense || stats.magicDefense) return 'blue';
        else if (stats.speed && stats.agility) return 'yellow';
        else if (stats.hp || stats.physique) return 'green';
        else if (stats.magic || stats.magicPower) return 'purple';
        else if (stats.hit) return 'black';
        else if (stats.dodge) return 'white';
        else if (stats.magicDamage && stats.defense && stats.speed) return 'orange';
        return 'red';
      })(),
      level: Math.floor(Math.random() * 3) + 8, // 8-10级
      quality: ['完美', '卓越', '精良'][Math.floor(Math.random() * 3)]
    },
    rune: {
      // rune 作为 runeStone 的别名
      names: ['赤炎符石', '冰晶符石', '疾风符石'],
      mainStats: ['伤害 +12', '防御 +18', '速度 +10'],
      ...uniqueStats
    },
    trinket: {
      // 根据灵饰槽位生成不同数据 - 龙宫门派法���配置（160级真实数据）
      names: slot === 1 
        ? ['碧海潮生·灵符', '龙吟九天·灵符', '水月洞天·灵符']
        : slot === 2
        ? ['四海龙王·灵石', '龙宫秘宝·灵石', '东海神珠·灵石']
        : slot === 3
        ? ['逆鳞之怒·灵珏', '潜龙在渊·灵珏', '龙腾四海·灵珏']
        : ['龙神庇护·灵玉', '水龙吟·灵玉', '龙战野·灵玉'],
      mainStats: ['气血 +120', '法力 +95', '灵力 +10'],
      quality: ['完美', '卓越', '精良'][Math.floor(Math.random() * 3)],
      trinketLevel: 160,
      trinketSlotType: slot === 1 || slot === 2 ? '戒指' : '耳饰',
      refineLevel: Math.floor(Math.random() * 6) + 6, // 6-11级星辉石
      refineGains: { // 星辉石固定增益表（每级增益）
        damage: 4,
        magicDamage: 3,
        defense: 8,
        magicDefense: 8,
        health: 28,
        speed: 3
      },
      // 使用subStatsLines存储多条副属性，以支持类似"三法伤"
      subStatsLines: (() => {
        const lines: Array<{key: string, value: number}> = [];
        const numLines = Math.floor(Math.random() * 2) + 2; // 2-3条副属性
        
        // 随机决定副属性类型组合，比如全法伤，或法伤+速度
        const typeRoll = Math.random();
        let typesToUse: string[] = [];
        
        if (typeRoll < 0.4) {
          typesToUse = ['magicDamage', 'magicDamage', 'magicDamage']; // 容易出三法伤
        } else if (typeRoll < 0.7) {
          typesToUse = ['magicDamage', 'magicDamage', 'speed'];
        } else {
          typesToUse = ['magicDamage', 'speed', 'defense'];
        }
        
        for (let i = 0; i < numLines; i++) {
          const type = typesToUse[i] || 'magicDamage';
          let value = 0;
          if (type === 'magicDamage') value = Math.floor(Math.random() * 11) + 15; // 15-25法伤
          if (type === 'health') value = Math.floor(Math.random() * 51) + 100; // 100-150气血
          if (type === 'speed') value = Math.floor(Math.random() * 6) + 10; // 10-15速度
          if (type === 'defense') value = Math.floor(Math.random() * 8) + 17; // 17-24防御
          
          lines.push({ key: type, value });
        }
        return lines;
      })(),
      // 基础属性（最多4条：1主+3副）
      baseStats: (() => {
        const mainType = Math.floor(Math.random() * 3);
        const result: any = {};
        
        // 主属性（三选一）
        if (mainType === 0) result.health = Math.floor(Math.random() * 51) + 100; // 100-150
        else if (mainType === 1) result.magic = Math.floor(Math.random() * 21) + 80; // 80-100
        else result.magicDefense = Math.floor(Math.random() * 5) + 18; // 18-22
        
        return result;
      })()
    },
    jade: {
      // 玉魄 - 龙宫门派配置（150-160级真实数据）
      names: ['龙魂玉魄', '水龙之魄', '东海龙珠'],
      mainStats: ['气血 +98', '防御 +19', '法防 +18'],
      // 钟灵石装
      zhongLingSet: (() => {
        const sets: Array<{type: any, level: number, stats: any}> = [
          { type: '健步如飞', level: 6, stats: { speed: 18 } },
          { type: '心无旁骛', level: 5, stats: { resistance: 3 } },
          { type: '气贯长虹', level: 7, stats: { health: 7 } },
          { type: '金刚不坏', level: 6, stats: { defense: 12 } },
        ];
        return sets[Math.floor(Math.random() * sets.length)];
      })(),
      // 基础属性（玉魄最多3条：1主+2副）
      baseStats: (() => {
        const mainType = Math.floor(Math.random() * 3);
        const result: any = {};
        
        // 主属性（三选一）
        if (mainType === 0) result.health = Math.floor(Math.random() * 16) + 85; // 85-100
        else if (mainType === 1) result.defense = Math.floor(Math.random() * 6) + 15; // 15-20
        else result.magicDefense = Math.floor(Math.random() * 6) + 14; // 14-19
        
        // 副属性1-2
        if (mainType === 0) {
          result.defense = Math.floor(Math.random() * 6) + 14;
          result.magicDefense = Math.floor(Math.random() * 5) + 12;
        } else {
          result.health = Math.floor(Math.random() * 11) + 70;
          result.physique = Math.floor(Math.random() * 6) + 5;
        }
        
        return result;
      })()
    }
  };

  const template = templates[type];
  const index = Math.floor(Math.random() * template.names.length);
  
  // 对于普通装备（weapon, helmet, necklace, armor, belt, shoes），直接使用 baseStats
  // 对灵饰（trinket），需要应用精炼加成
  // 对于玉魄（jade），直接使用 baseStats
  let currentStats = { ...template.baseStats };
  
  if (type === 'trinket' && template.refineLevel) {
    // 灵饰：应用星辉石精炼加成
    if (template.subStatsLines) {
      template.subStatsLines.forEach((line: { key: string; value: number }) => {
        const gainPerLevel = template.refineGains?.[line.key as keyof typeof template.refineGains] || 0;
        const finalValue = line.value + gainPerLevel * template.refineLevel;
        currentStats[line.key] = (currentStats[line.key] || 0) + finalValue;
      });
    }
  }
  
  // 为普通装备生成符石套装，灵饰和玉魄没有符石
  let runeStoneSets = undefined;
  let runeStoneSetsNames = undefined;
  let activeRuneStoneSet = undefined;
  
  if (type !== 'trinket' && type !== 'jade' && type !== 'runeStone' && type !== 'rune') {
    // 普通装备的符石套装
    runeStoneSets = [
      // 第1套：极限（比如隔山打牛）
      [
        { id: `rs_${Date.now()}_1`, type: 'red', level: 3, stats: { magicDamage: 1.5, hit: 2 } },
        { id: `rs_${Date.now()}_2`, type: 'blue', level: 3, stats: { magic: 1.5, speed: 1.5 } },
        { id: `rs_${Date.now()}_3`, type: 'white', level: 3, stats: { magicDamage: 1.5, defense: 1.5 } },
        { id: `rs_${Date.now()}_4`, type: 'black', level: 3, stats: { speed: 1.5, agility: 1.5 } },
        { id: `rs_${Date.now()}_5`, type: 'purple', level: 3, stats: { health: 15, physique: 1.5 } }
      ],
      // 第2套：百无禁忌
      [
        { id: `rs_${Date.now()}_6`, type: 'black', level: 3, stats: { speed: 1.5, agility: 1.5 } },
        { id: `rs_${Date.now()}_7`, type: 'white', level: 3, stats: { magicDamage: 1.5, defense: 1.5 } },
        { id: `rs_${Date.now()}_8`, type: 'purple', level: 3, stats: { health: 15, physique: 1.5 } },
        { id: `rs_${Date.now()}_9`, type: 'green', level: 3, stats: { defense: 1.5, magicDefense: 1.5 } },
        { id: `rs_${Date.now()}_10`, type: 'red', level: 3, stats: { magicDamage: 1.5, hit: 2 } }
      ]
    ];
    
    runeStoneSetsNames = ['隔山打牛', '百无禁忌'];
    activeRuneStoneSet = 0;
  }
  
  return {
    id: Date.now().toString() + Math.random(),
    name: template.names[index],
    type,
    slot,
    quality: template.quality,
    mainStat: template.mainStats[index],
    trinketLevel: template.trinketLevel,
    trinketSlotType: template.trinketSlotType,
    refineLevel: template.refineLevel,
    refineGains: template.refineGains,
    subStatsLines: template.subStatsLines,
    zhongLingSet: template.zhongLingSet,
    baseStats: template.baseStats,
    stats: currentStats,
    level: template.level || 160,
    forgeLevel: template.forgeLevel || Math.floor(Math.random() * 5) + 11,
    durability: template.durability || Math.floor(Math.random() * 400) + 100,
    price: Math.floor(Math.random() * (8000 - 800 + 1)) + 800, // 随机价格：800-8000元
    runeStoneSets,
    runeStoneSetsNames,
    activeRuneStoneSet
  };
}

export function EquipmentPanel() {
  const equipment = useGameStore((state) => state.equipment);
  const equipmentSets = useGameStore((state) => state.equipmentSets);
  const updateEquipmentSetName = useGameStore((state) => state.updateEquipmentSetName);
  const updateEquipment = useGameStore((state) => state.updateEquipment);
  const enterPreviewMode = useGameStore((state) => state.enterPreviewMode);
  const addOcrLog = useGameStore((state) => state.addOcrLog);
  
  const [currentSet, setCurrentSet] = useState(0);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [editingSetIndex, setEditingSetIndex] = useState<number | null>(null);
  const [editedSetName, setEditedSetName] = useState('');
  const [isSavingEquipment, setIsSavingEquipment] = useState(false);
  const [saveEquipmentMessage, setSaveEquipmentMessage] = useState<string | null>(null);
  const [saveEquipmentError, setSaveEquipmentError] = useState<string | null>(null);
  const [libraryModalInfo, setLibraryModalInfo] = useState<{
    type: Equipment['type'];
    name: string;
    slot?: number;
  } | null>(null);

  // 获取装备组合名称（从state获取，或使用默认名称）
  const getSetName = (index: number) => {
    if (equipmentSets[index]?.name) {
      // 去掉末尾的"组合"二字
      return equipmentSets[index].name.replace(/组合$/, '');
    }
    return `配置${index + 1}`;
  };

  // 保存装备组合名称
  const saveSetName = (index: number) => {
    if (editedSetName.trim()) {
      updateEquipmentSetName(index, editedSetName.trim());
    }
    setEditingSetIndex(null);
  };

  // 装备槽位
  const equipmentSlots: Array<{ type: Equipment['type']; name: string; icon: any; slot?: number }> = [
    { type: 'weapon', name: '武器', icon: Sword },
    { type: 'helmet', name: '头盔', icon: Shield },
    { type: 'necklace', name: '项链', icon: Gem },
    { type: 'armor', name: '铠甲', icon: Shield },
    { type: 'belt', name: '腰带', icon: Gem },
    { type: 'shoes', name: '鞋子', icon: Sparkles },
  ];

  const trinketSlots: Array<{ type: Equipment['type']; name: string; icon: any; slot: number }> = [
    { type: 'trinket', name: '灵符', icon: Sparkles, slot: 1 },
    { type: 'trinket', name: '灵石', icon: Sparkles, slot: 2 },
    { type: 'trinket', name: '灵珏', icon: Sparkles, slot: 3 },
    { type: 'trinket', name: '灵玉', icon: Sparkles, slot: 4 },
  ];

  const jadeSlots: Array<{ type: Equipment['type']; name: '阳玉' | '阴玉'; icon: any; slot: number }> = [
    { type: 'jade', name: '阳玉', icon: Gem, slot: 1 },
    { type: 'jade', name: '阴玉', icon: Gem, slot: 2 },
  ];

  const getEquipmentInSlot = (type: Equipment['type'], slot?: number) => {
    return equipment.find(e => e.type === type && (slot === undefined || e.slot === slot));
  };

  const handleEquipClick = (type: Equipment['type'], slot?: number) => {
    const current = getEquipmentInSlot(type, slot);
    
    // 如果已装备，打开详情弹窗
    if (current) {
      setSelectedEquipment(current);
      return;
    }
    
    // 未装备：打开装备库选择浮层
    const slotName = equipmentSlots.find(s => s.type === type)?.name
      || trinketSlots.find(s => s.type === type && s.slot === slot)?.name
      || jadeSlots.find(s => s.type === type && s.slot === slot)?.name
      || '装备';
    
    setLibraryModalInfo({
      type,
      name: slotName,
      slot
    });
  };

  const handleSaveEquipment = async () => {
    setIsSavingEquipment(true);
    setSaveEquipmentError(null);
    setSaveEquipmentMessage(null);

    try {
      const resp = await fetch('/api/simulator/current/equipment', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ equipment }),
      });

      const payload = await resp.json();
      if (!resp.ok || payload?.code !== 0 || !payload?.data) {
        throw new Error(payload?.message || '保存失败');
      }

      applySimulatorBundleToStore(payload.data);
      setSaveEquipmentMessage('当前装备已保存到云端');
    } catch (error) {
      console.error('Failed to save simulator equipment:', error);
      setSaveEquipmentError(error instanceof Error ? error.message : '保存失败');
    } finally {
      setIsSavingEquipment(false);
    }
  };

  return (
    <div className="h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 rounded-2xl border border-yellow-800/60 flex flex-col overflow-hidden shadow-2xl">
      {/* 标题栏 */}
      <div className="bg-gradient-to-r from-yellow-900/50 to-yellow-800/30 border-b border-yellow-700/60 px-5 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-yellow-600 flex items-center justify-center">
            <Settings className="w-5 h-5 text-slate-900" />
          </div>
          <div>
            <h2 className="text-base font-bold text-yellow-100">当前装备</h2>
            <p className="text-xs text-yellow-400/80">Current Equipment</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saveEquipmentError && (
            <span className="text-xs text-red-300">{saveEquipmentError}</span>
          )}
          {!saveEquipmentError && saveEquipmentMessage && (
            <span className="text-xs text-emerald-300">{saveEquipmentMessage}</span>
          )}
          <button
            className="rounded-lg border border-yellow-700/50 bg-slate-900/70 px-4 py-2 text-xs font-bold text-yellow-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSavingEquipment}
            onClick={handleSaveEquipment}
          >
            {isSavingEquipment ? '保存中...' : '保存装备'}
          </button>
        </div>
      </div>

      {/* 当前装备内容 */}
      <div className="flex-1 overflow-y-auto overflow-x-visible p-4 space-y-4">
        {/* 装备区域 - 包含装备组合切换器 */}
        <div className="bg-slate-900/40 border border-yellow-800/40 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-yellow-800/30">
              <Sword className="w-4 h-4 text-yellow-400" />
              <div className="text-yellow-400 text-sm font-medium">装备</div>
            </div>
            
            {/* 装备组合切换器 */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-yellow-400/70 text-xs">装备组合</div>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[0, 1, 2, 3, 4].map((idx) => (
                  <div key={idx} className="relative group/set">
                    {editingSetIndex === idx ? (
                      <input
                        type="text"
                        value={editedSetName}
                        onChange={(e) => setEditedSetName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveSetName(idx);
                          if (e.key === 'Escape') setEditingSetIndex(null);
                        }}
                        onBlur={() => saveSetName(idx)}
                        autoFocus
                        placeholder={getSetName(idx)}
                        className={`w-full py-2 rounded-lg text-xs font-medium text-center focus:outline-none transition-all ${
                          idx === currentSet
                            ? 'bg-yellow-600 text-slate-900 border-2 border-yellow-400 shadow-lg shadow-yellow-900/30'
                            : 'bg-slate-800/60 text-yellow-400/80 border-2 border-yellow-600/60'
                        }`}
                      />
                    ) : (
                      <>
                        <button
                          onClick={() => setCurrentSet(idx)}
                          className={`w-full py-2 pr-6 rounded-lg text-xs font-medium transition-all ${
                            idx === currentSet
                              ? 'bg-yellow-600 text-slate-900 shadow-lg shadow-yellow-900/30'
                              : 'bg-slate-800/60 text-yellow-400/80 hover:bg-slate-700/60 hover:text-yellow-300'
                          }`}
                        >
                          {getSetName(idx)}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditedSetName(getSetName(idx));
                            setEditingSetIndex(idx);
                          }}
                          className="absolute right-0.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover/set:opacity-100 hover:bg-blue-500/20 transition-opacity"
                        >
                          <Edit2 className="w-3 h-3 text-blue-400/70" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {/* 装备槽位 */}
            <div className="grid grid-cols-2 gap-2">
              {equipmentSlots.map(slotInfo => (
                <EquipmentPanelSlot
                  key={`${slotInfo.type}-${slotInfo.slot || 0}`}
                  slotInfo={slotInfo}
                  equip={getEquipmentInSlot(slotInfo.type, slotInfo.slot)}
                  onClick={() => handleEquipClick(slotInfo.type, slotInfo.slot)}
                />
              ))}
            </div>
            
            {/* 符石套装效果 */}
            <div className="mt-3 pt-3 border-t border-yellow-800/30">
              <div className="flex items-center gap-2 mb-2">
                <Gem className="w-3.5 h-3.5 text-cyan-400" />
                <div className="text-cyan-400 text-xs font-medium">符石套装效果</div>
              </div>
              {(() => {
                // 获取当前装备的符石套装信息
                const allEquipment = equipmentSlots.map(slotInfo => getEquipmentInSlot(slotInfo.type, slotInfo.slot)).filter(Boolean) as Equipment[];
                
                // 检查是否有装备带有符石套装
                const hasRuneStoneSet = allEquipment.some(eq => 
                  eq.runeStoneSets && eq.runeStoneSets.length > 0
                );
                
                if (!hasRuneStoneSet) {
                  return (
                    <div className="text-yellow-500/50 text-xs italic bg-slate-900/40 rounded-lg px-3 py-2 text-center">
                      暂无符石套装
                    </div>
                  );
                }
                
                // 符石套装效果只能是以下三个值之一
                const validEffects = ['锐不可当', '破血狂攻', '弱点击破'];
                // 根据装备数量或其他逻辑选择一个效果（这里简单使用第一个有符石套装的装备来决定）
                const effectIndex = allEquipment.findIndex(eq => eq.runeStoneSets && eq.runeStoneSets.length > 0) % validEffects.length;
                const setEffect = validEffects[effectIndex];
                
                return (
                  <div className="bg-cyan-900/20 border border-cyan-700/30 rounded-lg px-3 py-2">
                    <div className="text-cyan-200 text-xs text-center">{setEffect}</div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* 灵饰区域 */}
          <div className="bg-slate-900/40 border border-blue-700/40 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-blue-700/30">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <div className="text-blue-400 text-sm font-medium">灵饰</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {trinketSlots.map(slotInfo => (
                <EquipmentPanelSlot
                  key={`${slotInfo.type}-${slotInfo.slot || 0}`}
                  slotInfo={slotInfo}
                  equip={getEquipmentInSlot(slotInfo.type, slotInfo.slot)}
                  onClick={() => handleEquipClick(slotInfo.type, slotInfo.slot)}
                  theme="blue"
                />
              ))}
            </div>
            
            {/* 灵饰套装效果 */}
            <div className="mt-3 pt-3 border-t border-blue-700/30">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <div className="text-blue-400 text-xs font-medium">灵饰套装效果</div>
              </div>
              {(() => {
                // 获取所有已装备的灵饰
                const equippedTrinkets = trinketSlots
                  .map(slotInfo => getEquipmentInSlot(slotInfo.type, slotInfo.slot))
                  .filter(Boolean) as Equipment[];
                
                const trinketCount = equippedTrinkets.length;
                
                if (trinketCount === 0) {
                  return (
                    <div className="text-blue-500/50 text-xs italic bg-slate-900/40 rounded-lg px-3 py-2 text-center">
                      暂无灵饰套装
                    </div>
                  );
                }
                
                // 根据装备数量显示套装效果
                const setEffect = trinketCount === 4 ? '四件套' : `${trinketCount}件套`;
                
                return (
                  <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg px-3 py-2">
                    <div className="text-blue-200 text-xs text-center">{setEffect}</div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* 玉魄区域 */}
          <div className="bg-slate-900/40 border border-purple-700/40 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-purple-700/30">
              <Gem className="w-4 h-4 text-purple-400" />
              <div className="text-purple-400 text-sm font-medium">玉魄</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {jadeSlots.map(slotInfo => (
                <EquipmentPanelSlot
                  key={`${slotInfo.type}-${slotInfo.slot || 0}`}
                  slotInfo={slotInfo}
                  equip={getEquipmentInSlot(slotInfo.type, slotInfo.slot)}
                  onClick={() => handleEquipClick(slotInfo.type, slotInfo.slot)}
                  theme="purple"
                />
              ))}
            </div>
          </div>
        </div>
      
      {/* 装备详情弹窗 */}
      {selectedEquipment && (
        <EquipmentDetailModal
          equipment={selectedEquipment}
          onClose={() => setSelectedEquipment(null)}
        />
      )}
      
      {/* 装备库选择浮层 */}
      {libraryModalInfo && (
        <EquipmentLibraryModal
          slotType={libraryModalInfo.type}
          slotName={libraryModalInfo.name}
          slotSlot={libraryModalInfo.slot}
          availableEquipments={MOCK_LIBRARY_EQUIPMENT}
          onSelect={(equipment) => {
            // 为选中的装备设置正确的 slot 信息
            const equipmentToAdd = {
              ...equipment,
              slot: libraryModalInfo.slot
            };
            updateEquipment(equipmentToAdd);
          }}
          onClose={() => setLibraryModalInfo(null)}
        />
      )}
    </div>
  );
}
