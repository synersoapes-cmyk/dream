import type {
  Equipment,
  RuneStone,
} from '@/features/simulator/store/gameTypes';

import { SIMULATOR_PRIMARY_EQUIPMENT_TYPES } from '@/shared/lib/simulator-equipment';

const DEFAULT_RUNE_SET_OPTIONS = [
  '招云',
  '腾蛟',
  '心印',
  '仙骨',
  '全能',
  '法门',
  '逐兽',
  '聚焦',
  '药香',
  '隔山打牛',
  '回眸一笑',
  '万丈霞光',
  '飞檐走壁',
  '高山流水',
  '云随风舞',
] as const;

const RUNE_COLOR_LABELS: Record<string, string> = {
  red: '红',
  blue: '蓝',
  yellow: '黄',
  green: '绿',
  purple: '紫',
  black: '黑',
  white: '白',
  orange: '橙',
};

const FULL_SET_FIRST_RUNE_COLOR_MAP: Record<
  string,
  Partial<Record<(typeof SIMULATOR_PRIMARY_EQUIPMENT_TYPES)[number], RuneStone['type']>>
> = {
  招云: {
    helmet: 'white',
    necklace: 'red',
    weapon: 'yellow',
    armor: 'black',
    belt: 'blue',
    shoes: 'red',
  },
  腾蛟: {
    helmet: 'white',
    necklace: 'red',
    weapon: 'red',
    armor: 'black',
    belt: 'blue',
    shoes: 'red',
  },
};

function cloneRuneStone(runeStone: RuneStone): RuneStone {
  return {
    ...runeStone,
    stats: { ...(runeStone.stats ?? {}) },
  };
}

function cloneRuneStoneSets(
  runeStoneSets: Equipment['runeStoneSets']
): Equipment['runeStoneSets'] {
  return runeStoneSets?.map((set) => set.map((runeStone) => cloneRuneStone(runeStone)));
}

function toPositiveInteger(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.floor(parsed));
}

export function isSimulatorPrimaryEquipment(
  type: Equipment['type']
): type is (typeof SIMULATOR_PRIMARY_EQUIPMENT_TYPES)[number] {
  return (SIMULATOR_PRIMARY_EQUIPMENT_TYPES as readonly string[]).includes(type);
}

export function getSimulatorActiveRuneSetIndex(equipment: Equipment) {
  const maxIndex =
    Math.max(
      equipment.runeStoneSets?.length ?? 0,
      equipment.runeStoneSetsNames?.length ?? 0,
      1
    ) - 1;

  return Math.min(toPositiveInteger(equipment.activeRuneStoneSet), maxIndex);
}

export function createEmptyRuneStone(index = 0): RuneStone {
  return {
    id: `empty_rune_${index + 1}`,
    name: '未配置符石',
    type: 'empty',
    stats: {},
  };
}

function createColorRuneStone(color: RuneStone['type'], index = 0): RuneStone {
  const colorLabel = RUNE_COLOR_LABELS[color] ?? String(color);

  return {
    id: `preset_rune_${color}_${index + 1}`,
    name: `${colorLabel}符石`,
    type: color,
    stats: {},
  };
}

export function getSimulatorRuneSetOptions(equipment: Equipment) {
  const currentNames =
    equipment.runeStoneSetsNames
      ?.filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0 && item !== '未配置') ?? [];

  return Array.from(new Set([...currentNames, ...DEFAULT_RUNE_SET_OPTIONS]));
}

export function ensureSimulatorEquipmentRuneEditingState(equipment: Equipment) {
  if (!isSimulatorPrimaryEquipment(equipment.type)) {
    return equipment;
  }

  const next: Equipment = {
    ...equipment,
    runeStoneSets: cloneRuneStoneSets(equipment.runeStoneSets) ?? [],
    runeStoneSetsNames: equipment.runeStoneSetsNames
      ? [...equipment.runeStoneSetsNames]
      : [],
  };

  const activeIndex = getSimulatorActiveRuneSetIndex(next);

  while ((next.runeStoneSets?.length ?? 0) <= activeIndex) {
    next.runeStoneSets?.push([]);
  }
  while ((next.runeStoneSetsNames?.length ?? 0) <= activeIndex) {
    next.runeStoneSetsNames?.push('未配置');
  }

  if (!next.runeStoneSets || next.runeStoneSets.length === 0) {
    next.runeStoneSets = [[createEmptyRuneStone(0)]];
  }

  if (!next.runeStoneSets[activeIndex] || next.runeStoneSets[activeIndex].length === 0) {
    next.runeStoneSets[activeIndex] = [createEmptyRuneStone(0)];
  }

  if (!next.runeStoneSetsNames || next.runeStoneSetsNames.length === 0) {
    next.runeStoneSetsNames = ['未配置'];
  }

  next.activeRuneStoneSet = activeIndex;
  next.luckyHoles =
    typeof next.luckyHoles === 'string' && next.luckyHoles.trim().length > 0
      ? next.luckyHoles
      : String(Math.max(1, next.runeStoneSets[activeIndex]?.length ?? 1));

  return next;
}

export function applySimulatorRuneSetSelection(
  equipment: Equipment,
  setName: string
) {
  const next = ensureSimulatorEquipmentRuneEditingState(equipment);
  const activeIndex = getSimulatorActiveRuneSetIndex(next);
  const activeSet = next.runeStoneSets?.[activeIndex] ?? [];
  const firstRuneColor =
    FULL_SET_FIRST_RUNE_COLOR_MAP[setName]?.[
      next.type as (typeof SIMULATOR_PRIMARY_EQUIPMENT_TYPES)[number]
    ];

  if (next.runeStoneSetsNames) {
    next.runeStoneSetsNames[activeIndex] = setName;
  }

  if (activeSet.length === 0) {
    activeSet.push(
      firstRuneColor
        ? createColorRuneStone(firstRuneColor, 0)
        : createEmptyRuneStone(0)
    );
  } else if (firstRuneColor) {
    activeSet[0] = {
      ...activeSet[0],
      ...createColorRuneStone(firstRuneColor, 0),
      stats: { ...(activeSet[0]?.stats ?? {}) },
    };
  }

  next.runeStoneSets![activeIndex] = activeSet;
  next.activeRuneStoneSet = activeIndex;
  next.luckyHoles = String(Math.max(1, toPositiveInteger(next.luckyHoles) || activeSet.length));

  return next;
}
