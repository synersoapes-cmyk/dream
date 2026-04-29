import type {
  BaseAttributes,
  CombatStats,
  Equipment,
  EquipmentSet,
  ExperimentSeat,
  PendingEquipment,
} from '@/features/simulator/store/gameTypes';

import { getEquipmentRuneStoneSetInfo } from '@/shared/blocks/simulator/EquipmentPanel/RuneStoneHelper';
import {
  buildSimulatorEquipmentLibraryItems,
  type SimulatorEquipmentLibraryItem as LaboratoryLibrarySourceItem,
} from '@/shared/lib/simulator-equipment-library';
import { sumEquipmentGemstoneStats } from '@/shared/lib/simulator-equipment-meta';
import {
  getSimulatorRuneSetOptions as getPrdRuneSetOptions,
  getSimulatorRuneStoneOptions,
  getSimulatorStarPositionOptions,
} from '@/shared/lib/simulator-rune-star-rules';
import {
  getSimulatorSlotDefinitions,
  getSimulatorSlotLabel,
  SIMULATOR_CATEGORY_CONFIG,
} from '@/shared/lib/simulator-slot-config';

export type LaboratoryInheritanceOptions = {
  inheritGemstones?: boolean;
  inheritRuneStones?: boolean;
};

function toDisplayText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function getUniqueDisplayTexts(values: Array<unknown>) {
  return Array.from(
    new Set(values.map(toDisplayText).filter(Boolean))
  ) as string[];
}

function getEquipmentEffectTexts(
  equipments: Equipment[],
  options: {
    predicate?: (equipment: Equipment) => boolean;
    includeRuneSetName?: boolean;
    includeRuneSetEffect?: boolean;
    includeSetName?: boolean;
    includeSpecialEffect?: boolean;
    includeRefinementEffect?: boolean;
    includeExtraStat?: boolean;
    includeHighlights?: boolean;
  }
) {
  return getUniqueDisplayTexts(
    equipments.flatMap((equipment) => {
      if (options.predicate && !options.predicate(equipment)) {
        return [];
      }

      const values: Array<unknown> = [];

      if (options.includeRuneSetName) {
        values.push(...getEquipmentRuneStoneSetInfo([equipment]));
      }
      if (options.includeRuneSetEffect) {
        values.push(equipment.runeSetEffect);
      }
      if (options.includeSetName) {
        values.push(equipment.setName);
      }
      if (options.includeSpecialEffect) {
        values.push(equipment.specialEffect);
      }
      if (options.includeRefinementEffect) {
        values.push(equipment.refinementEffect);
      }
      if (options.includeExtraStat) {
        values.push(equipment.extraStat);
      }
      if (options.includeHighlights) {
        values.push(...(equipment.highlights ?? []));
      }

      return values;
    })
  );
}

const cloneRuneStoneSets = (equipment: Equipment): Equipment['runeStoneSets'] =>
  equipment.runeStoneSets?.map((set) =>
    set.map((runeStone) => ({
      ...runeStone,
      stats: { ...runeStone.stats },
    }))
  );

const cloneGemstones = (equipment: Equipment): Equipment['gemstones'] =>
  equipment.gemstones?.map((gemstone) => ({
    ...gemstone,
    stats: gemstone.stats ? { ...gemstone.stats } : undefined,
  }));

export const AVAILABLE_RUNES = getSimulatorRuneStoneOptions();

export const AVAILABLE_STAR_POSITIONS = getSimulatorStarPositionOptions().map(
  (item) => item.label
);

export const AVAILABLE_STAR_ALIGNMENTS = [
  '无',
  '体质 +2',
  '魔力 +2',
  '力量 +2',
  '耐力 +2',
  '敏捷 +2',
] as const;

const PRIMARY_LABORATORY_RUNE_SET_SLOTS: Equipment['type'][] = [
  'weapon',
  'helmet',
  'necklace',
  'armor',
  'belt',
  'shoes',
];

export const AVAILABLE_RUNE_SETS = Array.from(
  new Set(
    PRIMARY_LABORATORY_RUNE_SET_SLOTS.flatMap((type) =>
      getPrdRuneSetOptions({
        id: `seed-${type}`,
        name: '',
        type,
        mainStat: '',
        baseStats: {},
        stats: {},
      } as Equipment)
    )
  )
);

export const AVAILABLE_GEMSTONES = [
  '红玛瑙',
  '太阳石',
  '月亮石',
  '黑宝石',
  '舍利子',
  '光芒石',
  '翡翠石',
  '神秘石',
  '红宝石',
  '黄宝石',
  '蓝宝石',
  '绿宝石',
] as const;

