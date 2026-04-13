import type { Equipment } from '@/features/simulator/store/gameTypes';

import { normalizeRuneColor } from '@/shared/lib/simulator-equipment-meta';

type RuneComboTierDefinition = {
  tier: number;
  colors: string[];
};

type RuneComboDefinition = {
  name: string;
  allowedSlots: Equipment['type'][];
  tiers: RuneComboTierDefinition[];
};

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

const RUNE_COMBO_DEFINITIONS: RuneComboDefinition[] = [
  {
    name: '九龙诀',
    allowedSlots: ['helmet'],
    tiers: [
      { tier: 4, colors: ['白', '红', '黄', '蓝', '绿'] },
      { tier: 3, colors: ['白', '红', '黄', '蓝'] },
      { tier: 2, colors: ['白', '红', '黄'] },
    ],
  },
  {
    name: '呼风唤雨',
    allowedSlots: ['armor'],
    tiers: [
      { tier: 4, colors: ['黑', '黄', '蓝', '绿', '白'] },
      { tier: 3, colors: ['黑', '黄', '蓝', '绿'] },
      { tier: 2, colors: ['黑', '黄', '蓝'] },
    ],
  },
  {
    name: '破浪诀',
    allowedSlots: ['weapon'],
    tiers: [
      { tier: 4, colors: ['白', '红', '蓝', '黑', '绿'] },
      { tier: 3, colors: ['白', '红', '蓝', '黑'] },
      { tier: 2, colors: ['白', '红', '蓝'] },
    ],
  },
  {
    name: '逆鳞',
    allowedSlots: ['belt'],
    tiers: [
      { tier: 4, colors: ['白', '红', '绿', '紫', '蓝'] },
      { tier: 3, colors: ['白', '红', '绿', '紫'] },
      { tier: 2, colors: ['白', '红', '绿'] },
    ],
  },
  {
    name: '龙腾',
    allowedSlots: ['necklace'],
    tiers: [
      { tier: 4, colors: ['黑', '红', '白', '蓝', '紫'] },
      { tier: 3, colors: ['黑', '红', '白', '蓝'] },
      { tier: 2, colors: ['黑', '红', '白'] },
    ],
  },
  {
    name: '隔山打牛',
    allowedSlots: ['necklace', 'armor', 'belt', 'helmet', 'weapon', 'shoes'],
    tiers: [
      { tier: 5, colors: ['白', '红', '紫', '蓝', '黄'] },
      { tier: 4, colors: ['白', '红', '紫', '蓝'] },
      { tier: 3, colors: ['白', '红', '紫'] },
      { tier: 2, colors: ['白', '红'] },
    ],
  },
];

const RUNE_COMBO_TIER_LABELS: Record<number, string> = {
  2: '二级组合',
  3: '三级组合',
  4: '四级组合',
  5: '五级组合',
};

function normalizeSetName(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.split(/[:：]/)[0]?.trim() ?? '';
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
  const normalized = normalizeSetName(value);
  return (
    RUNE_COMBO_DEFINITIONS.find((item) => item.name === normalized) ?? null
  );
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

  const definition = RUNE_COMBO_DEFINITIONS.find(
    (item) => item.name === normalizedSetName
  );

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

  const matchedTier = definition.tiers.find((tier) =>
    matchesColors(activeColors, tier.colors)
  );

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
    normalizedSetName,
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
    return {
      message:
        activation.matchedTier !== null
          ? `当前仅 ${holeCount} 孔，但录入了 ${rawRuneCount} 颗符石，已强制按 ${holeCount} 孔最大可承载的${getRuneComboTierLabel(activation.matchedTier)}计算。`
          : `当前仅 ${holeCount} 孔，但录入了 ${rawRuneCount} 颗符石，组合无法完整激活，已按 ${holeCount} 孔规则截断计算。`,
      reason: 'hole_capacity_conflict',
      matchedTier: activation.matchedTier,
      holeCount,
      rawRuneCount,
    };
  }

  if (activation.reason === 'color_invalid' && rawRuneCount > 0) {
    return {
      message: '符石颜色与当前组合不匹配，系统已判定为未激活。',
      reason: 'color_invalid',
      matchedTier: null,
      holeCount,
      rawRuneCount,
    };
  }

  return null;
}
