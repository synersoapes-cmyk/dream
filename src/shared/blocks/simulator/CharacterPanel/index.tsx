'use client';

import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '@/features/simulator/store/gameStore';
import type {
  MeridianConfig,
  PotentialAllocationTarget,
} from '@/features/simulator/store/gameTypes';
import { applySimulatorBundleToStore } from '@/features/simulator/utils/simulatorBundle';
import { getSimulatorNetworkErrorMessage, isNavigatorOffline } from '@/shared/lib/simulator-network';
import {
  buildSimulatorArtifactConfigFromTreasure,
  buildSimulatorArtifactSpotlightTags,
  buildSimulatorArtifactSummary,
} from '@/shared/lib/simulator-artifact';
import {
  buildPanelSourceBreakdownSummary,
  formatPanelSourceSignedValue,
  buildSimulatorPanelSourceBreakdowns,
  sortPanelSourceValueItems,
} from '@/shared/lib/simulator-panel-source-breakdown';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Gem,
  ScrollText,
  Shield,
  Swords,
  TrendingUp,
  Upload,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

import { AttributeDisplay } from './AttributeDisplay';
import { Slider } from '../CombatPanel/Slider';
import { UploadPopover } from './UploadPopover';

const POTENTIAL_ALLOCATION_OPTIONS: Array<{
  key: PotentialAllocationTarget;
  label: string;
}> = [
  { key: 'physique', label: '体质' },
  { key: 'magic', label: '魔力' },
  { key: 'strength', label: '力量' },
  { key: 'endurance', label: '耐力' },
  { key: 'agility', label: '敏捷' },
];

const MERIDIAN_OPTIONS: Array<{
  key: keyof MeridianConfig;
  label: string;
}> = [
  { key: 'physique', label: '经脉体质' },
  { key: 'magic', label: '经脉魔力' },
  { key: 'strength', label: '经脉力量' },
  { key: 'endurance', label: '经脉耐力' },
  { key: 'agility', label: '经脉敏捷' },
  { key: 'magicPower', label: '经脉灵力' },
];

function formatSkillLevel(skill: {
  level: number;
  baseLevel?: number;
  extraLevel?: number;
  finalLevel?: number;
}) {
  const baseLevel = skill.baseLevel ?? skill.level ?? 0;
  const extraLevel = skill.extraLevel ?? 0;
  const finalLevel = skill.finalLevel ?? skill.level ?? baseLevel;

  return {
    levelText: extraLevel > 0 ? `${baseLevel}+${extraLevel}` : `${finalLevel}`,
    detailText:
      extraLevel > 0 ? `最终等级 ${finalLevel}` : `基础等级 ${finalLevel}`,
  };
}

