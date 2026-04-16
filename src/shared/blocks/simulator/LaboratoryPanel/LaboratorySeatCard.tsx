'use client';

import { useState } from 'react';
import { computeCombatStatsWithPanelBaseline } from '@/features/simulator/store/gameLogic';
import type {
  BaseAttributes,
  Equipment,
  EquipmentSet,
  ExperimentSeat,
  MeridianConfig,
  SyncedCloudState,
  Treasure,
} from '@/features/simulator/store/gameTypes';
import { ChevronDown, ChevronUp, Trash2, Upload } from 'lucide-react';

import { getEquipmentRuneStoneSetInfo } from '@/shared/blocks/simulator/EquipmentPanel/RuneStoneHelper';
import {
  buildLaboratoryMagicDamageCostLabel,
  buildLaboratoryMarginalWarning,
  buildLaboratoryOutcomeSummary,
  formatLaboratoryDamageDelta,
  getLaboratoryOutcomeTone,
} from '@/shared/lib/laboratory-outcome-summary';
import {
  buildSimulatorArtifactConfigFromTreasure,
  buildSimulatorArtifactSpotlightTags,
  buildSimulatorArtifactSummary,
} from '@/shared/lib/simulator-artifact';
import { SIMULATOR_PRIMARY_EQUIPMENT_TYPES } from '@/shared/lib/simulator-equipment';
import { getSimulatorEquipmentDisplayImageUrl } from '@/shared/lib/simulator-equipment-artwork';
import {
  formatEquipmentExtraAttributeSummary,
  sumEquipmentExtraAttributeTotals,
} from '@/shared/lib/simulator-extra-attribute-summary';
import {
  buildPanelSourceDeltaSummary,
  buildSimulatorPanelSourceBreakdowns,
  buildSimulatorPanelSourceDeltaBreakdowns,
  formatPanelSourceSignedValue,
  sortPanelSourceValueItems,
} from '@/shared/lib/simulator-panel-source-breakdown';
import {
  buildActiveRegularSetSummaries,
  formatActiveRegularSetSummary,
  type RegularSetRuntimeRule,
} from '@/shared/lib/simulator-regular-set';
import {
  buildRuneComboDropWarnings,
  diffActiveRuneComboEffects,
} from '@/shared/lib/simulator-rune-bonus';
import { matchesSimulatorSlotDefinition } from '@/shared/lib/simulator-slot-config';
import { getSimulatorStatLabel } from '@/shared/lib/simulator-stat-labels';
import type { LabValuationSeatResult } from '@/shared/services/lab-valuation';

import {
  calculateEquipmentTotalStats,
  describeSeatInheritance,
  getFallbackSeatTotalDamage,
  getSeatDisplayName,
  LABORATORY_CATEGORIES,
  mergeLaboratoryDisplayDiffs,
  resolveLaboratorySeatEquipment,
} from './laboratory-utils';

type LaboratorySelectedSlot = {
  seatId: string;
  slotType: Equipment['type'];
  slotSlot?: number;
  slotLabel: string;
  baseEquip?: Equipment;
  currentEquip?: Equipment;
  inheritGemstones?: boolean;
  inheritRuneStones?: boolean;
};

type Props = {
  seat: ExperimentSeat;
  experimentSeats: ExperimentSeat[];
  sampleEquipment: Equipment[];
  equipmentSets: EquipmentSet[];
  selectedSampleSetIndex: number;
  onSelectedSampleSetIndexChange: (index: number) => void;
  onApplySeat: (seat: ExperimentSeat) => void;
  onRemoveSeat: (seat: ExperimentSeat) => void;
  onSelectSlot: (selection: LaboratorySelectedSlot) => void;
  onClearDetailSelection: () => void;
  baseAttributes: BaseAttributes;
  bodyStrength: number;
  meridian: MeridianConfig;
  treasure: Treasure | null;
  baseSampleStats: ReturnType<typeof calculateEquipmentTotalStats>;
  seatLabValuation?: LabValuationSeatResult;
  labValuationError: string | null;
  isLoadingLabValuation: boolean;
  regularSetRules?: RegularSetRuntimeRule[];
  syncedCloudState?: SyncedCloudState | null;
};

