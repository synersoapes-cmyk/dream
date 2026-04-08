'use client';

import { computeDerivedStats } from '@/features/simulator/store/gameLogic';
import type {
  BaseAttributes,
  Equipment,
  EquipmentSet,
  ExperimentSeat,
  Treasure,
} from '@/features/simulator/store/gameTypes';
import { getEquipmentDefaultImage } from '@/features/simulator/utils/equipmentImage';
import { Upload } from 'lucide-react';

import { getEquipmentRuneStoneSetInfo } from '@/shared/blocks/simulator/EquipmentPanel/RuneStoneHelper';
import { matchesSimulatorSlotDefinition } from '@/shared/lib/simulator-slot-config';
import { getSimulatorStatLabel } from '@/shared/lib/simulator-stat-labels';
import type { LabValuationSeatResult } from '@/shared/services/lab-valuation';

import {
  calculateEquipmentTotalStats,
  getSeatDisplayName,
  LABORATORY_CATEGORIES,
} from './laboratory-utils';

type LaboratorySelectedSlot = {
  seatId: string;
  slotType: Equipment['type'];
  slotSlot?: number;
  slotLabel: string;
  currentEquip?: Equipment;
};

type Props = {
  seat: ExperimentSeat;
  experimentSeats: ExperimentSeat[];
  sampleEquipment: Equipment[];
  equipmentSets: EquipmentSet[];
  selectedSampleSetIndex: number;
  onSelectedSampleSetIndexChange: (index: number) => void;
  onApplySeat: (seat: ExperimentSeat) => void;
  onSelectSlot: (selection: LaboratorySelectedSlot) => void;
  onClearDetailSelection: () => void;
  baseAttributes: BaseAttributes;
  treasure: Treasure | null;
  baseSampleStats: ReturnType<typeof calculateEquipmentTotalStats>;
  seatLabValuation?: LabValuationSeatResult;
  labValuationError: string | null;
  isLoadingLabValuation: boolean;
};

