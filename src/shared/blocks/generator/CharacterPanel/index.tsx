// @ts-nocheck
"use client";
import { useGameStore } from '@/features/simulator/store/gameStore';
import { applySimulatorBundleToStore } from '@/features/simulator/utils/simulatorBundle';
import type { Equipment } from '@/features/simulator/store/gameTypes';
import { useState, useRef } from 'react';
import { EquipmentSlot } from './EquipmentSlot';
import { AttributeDisplay } from './AttributeDisplay';
import { CultivationBar } from './CultivationBar';
import { UploadPopover } from './UploadPopover';
import { Upload, Swords, User, ScrollText, Target, BookOpen, TrendingUp, Gem, Shield } from 'lucide-react';
import { motion } from 'motion/react';

const FORMATIONS = [
  '天覆阵',
  '地载阵',
  '风扬阵',
  '龙飞阵',
  '虎翼阵',
  '鸟翔阵',
  '蛇蟠阵',
  '云垂阵'
];

// 模拟生成新装备
function generateMockEquipment(type: Equipment['type']): Equipment {
  const templates: Record<Equipment['type'], { names: string[]; mainStats: string[]; stats: any }> = {
    weapon: {
      names: ['烈焰神杖', '龙啸破天杖', '冰魄灵杖'],
      mainStats: ['法伤 +380', '法伤 +360', '法伤 +350'],
      stats: { magicDamage: Math.floor(Math.random() * 100) + 340, hit: Math.floor(Math.random() * 50) + 110, magic: Math.floor(Math.random() * 15) + 20 }
    },
    helmet: {
      names: ['玄冰护盔', '龙魂宝冠', '极寒之冠'],
      mainStats: ['法防 +150', '法防 +140', '法防 +145'],
      stats: { magicDefense: Math.floor(Math.random() * 30) + 130, magic: Math.floor(Math.random() * 10) + 15, defense: Math.floor(Math.random() * 20) + 40 }
    },
    necklace: {
      names: ['龙珠项链', '深海明珠', '九天星链'],
      mainStats: ['法伤 +100', '法伤 +95', '法伤 +90'],
      stats: { magicDamage: Math.floor(Math.random() * 20) + 85, magic: Math.floor(Math.random() * 8) + 12 }
    },
    armor: {
      names: ['水龙战袍', '极寒护甲', '玄冰战衣'],
      mainStats: ['法防 +160', '法防 +155', '法防 +150'],
      stats: { magicDefense: Math.floor(Math.random() * 30) + 140, defense: Math.floor(Math.random() * 30) + 75, physique: Math.floor(Math.random() * 10) + 18 }
    },
    belt: {
      names: ['破军腰带', '疾风之带', '流云宝带'],
      mainStats: ['速度 +65', '速度 +60', '速度 +58'],
      stats: { speed: Math.floor(Math.random() * 15) + 55, agility: Math.floor(Math.random() * 8) + 10, defense: Math.floor(Math.random() * 15) + 30 }
    },
    shoes: {
      names: ['御风神靴', '流光飞靴', '凌波微步'],
      mainStats: ['敏捷 +22', '敏捷 +20', '敏捷 +19'],
      stats: { agility: Math.floor(Math.random() * 6) + 18, speed: Math.floor(Math.random() * 15) + 45, defense: Math.floor(Math.random() * 15) + 28 }
    },
    trinket: {
      names: ['水晶灵饰', '琉璃之心', '星辰灵佩'],
      mainStats: ['法伤 +60', '法伤 +55', '法伤 +58'],
      stats: { magicDamage: Math.floor(Math.random() * 15) + 55, magic: Math.floor(Math.random() * 10) + 12, speed: Math.floor(Math.random() * 10) + 8 }
    },
    jade: {
      names: ['混元玉魄', '九天玄玉', '龙魂玉佩'],
      mainStats: ['体质 +25', '体质 +23', '体质 +22'],
      stats: { physique: Math.floor(Math.random() * 5) + 22, defense: Math.floor(Math.random() * 20) + 35, magicDefense: Math.floor(Math.random() * 20) + 30 }
    }
  };

  const template = templates[type];
  const index = Math.floor(Math.random() * template.names.length);
  
  return {
    id: Date.now().toString(),
    name: template.names[index],
    type,
    mainStat: template.mainStats[index],
    baseStats: template.stats,
    stats: template.stats
  };
}