export function LaboratorySeatCard({
  seat,
  experimentSeats,
  sampleEquipment,
  equipmentSets,
  selectedSampleSetIndex,
  onSelectedSampleSetIndexChange,
  onApplySeat,
  onRemoveSeat,
  onSelectSlot,
  onClearDetailSelection,
  baseAttributes,
  bodyStrength,
  meridian,
  treasure,
  baseSampleStats,
  seatLabValuation,
  labValuationError,
  isLoadingLabValuation,
  regularSetRules,
  syncedCloudState,
}: Props) {
  const [expandedDeltaKey, setExpandedDeltaKey] = useState<string | null>(null);
  const seatEquip = resolveLaboratorySeatEquipment(seat, sampleEquipment);
  const { totals, totalPrice } = calculateEquipmentTotalStats(seatEquip);
  const seatCombatStats = computeCombatStatsWithPanelBaseline(
    {
      baseAttributes,
      equipment: seatEquip,
      treasure,
      bodyStrength,
      meridian,
      regularSetRules,
      runeSkillBaselineEquipment: sampleEquipment,
    },
    syncedCloudState
      ? {
          panelStats: syncedCloudState.combatStats,
          baseAttributes: syncedCloudState.baseAttributes,
          equipment: syncedCloudState.equipment,
          treasure: syncedCloudState.treasure,
          bodyStrength: syncedCloudState.cultivation.bodyStrength,
          formation:
            syncedCloudState.playerSetup?.formation ??
            syncedCloudState.formation,
          meridian: syncedCloudState.meridian,
          regularSetRules,
          runeSkillBaselineEquipment: syncedCloudState.equipment,
        }
      : null
  );
  const baseCombatStats = computeCombatStatsWithPanelBaseline(
    {
      baseAttributes,
      equipment: sampleEquipment,
      treasure,
      bodyStrength,
      meridian,
      regularSetRules,
      runeSkillBaselineEquipment: sampleEquipment,
    },
    syncedCloudState
      ? {
          panelStats: syncedCloudState.combatStats,
          baseAttributes: syncedCloudState.baseAttributes,
          equipment: syncedCloudState.equipment,
          treasure: syncedCloudState.treasure,
          bodyStrength: syncedCloudState.cultivation.bodyStrength,
          formation:
            syncedCloudState.playerSetup?.formation ??
            syncedCloudState.formation,
          meridian: syncedCloudState.meridian,
          regularSetRules,
          runeSkillBaselineEquipment: syncedCloudState.equipment,
        }
      : null
  );

  const seatRuneSets = getEquipmentRuneStoneSetInfo(seatEquip);
  const baseRuneSets = getEquipmentRuneStoneSetInfo(sampleEquipment);
  const seatPrimaryExtraAttributeSummary = formatEquipmentExtraAttributeSummary(
    sumEquipmentExtraAttributeTotals(
      seatEquip.filter((item) =>
        (SIMULATOR_PRIMARY_EQUIPMENT_TYPES as readonly string[]).includes(
          item.type
        )
      )
    )
  );
  const seatRegularSetSummary = buildActiveRegularSetSummaries(
    seatEquip
      .filter((item) =>
        (SIMULATOR_PRIMARY_EQUIPMENT_TYPES as readonly string[]).includes(
          item.type
        )
      )
      .map((item) => ({
        slot: item.type,
        setName: item.setName,
      })),
    regularSetRules
  ).map((item) => formatActiveRegularSetSummary(item));
  const addedSets = seatRuneSets.filter(
    (value) => !baseRuneSets.includes(value)
  );
  const removedSets = baseRuneSets.filter(
    (value) => !seatRuneSets.includes(value)
  );
  const runeComboDiffs = seat.isSample
    ? []
    : diffActiveRuneComboEffects(sampleEquipment, seatEquip);
  const runeComboWarnings = buildRuneComboDropWarnings(runeComboDiffs);

  let seatRuneStoneInfo = seatRuneSets[0] || '';
  if (!seat.isSample && addedSets.length > 0) {
    seatRuneStoneInfo = addedSets[0];
  }

  let runeStoneChange = '';
  if (!seat.isSample) {
    if (addedSets.length > 0 && removedSets.length > 0) {
      runeStoneChange = `${removedSets[0]} → ${addedSets[0]}`;
    } else if (addedSets.length > 0) {
      runeStoneChange = `新增: ${addedSets[0]}`;
    } else if (removedSets.length > 0) {
      runeStoneChange = `移除: ${removedSets[0]}`;
    }
  }

  const diffs: Record<string, number> = {};
  const combatDiffs: Record<string, number> = {};
  let totalDamageDiff = 0;
  let diffPrice = 0;
  const isServiceUnavailable = Boolean(labValuationError) && !seatLabValuation;

  if (!seat.isSample) {
    Object.keys(totals).forEach((key) => {
      const diff = totals[key] - (baseSampleStats.totals[key] || 0);
      if (Math.abs(diff) > 0.01) {
        diffs[key] = diff;
      }
    });

    Object.keys(baseSampleStats.totals).forEach((key) => {
      if (!(key in totals)) {
        diffs[key] = -(baseSampleStats.totals[key] || 0);
      }
    });

    Object.keys(seatCombatStats).forEach((key) => {
      const statKey = key as keyof typeof seatCombatStats;
      const diff = seatCombatStats[statKey] - baseCombatStats[statKey];
      if (Math.abs(diff) > 0.01) {
        combatDiffs[key] = diff;
      }
    });

    const isMagicFaction = ['龙宫', '魔王寨', '神木林'].includes(
      baseAttributes.faction
    );
    totalDamageDiff = isMagicFaction
      ? combatDiffs.magicDamage || 0
      : combatDiffs.damage || 0;

    diffPrice = totalPrice - baseSampleStats.totalPrice;

    if (seatLabValuation?.comparison) {
      totalDamageDiff =
        seatLabValuation.comparison.damageDiff ?? totalDamageDiff;
      diffPrice = seatLabValuation.comparison.priceDiff ?? diffPrice;
    }
  }

  const displayDiffs = mergeLaboratoryDisplayDiffs({
    combatDiffs,
    diffs,
  });
  const inheritanceBadges = seat.isSample
    ? []
    : describeSeatInheritance({
        inheritGemstones: seat.inheritGemstones,
        inheritRuneStones: seat.inheritRuneStones,
      });

  const magicDamageDiff =
    seatLabValuation?.comparison?.magicDamageDiff ??
    (combatDiffs.magicDamage || 0);
  let magicDamageCostDisplay =
    seatLabValuation?.comparison?.magicDamageCostLabel || '-';
  const fallbackSampleTotalDamage = getFallbackSeatTotalDamage(baseCombatStats);
  const totalDamageGainPercent =
    seatLabValuation?.comparison?.damageGainPercent ??
    (fallbackSampleTotalDamage > 0
      ? (totalDamageDiff / fallbackSampleTotalDamage) * 100
      : null);
  if (!seatLabValuation?.comparison && !isServiceUnavailable) {
    magicDamageCostDisplay = buildLaboratoryMagicDamageCostLabel({
      diffPrice,
      magicDamageDiff,
    });
  }
  const marginalWarning =
    seatLabValuation?.comparison?.marginalWarning ??
    (!isServiceUnavailable
      ? buildLaboratoryMarginalWarning({
          diffPrice,
          magicDamageDiff,
        })
      : null);

  const handleSelectSlot = (selection: LaboratorySelectedSlot) => {
    if (seat.isSample) {
      return;
    }

    onSelectSlot(selection);
    onClearDetailSelection();
  };

  const outcomeSummary = buildLaboratoryOutcomeSummary({
    totalDamageDiff,
    diffPrice,
  });
  const damageDeltaText = formatLaboratoryDamageDelta(totalDamageDiff);
  const damageTone = getLaboratoryOutcomeTone(totalDamageDiff);
  const totalDamageGainDisplay = isServiceUnavailable
    ? '不可用'
    : totalDamageGainPercent === null
      ? '—'
      : `${totalDamageGainPercent > 0 ? '+' : ''}${totalDamageGainPercent.toFixed(1)}%`;
  const diffPriceDisplay = `¥ ${
    diffPrice > 0
      ? `+${Number(diffPrice.toFixed(2))}`
      : Number(diffPrice.toFixed(2))
  }`;
  const summaryMetricCards = seat.isSample
    ? []
    : [
        {
          label: '伤害结论',
          value: isServiceUnavailable ? '不可用' : damageDeltaText,
          tone:
            damageTone === 'positive'
              ? 'border-emerald-600/35 bg-emerald-500/10 text-emerald-100'
              : damageTone === 'negative'
                ? 'border-red-600/35 bg-red-500/10 text-red-100'
                : 'border-slate-700/60 bg-slate-900/60 text-slate-100',
          helper: isServiceUnavailable ? '服务暂不可用' : outcomeSummary,
        },
        {
          label: '总伤增益',
          value: totalDamageGainDisplay,
          tone: isServiceUnavailable
            ? 'border-amber-600/35 bg-amber-500/10 text-amber-100'
            : totalDamageGainPercent === null
              ? 'border-slate-700/60 bg-slate-900/60 text-slate-100'
              : totalDamageGainPercent > 0
                ? 'border-emerald-600/35 bg-emerald-500/10 text-emerald-100'
                : totalDamageGainPercent < 0
                  ? 'border-red-600/35 bg-red-500/10 text-red-100'
                  : 'border-slate-700/60 bg-slate-900/60 text-slate-100',
          helper: '相对样本席位总伤变化',
        },
        {
          label: '差价成本',
          value: diffPriceDisplay,
          tone:
            diffPrice <= 0
              ? 'border-cyan-600/35 bg-cyan-500/10 text-cyan-100'
              : 'border-yellow-600/35 bg-yellow-500/10 text-yellow-100',
          helper: diffPrice <= 0 ? '当前更便宜' : '当前更贵',
        },
        {
          label: '1点法伤成本',
          value: isServiceUnavailable
            ? '不可用'
            : isLoadingLabValuation &&
                !seatLabValuation?.comparison &&
                magicDamageCostDisplay === '-'
              ? '计算中'
              : magicDamageCostDisplay,
          tone:
            magicDamageCostDisplay === '-' || isServiceUnavailable
              ? 'border-slate-700/60 bg-slate-900/60 text-slate-100'
              : 'border-fuchsia-600/35 bg-fuchsia-500/10 text-fuchsia-100',
          helper: `法伤变化 ${magicDamageDiff > 0 ? '+' : ''}${Math.round(magicDamageDiff)}`,
        },
      ];
  const artifactConfig = buildSimulatorArtifactConfigFromTreasure(treasure);
  const artifactSummary = buildSimulatorArtifactSummary(artifactConfig);
  const artifactTags = buildSimulatorArtifactSpotlightTags(artifactConfig);
  const hasPanelBaseline = Boolean(syncedCloudState);
  const samplePanelSourceBreakdowns = buildSimulatorPanelSourceBreakdowns({
    baseAttributes,
    equipment: sampleEquipment,
    treasure,
    bodyStrength,
    formation:
      syncedCloudState?.playerSetup?.formation ?? syncedCloudState?.formation,
    meridian,
    regularSetRules,
    syncedCloudState,
  });
  const seatPanelSourceBreakdowns = buildSimulatorPanelSourceBreakdowns({
    baseAttributes,
    equipment: seatEquip,
    treasure,
    bodyStrength,
    formation:
      syncedCloudState?.playerSetup?.formation ?? syncedCloudState?.formation,
    meridian,
    regularSetRules,
    syncedCloudState,
  });
  const seatPanelSourceDeltaBreakdowns =
    buildSimulatorPanelSourceDeltaBreakdowns(
      samplePanelSourceBreakdowns,
      seatPanelSourceBreakdowns
    ).slice(0, 3);
  const getDisplayDiffLabel = (key: string) =>
    key === 'magic' ? '魔力' : getSimulatorStatLabel(key);

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden rounded-xl border border-yellow-800/40 bg-slate-900/60 p-4">
      <div className="mb-3 flex flex-shrink-0 items-center justify-between border-b border-yellow-800/30 pb-2">
        <div className="flex items-center gap-2">
          <h3
            className={`text-sm font-bold ${seat.isSample ? 'text-yellow-500' : 'text-yellow-100'}`}
          >
            {getSeatDisplayName(seat, experimentSeats)}
          </h3>
          {!seat.isSample && (
            <div className="flex flex-wrap gap-1">
              {inheritanceBadges.map((badge) => (
                <span
                  key={badge}
                  className="rounded border border-cyan-700/40 bg-cyan-950/30 px-1.5 py-0.5 text-[10px] text-cyan-300"
                >
                  {badge}
                </span>
              ))}
            </div>
          )}
          {seat.isSample && (
            <select
              id={`sample-seat-set-${seat.id}`}
              name={`sample-seat-set-${seat.id}`}
              value={selectedSampleSetIndex}
              onChange={(event) =>
                onSelectedSampleSetIndexChange(Number(event.target.value))
              }
              className="cursor-pointer rounded border border-yellow-700/40 bg-slate-800/80 px-2 py-0.5 text-xs text-yellow-100 focus:ring-1 focus:ring-yellow-600/50 focus:outline-none"
            >
              {equipmentSets.map((set, index) => (
                <option key={set.id} value={index}>
                  {set.name || `装备组合 ${index + 1}`}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!seat.isSample && (
            <button
              onClick={() => onRemoveSeat(seat)}
              className="flex items-center gap-1 rounded border border-red-600/30 bg-red-950/20 px-2 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-950/35"
              title="删除此对比席位"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>删除</span>
            </button>
          )}
          {!seat.isSample && (
            <button
              onClick={() => onApplySeat(seat)}
              className="flex items-center gap-1 rounded border border-yellow-600/40 bg-yellow-600/20 px-2 py-1 text-xs font-medium text-yellow-400 transition-colors hover:bg-yellow-600/30 hover:text-yellow-300"
              title="将此席位装备应用到当前装备"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>应用</span>
            </button>
          )}
        </div>
      </div>

      <div className="custom-scrollbar mb-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
        <div
          className={`rounded-lg border p-3 ${
            seat.isSample
              ? 'border-cyan-800/30 bg-cyan-950/10'
              : 'border-yellow-800/30 bg-yellow-950/10'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div
                className={`text-xs font-bold ${
                  seat.isSample ? 'text-cyan-200' : 'text-yellow-200'
                }`}
              >
                {seat.isSample ? '样本席位口径' : '对比席位口径'}
              </div>
              <div className="mt-1 text-xs leading-6 text-slate-300">
                {seat.isSample
                  ? '样本位代表当前角色的基线面板 + 当前方案增量，是整组实验的对照基准。'
                  : '对比位不会重算一套新角色，只是在同一个基线面板上替换本席位方案产生增量差值。'}
              </div>
            </div>
            <span
              className={`rounded-full border px-2 py-1 text-[10px] ${
                hasPanelBaseline
                  ? seat.isSample
                    ? 'border-cyan-700/40 bg-cyan-500/10 text-cyan-200'
                    : 'border-yellow-700/40 bg-yellow-500/10 text-yellow-200'
                  : 'border-slate-700 bg-slate-900/60 text-slate-300'
              }`}
            >
              {hasPanelBaseline ? 'OCR 基线已接入' : '当前按本地档案值'}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {LABORATORY_CATEGORIES.map((category) => (
            <div key={category.name} className="space-y-2">
              <div className="mb-2 border-b border-yellow-800/30 pb-1 text-xs font-bold text-yellow-600">
                {category.name}
              </div>
              <div className="space-y-2">
                {category.slots.map((slotDef) => {
                  const equipment = seatEquip.find((item) =>
                    matchesSimulatorSlotDefinition(slotDef, item)
                  );
                  const currentEquip = sampleEquipment.find((item) =>
                    matchesSimulatorSlotDefinition(slotDef, item)
                  );
                  const isSameAsCurrent =
                    !seat.isSample &&
                    ((!equipment && !currentEquip) ||
                      (equipment &&
                        currentEquip &&
                        equipment.id === currentEquip.id));

                  if (isSameAsCurrent) {
                    return (
                      <div
                        key={slotDef.id}
                        onClick={() =>
                          handleSelectSlot({
                            seatId: seat.id,
                            slotType: slotDef.type,
                            slotSlot: slotDef.slot,
                            slotLabel: slotDef.label,
                            baseEquip: currentEquip,
                            currentEquip: equipment,
                            inheritGemstones: seat.inheritGemstones,
                            inheritRuneStones: seat.inheritRuneStones,
                          })
                        }
                        className={`flex items-center gap-2 rounded-lg border border-slate-800/50 bg-slate-900/40 p-2.5 text-xs shadow-sm ${!seat.isSample ? 'cursor-pointer transition-all hover:border-yellow-600/40 hover:bg-slate-900/60' : ''}`}
                      >
                        <span className="w-10 shrink-0 border-r border-slate-700/50 pr-2 text-right text-slate-500">
                          {slotDef.label}
                        </span>
                        <span className="font-medium tracking-wide text-slate-400">
                          当前装备
                        </span>
                        <span className="ml-auto rounded-full border border-slate-700/70 bg-slate-900/80 px-2 py-0.5 text-[10px] text-slate-300">
                          沿用当前
                        </span>
                      </div>
                    );
                  }

                  if (!equipment) {
                    return (
                      <div
                        key={slotDef.id}
                        onClick={() =>
                          handleSelectSlot({
                            seatId: seat.id,
                            slotType: slotDef.type,
                            slotSlot: slotDef.slot,
                            slotLabel: slotDef.label,
                            baseEquip: currentEquip,
                            currentEquip: equipment,
                            inheritGemstones: seat.inheritGemstones,
                            inheritRuneStones: seat.inheritRuneStones,
                          })
                        }
                        className={`flex items-center gap-2 rounded-lg border border-slate-800/50 bg-slate-900/40 p-2.5 text-xs shadow-sm ${!seat.isSample ? 'cursor-pointer transition-all hover:border-yellow-600/40 hover:bg-slate-900/60' : ''}`}
                      >
                        <span className="w-10 shrink-0 border-r border-slate-700/50 pr-2 text-right text-slate-500">
                          {slotDef.label}
                        </span>
                        <span className="text-slate-600 italic">空</span>
                        <span className="ml-auto rounded-full border border-red-700/40 bg-red-950/20 px-2 py-0.5 text-[10px] text-red-300">
                          未挂载
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={slotDef.id}
                      onClick={() =>
                        handleSelectSlot({
                          seatId: seat.id,
                          slotType: slotDef.type,
                          slotSlot: slotDef.slot,
                          slotLabel: slotDef.label,
                          baseEquip: currentEquip,
                          currentEquip: equipment,
                          inheritGemstones: seat.inheritGemstones,
                          inheritRuneStones: seat.inheritRuneStones,
                        })
                      }
                      className={`flex rounded-lg border border-slate-700/80 bg-slate-800/80 p-2.5 text-xs shadow-sm ${!seat.isSample ? 'cursor-pointer transition-all hover:border-yellow-600/60 hover:bg-slate-800' : ''}`}
                    >
                      <span className="mt-0.5 w-10 shrink-0 border-r border-slate-700/50 pr-2 text-right text-slate-400">
                        {slotDef.label}
                      </span>
                      <div className="ml-2 h-8 w-8 shrink-0 overflow-hidden rounded border border-slate-700/50 bg-slate-950/50">
                        <img
                          src={getSimulatorEquipmentDisplayImageUrl(equipment)}
                          alt={equipment.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1 pl-2">
                        <div className="flex items-start justify-between">
                          <span className="truncate text-sm font-bold text-yellow-100">
                            {equipment.name}
                          </span>
                          <div className="ml-2 flex shrink-0 flex-col items-end gap-1">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] ${
                                currentEquip
                                  ? 'border-amber-600/40 bg-amber-500/10 text-amber-200'
                                  : 'border-emerald-600/40 bg-emerald-500/10 text-emerald-200'
                              }`}
                            >
                              {currentEquip ? '替换当前' : '新增挂载'}
                            </span>
                            {equipment.price ? (
                              <span className="font-bold text-[#fff064]">
                                ¥ {equipment.price}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {equipment.mainStat && (
                          <div className="mt-1 leading-snug break-all whitespace-pre-line text-slate-300">
                            {equipment.mainStat}
                          </div>
                        )}

                        {equipment.extraStat && (
                          <div className="mt-1 leading-snug break-all whitespace-pre-line text-red-400">
                            {equipment.extraStat}
                          </div>
                        )}

                        {equipment.highlights &&
                          equipment.highlights.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {equipment.highlights.map((highlight, index) => (
                                <span
                                  key={index}
                                  className="rounded border border-red-500/50 px-1 py-0.5 text-[10px] text-red-400"
                                >
                                  {highlight}
                                </span>
                              ))}
                            </div>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {seatRuneStoneInfo && (
          <div className="rounded-lg bg-slate-950/40 p-3">
            <div className="mb-2 text-xs font-bold text-yellow-400">
              符石套装效果
            </div>
            <div className="text-xs leading-relaxed text-slate-300">
              {seatRuneStoneInfo || '无套装'}
            </div>
          </div>
        )}

        {seatPrimaryExtraAttributeSummary.length > 0 && (
          <div className="rounded-lg bg-slate-950/40 p-3">
            <div className="mb-2 text-xs font-bold text-amber-300">
              双加汇总
            </div>
            <div className="flex flex-wrap gap-1.5">
              {seatPrimaryExtraAttributeSummary.map((item) => (
                <span
                  key={item}
                  className="rounded border border-amber-500/40 bg-amber-950/40 px-2 py-1 text-[11px] text-amber-100"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {seatRegularSetSummary.length > 0 && (
          <div className="rounded-lg bg-slate-950/40 p-3">
            <div className="mb-2 text-xs font-bold text-emerald-300">
              常规套装效果
            </div>
            <div className="flex flex-wrap gap-1.5">
              {seatRegularSetSummary.map((item) => (
                <span
                  key={item}
                  className="rounded border border-emerald-500/40 bg-emerald-950/40 px-2 py-1 text-[11px] text-emerald-100"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-lg bg-slate-950/40 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-xs font-bold text-emerald-300">神器加成</div>
            <div className="text-[10px] text-emerald-200/60">
              当前统一作用于全部席位
            </div>
          </div>
          {artifactConfig ? (
            <div className="space-y-2">
              <div className="text-xs leading-relaxed text-emerald-100/90">
                {artifactSummary}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {artifactTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded border border-emerald-500/35 bg-emerald-950/40 px-2 py-1 text-[11px] text-emerald-100"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic">未配置神器加成</div>
          )}
        </div>

        {!seat.isSample && (
          <div className="rounded-lg border border-yellow-800/30 bg-yellow-950/10 p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-yellow-200">
                  结论速览
                </div>
                <div className="mt-1 text-[11px] leading-5 text-slate-300">
                  先看这套对比位是不是“值得继续深看”，再决定是否展开下面的属性与来源明细。
                </div>
              </div>
              {marginalWarning ? (
                <span className="rounded-full border border-amber-600/40 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">
                  {marginalWarning}
                </span>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {summaryMetricCards.map((item) => (
                <div
                  key={item.label}
                  className={`rounded-lg border px-3 py-2 ${item.tone}`}
                >
                  <div className="text-[11px] opacity-75">{item.label}</div>
                  <div className="mt-1 text-base font-semibold">{item.value}</div>
                  <div className="mt-1 text-[10px] opacity-70">{item.helper}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-slate-800/70 bg-slate-950/50 px-3 py-2 text-[11px] leading-5 text-slate-300">
              收益摘要：{' '}
              <span
                className={
                  damageTone === 'positive'
                    ? 'text-emerald-300'
                    : damageTone === 'negative'
                      ? 'text-red-300'
                      : 'text-slate-200'
                }
              >
                {isServiceUnavailable ? '不可用' : outcomeSummary}
              </span>
            </div>
          </div>
        )}

        <div className="rounded-lg bg-slate-950/40 p-3">
          <div className="mb-2 text-xs font-bold text-yellow-400">
            属性及伤害变化
          </div>
          {seat.isSample ? (
            <div className="py-4 text-center text-xs text-slate-500 italic">
              样本席位，作为对比基准
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                {Object.entries(displayDiffs).map(([key, value]) => {
                  const isPositive = value > 0;
                  return (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-slate-400">
                        {getDisplayDiffLabel(key)}:
                      </span>
                      <span
                        className={
                          isPositive ? 'text-green-400' : 'text-red-400'
                        }
                      >
                        {isPositive ? '+' : ''}
                        {Math.round(value)}
                      </span>
                    </div>
                  );
                })}
                {Object.keys(displayDiffs).length === 0 && (
                  <div className="col-span-2 text-xs text-slate-500 italic">
                    无属性变化
                  </div>
                )}
              </div>

              {runeStoneChange && (
                <div className="mt-3 border-t border-yellow-800/30 pt-2">
                  <div className="mb-1.5 text-xs font-bold text-yellow-400">
                    符石套装变化
                  </div>
                  <div className="text-xs text-cyan-400">{runeStoneChange}</div>
                </div>
              )}

              {runeComboDiffs.length > 0 && (
                <div className="mt-3 border-t border-yellow-800/30 pt-2">
                  <div className="mb-1.5 text-xs font-bold text-amber-300">
                    符石技能变化
                  </div>
                  <div className="space-y-1">
                    {runeComboDiffs.map((item) => {
                      const isPositive = item.deltaBonusValue > 0;
                      const isNegative = item.deltaBonusValue < 0;

                      return (
                        <div
                          key={item.comboName}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="text-slate-300">
                            {item.effectLabel}
                          </span>
                          <span
                            className={
                              isPositive
                                ? 'text-green-400'
                                : isNegative
                                  ? 'text-red-400'
                                  : 'text-slate-400'
                            }
                          >
                            {item.nextBonusValue > 0
                              ? `+${item.nextBonusValue}`
                              : '未激活'}
                            {isNegative
                              ? ` (${item.deltaBonusValue})`
                              : isPositive
                                ? ` (+${item.deltaBonusValue})`
                                : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {runeComboWarnings.length > 0 && (
                <div className="mt-3 rounded-lg border border-red-600/40 bg-red-950/20 px-3 py-2">
                  <div className="mb-1 text-xs font-bold text-red-300">
                    符石跌落预警
                  </div>
                  <div className="space-y-1">
                    {runeComboWarnings.map((warning) => (
                      <div key={warning} className="text-xs text-red-200">
                        {warning}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {!seat.isSample && seatPanelSourceDeltaBreakdowns.length > 0 && (
          <div className="rounded-lg bg-slate-950/40 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-xs font-bold text-cyan-300">
                关键来源拆解
              </div>
              <div className="text-[10px] text-cyan-200/60">
                相对样本位的来源差
              </div>
            </div>
            <div className="space-y-2">
              {seatPanelSourceDeltaBreakdowns.map((item) => (
                <div
                  key={item.key}
                  className="rounded-lg border border-cyan-900/30 bg-cyan-950/10 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-200">
                      {item.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-semibold ${
                          item.totalDiff > 0
                            ? 'text-green-400'
                            : item.totalDiff < 0
                              ? 'text-red-400'
                              : 'text-slate-400'
                        }`}
                      >
                        {item.totalDiff > 0 ? '+' : ''}
                        {item.totalDiff}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedDeltaKey((current) =>
                            current === item.key ? null : item.key
                          )
                        }
                        className="rounded border border-cyan-700/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] text-cyan-100 transition-colors hover:border-cyan-500/50 hover:bg-cyan-500/15"
                      >
                        {expandedDeltaKey === item.key ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.sourceDiffs.length > 0 ? (
                      item.sourceDiffs.slice(0, 3).map((source) => (
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
                        当前没有可拆解来源
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-[11px] leading-5 text-cyan-100/75">
                    {buildPanelSourceDeltaSummary(item, 2)}
                  </div>
                  {expandedDeltaKey === item.key && (
                    <div className="mt-2 rounded-md border border-cyan-900/30 bg-slate-950/40 p-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>相对样本位总差值</span>
                        <span
                          className={
                            item.totalDiff > 0
                              ? 'text-emerald-300'
                              : item.totalDiff < 0
                                ? 'text-red-300'
                                : 'text-slate-200'
                          }
                        >
                          {formatPanelSourceSignedValue(item.totalDiff)}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1">
                        {item.sourceDetailDiffs.length > 0 ? (
                          item.sourceDetailDiffs.map((group, groupIndex) => (
                            <div
                              key={`${item.key}-delta-group-${group.label}`}
                              className="rounded border border-slate-800/80 bg-slate-950/55 p-1.5"
                            >
                              <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400">
                                <span className="text-cyan-100/80">
                                  {groupIndex === 0
                                    ? `主因来源 · ${group.label}`
                                    : groupIndex === 1
                                      ? `次因来源 · ${group.label}`
                                      : group.label}
                                </span>
                                <span>{group.items.length} 项</span>
                              </div>
                              <div className="space-y-1">
                                {sortPanelSourceValueItems(group.items).map(
                                  (source) => (
                                    <div
                                      key={`${item.key}-delta-${group.label}-${source.label}`}
                                      className="rounded border border-slate-800/80 bg-slate-950/60 px-2 py-1 text-[11px]"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-slate-300">
                                          {source.label}
                                        </span>
                                        <span
                                          className={
                                            source.value > 0
                                              ? 'text-emerald-300'
                                              : 'text-red-300'
                                          }
                                        >
                                          {formatPanelSourceSignedValue(
                                            source.value
                                          )}
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
                        ) : item.sourceDiffs.length > 0 ? (
                          sortPanelSourceValueItems(item.sourceDiffs).map(
                            (source, index) => (
                              <div
                                key={`${item.key}-delta-${source.label}`}
                                className="flex items-center justify-between rounded border border-slate-800/80 bg-slate-950/60 px-2 py-1 text-[11px]"
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
                                      ? 'text-emerald-300'
                                      : 'text-red-300'
                                  }
                                >
                                  {formatPanelSourceSignedValue(source.value)}
                                </span>
                              </div>
                            )
                          )
                        ) : (
                          <div className="text-[11px] text-slate-500">
                            当前没有更多来源差异
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 rounded-lg border-t border-yellow-800/30 bg-slate-950/60 p-3">
        {seat.isSample ? (
          <div className="text-center text-xs text-slate-500 italic">
            当前基准
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-yellow-100">伤害结论:</span>
              {isServiceUnavailable ? (
                <span className="text-amber-300">不可用</span>
              ) : (
                <span
                  className={
                    damageTone === 'positive'
                      ? 'text-green-400'
                      : damageTone === 'negative'
                        ? 'text-red-400'
                        : 'text-slate-400'
                  }
                >
                  {damageDeltaText}
                </span>
              )}
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">收益摘要:</span>
              <span
                className={
                  damageTone === 'positive'
                    ? 'text-green-400'
                    : damageTone === 'negative'
                      ? 'text-red-400'
                      : 'text-slate-400'
                }
              >
                {isServiceUnavailable ? '不可用' : outcomeSummary}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">总伤增益百分比:</span>
              <span
                className={
                  isServiceUnavailable
                    ? 'text-amber-300'
                    : totalDamageGainPercent === null
                      ? 'text-slate-500'
                      : totalDamageGainPercent > 0
                        ? 'text-green-400'
                        : totalDamageGainPercent < 0
                          ? 'text-red-400'
                          : 'text-slate-400'
                }
              >
                {isServiceUnavailable
                  ? '不可用'
                  : totalDamageGainPercent === null
                    ? '—'
                    : `${totalDamageGainPercent > 0 ? '+' : ''}${totalDamageGainPercent.toFixed(1)}%`}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">差价成本:</span>
              <span className="text-yellow-400">
                ¥{' '}
                {diffPrice > 0
                  ? `+${Number(diffPrice.toFixed(2))}`
                  : Number(diffPrice.toFixed(2))}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">1点法伤成本:</span>
              <span className="text-yellow-400">
                {isServiceUnavailable
                  ? '不可用'
                  : isLoadingLabValuation &&
                      !seatLabValuation?.comparison &&
                      magicDamageCostDisplay === '-'
                    ? '计算中'
                    : magicDamageCostDisplay}
              </span>
            </div>
            {marginalWarning ? (
              <div className="flex justify-between gap-3 text-xs">
                <span className="text-slate-400">边际效益:</span>
                <span className="text-amber-300">{marginalWarning}</span>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