export const LABORATORY_CATEGORIES = SIMULATOR_CATEGORY_CONFIG.map(
  (category) => ({
    name: category.name,
    slots: getSimulatorSlotDefinitions(category.key).map((slot) => ({
      ...slot,
      label: getSimulatorSlotLabel(slot, 'laboratory'),
    })),
  })
);

export const LABORATORY_ATTRIBUTE_LIST: Array<{
  key: keyof (BaseAttributes & CombatStats);
  label: string;
  isBase: boolean;
}> = [
  { key: 'physique', label: '体质', isBase: true },
  { key: 'magic', label: '魔力', isBase: true },
  { key: 'strength', label: '力量', isBase: true },
  { key: 'endurance', label: '耐力', isBase: true },
  { key: 'agility', label: '敏捷', isBase: true },
  { key: 'magicDamage', label: '法术伤害', isBase: false },
  { key: 'spellDamageLevel', label: '法术伤害等级', isBase: false },
  { key: 'spiritualPower', label: '灵力', isBase: false },
  { key: 'magicCritLevel', label: '法术暴击等级', isBase: false },
  { key: 'speed', label: '速度', isBase: false },
  { key: 'hit', label: '命中', isBase: false },
  { key: 'fixedDamage', label: '固定伤害', isBase: false },
  { key: 'pierceLevel', label: '穿刺等级', isBase: false },
  { key: 'elementalMastery', label: '五行克制能力', isBase: false },
  { key: 'hp', label: '气血', isBase: false },
  { key: 'magicDefense', label: '法术防御', isBase: false },
  { key: 'defense', label: '物理防御', isBase: false },
  { key: 'block', label: '格挡值', isBase: false },
  { key: 'antiCritLevel', label: '抗暴击等级', isBase: false },
  { key: 'sealResistLevel', label: '抵抗封印等级', isBase: false },
  { key: 'dodge', label: '躲避', isBase: false },
  { key: 'elementalResistance', label: '五行克制抵御能力', isBase: false },
];

export function buildLaboratoryLibrarySourceItems(params: {
  currentEquipment: Equipment[];
  equipmentSets: EquipmentSet[];
  activeSetIndex: number;
  candidateLibraryItems: PendingEquipment[];
  inventoryLibraryItems?: PendingEquipment[];
  includePlanOnlyItems?: boolean;
}) {
  return buildSimulatorEquipmentLibraryItems(params);
}

export function summarizeEquipmentEffects(
  equipments: Equipment[],
  options: Parameters<typeof getEquipmentEffectTexts>[1]
) {
  return getEquipmentEffectTexts(equipments, options).join(' / ');
}

export function resolveLaboratorySeatEquipment(
  seat: Pick<ExperimentSeat, 'isSample' | 'equipment'>,
  sampleEquipment: Equipment[]
): Equipment[] {
  return seat.isSample ? sampleEquipment : seat.equipment;
}

export function cloneEquipmentForEditor(equipment: Equipment): Equipment {
  return {
    ...equipment,
    highlights: equipment.highlights ? [...equipment.highlights] : undefined,
    effectModifiers: equipment.effectModifiers?.map((modifier) => ({
      ...modifier,
    })),
    starPositionConfig: equipment.starPositionConfig
      ? { ...equipment.starPositionConfig }
      : undefined,
    starAlignmentConfig: equipment.starAlignmentConfig
      ? {
          ...equipment.starAlignmentConfig,
          colors: equipment.starAlignmentConfig.colors
            ? [...equipment.starAlignmentConfig.colors]
            : undefined,
        }
      : undefined,
    baseStats: { ...equipment.baseStats },
    stats: { ...equipment.stats },
    gemstones: cloneGemstones(equipment),
    runeStoneSets: cloneRuneStoneSets(equipment),
    runeStoneSetsNames: equipment.runeStoneSetsNames
      ? [...equipment.runeStoneSetsNames]
      : undefined,
  };
}

export function mergeEquipmentWithInheritance(
  baseEquipment: Equipment | undefined,
  nextEquipment: Equipment,
  options: LaboratoryInheritanceOptions
): Equipment {
  const merged = cloneEquipmentForEditor(nextEquipment);

  if (!baseEquipment) {
    return merged;
  }

  if (options.inheritGemstones) {
    merged.gemstones = cloneGemstones(baseEquipment);
    merged.gemstone = baseEquipment.gemstone;
    merged.forgeLevel = baseEquipment.forgeLevel;
  }

  if (options.inheritRuneStones) {
    merged.runeStoneSets = cloneRuneStoneSets(baseEquipment);
    merged.runeStoneSetsNames = baseEquipment.runeStoneSetsNames
      ? [...baseEquipment.runeStoneSetsNames]
      : undefined;
    merged.activeRuneStoneSet = baseEquipment.activeRuneStoneSet;
    merged.runeSetEffect = baseEquipment.runeSetEffect;
    merged.luckyHoles = baseEquipment.luckyHoles;
  }

  return merged;
}