export function CharacterPanel() {
  const accounts = useGameStore((state) => state.accounts);
  const activeAccountId = useGameStore((state) => state.activeAccountId);
  const baseAttributes = useGameStore((state) => state.baseAttributes);
  const combatStats = useGameStore((state) => state.combatStats);
  const updateBaseAttribute = useGameStore((state) => state.updateBaseAttribute);
  const updateCombatStat = useGameStore((state) => state.updateCombatStat);
  const cultivation = useGameStore((state) => state.cultivation);
  const updateCultivation = useGameStore((state) => state.updateCultivation);
  const skills = useGameStore((state) => state.skills);
  const treasure = useGameStore((state) => state.treasure);
  const addOcrLog = useGameStore((state) => state.addOcrLog);
  const formation = useGameStore((state) => state.formation);
  const setFormation = useGameStore((state) => state.setFormation);
  const equipment = useGameStore((state) => state.equipment);
  const enterPreviewMode = useGameStore((state) => state.enterPreviewMode);
  
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'attributes' | 'cultivation'>('attributes');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [saveProfileMessage, setSaveProfileMessage] = useState<string | null>(null);
  const [saveProfileError, setSaveProfileError] = useState<string | null>(null);
  const [isSavingCultivation, setIsSavingCultivation] = useState(false);
  const [saveCultivationMessage, setSaveCultivationMessage] = useState<string | null>(null);
  const [saveCultivationError, setSaveCultivationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeAccount = accounts.find((account) => account.id === activeAccountId) || null;
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    addOcrLog({
      type: 'character',
      message: `正在识别截图：${file.name}`,
      status: 'processing'
    });
    
    setTimeout(() => {
      addOcrLog({
        type: 'character',
        message: '识别成功！已自动填充角色数据',
        status: 'success'
      });
      setUploading(false);
    }, 2000);
  };
  
  const handleEquipmentUpload = (type: Equipment['type']) => {
    // 模拟上传新装备并触发预览模式
    const currentEquipment = equipment.find(e => e.type === type) || null;
    const newEquipment = generateMockEquipment(type);
    
    addOcrLog({
      type: 'equipment',
      message: `识别到新装备：${newEquipment.name}`,
      status: 'success'
    });
    
    enterPreviewMode(currentEquipment, newEquipment, type);
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    setSaveProfileError(null);
    setSaveProfileMessage(null);

    try {
      const resp = await fetch('/api/simulator/current/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level: baseAttributes.level,
          faction: baseAttributes.faction,
          physique: baseAttributes.physique,
          magic: baseAttributes.magic,
          strength: baseAttributes.strength,
          endurance: baseAttributes.endurance,
          agility: baseAttributes.agility,
          magicPower: baseAttributes.magicPower || 0,
          hp: combatStats.hp || 0,
          mp: combatStats.magic || 0,
          damage: combatStats.damage || 0,
          defense: combatStats.defense || 0,
          magicDamage: combatStats.magicDamage || 0,
          magicDefense: combatStats.magicDefense || 0,
          speed: combatStats.speed || 0,
          hit: combatStats.hit || 0,
          dodge: combatStats.dodge || 0,
          sealHit: combatStats.sealHit || 0,
        }),
      });

      const payload = await resp.json();
      if (!resp.ok || payload?.code !== 0 || !payload?.data) {
        throw new Error(payload?.message || '保存失败');
      }

      applySimulatorBundleToStore(payload.data);
      setSaveProfileMessage('基础属性已保存到云端');
    } catch (error) {
      console.error('Failed to save simulator profile:', error);
      setSaveProfileError(error instanceof Error ? error.message : '保存失败');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveCultivation = async () => {
    setIsSavingCultivation(true);
    setSaveCultivationError(null);
    setSaveCultivationMessage(null);

    try {
      const resp = await fetch('/api/simulator/current/cultivation', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          physicalAttack: cultivation.physicalAttack || 0,
          physicalDefense: cultivation.physicalDefense || 0,
          magicAttack: cultivation.magicAttack || 0,
          magicDefense: cultivation.magicDefense || 0,
          petPhysicalAttack: cultivation.petPhysicalAttack || 0,
          petPhysicalDefense: cultivation.petPhysicalDefense || 0,
          petMagicAttack: cultivation.petMagicAttack || 0,
          petMagicDefense: cultivation.petMagicDefense || 0,
        }),
      });

      const payload = await resp.json();
      if (!resp.ok || payload?.code !== 0 || !payload?.data) {
        throw new Error(payload?.message || '保存失败');
      }

      applySimulatorBundleToStore(payload.data);
      setSaveCultivationMessage('修炼等级已保存到云端');
    } catch (error) {
      console.error('Failed to save simulator cultivation:', error);
      setSaveCultivationError(error instanceof Error ? error.message : '保存失败');
    } finally {
      setIsSavingCultivation(false);
    }
  };
  
  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-yellow-800/60 rounded-2xl shadow-2xl overflow-hidden">
      {/* 标题栏 */}
      <div className="bg-gradient-to-r from-yellow-900/50 to-yellow-800/30 border-b border-yellow-700/60 px-5 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-yellow-600 flex items-center justify-center">
            <User className="w-5 h-5 text-slate-900" />
          </div>
          <div>
            <h2 className="text-base font-bold text-yellow-100">固定属性</h2>
            <p className="text-xs text-yellow-400/80">Character Profile</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeAccount && (
            <span className="text-sm text-yellow-100 bg-slate-900/60 px-4 py-1.5 rounded-lg border border-yellow-700/30">
              角色：{activeAccount.name}
            </span>
          )}
          <span className="text-sm text-yellow-400/90 bg-yellow-900/40 px-4 py-1.5 rounded-lg border border-yellow-700/40">
            门派：{baseAttributes.faction}
          </span>
          <span className="text-sm text-yellow-400/90 bg-yellow-900/40 px-4 py-1.5 rounded-lg border border-yellow-700/40">
            等级：{baseAttributes.level}
          </span>
        </div>
      </div>
      
      {/* 标签页 */}
      <div className="flex px-5 pt-3 border-b border-yellow-800/40 bg-gradient-to-r from-yellow-900/10 to-transparent">
        <button
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'attributes'
              ? 'border-yellow-400 text-yellow-400'
              : 'border-transparent text-slate-400 hover:text-yellow-100'
          }`}
          onClick={() => setActiveTab('attributes')}
        >
          属性
        </button>
        <button
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'cultivation'
              ? 'border-yellow-400 text-yellow-400'
              : 'border-transparent text-slate-400 hover:text-yellow-100'
          }`}
          onClick={() => setActiveTab('cultivation')}
        >
          修炼
        </button>
        {activeTab === 'attributes' && (
          <div className="ml-auto flex items-center gap-3 pb-2">
            {saveProfileError && (
              <span className="text-xs text-red-300">{saveProfileError}</span>
            )}
            {!saveProfileError && saveProfileMessage && (
              <span className="text-xs text-emerald-300">{saveProfileMessage}</span>
            )}
            <button
              className="rounded-lg border border-yellow-700/50 bg-slate-900/70 px-4 py-2 text-xs font-bold text-yellow-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSavingProfile}
              onClick={handleSaveProfile}
            >
              {isSavingProfile ? '保存中...' : '保存到云端'}
            </button>
          </div>
        )}
        {activeTab === 'cultivation' && (
          <div className="ml-auto flex items-center gap-3 pb-2">
            {saveCultivationError && (
              <span className="text-xs text-red-300">{saveCultivationError}</span>
            )}
            {!saveCultivationError && saveCultivationMessage && (
              <span className="text-xs text-emerald-300">{saveCultivationMessage}</span>
            )}
            <button
              className="rounded-lg border border-yellow-700/50 bg-slate-900/70 px-4 py-2 text-xs font-bold text-yellow-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSavingCultivation}
              onClick={handleSaveCultivation}
            >
              {isSavingCultivation ? '保存中...' : '保存修炼'}
            </button>
          </div>
        )}
      </div>
      
      {/* 滚动区域 - 展示所有属性 */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {activeTab === 'attributes' ? (
          <div className="grid grid-cols-2 gap-4">
            {/* 五围属性 */}
          <div className="bg-slate-900/40 border border-yellow-800/40 rounded-xl p-4">
            <h3 className="text-sm text-yellow-400 font-bold mb-3 flex items-center gap-2 border-b border-yellow-800/30 pb-2">
              <ScrollText className="w-4 h-4" />
              五围属性
            </h3>
            <div className="space-y-1">
              <AttributeDisplay label="体质" value={baseAttributes.physique} statKey="physique" onValueChange={(v) => updateBaseAttribute('physique', v)} />
              <AttributeDisplay label="魔力" value={baseAttributes.magic} statKey="magic" onValueChange={(v) => updateBaseAttribute('magic', v)} />
              <AttributeDisplay label="力量" value={baseAttributes.strength} statKey="strength" onValueChange={(v) => updateBaseAttribute('strength', v)} />
              <AttributeDisplay label="耐力" value={baseAttributes.endurance} statKey="endurance" onValueChange={(v) => updateBaseAttribute('endurance', v)} />
              <AttributeDisplay label="敏捷" value={baseAttributes.agility} statKey="agility" onValueChange={(v) => updateBaseAttribute('agility', v)} />
            </div>
          </div>
          
          {/* 攻击属性 */}
          <div className="bg-slate-900/40 border border-yellow-800/40 rounded-xl p-4">
            <h3 className="text-sm text-yellow-400 font-bold mb-3 flex items-center gap-2 border-b border-yellow-800/30 pb-2">
              <Swords className="w-4 h-4" />
              攻击属性
            </h3>
            <div className="space-y-1">
              <AttributeDisplay label="法术伤害" value={combatStats.magicDamage || 0} statKey="magicDamage" onValueChange={(v) => updateCombatStat('magicDamage', v)} />
              <AttributeDisplay label="灵力" value={combatStats.spiritualPower || 0} statKey="spiritualPower" onValueChange={(v) => updateCombatStat('spiritualPower', v)} />
              <AttributeDisplay label="法术暴击等级" value={combatStats.magicCritLevel || 0} statKey="magicCritLevel" onValueChange={(v) => updateCombatStat('magicCritLevel', v)} />
              <AttributeDisplay label="速度" value={combatStats.speed} statKey="speed" onValueChange={(v) => updateCombatStat('speed', v)} />
              <AttributeDisplay label="命中" value={combatStats.hit} statKey="hit" onValueChange={(v) => updateCombatStat('hit', v)} />
              <AttributeDisplay label="固定伤害" value={combatStats.fixedDamage || 0} statKey="fixedDamage" onValueChange={(v) => updateCombatStat('fixedDamage', v)} />
              <AttributeDisplay label="穿刺等级" value={combatStats.pierceLevel || 0} statKey="pierceLevel" onValueChange={(v) => updateCombatStat('pierceLevel', v)} />
              <AttributeDisplay label="五行克制能力" value={combatStats.elementalMastery || 0} statKey="elementalMastery" onValueChange={(v) => updateCombatStat('elementalMastery', v)} />
            </div>
          </div>

          {/* 防御属性 */}
          <div className="bg-slate-900/40 border border-yellow-800/40 rounded-xl p-4">
            <h3 className="text-sm text-yellow-400 font-bold mb-3 flex items-center gap-2 border-b border-yellow-800/30 pb-2">
              <Shield className="w-4 h-4" />
              防御属性
            </h3>
            <div className="space-y-1">
              <AttributeDisplay label="气血" value={combatStats.hp || 0} statKey="hp" onValueChange={(v) => updateCombatStat('hp', v)} />
              <AttributeDisplay label="法术防御" value={combatStats.magicDefense} statKey="magicDefense" onValueChange={(v) => updateCombatStat('magicDefense', v)} />
              <AttributeDisplay label="物理防御" value={combatStats.defense} statKey="defense" onValueChange={(v) => updateCombatStat('defense', v)} />
              <AttributeDisplay label="格挡值" value={combatStats.block || 0} statKey="block" onValueChange={(v) => updateCombatStat('block', v)} />
              <AttributeDisplay label="抗暴击等级" value={combatStats.antiCritLevel || 0} statKey="antiCritLevel" onValueChange={(v) => updateCombatStat('antiCritLevel', v)} />
              <AttributeDisplay label="抵抗封印等级" value={combatStats.sealResistLevel || 0} statKey="sealResistLevel" onValueChange={(v) => updateCombatStat('sealResistLevel', v)} />
              <AttributeDisplay label="躲避" value={combatStats.dodge || 0} statKey="dodge" onValueChange={(v) => updateCombatStat('dodge', v)} />
              <AttributeDisplay label="五行克制抵御能力" value={combatStats.elementalResistance || 0} statKey="elementalResistance" onValueChange={(v) => updateCombatStat('elementalResistance', v)} />
            </div>
          </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 技能 & 法宝 */}
            <div className="grid grid-cols-2 gap-4">
              {/* 技能列表 */}
          <div className="bg-slate-900/40 border border-yellow-800/40 rounded-xl p-4">
            <h3 className="text-sm text-yellow-400 font-bold mb-3 flex items-center gap-2 border-b border-yellow-800/30 pb-2">
              <BookOpen className="w-4 h-4" />
              角色技能
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
              {skills.map((skill, i) => (
                <div key={i} className="flex justify-between items-center py-2 px-3 bg-slate-900/60 border border-yellow-800/30 rounded-lg hover:border-yellow-600/50 transition-colors">
                  <span className="text-sm text-yellow-100 font-medium">{skill.name}</span>
                  <span className="text-sm text-yellow-400 bg-yellow-900/30 px-2 py-0.5 rounded">Lv.{skill.level}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* 法宝 */}
          <div className="bg-slate-900/40 border border-yellow-800/40 rounded-xl p-4">
            <h3 className="text-sm text-yellow-400 font-bold mb-3 flex items-center gap-2 border-b border-yellow-800/30 pb-2">
              <Gem className="w-4 h-4" />
              法宝装备
            </h3>
            {treasure ? (
              <div className="bg-gradient-to-br from-slate-900/80 to-slate-950/80 border border-yellow-800/40 rounded-lg p-4 hover:border-yellow-600/60 transition-colors">
                <div className="text-sm text-yellow-100 font-bold mb-2">{treasure.name}</div>
                <div className="text-sm text-yellow-400/80">{treasure.attributes}</div>
              </div>
            ) : (
              <div className="text-sm text-slate-500 italic flex items-center justify-center h-20">未装备法宝</div>
            )}
          </div>
        </div>

        {/* 修炼 */}
        <div className="bg-slate-900/40 border border-yellow-800/40 rounded-xl p-5">
          <h3 className="text-sm text-yellow-400 font-bold mb-4 flex items-center gap-2 border-b border-yellow-800/30 pb-3">
            <TrendingUp className="w-4 h-4" />
            修炼等级
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <AttributeDisplay label="攻击修炼" value={cultivation.physicalAttack || 0} onValueChange={(v) => updateCultivation('physicalAttack', v)} />
            <AttributeDisplay label="防御修炼" value={cultivation.physicalDefense || 0} onValueChange={(v) => updateCultivation('physicalDefense', v)} />
            <AttributeDisplay label="法攻修炼" value={cultivation.magicAttack || 0} onValueChange={(v) => updateCultivation('magicAttack', v)} />
            <AttributeDisplay label="法防修炼" value={cultivation.magicDefense || 0} onValueChange={(v) => updateCultivation('magicDefense', v)} />
            <AttributeDisplay label="猎术修炼" value={cultivation.petPhysicalAttack || 0} onValueChange={(v) => updateCultivation('petPhysicalAttack', v)} />
          </div>
        </div>
          </div>
        )}
      </div>
      {/* 底部上传按钮 */}
      <div className="p-4 border-t border-yellow-800/40 bg-slate-900/50 flex justify-center">
        <UploadPopover 
          type="attributes"
          trigger={
            <button className="w-full py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all bg-slate-900 border border-yellow-700/60 text-yellow-400 hover:border-yellow-600 hover:bg-slate-800">
              <Upload className="w-4 h-4" />
              <span className="text-sm font-bold">上传属性截图</span>
            </button>
          }
        />
      </div>
    </div>
  );
}
