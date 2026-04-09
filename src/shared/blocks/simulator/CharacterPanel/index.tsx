'use client';

import { useState } from 'react';
import { useGameStore } from '@/features/simulator/store/gameStore';
import { applySimulatorBundleToStore } from '@/features/simulator/utils/simulatorBundle';
import {
  BookOpen,
  Gem,
  ScrollText,
  Shield,
  Swords,
  TrendingUp,
  Upload,
  User,
} from 'lucide-react';

import { AttributeDisplay } from './AttributeDisplay';
import { UploadPopover } from './UploadPopover';

export function CharacterPanel() {
  const currentCharacter = useGameStore((state) => state.currentCharacter);
  const baseAttributes = useGameStore((state) => state.baseAttributes);
  const combatStats = useGameStore((state) => state.combatStats);
  const updateBaseAttribute = useGameStore(
    (state) => state.updateBaseAttribute
  );
  const updateCombatStat = useGameStore((state) => state.updateCombatStat);
  const cultivation = useGameStore((state) => state.cultivation);
  const updateCultivation = useGameStore((state) => state.updateCultivation);
  const skills = useGameStore((state) => state.skills);
  const treasure = useGameStore((state) => state.treasure);
  const [activeTab, setActiveTab] = useState<'attributes' | 'cultivation'>(
    'attributes'
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [saveProfileMessage, setSaveProfileMessage] = useState<string | null>(
    null
  );
  const [saveProfileError, setSaveProfileError] = useState<string | null>(null);
  const [isSavingCultivation, setIsSavingCultivation] = useState(false);
  const [saveCultivationMessage, setSaveCultivationMessage] = useState<
    string | null
  >(null);
  const [saveCultivationError, setSaveCultivationError] = useState<
    string | null
  >(null);

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
          ...(combatStats.sealHit !== undefined
            ? { sealHit: combatStats.sealHit }
            : {}),
        }),
      });

      const payload = await resp.json();
      if (!resp.ok || payload?.code !== 0 || !payload?.data) {
        throw new Error(payload?.message || '保存失败');
      }

      applySimulatorBundleToStore(payload.data, {
        preserveWorkbenchState: true,
      });
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

      applySimulatorBundleToStore(payload.data, {
        preserveWorkbenchState: true,
      });
      setSaveCultivationMessage('修炼等级已保存到云端');
    } catch (error) {
      console.error('Failed to save simulator cultivation:', error);
      setSaveCultivationError(
        error instanceof Error ? error.message : '保存失败'
      );
    } finally {
      setIsSavingCultivation(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-yellow-800/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl">
      {/* 标题栏 */}
      <div className="flex items-center justify-between border-b border-yellow-700/60 bg-gradient-to-r from-yellow-900/50 to-yellow-800/30 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-600">
            <User className="h-5 w-5 text-slate-900" />
          </div>
          <div>
            <h2 className="text-base font-bold text-yellow-100">固定属性</h2>
            <p className="text-xs text-yellow-400/80">Character Profile</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {currentCharacter && (
            <span className="rounded-lg border border-yellow-700/30 bg-slate-900/60 px-4 py-1.5 text-sm text-yellow-100">
              角色：{currentCharacter.name}
            </span>
          )}
          <span className="rounded-lg border border-yellow-700/40 bg-yellow-900/40 px-4 py-1.5 text-sm text-yellow-400/90">
            门派：{baseAttributes.faction}
          </span>
          <span className="rounded-lg border border-yellow-700/40 bg-yellow-900/40 px-4 py-1.5 text-sm text-yellow-400/90">
            等级：{baseAttributes.level}
          </span>
        </div>
      </div>

      {/* 标签页 */}
      <div className="flex border-b border-yellow-800/40 bg-gradient-to-r from-yellow-900/10 to-transparent px-5 pt-3">
        <button
          className={`border-b-2 px-4 py-2 text-sm font-bold transition-colors ${
            activeTab === 'attributes'
              ? 'border-yellow-400 text-yellow-400'
              : 'border-transparent text-slate-400 hover:text-yellow-100'
          }`}
          onClick={() => setActiveTab('attributes')}
        >
          属性
        </button>
        <button
          className={`border-b-2 px-4 py-2 text-sm font-bold transition-colors ${
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
              <span className="text-xs text-emerald-300">
                {saveProfileMessage}
              </span>
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
              <span className="text-xs text-red-300">
                {saveCultivationError}
              </span>
            )}
            {!saveCultivationError && saveCultivationMessage && (
              <span className="text-xs text-emerald-300">
                {saveCultivationMessage}
              </span>
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
      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        {activeTab === 'attributes' ? (
          <div className="grid grid-cols-2 gap-4">
            {/* 五围属性 */}
            <div className="rounded-xl border border-yellow-800/40 bg-slate-900/40 p-4">
              <h3 className="mb-3 flex items-center gap-2 border-b border-yellow-800/30 pb-2 text-sm font-bold text-yellow-400">
                <ScrollText className="h-4 w-4" />
                五围属性
              </h3>
              <div className="space-y-1">
                <AttributeDisplay
                  label="体质"
                  value={baseAttributes.physique}
                  statKey="physique"
                  onValueChange={(v) => updateBaseAttribute('physique', v)}
                />
                <AttributeDisplay
                  label="魔力"
                  value={baseAttributes.magic}
                  statKey="magic"
                  onValueChange={(v) => updateBaseAttribute('magic', v)}
                />
                <AttributeDisplay
                  label="力量"
                  value={baseAttributes.strength}
                  statKey="strength"
                  onValueChange={(v) => updateBaseAttribute('strength', v)}
                />
                <AttributeDisplay
                  label="耐力"
                  value={baseAttributes.endurance}
                  statKey="endurance"
                  onValueChange={(v) => updateBaseAttribute('endurance', v)}
                />
                <AttributeDisplay
                  label="敏捷"
                  value={baseAttributes.agility}
                  statKey="agility"
                  onValueChange={(v) => updateBaseAttribute('agility', v)}
                />
              </div>
            </div>

            {/* 攻击属性 */}
            <div className="rounded-xl border border-yellow-800/40 bg-slate-900/40 p-4">
              <h3 className="mb-3 flex items-center gap-2 border-b border-yellow-800/30 pb-2 text-sm font-bold text-yellow-400">
                <Swords className="h-4 w-4" />
                攻击属性
              </h3>
              <div className="space-y-1">
                <AttributeDisplay
                  label="法术伤害"
                  value={combatStats.magicDamage || 0}
                  statKey="magicDamage"
                  onValueChange={(v) => updateCombatStat('magicDamage', v)}
                />
                <AttributeDisplay
                  label="灵力"
                  value={combatStats.spiritualPower || 0}
                  statKey="spiritualPower"
                  onValueChange={(v) => updateCombatStat('spiritualPower', v)}
                />
                <AttributeDisplay
                  label="法术暴击等级"
                  value={combatStats.magicCritLevel || 0}
                  statKey="magicCritLevel"
                  onValueChange={(v) => updateCombatStat('magicCritLevel', v)}
                />
                <AttributeDisplay
                  label="速度"
                  value={combatStats.speed}
                  statKey="speed"
                  onValueChange={(v) => updateCombatStat('speed', v)}
                />
                <AttributeDisplay
                  label="命中"
                  value={combatStats.hit}
                  statKey="hit"
                  onValueChange={(v) => updateCombatStat('hit', v)}
                />
                <AttributeDisplay
                  label="固定伤害"
                  value={combatStats.fixedDamage || 0}
                  statKey="fixedDamage"
                  onValueChange={(v) => updateCombatStat('fixedDamage', v)}
                />
                <AttributeDisplay
                  label="穿刺等级"
                  value={combatStats.pierceLevel || 0}
                  statKey="pierceLevel"
                  onValueChange={(v) => updateCombatStat('pierceLevel', v)}
                />
                <AttributeDisplay
                  label="五行克制能力"
                  value={combatStats.elementalMastery || 0}
                  statKey="elementalMastery"
                  onValueChange={(v) => updateCombatStat('elementalMastery', v)}
                />
              </div>
            </div>

            {/* 防御属性 */}
            <div className="rounded-xl border border-yellow-800/40 bg-slate-900/40 p-4">
              <h3 className="mb-3 flex items-center gap-2 border-b border-yellow-800/30 pb-2 text-sm font-bold text-yellow-400">
                <Shield className="h-4 w-4" />
                防御属性
              </h3>
              <div className="space-y-1">
                <AttributeDisplay
                  label="气血"
                  value={combatStats.hp || 0}
                  statKey="hp"
                  onValueChange={(v) => updateCombatStat('hp', v)}
                />
                <AttributeDisplay
                  label="法术防御"
                  value={combatStats.magicDefense}
                  statKey="magicDefense"
                  onValueChange={(v) => updateCombatStat('magicDefense', v)}
                />
                <AttributeDisplay
                  label="物理防御"
                  value={combatStats.defense}
                  statKey="defense"
                  onValueChange={(v) => updateCombatStat('defense', v)}
                />
                <AttributeDisplay
                  label="格挡值"
                  value={combatStats.block || 0}
                  statKey="block"
                  onValueChange={(v) => updateCombatStat('block', v)}
                />
                <AttributeDisplay
                  label="抗暴击等级"
                  value={combatStats.antiCritLevel || 0}
                  statKey="antiCritLevel"
                  onValueChange={(v) => updateCombatStat('antiCritLevel', v)}
                />
                <AttributeDisplay
                  label="抵抗封印等级"
                  value={combatStats.sealResistLevel || 0}
                  statKey="sealResistLevel"
                  onValueChange={(v) => updateCombatStat('sealResistLevel', v)}
                />
                <AttributeDisplay
                  label="躲避"
                  value={combatStats.dodge || 0}
                  statKey="dodge"
                  onValueChange={(v) => updateCombatStat('dodge', v)}
                />
                <AttributeDisplay
                  label="五行克制抵御能力"
                  value={combatStats.elementalResistance || 0}
                  statKey="elementalResistance"
                  onValueChange={(v) =>
                    updateCombatStat('elementalResistance', v)
                  }
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 技能 & 法宝 */}
            <div className="grid grid-cols-2 gap-4">
              {/* 技能列表 */}
              <div className="rounded-xl border border-yellow-800/40 bg-slate-900/40 p-4">
                <h3 className="mb-3 flex items-center gap-2 border-b border-yellow-800/30 pb-2 text-sm font-bold text-yellow-400">
                  <BookOpen className="h-4 w-4" />
                  角色技能
                </h3>
                <div className="custom-scrollbar max-h-40 space-y-2 overflow-y-auto pr-1">
                  {skills.map((skill, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border border-yellow-800/30 bg-slate-900/60 px-3 py-2 transition-colors hover:border-yellow-600/50"
                    >
                      <span className="text-sm font-medium text-yellow-100">
                        {skill.name}
                      </span>
                      <span className="rounded bg-yellow-900/30 px-2 py-0.5 text-sm text-yellow-400">
                        Lv.{skill.level}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 法宝 */}
              <div className="rounded-xl border border-yellow-800/40 bg-slate-900/40 p-4">
                <h3 className="mb-3 flex items-center gap-2 border-b border-yellow-800/30 pb-2 text-sm font-bold text-yellow-400">
                  <Gem className="h-4 w-4" />
                  法宝装备
                </h3>
                {treasure ? (
                  <div className="rounded-lg border border-yellow-800/40 bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-4 transition-colors hover:border-yellow-600/60">
                    <div className="mb-2 text-sm font-bold text-yellow-100">
                      {treasure.name}
                    </div>
                    <div className="text-sm text-yellow-400/80">
                      {treasure.description}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-20 items-center justify-center text-sm text-slate-500 italic">
                    未装备法宝
                  </div>
                )}
              </div>
            </div>

            {/* 修炼 */}
            <div className="rounded-xl border border-yellow-800/40 bg-slate-900/40 p-5">
              <h3 className="mb-4 flex items-center gap-2 border-b border-yellow-800/30 pb-3 text-sm font-bold text-yellow-400">
                <TrendingUp className="h-4 w-4" />
                修炼等级
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <AttributeDisplay
                  label="攻击修炼"
                  value={cultivation.physicalAttack || 0}
                  onValueChange={(v) => updateCultivation('physicalAttack', v)}
                />
                <AttributeDisplay
                  label="防御修炼"
                  value={cultivation.physicalDefense || 0}
                  onValueChange={(v) => updateCultivation('physicalDefense', v)}
                />
                <AttributeDisplay
                  label="法攻修炼"
                  value={cultivation.magicAttack || 0}
                  onValueChange={(v) => updateCultivation('magicAttack', v)}
                />
                <AttributeDisplay
                  label="法防修炼"
                  value={cultivation.magicDefense || 0}
                  onValueChange={(v) => updateCultivation('magicDefense', v)}
                />
                <AttributeDisplay
                  label="猎术修炼"
                  value={cultivation.petPhysicalAttack || 0}
                  onValueChange={(v) =>
                    updateCultivation('petPhysicalAttack', v)
                  }
                />
              </div>
            </div>
          </div>
        )}
      </div>
      {/* 底部上传按钮 */}
      <div className="flex justify-center border-t border-yellow-800/40 bg-slate-900/50 p-4">
        <UploadPopover
          type="attributes"
          trigger={
            <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-yellow-700/60 bg-slate-900 py-2.5 text-yellow-400 transition-all hover:border-yellow-600 hover:bg-slate-800">
              <Upload className="h-4 w-4" />
              <span className="text-sm font-bold">上传属性截图</span>
            </button>
          }
        />
      </div>
    </div>
  );
}