export function CharacterPanel() {
  const currentCharacter = useGameStore((state) => state.currentCharacter);
  const syncedCloudState = useGameStore((state) => state.syncedCloudState);
  const baseAttributes = useGameStore((state) => state.baseAttributes);
  const combatStats = useGameStore((state) => state.combatStats);
  const updateBaseAttribute = useGameStore(
    (state) => state.updateBaseAttribute
  );
  const allocatePotentialPoints = useGameStore(
    (state) => state.allocatePotentialPoints
  );
  const updateCombatStat = useGameStore((state) => state.updateCombatStat);
  const cultivation = useGameStore((state) => state.cultivation);
  const updateCultivation = useGameStore((state) => state.updateCultivation);
  const meridian = useGameStore((state) => state.meridian);
  const updateMeridian = useGameStore((state) => state.updateMeridian);
  const equipment = useGameStore((state) => state.equipment);
  const playerSetup = useGameStore((state) => state.playerSetup);
  const activeRegularSetRules = useGameStore(
    (state) => state.activeRegularSetRules
  );
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
  const [allocationTarget, setAllocationTarget] =
    useState<PotentialAllocationTarget>('magic');
  const [allocationAmount, setAllocationAmount] = useState(0);
  const [expandedSourceKey, setExpandedSourceKey] = useState<string | null>(
    null
  );

  useEffect(() => {
    setAllocationAmount((current) =>
      Math.min(current, Math.max(0, baseAttributes.potentialPoints))
    );
  }, [baseAttributes.potentialPoints]);

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    setSaveProfileError(null);
    setSaveProfileMessage(null);

    try {
      if (isNavigatorOffline()) {
        throw new Error('OFFLINE');
      }

      const resp = await fetch('/api/simulator/current/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level: baseAttributes.level,
          faction: baseAttributes.faction,
          baseHp: baseAttributes.hp,
          physique: baseAttributes.physique,
          magic: baseAttributes.magic,
          potentialPoints: baseAttributes.potentialPoints,
          strength: baseAttributes.strength,
          endurance: baseAttributes.endurance,
          agility: baseAttributes.agility,
          magicPower: baseAttributes.magicPower || 0,
          spiritualPower: combatStats.spiritualPower || 0,
          hp: combatStats.hp || 0,
          mp: combatStats.magic || 0,
          damage: combatStats.damage || 0,
          defense: combatStats.defense || 0,
          magicDamage: combatStats.magicDamage || 0,
          magicDefense: combatStats.magicDefense || 0,
          speed: combatStats.speed || 0,
          hit: combatStats.hit || 0,
          dodge: combatStats.dodge || 0,
          meridianConfig: meridian,
          ...(combatStats.sealHit !== undefined
            ? { sealHit: combatStats.sealHit }
            : {}),
          treasure,
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
      const message =
        error instanceof Error && error.message === 'OFFLINE'
          ? '请检查网络'
          : getSimulatorNetworkErrorMessage(error, '保存失败');
      setSaveProfileError(message);
      toast.error(message, {
        description:
          message === '请检查网络'
            ? '当前网络不可用，基础属性还没有同步到云端。'
            : undefined,
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveCultivation = async () => {
    setIsSavingCultivation(true);
    setSaveCultivationError(null);
    setSaveCultivationMessage(null);

    try {
      if (isNavigatorOffline()) {
        throw new Error('OFFLINE');
      }

      const resp = await fetch('/api/simulator/current/cultivation', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bodyStrength: cultivation.bodyStrength || 0,
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
      const message =
        error instanceof Error && error.message === 'OFFLINE'
          ? '请检查网络'
          : getSimulatorNetworkErrorMessage(error, '保存失败');
      setSaveCultivationError(message);
      toast.error(message, {
        description:
          message === '请检查网络'
            ? '当前网络不可用，修炼调整还没有同步到云端。'
            : undefined,
      });
    } finally {
      setIsSavingCultivation(false);
    }
  };

  const handleApplyPotentialAllocation = () => {
    allocatePotentialPoints(allocationTarget, allocationAmount);
    setAllocationAmount(0);
  };

  const handleAllocateAllMagic = () => {
    const available = Math.max(0, baseAttributes.potentialPoints);
    if (available <= 0) {
      return;
    }

    setAllocationTarget('magic');
    allocatePotentialPoints('magic', available);
    setAllocationAmount(0);
  };

  const artifactSummary = buildSimulatorArtifactSummary(
    buildSimulatorArtifactConfigFromTreasure(treasure)
  );
  const artifactTags = buildSimulatorArtifactSpotlightTags(
    buildSimulatorArtifactConfigFromTreasure(treasure)
  );
  const hasPanelBaseline = Boolean(syncedCloudState);
  const panelSourceBreakdowns = useMemo(
    () =>
      buildSimulatorPanelSourceBreakdowns({
        baseAttributes,
        equipment,
        treasure,
        bodyStrength: cultivation.bodyStrength || 0,
        formation: playerSetup.formation,
        meridian,
        regularSetRules: activeRegularSetRules,
        syncedCloudState,
      }),
    [
      activeRegularSetRules,
      baseAttributes,
      cultivation.bodyStrength,
      equipment,
      meridian,
      playerSetup.formation,
      syncedCloudState,
      treasure,
    ]
  );

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
          <span className="rounded-lg border border-yellow-700/40 bg-slate-900/60 px-4 py-1.5 text-sm text-yellow-100">
            潜力点：{baseAttributes.potentialPoints}
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
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-cyan-800/30 bg-cyan-950/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-cyan-100">
                      基线层
                    </div>
                    <div className="mt-1 text-xs leading-6 text-slate-300">
                      当前角色的 OCR 面板真值与手动校准值。这里主要维护人物基础档案，不直接代表换装推演结果。
                    </div>
                  </div>
                  <span className="rounded-full border border-cyan-700/40 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-200">
                    {hasPanelBaseline ? '已接入 OCR 基线' : '暂用当前档案值'}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-yellow-800/30 bg-yellow-950/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-yellow-100">
                      增量层
                    </div>
                    <div className="mt-1 text-xs leading-6 text-slate-300">
                      经脉、装备、修炼、神器等变化会在基线之上联动到当前面板。右侧攻击/防御区看到的是“基线 + 增量”的结果。
                    </div>
                  </div>
                  <span className="rounded-full border border-yellow-700/40 bg-yellow-500/10 px-2 py-1 text-[11px] text-yellow-200">
                    当前结果联动区
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-cyan-800/30 bg-slate-900/40 p-4">
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-cyan-800/20 pb-2">
                <div>
                  <div className="text-sm font-bold text-cyan-100">
                    主要来源拆解
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    先看关键面板项的主要增量来自哪里。这里展示的是“当前结果”相对 OCR 基线的来源拆解。
                  </div>
                </div>
                <span className="rounded-full border border-cyan-700/40 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-200">
                  法伤 / 灵力 / 速度 / 法防 / 气血 / 法爆 / 固伤 / 穿刺 / 命中
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                {panelSourceBreakdowns.map((item) => (
                  <div
                    key={item.key}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-100">
                        {item.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-yellow-200">
                          {item.total}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSourceKey((current) =>
                              current === item.key ? null : item.key
                            )
                          }
                          className="rounded-md border border-cyan-700/30 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-100 transition-colors hover:border-cyan-500/50 hover:bg-cyan-500/15"
                        >
                          <span className="flex items-center gap-1">
                            {expandedSourceKey === item.key ? '收起明细' : '查看明细'}
                            {expandedSourceKey === item.key ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </span>
                        </button>
                      </div>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      基线 {item.baseline}
                      {item.hasBaseline ? (
                        <span className="ml-1">
                          {item.delta > 0 ? `· +${item.delta}` : item.delta < 0 ? `· ${item.delta}` : '· 无变化'}
                        </span>
                      ) : (
                        <span className="ml-1">· 暂无 OCR 基线</span>
                      )}
                    </div>
                    <div className="mt-2 text-[11px] leading-5 text-cyan-100/80">
                      {buildPanelSourceBreakdownSummary(item, 2)}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.sources.length > 0 ? (
                        item.sources.map((source) => (
                          <span
                            key={`${item.key}-${source.label}`}
                            className={`rounded border px-2 py-1 text-[11px] ${
                              source.value > 0
                                ? 'border-emerald-600/30 bg-emerald-500/10 text-emerald-200'
                                : 'border-red-600/30 bg-red-500/10 text-red-200'
                            }`}
                          >
                            {source.label}
                            {source.value > 0 ? ' +' : ' '}
                            {source.value}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-slate-500">
                          当前没有可拆解的增量来源
                        </span>
                      )}
                    </div>
                    {expandedSourceKey === item.key && (
                      <div className="mt-3 rounded-lg border border-cyan-900/30 bg-cyan-950/10 p-3">
                        <div className="grid grid-cols-3 gap-2 text-[11px]">
                          <div className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-2">
                            <div className="text-slate-500">当前结果</div>
                            <div className="mt-1 font-semibold text-cyan-100">
                              {item.total}
                            </div>
                          </div>
                          <div className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-2">
                            <div className="text-slate-500">OCR 基线</div>
                            <div className="mt-1 font-semibold text-slate-100">
                              {item.baseline}
                            </div>
                          </div>
                          <div className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-2">
                            <div className="text-slate-500">总增量</div>
                            <div
                              className={`mt-1 font-semibold ${
                                item.delta > 0
                                  ? 'text-emerald-300'
                                  : item.delta < 0
                                    ? 'text-red-300'
                                    : 'text-slate-100'
                              }`}
                            >
                              {formatPanelSourceSignedValue(item.delta)}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 space-y-1.5">
                          {item.sourceDetails.length > 0 ? (
                            item.sourceDetails.map((group, groupIndex) => (
                              <div
                                key={`${item.key}-group-${group.label}`}
                                className="rounded-md border border-slate-800/80 bg-slate-950/50 p-2"
                              >
                                <div className="mb-1.5 flex items-center justify-between text-[11px]">
                                  <span className="text-cyan-100/85">
                                    {groupIndex === 0
                                      ? `主因来源 · ${group.label}`
                                      : groupIndex === 1
                                        ? `次因来源 · ${group.label}`
                                        : group.label}
                                  </span>
                                  <span className="text-slate-500">
                                    {group.items.length} 项
                                  </span>
                                </div>
                                <div className="space-y-1.5">
                                  {sortPanelSourceValueItems(group.items).map(
                                    (source) => (
                                      <div
                                        key={`${item.key}-detail-${group.label}-${source.label}`}
                                        className="rounded-md border border-slate-800/70 bg-slate-950/70 px-2 py-1.5 text-[11px]"
                                      >
                                        <div className="flex items-center justify-between gap-3">
                                          <span className="text-slate-300">
                                            {source.label}
                                          </span>
                                          <span
                                            className={
                                              source.value > 0
                                                ? 'font-medium text-emerald-300'
                                                : 'font-medium text-red-300'
                                            }
                                          >
                                            {formatPanelSourceSignedValue(source.value)}
                                          </span>
                                        </div>
                                        {source.note ? (
                                          <div className="mt-1 text-[10px] leading-4 text-slate-500">
                                            {source.note}
                                          </div>
                                        ) : null}
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            ))
                          ) : item.sources.length > 0 ? (
                            sortPanelSourceValueItems(item.sources).map(
                              (source, index) => (
                                <div
                                  key={`${item.key}-detail-${source.label}`}
                                  className="flex items-center justify-between rounded-md border border-slate-800/80 bg-slate-950/60 px-2 py-1.5 text-[11px]"
                                >
                                  <span className="text-slate-300">
                                    {index === 0
                                      ? `主因 · ${source.label}`
                                      : index === 1
                                        ? `次因 · ${source.label}`
                                        : source.label}
                                  </span>
                                  <span
                                    className={
                                      source.value > 0
                                        ? 'font-medium text-emerald-300'
                                        : 'font-medium text-red-300'
                                    }
                                  >
                                    {formatPanelSourceSignedValue(source.value)}
                                  </span>
                                </div>
                              )
                            )
                          ) : (
                            <div className="rounded-md border border-dashed border-slate-700 px-2 py-2 text-[11px] text-slate-500">
                              {item.hasBaseline
                                ? '当前字段没有可继续展开的增量来源。'
                                : '当前字段还没有 OCR 基线，所以暂时只能展示当前值。'}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
            {/* 五围属性 */}
            <div className="rounded-xl border border-yellow-800/40 bg-slate-900/40 p-4">
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-yellow-800/30 pb-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-yellow-400">
                  <ScrollText className="h-4 w-4" />
                  五围属性
                </h3>
                <span className="rounded-full border border-cyan-700/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">
                  基线维护
                </span>
              </div>
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
                  label="潜力点"
                  value={baseAttributes.potentialPoints}
                  statKey="potentialPoints"
                  onValueChange={(v) =>
                    updateBaseAttribute('potentialPoints', v)
                  }
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
              <div className="mt-4 rounded-xl border border-yellow-800/30 bg-slate-950/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-yellow-300">
                      快速加点
                    </div>
                    <div className="text-[11px] text-slate-400">
                      拖动滑杆分配当前潜力点，也可一键全魔
                    </div>
                  </div>
                  <div className="rounded-md border border-yellow-700/40 bg-slate-900/60 px-2 py-1 text-xs text-yellow-200">
                    剩余 {baseAttributes.potentialPoints}
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {POTENTIAL_ALLOCATION_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      className={`rounded-lg border px-2 py-1.5 text-xs font-bold transition-colors ${
                        allocationTarget === option.key
                          ? 'border-yellow-500 bg-yellow-900/40 text-yellow-200'
                          : 'border-yellow-800/30 bg-slate-900/50 text-slate-300 hover:border-yellow-700/40 hover:text-yellow-100'
                      }`}
                      onClick={() => setAllocationTarget(option.key)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                    <span>分配点数</span>
                    <span>
                      {allocationAmount} / {baseAttributes.potentialPoints}
                    </span>
                  </div>
                  <Slider
                    max={Math.max(0, baseAttributes.potentialPoints)}
                    min={0}
                    onValueChange={(nextValue) =>
                      setAllocationAmount(nextValue[0] || 0)
                    }
                    step={1}
                    value={[allocationAmount]}
                  />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    className="rounded-lg border border-yellow-700/40 bg-slate-900/70 px-3 py-1.5 text-xs font-bold text-yellow-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={baseAttributes.potentialPoints <= 0}
                    onClick={() =>
                      setAllocationAmount(Math.max(0, baseAttributes.potentialPoints))
                    }
                    type="button"
                  >
                    拉满
                  </button>
                  <button
                    className="rounded-lg border border-emerald-700/40 bg-emerald-900/20 px-3 py-1.5 text-xs font-bold text-emerald-200 transition-colors hover:bg-emerald-800/30 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={baseAttributes.potentialPoints <= 0}
                    onClick={handleAllocateAllMagic}
                    type="button"
                  >
                    一键全魔
                  </button>
                  <button
                    className="ml-auto rounded-lg border border-yellow-700/50 bg-yellow-900/30 px-3 py-1.5 text-xs font-bold text-yellow-100 transition-colors hover:bg-yellow-800/30 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      allocationAmount <= 0 || baseAttributes.potentialPoints <= 0
                    }
                    onClick={handleApplyPotentialAllocation}
                    type="button"
                  >
                    应用加点
                  </button>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-cyan-800/30 bg-cyan-950/10 p-3">
                <div className="mb-2">
                  <div className="text-sm font-bold text-cyan-200">
                    经脉补偿
                  </div>
                  <div className="text-[11px] text-slate-400">
                    用结构化加成模拟经脉点位，修改后会直接反馈到面板
                  </div>
                </div>
                <div className="space-y-1">
                  {MERIDIAN_OPTIONS.map((item) => (
                    <AttributeDisplay
                      key={item.key}
                      label={item.label}
                      value={meridian[item.key] || 0}
                      onValueChange={(v) => updateMeridian(item.key, v)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* 攻击属性 */}
            <div className="rounded-xl border border-yellow-800/40 bg-slate-900/40 p-4">
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-yellow-800/30 pb-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-yellow-400">
                  <Swords className="h-4 w-4" />
                  攻击属性
                </h3>
                <span className="rounded-full border border-yellow-700/40 bg-yellow-500/10 px-2 py-0.5 text-[10px] text-yellow-200">
                  基线 + 增量结果
                </span>
              </div>
              <p className="mb-3 text-[11px] leading-5 text-slate-400">
                这里展示的是最终面板，不是 OCR 原图直接抄值。经脉、装备、修炼等增量会在基线之上实时联动。
              </p>
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
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-yellow-800/30 pb-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-yellow-400">
                  <Shield className="h-4 w-4" />
                  防御属性
                </h3>
                <span className="rounded-full border border-yellow-700/40 bg-yellow-500/10 px-2 py-0.5 text-[10px] text-yellow-200">
                  基线 + 增量结果
                </span>
              </div>
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
                <p className="mb-3 text-xs leading-relaxed text-slate-400">
                  当前显示为“基础等级+额外等级”。额外等级通常来自符石组合等战斗增益。
                </p>
                <div className="custom-scrollbar max-h-40 space-y-2 overflow-y-auto pr-1">
                  {skills.map((skill, i) => {
                    const { levelText, detailText } = formatSkillLevel(skill);

                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border border-yellow-800/30 bg-slate-900/60 px-3 py-2 transition-colors hover:border-yellow-600/50"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-yellow-100">
                            {skill.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {detailText}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {skill.extraLevel > 0 ? (
                            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                              +{skill.extraLevel}
                            </span>
                          ) : null}
                          <span className="rounded bg-yellow-900/30 px-2 py-0.5 text-sm text-yellow-400">
                            Lv.{levelText}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 神器加成 */}
              <div className="rounded-xl border border-yellow-800/40 bg-slate-900/40 p-4">
                <h3 className="mb-3 flex items-center gap-2 border-b border-yellow-800/30 pb-2 text-sm font-bold text-yellow-400">
                  <Gem className="h-4 w-4" />
                  神器加成
                </h3>
                {treasure ? (
                  <div className="rounded-lg border border-yellow-800/40 bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-4 transition-colors hover:border-yellow-600/60">
                    <div className="mb-2 text-sm font-bold text-yellow-100">
                      {treasure.name}
                    </div>
                    <div className="text-sm text-yellow-400/80">
                      {artifactSummary}
                    </div>
                    {artifactTags.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {artifactTags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-yellow-700/40 bg-yellow-950/30 px-2 py-0.5 text-[11px] text-yellow-100/90"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex h-20 items-center justify-center text-sm text-slate-500 italic">
                    未配置神器加成
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
                  label="强身"
                  value={cultivation.bodyStrength || 0}
                  onValueChange={(v) => updateCultivation('bodyStrength', v)}
                />
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
