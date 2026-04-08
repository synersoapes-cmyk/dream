'use client';

import { computeDerivedStats } from '@/features/simulator/store/gameLogic';
import type {
  BaseAttributes,
  Equipment,
  ExperimentSeat,
  Treasure,
} from '@/features/simulator/store/gameTypes';

import {
  getSimulatorSlotLabel,
  matchesSimulatorSlotDefinition,
  SIMULATOR_RUNE_STONE_SLOT_DEFINITIONS,
} from '@/shared/lib/simulator-slot-config';
import type { LabValuationSeatResult } from '@/shared/services/lab-valuation';

import {
  calculateEquipmentTotalStats,
  getFallbackSeatTotalDamage,
  getSeatDisplayName,
  LABORATORY_ATTRIBUTE_LIST,
  summarizeEquipmentEffects,
} from './laboratory-utils';

type Props = {
  experimentSeats: ExperimentSeat[];
  sampleEquipment: Equipment[];
  baseAttributes: BaseAttributes;
  treasure: Treasure | null;
  labValuationBySeatId: Record<string, LabValuationSeatResult>;
  labValuationError: string | null;
  isLoadingLabValuation: boolean;
};

type TableSeatData = {
  seat: ExperimentSeat;
  seatEquip: Equipment[];
  totals: Record<string, number>;
  totalPrice: number;
  seatCombatStats: ReturnType<typeof computeDerivedStats>;
  seatLabValuation?: LabValuationSeatResult;
};

