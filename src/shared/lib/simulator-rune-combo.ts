import type { Equipment } from '@/features/simulator/store/gameTypes';

import { normalizeRuneColor } from '@/shared/lib/simulator-equipment-meta';
import {
  DEFAULT_PRD_RUNE_COMBO_RULES,
  type SimulatorRuneComboRule,
  findRuneComboRuleByName,
  getRuneComboDisplayName,
} from '@/shared/lib/simulator-rune-star-rules';

type RuneComboEquipmentLike = Pick<
  Equipment,
  'type' | 'luckyHoles' | 'runeStoneSets' | 'runeStoneSetsNames' | 'activeRuneStoneSet'
>;

export type RuneComboResolution = {
  setName: string;
  normalizedSetName: string;
  isActivated: boolean;
  matchedTier: number | null;
  activeColors: string[];
  reason: 'missing' | 'slot_invalid' | 'color_invalid' | 'activated';
};

export type RuneComboConflict = {
  message: string;
  reason: 'slot_invalid' | 'hole_capacity_conflict' | 'color_invalid';
  matchedTier: number | null;
  holeCount: number;
  rawRuneCount: number;
};

const RUNE_COMBO_TIER_LABELS: Record<number, string> = {
  2: '二级组合',
  3: '三级组合',
  4: '四级组合',
  5: '五级组合',
};

function normalizeSetName(value: unknown) {
  return getRuneComboDisplayName(value, DEFAULT_PRD_RUNE_COMBO_RULES);
}

function toPositiveHoleCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : null;
}

function getActiveSetName(equipment: RuneComboEquipmentLike) {
  if (!Array.isArray(equipment.runeStoneSetsNames) || equipment.runeStoneSetsNames.length === 0) {
    return '';
  }

  const activeIndex = equipment.activeRuneStoneSet ?? 0;
  const rawName =
    equipment.runeStoneSetsNames[activeIndex] ?? equipment.runeStoneSetsNames[0] ?? '';

  return typeof rawName === 'string' ? rawName.trim() : '';
}

function getRawActiveSet(equipment: RuneComboEquipmentLike) {
  const activeIndex = Math.max(0, Math.floor(Number(equipment.activeRuneStoneSet ?? 0)));
  return equipment.runeStoneSets?.[activeIndex] ?? equipment.runeStoneSets?.[0] ?? [];
}

function getActiveColors(equipment: RuneComboEquipmentLike) {
  const activeSet = getRawActiveSet(equipment);
  const holeCount = toPositiveHoleCount(equipment.luckyHoles);
  const truncatedSet =
    holeCount === null ? activeSet : activeSet.slice(0, holeCount);

  return truncatedSet
    .map((item) => normalizeRuneColor(item.color ?? item.type ?? item.name))
    .filter((item): item is string => Boolean(item));
}

function matchesColors(actual: string[], expected: string[]) {
  if (actual.length !== expected.length) {
    return false;
  }

  return expected.every((color, index) => actual[index] === color);
}

export function getRuneComboTierLabel(tier: number | null) {
  if (!tier) {
    return '未激活';
  }

  return RUNE_COMBO_TIER_LABELS[tier] ?? `${tier}级组合`;
}

export function findRuneComboDefinitionByName(value: unknown) {
  return findRuneComboRuleByName(value, DEFAULT_PRD_RUNE_COMBO_RULES);
}

function findMatchedTier(
  definition: SimulatorRuneComboRule,
  activeColors: string[]
) {
  return definition.tiers.find((tier) => matchesColors(activeColors, tier.colors)) ?? null;
}

export function resolveRuneComboActivation(
  equipment: RuneComboEquipmentLike
): RuneComboResolution {
  const setName = getActiveSetName(equipment);
  const normalizedSetName = normalizeSetName(setName);
  const activeColors = getActiveColors(equipment);

  if (!normalizedSetName || activeColors.length === 0) {
    return {
      setName,
      normalizedSetName,
      isActivated: false,
      matchedTier: null,
      activeColors,
      reason: 'missing',
    };
  }

  const definition = findRuneComboRuleByName(normalizedSetName, DEFAULT_PRD_RUNE_COMBO_RULES);

  if (!definition) {
    return {
      setName,
      normalizedSetName,
      isActivated: true,
      matchedTier: null,
      activeColors,
      reason: 'activated',
    };
  }

  if (!definition.allowedSlots.includes(equipment.type)) {
    return {
      setName,
      normalizedSetName,
      isActivated: false,
      matchedTier: null,
      activeColors,
      reason: 'slot_invalid',
    };
  }

  const matchedTier = findMatchedTier(definition, activeColors);

  if (!matchedTier) {
    return {
      setName,
      normalizedSetName,
      isActivated: false,
      matchedTier: null,
      activeColors,
      reason: 'color_invalid',
    };
  }

  return {
    setName,
    normalizedSetName: definition.name,
    isActivated: true,
    matchedTier: matchedTier.tier,
    activeColors,
    reason: 'activated',
  };
}

export function analyzeRuneComboConflict(
  equipment: RuneComboEquipmentLike
): RuneComboConflict | null {
  const activation = resolveRuneComboActivation(equipment);
  const definition = findRuneComboDefinitionByName(activation.setName);
  const rawRuneCount = getRawActiveSet(equipment).length;
  const holeCount = toPositiveHoleCount(equipment.luckyHoles) ?? rawRuneCount;

  if (!definition) {
    return null;
  }

  if (activation.reason === 'slot_invalid') {
    return {
      message: '当前部位无法激活该符石组合，仅按单颗符石属性计算。',
      reason: 'slot_invalid',
      matchedTier: null,
      holeCount,
      rawRuneCount,
    };
  }

  if (rawRuneCount > holeCount) {
    const truncatedColors = activation.activeColors;
    const matchedTier =
      definition.tiers.find((tier) => matchesColors(truncatedColors, tier.colors))?.tier ??
      null;

    return {
      message: `当前为 ${holeCount} 孔装备，已强制按 ${holeCount} 孔最大可承载的${getRuneComboTierLabel(
        matchedTier
      )}计算。`,
      reason: 'hole_capacity_conflict',
      matchedTier,
      holeCount,
      rawRuneCount,
    };
  }

  if (activation.reason === 'color_invalid') {
    return {
      message: '当前颜色顺序未命中该组合，系统仅保留单颗符石属性。',
      reason: 'color_invalid',
      matchedTier: null,
      holeCount,
      rawRuneCount,
    };
  }

  return null;
}
