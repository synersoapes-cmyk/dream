import type {
  BaseAttributes,
  CombatStats,
  Equipment,
} from '@/features/simulator/store/gameTypes';

import { getEquipmentRuneStoneSetInfo } from '@/shared/blocks/simulator/EquipmentPanel/RuneStoneHelper';
import {
  getSimulatorSlotDefinitions,
  getSimulatorSlotLabel,
  SIMULATOR_CATEGORY_CONFIG,
} from '@/shared/lib/simulator-slot-config';

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

export const AVAILABLE_RUNES = [
  { id: '1', name: '红符石', type: 'red', stats: { damage: 1.5 } },
  { id: '1-2', name: '红符石(精)', type: 'red', stats: { damage: 2 } },
  { id: '2', name: '蓝符石', type: 'blue', stats: { speed: 1.5 } },
  { id: '2-2', name: '蓝符石(精)', type: 'blue', stats: { speed: 2 } },
  { id: '3', name: '绿符石', type: 'green', stats: { defense: 1.5 } },
  { id: '3-2', name: '绿符石(精)', type: 'green', stats: { defense: 2 } },
  { id: '4', name: '黄符石', type: 'yellow', stats: { hit: 2 } },
  { id: '4-2', name: '黄符石(精)', type: 'yellow', stats: { hit: 3 } },
  { id: '5', name: '白符石', type: 'white', stats: { magic: 2 } },
  { id: '6', name: '黑符石', type: 'black', stats: { magicDamage: 1.5 } },
  { id: '7', name: '紫符石', type: 'purple', stats: { dodge: 2 } },
] as const;

export const AVAILABLE_STAR_POSITIONS = [
  '无',
  '伤害 +2.5',
  '气血 +10',
  '速度 +1.5',
  '防御 +2',
  '法伤 +2.5',
  '躲避 +2',
] as const;

export const AVAILABLE_STAR_ALIGNMENTS = [
  '无',
  '体质 +2',
  '魔力 +2',
  '力量 +2',
  '耐力 +2',
  '敏捷 +2',
] as const;

export const AVAILABLE_RUNE_SETS = [
  '全能',
  '法门',
  '逐兽',
  '聚焦',
  '仙骨',
  '药香',
  '心印',
  '招云',
  '腾蛟',
] as const;

export const AVAILABLE_GEMSTONES = [
  '红玛瑙',
  '太阳石',
  '月亮石',
  '黑宝石',
  '舍利子',
  '光芒石',
  '翡翠石',
  '神秘石',
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

export function summarizeEquipmentEffects(
  equipments: Equipment[],
  options: Parameters<typeof getEquipmentEffectTexts>[1]
) {
  return getEquipmentEffectTexts(equipments, options).join(' / ');
}

export function cloneEquipmentForEditor(equipment: Equipment): Equipment {
  return {
    ...equipment,
    highlights: equipment.highlights ? [...equipment.highlights] : undefined,
    effectModifiers: equipment.effectModifiers?.map((modifier) => ({
      ...modifier,
    })),
    baseStats: { ...equipment.baseStats },
    stats: { ...equipment.stats },
    runeStoneSets: cloneRuneStoneSets(equipment),
    runeStoneSetsNames: equipment.runeStoneSetsNames
      ? [...equipment.runeStoneSetsNames]
      : undefined,
  };
}

export function calculateEquipmentTotalStats(equipments: Equipment[]) {
  const totals: Record<string, number> = {};
  let totalPrice = 0;

  equipments.forEach((eq) => {
    if (eq.price) totalPrice += eq.price;

    Object.entries(eq.stats || {}).forEach(([key, val]) => {
      if (typeof val === 'number') {
        totals[key] = (totals[key] || 0) + val;
      }
    });

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