export function LaboratoryComparisonTable({
  experimentSeats,
  sampleEquipment,
  baseAttributes,
  treasure,
  labValuationBySeatId,
  labValuationError,
  isLoadingLabValuation,
}: Props) {
  const displaySeats = experimentSeats.slice(0, 2);
  const allSeatsData: TableSeatData[] = displaySeats.map((seat) => {
    const seatEquip = seat.isSample ? sampleEquipment : seat.equipment;
    const { totals, totalPrice } = calculateEquipmentTotalStats(seatEquip);
    const seatCombatStats = computeDerivedStats(
      baseAttributes,
      seatEquip,
      treasure
    );
    const seatLabValuation = labValuationBySeatId[seat.id];

    return {
      seat,
      seatEquip,
      totals,
      totalPrice,
      seatCombatStats,
      seatLabValuation,
    };
  });

  const sampleSeatData = allSeatsData[0];

  return (
    <div className="flex-1 overflow-auto rounded-xl border border-yellow-800/40 bg-slate-900/60 p-4">
      <div className="flex h-full flex-col space-y-4">
        <h3 className="flex-shrink-0 text-sm font-bold text-yellow-400">
          明细属性对比
        </h3>

        <div className="flex-1 overflow-auto rounded-lg border border-yellow-800/30 bg-slate-900/40">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0">
              <tr className="bg-slate-800/80">
                <th className="w-24 border-r border-yellow-800/30 p-2.5 text-left text-xs font-bold text-yellow-400">
                  属性
                </th>
                {allSeatsData.map(({ seat }) => (
                  <th
                    key={seat.id}
                    className={`p-2.5 text-center text-xs font-bold ${seat.isSample ? 'text-yellow-500' : 'text-yellow-100'}`}
                  >
                    {getSeatDisplayName(seat, experimentSeats)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LABORATORY_ATTRIBUTE_LIST.map((attr) => {
                const sampleValue = attr.isBase
                  ? Number(
                      baseAttributes[attr.key as keyof typeof baseAttributes] ??
                        0
                    ) + (sampleSeatData?.totals[attr.key] || 0)
                  : sampleSeatData?.seatCombatStats[
                      attr.key as keyof typeof sampleSeatData.seatCombatStats
                    ] || 0;

                return (
                  <tr
                    key={attr.key}
                    className="border-b border-yellow-800/10 hover:bg-slate-800/20"
                  >
                    <td className="border-r border-yellow-800/20 p-2.5 text-xs font-medium text-slate-300">
                      {attr.label}
                    </td>
                    {allSeatsData.map(
                      ({ seat, totals, seatCombatStats }, index) => {
                        const currentValue = attr.isBase
                          ? Number(
                              baseAttributes[
                                attr.key as keyof typeof baseAttributes
                              ] ?? 0
                            ) + (totals[attr.key] || 0)
                          : seatCombatStats[
                              attr.key as keyof typeof seatCombatStats
                            ] || 0;

                        const diff =
                          index === 0 ? 0 : currentValue - sampleValue;
                        const isUnchanged = diff === 0 && index !== 0;
                        const isPositive = diff > 0;
                        const isNegative = diff < 0;

                        return (
                          <td
                            key={seat.id}
                            className="p-2.5 text-center text-xs"
                          >
                            {isUnchanged ? (
                              <span className="text-slate-500">—</span>
                            ) : (
                              <div className="flex flex-col items-center gap-0.5">
                                <div
                                  className={
                                    seat.isSample
                                      ? 'font-bold text-yellow-100'
                                      : 'text-slate-200'
                                  }
                                >
                                  {Math.round(currentValue)}
                                </div>
                                {index !== 0 && !isUnchanged && (
                                  <div
                                    className={`text-[10px] font-medium ${isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-slate-500'}`}
                                  >
                                    {isPositive ? '+' : ''}
                                    {Math.round(diff)}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      }
                    )}
                  </tr>
                );
              })}

              <tr className="bg-slate-800/60">
                <td colSpan={allSeatsData.length + 1} className="p-0"></td>
              </tr>

              {SIMULATOR_RUNE_STONE_SLOT_DEFINITIONS.map((slotDef) => (
                <tr
                  key={slotDef.id}
                  className="border-b border-yellow-800/10 hover:bg-slate-800/20"
                >
                  <td className="border-r border-yellow-800/20 p-2.5 text-xs font-medium text-slate-300">
                    {getSimulatorSlotLabel(slotDef, 'runeStone')}
                    符石
                  </td>
                  {allSeatsData.map(({ seat, seatEquip }, index) => {
                    const equipment = seatEquip.find((item) =>
                      matchesSimulatorSlotDefinition(slotDef, item)
                    );
                    const runeSetName = equipment?.runeStoneSetsNames?.[0];

                    const sampleSlotEquipment = sampleSeatData?.seatEquip.find(
                      (item) => matchesSimulatorSlotDefinition(slotDef, item)
                    );
                    const sampleRuneSetName =
                      sampleSlotEquipment?.runeStoneSetsNames?.[0];
                    const isDifferent =
                      index !== 0 && runeSetName !== sampleRuneSetName;

                    return (
                      <td key={seat.id} className="p-2.5 text-center text-xs">
                        <div
                          className={`${seat.isSample ? 'font-bold text-purple-400' : isDifferent ? 'text-purple-300' : 'text-slate-400'}`}
                        >
                          {runeSetName || '无'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}

              <tr className="bg-slate-800/60">
                <td colSpan={allSeatsData.length + 1} className="p-0"></td>
              </tr>

              <tr className="border-b border-yellow-800/10 hover:bg-slate-800/20">
                <td className="border-r border-yellow-800/20 p-2.5 text-xs font-medium text-slate-300">
                  符石套装效果
                </td>
                {allSeatsData.map(({ seat, seatEquip }, index) => {
                  const runeSetEffect =
                    summarizeEquipmentEffects(seatEquip, {
                      includeRuneSetName: true,
                      includeRuneSetEffect: true,
                    }) || '无';
                  const sampleRuneSetEffect =
                    summarizeEquipmentEffects(sampleSeatData?.seatEquip || [], {
                      includeRuneSetName: true,
                      includeRuneSetEffect: true,
                    }) || '无';
                  const isDifferent =
                    index !== 0 && runeSetEffect !== sampleRuneSetEffect;

                  return (
                    <td key={seat.id} className="p-2.5 text-center text-xs">
                      <div
                        className={`${seat.isSample ? 'font-bold text-orange-400' : isDifferent ? 'text-orange-300' : 'text-slate-400'}`}
                      >
                        {runeSetEffect}
                      </div>
                    </td>
                  );
                })}
              </tr>

              <tr className="border-b border-yellow-800/10 hover:bg-slate-800/20">
                <td className="border-r border-yellow-800/20 p-2.5 text-xs font-medium text-slate-300">
                  灵饰套装效果
                </td>
                {allSeatsData.map(({ seat, seatEquip }, index) => {
                  const trinketSetEffect =
                    summarizeEquipmentEffects(seatEquip, {
                      predicate: (equipment) => equipment.type === 'trinket',
                      includeSetName: true,
                      includeSpecialEffect: true,
                      includeRefinementEffect: true,
                      includeHighlights: true,
                    }) || '无';
                  const sampleTrinketSetEffect =
                    summarizeEquipmentEffects(sampleSeatData?.seatEquip || [], {
                      predicate: (equipment) => equipment.type === 'trinket',
                      includeSetName: true,
                      includeSpecialEffect: true,
                      includeRefinementEffect: true,
                      includeHighlights: true,
                    }) || '无';
                  const isDifferent =
                    index !== 0 && trinketSetEffect !== sampleTrinketSetEffect;

                  return (
                    <td key={seat.id} className="p-2.5 text-center text-xs">
                      <div
                        className={`${seat.isSample ? 'font-bold text-cyan-400' : isDifferent ? 'text-cyan-300' : 'text-slate-400'}`}
                      >
                        {trinketSetEffect}
                      </div>
                    </td>
                  );
                })}
              </tr>

              <tr className="bg-slate-800/60">
                <td colSpan={allSeatsData.length + 1} className="p-0"></td>
              </tr>

              <tr className="border-b border-yellow-800/10 hover:bg-slate-800/20">
                <td className="border-r border-yellow-800/20 p-2.5 text-xs font-medium text-slate-300">
                  服务端总伤
                </td>
                {allSeatsData.map(
                  ({ seat, seatCombatStats, seatLabValuation }, index) => {
                    const isServiceUnavailable =
                      Boolean(labValuationError) && !seatLabValuation;
                    const fallbackTotalDamage =
                      getFallbackSeatTotalDamage(seatCombatStats);
                    const fallbackSampleTotalDamage =
                      getFallbackSeatTotalDamage(
                        sampleSeatData?.seatCombatStats ?? seatCombatStats
                      );
                    const totalDamage =
                      seatLabValuation?.totalDamage ?? fallbackTotalDamage;
                    const sampleTotalDamage =
                      sampleSeatData?.seatLabValuation?.totalDamage ??
                      fallbackSampleTotalDamage;
                    const diff =
                      index === 0 ? 0 : totalDamage - sampleTotalDamage;
                    const isUnchanged = Math.abs(diff) < 0.1 && index !== 0;
                    const isPositive = diff > 0;
                    const isNegative = diff < 0;

                    return (
                      <td key={seat.id} className="p-2.5 text-center text-xs">
                        {isLoadingLabValuation && !seatLabValuation ? (
                          <span className="text-slate-500">计算中</span>
                        ) : isServiceUnavailable ? (
                          <span className="text-amber-300">不可用</span>
                        ) : isUnchanged ? (
                          <span className="text-slate-500">—</span>
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            <div
                              className={
                                seat.isSample
                                  ? 'font-bold text-yellow-100'
                                  : 'text-slate-200'
                              }
                            >
                              {Math.round(totalDamage)}
                            </div>
                            {index !== 0 && !isUnchanged && (
                              <div
                                className={`text-[10px] font-medium ${isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-slate-500'}`}
                              >
                                {isPositive ? '+' : ''}
                                {Math.round(diff)}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  }
                )}
              </tr>

              <tr className="bg-slate-800/60">
                <td colSpan={allSeatsData.length + 1} className="p-0"></td>
              </tr>

              <tr className="border-b border-yellow-800/10 hover:bg-slate-800/20">
                <td className="border-r border-yellow-800/20 p-2.5 text-xs font-medium text-slate-300">
                  总价格
                </td>
                {allSeatsData.map(
                  ({ seat, totalPrice, seatLabValuation }, index) => {
                    const diff =
                      index === 0
                        ? 0
                        : (seatLabValuation?.comparison?.priceDiff ??
                          totalPrice - (sampleSeatData?.totalPrice ?? 0));

                    return (
                      <td key={seat.id} className="p-2.5 text-center text-xs">
                        {seat.isSample ? (
                          <span className="text-slate-500">—</span>
                        ) : (
                          <div
                            className={`${diff > 0 ? 'text-red-400' : diff < 0 ? 'text-green-400' : 'text-slate-500'}`}
                          >
                            {diff === 0
                              ? '—'
                              : `${diff > 0 ? '+' : ''}¥${Math.round(diff)}`}
                          </div>
                        )}
                      </td>
                    );
                  }
                )}
              </tr>

              <tr className="hover:bg-slate-800/20">
                <td className="border-r border-yellow-800/20 p-2.5 text-xs font-medium text-slate-300">
                  1点伤害成本
                </td>
                {allSeatsData.map(
                  ({ seat, totalPrice, seatCombatStats, seatLabValuation }) => {
                    const isServiceUnavailable =
                      Boolean(labValuationError) && !seatLabValuation;
                    if (seat.isSample) {
                      return (
                        <td key={seat.id} className="p-2.5 text-center text-xs">
                          <span className="text-slate-500">—</span>
                        </td>
                      );
                    }

                    const fallbackTotalDamage =
                      getFallbackSeatTotalDamage(seatCombatStats);
                    const fallbackSampleTotalDamage =
                      getFallbackSeatTotalDamage(
                        sampleSeatData?.seatCombatStats ?? seatCombatStats
                      );
                    const totalDamage =
                      seatLabValuation?.totalDamage ?? fallbackTotalDamage;
                    const sampleTotalDamage =
                      sampleSeatData?.seatLabValuation?.totalDamage ??
                      fallbackSampleTotalDamage;
                    const damageDiff = totalDamage - sampleTotalDamage;
                    const priceDiff =
                      seatLabValuation?.comparison?.priceDiff ??
                      totalPrice - (sampleSeatData?.totalPrice ?? 0);
                    const costPerDamage =
                      seatLabValuation?.comparison?.costPerDamage ??
                      (damageDiff > 0 ? priceDiff / damageDiff : 0);
                    const costLabel = seatLabValuation?.comparison?.costLabel;
                    const shouldShowNumericCost =
                      !costLabel || costLabel === '-';

                    return (
                      <td key={seat.id} className="p-2.5 text-center text-xs">
                        {isLoadingLabValuation && !seatLabValuation ? (
                          <span className="text-slate-500">计算中</span>
                        ) : isServiceUnavailable ? (
                          <span className="text-amber-300">不可用</span>
                        ) : costLabel && costLabel !== '-' ? (
                          <span className="text-[#fff064]">{costLabel}</span>
                        ) : damageDiff <= 0 ? (
                          <span className="text-slate-500">—</span>
                        ) : (
                          <div className="text-[#fff064]">
                            {shouldShowNumericCost
                              ? `¥${Math.round(costPerDamage)}`
                              : costLabel}
                          </div>
                        )}
                      </td>
                    );
                  }
                )}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