export function LaboratorySeatCard({
  seat,
  experimentSeats,
  sampleEquipment,
  equipmentSets,
  selectedSampleSetIndex,
  onSelectedSampleSetIndexChange,
  onApplySeat,
  onSelectSlot,
  onClearDetailSelection,
  baseAttributes,
  treasure,
  baseSampleStats,
  seatLabValuation,
  labValuationError,
  isLoadingLabValuation,
}: Props) {
  const seatEquip = seat.isSample ? sampleEquipment : seat.equipment;
  const { totals, totalPrice } = calculateEquipmentTotalStats(seatEquip);
  const seatCombatStats = computeDerivedStats(
    baseAttributes,
    seatEquip,
    treasure
  );
  const baseCombatStats = computeDerivedStats(
    baseAttributes,
    sampleEquipment,
    treasure
  );

  const seatRuneSets = getEquipmentRuneStoneSetInfo(seatEquip);
  const baseRuneSets = getEquipmentRuneStoneSetInfo(sampleEquipment);
  const addedSets = seatRuneSets.filter(
    (value) => !baseRuneSets.includes(value)
  );
  const removedSets = baseRuneSets.filter(
    (value) => !seatRuneSets.includes(value)
  );

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

  const displayDiffs = { ...combatDiffs };
  Object.keys(diffs).forEach((key) => {
    if (!(key in combatDiffs)) {
      displayDiffs[key] = diffs[key];
    }
  });

  let costPerDamageDisplay = seatLabValuation?.comparison?.costLabel || '-';
  if (!seatLabValuation?.comparison && !isServiceUnavailable) {
    if (totalDamageDiff > 0) {
      if (diffPrice > 0) {
        costPerDamageDisplay = `¥ ${(diffPrice / totalDamageDiff).toFixed(1)}`;
      } else {
        costPerDamageDisplay = '收益';
      }
    } else if (totalDamageDiff < 0) {
      if (diffPrice < 0) {
        costPerDamageDisplay = `省 ¥ ${Math.abs(diffPrice / totalDamageDiff).toFixed(1)}`;
      } else {
        costPerDamageDisplay = '纯亏';
      }
    } else {
      costPerDamageDisplay =
        diffPrice > 0 ? '只花钱不提升' : diffPrice < 0 ? '纯省钱' : '-';
    }
  }

  const handleSelectSlot = (selection: LaboratorySelectedSlot) => {
    if (seat.isSample) {
      return;
    }

    onSelectSlot(selection);
    onClearDetailSelection();
  };

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden rounded-xl border border-yellow-800/40 bg-slate-900/60 p-4">
      <div className="mb-3 flex flex-shrink-0 items-center justify-between border-b border-yellow-800/30 pb-2">
        <div className="flex items-center gap-2">
          <h3
            className={`text-sm font-bold ${seat.isSample ? 'text-yellow-500' : 'text-yellow-100'}`}
          >
            {getSeatDisplayName(seat, experimentSeats)}
          </h3>
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
                            currentEquip,
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
                          })
                        }
                        className={`flex items-center gap-2 rounded-lg border border-slate-800/50 bg-slate-900/40 p-2.5 text-xs shadow-sm ${!seat.isSample ? 'cursor-pointer transition-all hover:border-yellow-600/40 hover:bg-slate-900/60' : ''}`}
                      >
                        <span className="w-10 shrink-0 border-r border-slate-700/50 pr-2 text-right text-slate-500">
                          {slotDef.label}
                        </span>
                        <span className="text-slate-600 italic">空</span>
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
                          currentEquip: equipment,
                        })
                      }
                      className={`flex rounded-lg border border-slate-700/80 bg-slate-800/80 p-2.5 text-xs shadow-sm ${!seat.isSample ? 'cursor-pointer transition-all hover:border-yellow-600/60 hover:bg-slate-800' : ''}`}
                    >
                      <span className="mt-0.5 w-10 shrink-0 border-r border-slate-700/50 pr-2 text-right text-slate-400">
                        {slotDef.label}
                      </span>
                      <div className="ml-2 h-8 w-8 shrink-0 overflow-hidden rounded border border-slate-700/50 bg-slate-950/50">
                        <img
                          src={
                            equipment.imageUrl ||
                            getEquipmentDefaultImage(equipment.type)
                          }
                          alt={equipment.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1 pl-2">
                        <div className="flex items-start justify-between">
                          <span className="truncate text-sm font-bold text-yellow-100">
                            {equipment.name}
                          </span>
                          {equipment.price ? (
                            <span className="ml-2 shrink-0 font-bold text-[#fff064]">
                              ¥ {equipment.price}
                            </span>
                          ) : null}
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
                        {getSimulatorStatLabel(key)}:
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
            </div>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 rounded-lg border-t border-yellow-800/30 bg-slate-950/60 p-3">
        {seat.isSample ? (
          <div className="text-center text-xs text-slate-500 italic">
            当前基准
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-yellow-100">服务端总伤提升:</span>
              {isServiceUnavailable ? (
                <span className="text-amber-300">不可用</span>
              ) : (
                <span
                  className={
                    totalDamageDiff > 0
                      ? 'text-green-400'
                      : totalDamageDiff < 0
                        ? 'text-red-400'
                        : 'text-slate-400'
                  }
                >
                  {totalDamageDiff > 0 ? '+' : ''}
                  {Math.round(totalDamageDiff)}
                </span>
              )}
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
              <span className="text-slate-400">单点伤害成本:</span>
              <span className="text-yellow-400">
                {isServiceUnavailable
                  ? '不可用'
                  : isLoadingLabValuation &&
                      !seatLabValuation?.comparison &&
                      costPerDamageDisplay === '-'
                    ? '计算中'
                    : costPerDamageDisplay}
                {!isServiceUnavailable && costPerDamageDisplay.includes('¥')
                  ? ' / 点'
                  : ''}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
