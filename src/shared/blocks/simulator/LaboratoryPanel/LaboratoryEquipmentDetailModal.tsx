'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  Equipment,
  ExperimentSeat,
  RuneStone,
} from '@/features/simulator/store/gameTypes';
import { getVisibleCompareExperimentSeats } from '@/features/simulator/utils/simulatorExperimentSeats';
import { Edit2, X } from 'lucide-react';
import { usePopper } from 'react-popper';

import { AccessoryEffectModifierEditor } from '@/shared/blocks/simulator/AccessoryEffectModifierEditor';
import { EquipmentImprovementSummaryCard } from '@/shared/blocks/simulator/EquipmentSummary/EquipmentImprovementSummaryCard';
import { GemstoneEditor } from '@/shared/blocks/simulator/GemstoneEditor';
import { useEquipmentExtensionConfigs } from '@/shared/blocks/simulator/use-equipment-extension-configs';
import { useSimulatorStarResonanceRules } from '@/shared/blocks/simulator/use-star-resonance-rules';
import { getSimulatorEquipmentDisplayImageUrl } from '@/shared/lib/simulator-equipment-artwork';
import {
  formatSimulatorEquipmentStatValue,
  getSimulatorEquipmentInitialValueEntries,
} from '@/shared/lib/simulator-equipment-editor';
import {
  buildEquipmentImprovementDiffSummary,
  buildEquipmentImprovementSummary,
} from '@/shared/lib/simulator-equipment-improvement-summary';
import { buildEquipmentRuleInsights } from '@/shared/lib/simulator-equipment-rule-insights';
import { getEquipmentSpotlightTags } from '@/shared/lib/simulator-equipment-spotlight';
import { resolveJadeAttributePoolForSlot } from '@/shared/lib/simulator-jade-attribute-pool';
import { parseRegularSetRulesConfig } from '@/shared/lib/simulator-regular-set';
import {
  applySimulatorRuneSetSelection,
  ensureSimulatorEquipmentRuneEditingState,
  getSimulatorRuneSetOptions,
  isSimulatorPrimaryEquipment,
} from '@/shared/lib/simulator-rune-editor';
import {
  applySimulatorRecommendedRunePlan,
  buildSimulatorRecommendedRunePlan,
  getSimulatorRuneStoneOptions,
  getSimulatorStarPositionOptions,
  parseRuneComboRulesConfig,
  parseRuneOptimizerProfilesConfig,
  parseRuneStoneRulesConfig,
  parseStarStoneRulesConfig,
  shouldAutoApplySimulatorRecommendedRunePlan,
} from '@/shared/lib/simulator-rune-star-rules';
import { getSimulatorStatLabel } from '@/shared/lib/simulator-stat-labels';
import type { SimulatorEquipmentLibrarySourceKind } from '@/shared/lib/simulator-equipment-library';

import {
  cloneEquipmentForEditor,
  getSeatDisplayName,
} from './laboratory-utils';

type Props = {
  equipment: Equipment;
  experimentSeats: ExperimentSeat[];
  formatPrice: (price: number | undefined) => string;
  sourceLabels?: string[];
  sourceKinds?: SimulatorEquipmentLibrarySourceKind[];
  onRemoveCandidateSource?: (() => void) | null;
  inventoryStatusActions?: {
    activeCount: number;
    inactiveCount: number;
    isUpdating: boolean;
    onRestoreActive: () => void;
    onMarkSold: () => void;
    onMarkDiscarded: () => void;
  } | null;
  onClose: () => void;
  onReplaceCurrent: (equipment: Equipment) => Promise<void> | void;
  onApplyToSeat: (seatId: string, equipment: Equipment) => Promise<void> | void;
};