export function describeSeatInheritance(options: LaboratoryInheritanceOptions) {
  const inheritGemstones = options.inheritGemstones !== false;
  const inheritRuneStones = options.inheritRuneStones !== false;

  if (inheritGemstones && inheritRuneStones) {
    return ['继承旧宝石', '继承旧符石'];
  }

  if (inheritGemstones) {
    return ['继承旧宝石', '不继承旧符石'];
  }

  if (inheritRuneStones) {
    return ['不继承旧宝石', '继承旧符石'];
  }

  return ['不继承旧打造'];
}

export function calculateEquipmentTotalStats(equipments: Equipment[]) {
  const totals: Record<string, number> = {};
  let totalPrice = 0;

  equipments.forEach((eq) => {
    totalPrice += (eq.price || 0) + (eq.crossServerFee || 0);

    Object.entries(eq.stats || {}).forEach(([key, val]) => {
      if (typeof val === 'number') {
        totals[key] = (totals[key] || 0) + val;
      }
    });

    Object.entries(sumEquipmentGemstoneStats(eq.gemstones)).forEach(
      ([key, val]) => {
        if (typeof val === 'number') {
          totals[key] = (totals[key] || 0) + val;
        }
      }
    );

    if (eq.runeStoneSets && eq.activeRuneStoneSet !== undefined) {
      const activeSet = eq.runeStoneSets[eq.activeRuneStoneSet];
      if (activeSet) {
        activeSet.forEach((rs) => {
          Object.entries(rs.stats || {}).forEach(([key, val]) => {
            if (typeof val === 'number') {
              totals[key] = (totals[key] || 0) + val;
            }
          });
        });
      }
    }
  });

  return { totals, totalPrice };
}

const LABORATORY_DISPLAY_ALIAS_GROUPS = [
  {
    displayKey: 'spiritualPower',
    keys: ['spiritualPower', 'magicPower', 'spirit'],
  },
] as const;

const LABORATORY_ALIAS_KEY_SET: ReadonlySet<string> = new Set(
  LABORATORY_DISPLAY_ALIAS_GROUPS.flatMap((group) => group.keys)
);

function pickLaboratoryAliasValue(
  values: Record<string, number>,
  keys: readonly string[]
) {
  for (const key of keys) {
    const value = values[key];
    if (typeof value === 'number' && Math.abs(value) > 0.01) {
      return value;
    }
  }

  return undefined;
}

export function mergeLaboratoryDisplayDiffs(params: {
  combatDiffs: Record<string, number>;
  diffs: Record<string, number>;
}) {
  const merged: Record<string, number> = {};
  const { combatDiffs, diffs } = params;

  for (const [key, value] of Object.entries(combatDiffs)) {
    if (LABORATORY_ALIAS_KEY_SET.has(key) || Math.abs(value) <= 0.01) {
      continue;
    }

    merged[key] = value;
  }

  for (const [key, value] of Object.entries(diffs)) {
    if (
      LABORATORY_ALIAS_KEY_SET.has(key) ||
      key in combatDiffs ||
      Math.abs(value) <= 0.01
    ) {
      continue;
    }

    merged[key] = value;
  }

  for (const group of LABORATORY_DISPLAY_ALIAS_GROUPS) {
    const value =
      pickLaboratoryAliasValue(combatDiffs, group.keys) ??
      pickLaboratoryAliasValue(diffs, group.keys);

    if (value !== undefined) {
      merged[group.displayKey] = value;
    }
  }

  return merged;
}

export function getFallbackSeatTotalDamage(
  seatCombatStats: Record<string, number>
) {
  return (
    (seatCombatStats.magicDamage || 0) +
    (seatCombatStats.magicPower || 0) * 0.7 +
    (seatCombatStats.damage || 0) * 0.25
  );
}

export function getSeatDisplayName(
  seat: { id: string; name: string; isSample: boolean },
  allSeats: Array<{ id: string; name: string; isSample: boolean }>
) {
  if (seat.isSample) {
    return seat.name;
  }

  const comparisonSeats = allSeats.filter((item) => !item.isSample);
  const index = comparisonSeats.findIndex((item) => item.id === seat.id);
  return `对比席位${index + 1}`;
}