export function LaboratoryEquipmentDetailModal({
  equipment,
  experimentSeats,
  formatPrice,
  sourceLabels = [],
  sourceKinds = [],
  onRemoveCandidateSource = null,
  inventoryStatusActions = null,
  onClose,
  onReplaceCurrent,
  onApplyToSeat,
}: Props) {
  const [draftEquipment, setDraftEquipment] = useState<Equipment>(
    ensureSimulatorEquipmentRuneEditingState(cloneEquipmentForEditor(equipment))
  );
  const [runePopover, setRunePopover] = useState<{
    type: 'rune' | 'starPosition' | 'starAlignment' | 'luckyHoles' | 'runeSet';
    index?: number;
  } | null>(null);
  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(
    null
  );
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null);
  const {
    options: starAlignmentOptions,
    isLoading: isLoadingStarRules,
    isPrimarySlot: canSelectStarAlignment,
  } = useSimulatorStarResonanceRules(
    isSimulatorPrimaryEquipment(draftEquipment.type)
      ? draftEquipment.type
      : undefined
  );
  const { configs: equipmentExtensionConfigs } = useEquipmentExtensionConfigs([
    'regular_set_rules',
    'jade_attribute_pool',
    'rune_stone_rules',
    'star_stone_rules',
    'rune_combo_rules',
    'rune_optimizer_profiles',
  ]);
  const regularSetRules = useMemo(
    () =>
      parseRegularSetRulesConfig(
        equipmentExtensionConfigs.find(
          (item) => item.configKey === 'regular_set_rules'
        )?.value
      ),
    [equipmentExtensionConfigs]
  );
  const runeStoneRules = useMemo(
    () =>
      parseRuneStoneRulesConfig(
        equipmentExtensionConfigs.find(
          (item) => item.configKey === 'rune_stone_rules'
        )?.value
      ),
    [equipmentExtensionConfigs]
  );
  const starStoneRules = useMemo(
    () =>
      parseStarStoneRulesConfig(
        equipmentExtensionConfigs.find(
          (item) => item.configKey === 'star_stone_rules'
        )?.value
      ),
    [equipmentExtensionConfigs]
  );
  const runeComboRules = useMemo(
    () =>
      parseRuneComboRulesConfig(
        equipmentExtensionConfigs.find(
          (item) => item.configKey === 'rune_combo_rules'
        )?.value
      ),
    [equipmentExtensionConfigs]
  );
  const runeOptimizerProfiles = useMemo(
    () =>
      parseRuneOptimizerProfilesConfig(
        equipmentExtensionConfigs.find(
          (item) => item.configKey === 'rune_optimizer_profiles'
        )?.value
      ),
    [equipmentExtensionConfigs]
  );
  const runeStoneOptions = useMemo(
    () => getSimulatorRuneStoneOptions(runeStoneRules),
    [runeStoneRules]
  );
  const starPositionOptions = useMemo(
    () => getSimulatorStarPositionOptions(starStoneRules),
    [starStoneRules]
  );
  const runeSetOptions = useMemo(
    () => getSimulatorRuneSetOptions(draftEquipment, runeComboRules),
    [draftEquipment, runeComboRules]
  );
  const recommendedRunePlan = useMemo(
    () =>
      isSimulatorPrimaryEquipment(draftEquipment.type)
        ? buildSimulatorRecommendedRunePlan(draftEquipment, {
            runeStoneRules,
            runeComboRules,
            optimizerProfiles: runeOptimizerProfiles,
          })
        : null,
    [draftEquipment, runeComboRules, runeOptimizerProfiles, runeStoneRules]
  );
  const jadeAttributePool = useMemo(
    () =>
      draftEquipment.type === 'jade'
        ? resolveJadeAttributePoolForSlot({
            value: equipmentExtensionConfigs.find(
              (item) => item.configKey === 'jade_attribute_pool'
            )?.value,
            slot: draftEquipment.slot,
          })
        : null,
    [draftEquipment.slot, draftEquipment.type, equipmentExtensionConfigs]
  );
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: 'bottom-start',
    strategy: 'fixed',
    modifiers: [
      { name: 'preventOverflow', options: { padding: 8 } },
      {
        name: 'flip',
        options: {
          fallbackPlacements: ['top-start', 'right-start', 'left-start'],
        },
      },
      { name: 'offset', options: { offset: [0, 4] } },
    ],
  });

  useEffect(() => {
    setDraftEquipment(
      ensureSimulatorEquipmentRuneEditingState(cloneEquipmentForEditor(equipment))
    );
    setRunePopover(null);
  }, [equipment]);

  useEffect(() => {
    if (!recommendedRunePlan || !shouldAutoApplySimulatorRecommendedRunePlan(draftEquipment)) {
      return;
    }

    setDraftEquipment((current) =>
      applySimulatorRecommendedRunePlan(current, recommendedRunePlan)
    );
  }, [draftEquipment, recommendedRunePlan]);

  const visibleCompareSeats = useMemo(
    () => getVisibleCompareExperimentSeats(experimentSeats),
    [experimentSeats]
  );
  const initialValueEntries = useMemo(
    () => getSimulatorEquipmentInitialValueEntries(draftEquipment),
    [draftEquipment]
  );
  const ruleInsights = useMemo(
    () =>
      buildEquipmentRuleInsights(draftEquipment, {
        regularSetRules,
      }),
    [draftEquipment, regularSetRules]
  );
  const spotlightTags = useMemo(
    () => getEquipmentSpotlightTags(draftEquipment),
    [draftEquipment]
  );
  const sampleSlotEquipment = useMemo(() => {
    const sampleSeat = experimentSeats.find((seat) => seat.isSample);
    if (!sampleSeat) {
      return null;
    }

    return (
      sampleSeat.equipment.find(
        (item) =>
          item.type === draftEquipment.type &&
          Number(item.slot ?? -1) === Number(draftEquipment.slot ?? -1)
      ) ??
      sampleSeat.equipment.find((item) => item.type === draftEquipment.type) ??
      null
    );
  }, [draftEquipment.slot, draftEquipment.type, experimentSeats]);
  const improvementSummary = useMemo(
    () => buildEquipmentImprovementSummary(draftEquipment),
    [draftEquipment]
  );
  const improvementDiffSummary = useMemo(
    () =>
      buildEquipmentImprovementDiffSummary(draftEquipment, sampleSlotEquipment),
    [draftEquipment, sampleSlotEquipment]
  );
  const sourceKindLabels = useMemo(() => {
    return sourceKinds.map((sourceKind) => {
      if (sourceKind === 'inventory_asset') {
        return '正式库存来源';
      }
      if (sourceKind === 'current_plan') {
        return '当前方案来源';
      }
      if (sourceKind === 'equipment_plan') {
        return '其他方案来源';
      }
      return '候选装备库来源';
    });
  }, [sourceKinds]);

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-slate-950/95 p-5">
      <div className="mb-4 flex flex-shrink-0 items-center justify-between">
        <h3 className="font-bold text-yellow-100">装备详情 & 挂载</h3>
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-sm text-yellow-400 hover:text-yellow-300"
        >
          <X className="h-5 w-5" /> 返回
        </button>
      </div>

      <div className="custom-scrollbar mb-4 flex-1 overflow-y-auto">
        <div className="space-y-3">
          <div className="rounded-xl border border-yellow-800/40 bg-slate-900 p-4">
            <div className="flex gap-6">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-yellow-800/30 bg-slate-950/50">
                <img
                  src={getSimulatorEquipmentDisplayImageUrl(draftEquipment)}
                  alt={draftEquipment.name}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <div className="text-2xl font-bold text-yellow-400">
                    {draftEquipment.name}
                  </div>
                  <div className="rounded border border-green-600/50 bg-green-900/20 px-2 py-0.5 text-[10px] font-medium text-green-400">
                    已入库
                  </div>
                </div>

                {spotlightTags.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {spotlightTags.map((highlight, index) => (
                        <span
                          key={index}
                          className="rounded border border-red-500/50 px-2 py-0.5 text-xs font-medium text-red-400"
                        >
                          {highlight}
                        </span>
                      ))}
                    </div>
                  )}

                {draftEquipment.description && (
                  <div className="mb-2 text-sm leading-relaxed text-slate-300">
                    {draftEquipment.description}
                  </div>
                )}

                {draftEquipment.equippableRoles && (
                  <div>
                    <span className="text-xs text-green-400">【装备角色】</span>
                    <span className="ml-1 text-xs text-slate-300">
                      {draftEquipment.equippableRoles}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-col gap-3 border-l border-yellow-800/30 pl-6">
                <div className="text-right">
                  <div className="mb-1 text-[10px] text-slate-500">售价</div>
                  <div className="text-xl font-bold text-[#fff064]">
                    ¥ {formatPrice(draftEquipment.price)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="mb-1 text-[10px] text-slate-500">
                    跨服费用
                  </div>
                  <div className="text-xl font-bold text-[#fff064]">
                    ¥ {formatPrice(draftEquipment.crossServerFee)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-yellow-800/40 bg-slate-900 p-4">
            <div className="mb-3 flex gap-6">
              {draftEquipment.level && (
                <div>
                  <span className="text-sm font-bold text-yellow-400">
                    等级 {draftEquipment.level}
                  </span>
                </div>
              )}
              {draftEquipment.element && draftEquipment.element !== '无' && (
                <div>
                  <span className="text-sm text-yellow-400">五行 </span>
                  <span className="text-sm font-bold text-yellow-400">
                    {draftEquipment.element}
                  </span>
                </div>
              )}
            </div>

            <div className="mb-2 text-sm text-yellow-100">
              {draftEquipment.mainStat}
            </div>

            {initialValueEntries.length > 0 && (
              <div className="mb-2 rounded-lg border border-yellow-800/30 bg-slate-950/40 p-3">
                <div className="mb-2 text-xs font-bold text-yellow-400">
                  初值
                </div>
                <div className="flex flex-wrap gap-2">
                  {initialValueEntries.map((entry) => (
                    <div
                      key={entry.key}
                      className="rounded border border-slate-700/70 bg-slate-900/70 px-2 py-1 text-xs"
                    >
                      <span className="text-slate-400">{entry.label}</span>
                      <span className="ml-1 font-medium text-yellow-100">
                        {entry.value > 0 ? '+' : ''}
                        {formatSimulatorEquipmentStatValue(entry.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {draftEquipment.durability && (
              <div className="text-sm text-slate-300">
                耐久度 {draftEquipment.durability}
              </div>
            )}

            {draftEquipment.forgeLevel !== undefined &&
              draftEquipment.gemstone && (
                <>
                  <div className="mt-1 text-sm text-slate-300">
                    {draftEquipment.type === 'trinket'
                      ? '星辉石等级 '
                      : draftEquipment.type === 'jade'
                        ? '玉魄阶数 '
                        : '锻炼等级 '}
                    {draftEquipment.forgeLevel}
                  </div>
                  {draftEquipment.type !== 'jade' && (
                    <div className="mt-1 text-sm text-slate-300">
                      <span className="text-slate-300">镶嵌宝石 </span>
                      <span className="text-red-400">
                        {draftEquipment.gemstone}
                      </span>
                    </div>
                  )}
                </>
              )}

            {draftEquipment.extraStat && (
              <div className="mt-1 text-sm text-green-400">
                {draftEquipment.extraStat}
              </div>
            )}
          </div>

          <EquipmentImprovementSummaryCard
            summary={improvementSummary}
            diffSummary={improvementDiffSummary}
          />

          {(sourceLabels.length > 0 || sourceKindLabels.length > 0) && (
            <div className="rounded-xl border border-sky-800/40 bg-slate-900 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-sky-100">来源归属</div>
                  <div className="mt-1 text-xs text-slate-400">
                    这件装备当前在哪些方案或库存上下文中被引用，会直接影响总库筛选与后续操作语义。
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {inventoryStatusActions ? (
                    <>
                      {inventoryStatusActions.inactiveCount > 0 ? (
                        <button
                          type="button"
                          disabled={inventoryStatusActions.isUpdating}
                          onClick={inventoryStatusActions.onRestoreActive}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            inventoryStatusActions.isUpdating
                              ? 'cursor-not-allowed border-slate-700/60 bg-slate-900/60 text-slate-500'
                              : 'border-sky-500/40 bg-sky-950/40 text-sky-100 hover:bg-sky-900/40'
                          }`}
                        >
                          恢复待用
                        </button>
                      ) : null}
                      {inventoryStatusActions.activeCount > 0 ? (
                        <>
                          <button
                            type="button"
                            disabled={inventoryStatusActions.isUpdating}
                            onClick={inventoryStatusActions.onMarkSold}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                              inventoryStatusActions.isUpdating
                                ? 'cursor-not-allowed border-slate-700/60 bg-slate-900/60 text-slate-500'
                                : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/40'
                            }`}
                          >
                            标记已售出
                          </button>
                          <button
                            type="button"
                            disabled={inventoryStatusActions.isUpdating}
                            onClick={inventoryStatusActions.onMarkDiscarded}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                              inventoryStatusActions.isUpdating
                                ? 'cursor-not-allowed border-slate-700/60 bg-slate-900/60 text-slate-500'
                                : 'border-rose-500/40 bg-rose-950/30 text-rose-100 hover:bg-rose-900/40'
                            }`}
                          >
                            标记作废
                          </button>
                        </>
                      ) : null}
                    </>
                  ) : null}
                  {onRemoveCandidateSource ? (
                    <button
                      type="button"
                      onClick={onRemoveCandidateSource}
                      className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-1.5 text-xs font-medium text-rose-100 transition-colors hover:bg-rose-900/40"
                    >
                      移出候选库
                    </button>
                  ) : null}
                </div>
              </div>

              {sourceLabels.length > 0 && (
                <div className="mb-3">
                  <div className="mb-2 text-xs font-medium text-sky-300">
                    具体来源
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sourceLabels.map((sourceLabel) => (
                      <span
                        key={`${draftEquipment.id}-source-${sourceLabel}`}
                        className="rounded border border-sky-700/40 bg-sky-950/30 px-2 py-1 text-xs text-sky-100"
                      >
                        {sourceLabel}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {sourceKindLabels.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-medium text-sky-300">
                    来源类型
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sourceKindLabels.map((label) => (
                      <span
                        key={`${draftEquipment.id}-source-kind-${label}`}
                        className="rounded border border-violet-700/40 bg-violet-950/30 px-2 py-1 text-xs text-violet-100"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {inventoryStatusActions ? (
                <div className="mt-3 rounded-lg border border-emerald-800/30 bg-emerald-950/10 p-3">
                  <div className="text-xs font-medium text-emerald-300">
                    正式库存状态动作
                  </div>
                  <div className="mt-1 text-xs leading-relaxed text-slate-300">
                    当前有 {inventoryStatusActions.activeCount}{' '}
                    条候选入库生成的正式库存记录可直接标记售出/作废，另有{' '}
                    {inventoryStatusActions.inactiveCount}{' '}
                    条失效记录可恢复为库存待用。“已售出 / 已作废”的正式库存不会进入换装弹窗或实验室席位选择器；恢复待用后会重新进入这两条链路。所有动作都会同步回写关联候选来源，但不会删除方案内或实验席位里的其他引用。
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {ruleInsights.length > 0 && (
            <div className="rounded-xl border border-cyan-800/40 bg-slate-900 p-4">
              <div className="mb-3 text-sm font-bold text-cyan-100">
                规则解释
              </div>
              <div className="space-y-2">
                {ruleInsights.map((insight) => (
                  <div
                    key={insight.id}
                    className={`rounded-lg border px-3 py-3 ${
                      insight.tone === 'success'
                        ? 'border-emerald-700/40 bg-emerald-950/20'
                        : insight.tone === 'warning'
                          ? 'border-amber-700/40 bg-amber-950/20'
                          : 'border-slate-700/60 bg-slate-950/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div
                        className={`text-sm font-semibold ${
                          insight.tone === 'success'
                            ? 'text-emerald-300'
                            : insight.tone === 'warning'
                              ? 'text-amber-300'
                              : 'text-cyan-100'
                        }`}
                      >
                        {insight.title}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {insight.tone === 'success'
                          ? '已命中'
                          : insight.tone === 'warning'
                            ? '需注意'
                            : '已记录'}
                      </div>
                    </div>
                    <div className="mt-1 text-sm text-slate-200">
                      {insight.summary}
                    </div>
                    {insight.details.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {insight.details.map((detail) => (
                          <div
                            key={`${insight.id}-${detail}`}
                            className="text-[11px] text-slate-400"
                          >
                            {detail}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {draftEquipment.type !== 'trinket' &&
            draftEquipment.type !== 'jade' && (
              <GemstoneEditor
                equipment={draftEquipment}
                onChange={setDraftEquipment}
                title="宝石编辑"
              />
            )}

          {draftEquipment.type === 'trinket' &&
            draftEquipment.specialEffect && (
              <div className="space-y-2 rounded-xl border border-yellow-800/40 bg-slate-900 p-4">
                <div className="text-sm text-purple-400">
                  特效：{draftEquipment.specialEffect}
                </div>
              </div>
            )}

          {draftEquipment.type === 'jade' && (
            <AccessoryEffectModifierEditor
              equipment={draftEquipment}
              onChange={setDraftEquipment}
              allowedCodes={jadeAttributePool?.allowedModifierCodes}
              poolDescription={
                jadeAttributePool?.allowedModifierCodes.length
                  ? `当前槽位允许的百分比词条：${jadeAttributePool.allowedModifierCodes.join(
                      ' / '
                    )}`
                  : jadeAttributePool?.description
              }
            />
          )}

          {draftEquipment.type !== 'trinket' &&
            draftEquipment.type !== 'jade' &&
            draftEquipment.runeStoneSets &&
            draftEquipment.runeStoneSets.length > 0 && (
              <div className="space-y-2 rounded-xl border border-yellow-800/40 bg-slate-900 p-4">
                {recommendedRunePlan && (
                  <div className="rounded-lg border border-cyan-700/40 bg-cyan-950/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-cyan-100">
                          默认最优符石
                        </div>
                        <div className="mt-1 text-xs text-cyan-200/90">
                          推荐组合：{recommendedRunePlan.comboName}
                          {recommendedRunePlan.tier
                            ? ` · ${recommendedRunePlan.tier}级`
                            : ''}
                        </div>
                        <div className="mt-1 text-xs text-cyan-300/80">
                          {recommendedRunePlan.expectedDeltaLabel}
                        </div>
                        <div className="mt-1 text-xs text-cyan-300/70">
                          {recommendedRunePlan.reason}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rounded-md border border-cyan-500/40 px-3 py-1 text-xs text-cyan-100 transition-colors hover:bg-cyan-500/10"
                        onClick={() =>
                          setDraftEquipment((current) =>
                            applySimulatorRecommendedRunePlan(
                              current,
                              recommendedRunePlan
                            )
                          )
                        }
                      >
                        重新推荐
                      </button>
                    </div>
                  </div>
                )}

                <div className="relative">
                  <div
                    ref={
                      runePopover?.type === 'luckyHoles'
                        ? setReferenceElement
                        : null
                    }
                    className="-mx-2 inline-flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm text-green-400 transition-colors hover:bg-slate-800/80"
                    onClick={() => setRunePopover({ type: 'luckyHoles' })}
                  >
                    开运孔数：{draftEquipment.luckyHoles || '0'}
                    <Edit2 className="h-3 w-3 text-green-400/60" />
                  </div>

                  {runePopover?.type === 'luckyHoles' && (
                    <div
                      ref={setPopperElement}
                      style={{ ...styles.popper, zIndex: 9999 }}
                      {...attributes.popper}
                      className="w-32 overflow-hidden rounded-lg border border-yellow-700/50 bg-slate-800 shadow-xl"
                    >
                      <div className="p-1">
                        <div className="mb-1 border-b border-yellow-900/30 px-2 py-1.5 text-xs text-yellow-500/80">
                          选择孔数
                        </div>
                        {[0, 1, 2, 3, 4, 5].map((num) => (
                          <div
                            key={num}
                            className="cursor-pointer rounded px-3 py-2 text-sm text-green-400 transition-colors hover:bg-slate-700"
                            onClick={() => {
                              const nextEquipment = {
                                ...draftEquipment,
                                luckyHoles: num.toString(),
                              };

                              if (
                                nextEquipment.runeStoneSets &&
                                nextEquipment.runeStoneSets.length > 0
                              ) {
                                nextEquipment.runeStoneSets = [
                                  ...nextEquipment.runeStoneSets,
                                ];
                                const currentRunes = [
                                  ...(nextEquipment.runeStoneSets[0] || []),
                                ];

                                if (num < currentRunes.length) {
                                  nextEquipment.runeStoneSets[0] =
                                    currentRunes.slice(0, num);
                                } else if (num > currentRunes.length) {
                                  while (
                                    nextEquipment.runeStoneSets[0].length < num
                                  ) {
                                    nextEquipment.runeStoneSets[0].push({
                                      id: `empty_rune_${nextEquipment.runeStoneSets[0].length + 1}`,
                                      name: '未配置符石',
                                      type: 'empty',
                                      stats: {},
                                    });
                                  }
                                }
                              }

                              setDraftEquipment(nextEquipment);
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
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setRunePopover(null)}
                  />
                )}

                {draftEquipment.runeStoneSets[0].map(
                  (stone: RuneStone, index: number) => (
                    <div key={index} className="relative">
                      <div
                        ref={
                          runePopover?.type === 'rune' &&
                          runePopover.index === index
                            ? setReferenceElement
                            : null
                        }
                        className="-mx-2 inline-flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm text-green-400 transition-colors hover:bg-slate-800/80"
                        onClick={() => setRunePopover({ type: 'rune', index })}
                      >
                        <span>
                          符石{index + 1}：{stone.name || ''}{' '}
                          {Object.entries(stone.stats)
                            .map(
                              ([key, value]) =>
                                `${getSimulatorStatLabel(key)} +${value}`
                            )
                            .join(' ')}
                        </span>
                        <Edit2 className="h-3 w-3 text-green-400/60" />
                      </div>

                      {runePopover?.type === 'rune' &&
                        runePopover.index === index && (
                          <div
                            ref={setPopperElement}
                            style={{ ...styles.popper, zIndex: 9999 }}
                            {...attributes.popper}
                            className="w-64 overflow-hidden rounded-lg border border-yellow-700/50 bg-slate-800 shadow-xl"
                          >
                            <div className="custom-scrollbar max-h-60 overflow-y-auto p-1">
                              <div className="mb-1 border-b border-yellow-900/30 px-2 py-1.5 text-xs text-yellow-500/80">
                                选择要替换的符石
                              </div>
                              {runeStoneOptions.map((rune) => (
                                <div
                                  key={rune.id}
                                  className="flex cursor-pointer items-center justify-between rounded px-3 py-2 text-sm transition-colors hover:bg-slate-700"
                                  onClick={() => {
                                    const nextEquipment = {
                                      ...draftEquipment,
                                    };
                                    nextEquipment.runeStoneSets = [
                                      ...(nextEquipment.runeStoneSets ?? []),
                                    ];
                                    nextEquipment.runeStoneSets[0] = [
                                      ...(nextEquipment.runeStoneSets[0] ?? []),
                                    ];
                                    nextEquipment.runeStoneSets[0][index] = {
                                      ...rune,
                                    };
                                    setDraftEquipment(nextEquipment);
                                    setRunePopover(null);
                                  }}
                                >
                                  <span className="font-medium text-green-400">
                                    {rune.name}
                                  </span>
                                  <span className="text-xs text-slate-300">
                                    {Object.entries(rune.stats)
                                      .map(
                                        ([key, value]) =>
                                          `${getSimulatorStatLabel(key)} +${value}`
                                      )
                                      .join(' ')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  )
                )}

                <div className="relative">
                  <div
                    ref={
                      runePopover?.type === 'starPosition'
                        ? setReferenceElement
                        : null
                    }
                    className="-mx-2 inline-flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm text-green-400 transition-colors hover:bg-slate-800/80"
                    onClick={() => setRunePopover({ type: 'starPosition' })}
                  >
                    星位：{draftEquipment.starPosition || '无'}
                    <Edit2 className="h-3 w-3 text-green-400/60" />
                  </div>

                  {runePopover?.type === 'starPosition' && (
                    <div
                      ref={setPopperElement}
                      style={{ ...styles.popper, zIndex: 9999 }}
                      {...attributes.popper}
                      className="w-48 overflow-hidden rounded-lg border border-yellow-700/50 bg-slate-800 shadow-xl"
                    >
                      <div className="custom-scrollbar max-h-60 overflow-y-auto p-1">
                        <div className="mb-1 border-b border-yellow-900/30 px-2 py-1.5 text-xs text-yellow-500/80">
                          选择星位属性
                        </div>
                        {starPositionOptions.map((option) => (
                          <div
                            key={option.id}
                            className="cursor-pointer rounded px-3 py-2 transition-colors hover:bg-slate-700"
                            onClick={() => {
                              setDraftEquipment({
                                ...draftEquipment,
                                starPosition: option.label,
                                starPositionConfig:
                                  option.id === 'none'
                                    ? undefined
                                    : { ...option },
                              });
                              setRunePopover(null);
                            }}
                          >
                            <div className="text-sm text-green-400">
                              {option.label}
                            </div>
                            {option.attrType && (
                              <div className="mt-1 text-[11px] text-slate-400">
                                {option.attrType} · {option.attrValue}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative">
                  {canSelectStarAlignment && (
                    <div
                      ref={
                        runePopover?.type === 'starAlignment'
                          ? setReferenceElement
                          : null
                      }
                      className="-mx-2 inline-flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm text-green-400 transition-colors hover:bg-slate-800/80"
                      onClick={() => setRunePopover({ type: 'starAlignment' })}
                    >
                      星相互合：{draftEquipment.starAlignment || '无'}
                      <Edit2 className="h-3 w-3 text-green-400/60" />
                    </div>
                  )}

                  {runePopover?.type === 'starAlignment' &&
                    canSelectStarAlignment && (
                      <div
                        ref={setPopperElement}
                        style={{ ...styles.popper, zIndex: 9999 }}
                        {...attributes.popper}
                        className="w-72 overflow-hidden rounded-lg border border-yellow-700/50 bg-slate-800 shadow-xl"
                      >
                        <div className="custom-scrollbar max-h-60 overflow-y-auto p-1">
                          <div className="mb-1 border-b border-yellow-900/30 px-2 py-1.5 text-xs text-yellow-500/80">
                            选择星相互合规则
                          </div>
                          {isLoadingStarRules && (
                            <div className="px-3 py-2 text-xs text-slate-400">
                              读取规则中...
                            </div>
                          )}
                          {starAlignmentOptions.map((option) => (
                            <div
                              key={option.id}
                              className="cursor-pointer rounded px-3 py-2 transition-colors hover:bg-slate-700"
                              onClick={() => {
                                setDraftEquipment({
                                  ...draftEquipment,
                                  starAlignment: option.value,
                                  starAlignmentConfig:
                                    option.id === 'none'
                                      ? undefined
                                      : {
                                          id: option.id,
                                          label: option.value,
                                          attrType: option.attrType,
                                          attrValue: option.attrValue,
                                          comboName: option.title,
                                          colors: option.colors,
                                        },
                                });
                                setRunePopover(null);
                              }}
                            >
                              <div className="text-sm text-green-400">
                                {option.title}
                                <span className="ml-2 text-xs text-slate-400">
                                  {option.value}
                                </span>
                              </div>
                              <div className="mt-1 text-[11px] text-slate-400">
                                {option.description}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>

                {draftEquipment.runeStoneSetsNames &&
                  draftEquipment.runeStoneSetsNames.length > 0 && (
                    <div className="relative">
                      <div
                        ref={
                          runePopover?.type === 'runeSet'
                            ? setReferenceElement
                            : null
                        }
                        className="-mx-2 mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm text-purple-400 transition-colors hover:bg-slate-800/80"
                        onClick={() => setRunePopover({ type: 'runeSet' })}
                      >
                        符石组合：
                        {draftEquipment.runeStoneSetsNames[0]}
                        <Edit2 className="h-3 w-3 text-purple-400/60" />
                      </div>

                      {runePopover?.type === 'runeSet' && (
                        <div
                          ref={setPopperElement}
                          style={{ ...styles.popper, zIndex: 9999 }}
                          {...attributes.popper}
                          className="w-48 overflow-hidden rounded-lg border border-yellow-700/50 bg-slate-800 shadow-xl"
                        >
                          <div className="custom-scrollbar max-h-60 overflow-y-auto p-1">
                            <div className="mb-1 border-b border-yellow-900/30 px-2 py-1.5 text-xs text-yellow-500/80">
                              选择符石组合
                            </div>
                            {runeSetOptions.map((runeSetName, index) => (
                              <div
                                key={index}
                                className="cursor-pointer rounded px-3 py-2 text-sm text-purple-400 transition-colors hover:bg-slate-700"
                                onClick={() => {
                                  setDraftEquipment((current) =>
                                    ensureSimulatorEquipmentRuneEditingState(
                                      applySimulatorRuneSetSelection(
                                        current,
                                        runeSetName,
                                        {
                                          runeStoneRules,
                                          runeComboRules,
                                          optimizerProfiles:
                                            runeOptimizerProfiles,
                                        }
                                      )
                                    )
                                  );
                                  setRunePopover(null);
                                }}
                              >
                                {runeSetName}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
              </div>
            )}
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-yellow-800/30 pt-4">
        <div className="mb-3 text-sm font-bold text-yellow-100">
          选择挂载位置：
        </div>
        <div className="custom-scrollbar flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={async () => {
              await onReplaceCurrent(draftEquipment);
              onClose();
            }}
            className="flex w-[calc(100%/6)] min-w-[140px] flex-shrink-0 flex-col items-center justify-center rounded-lg border border-yellow-600/40 bg-yellow-900/30 p-3 text-center transition-colors hover:bg-yellow-900/50"
          >
            <span className="text-sm font-medium text-yellow-100">
              替换到【当前状态】
            </span>
          </button>

          {visibleCompareSeats.map((seat) => (
            <button
              key={seat.id}
              onClick={async () => {
                await onApplyToSeat(seat.id, draftEquipment);
                onClose();
              }}
              className="flex w-[calc(100%/6)] min-w-[140px] flex-shrink-0 flex-col items-center justify-center rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-center transition-colors hover:bg-slate-800/80"
            >
              <span className="text-sm text-slate-200">
                挂载到【{getSeatDisplayName(seat, visibleCompareSeats)}】
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
