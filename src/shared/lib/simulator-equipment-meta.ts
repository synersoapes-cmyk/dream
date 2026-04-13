import type {
  EquipmentGemstone,
  RuneStone,
  StarAlignmentConfig,
} from '@/features/simulator/store/gameTypes';

type JsonRecord = Record<string, unknown>;
type GemstoneAliasMeta = Pick<EquipmentGemstone, 'type' | 'element'> & {
  defaultStat: string;
  statLabel: string;
};

const RUNE_COLOR_ALIAS: Record<string, string> = {
  red: '红',
  blue: '蓝',
  green: '绿',
  yellow: '黄',
  white: '白',
  black: '黑',
  purple: '紫',
  orange: '橙',
  hong: '红',
  lan: '蓝',
  lv: '绿',
  huang: '黄',
  bai: '白',
  hei: '黑',
  zi: '紫',
  cheng: '橙',
  红: '红',
  蓝: '蓝',
  绿: '绿',
  黄: '黄',
  金: '黄',
  白: '白',
  黑: '黑',
  紫: '紫',
  橙: '橙',
};

const GEMSTONE_TYPE_ALIAS: Record<string, GemstoneAliasMeta> = {
  舍利子: {
    type: 'spirit',
    element: '土',
    defaultStat: 'spirit',
    statLabel: '灵力',
  },
  太阳石: {
    type: 'damage',
    element: '火',
    defaultStat: 'damage',
    statLabel: '伤害力',
  },
  月亮石: {
    type: 'defense',
    element: '水',
    defaultStat: 'defense',
    statLabel: '防御力',
  },
  翡翠石: {
    type: 'magicDefense',
    element: '木',
    defaultStat: 'magicDefense',
    statLabel: '法术防御力',
  },
  黑宝石: {
    type: 'speed',
    element: '水',
    defaultStat: 'speed',
    statLabel: '速度',
  },
  光芒石: {
    type: 'hp',
    element: '金',
    defaultStat: 'hp',
    statLabel: '气血上限',
  },
  红玛瑙: {
    type: 'hit',
    element: '火',
    defaultStat: 'hit',
    statLabel: '命中',
  },
  神秘石: {
    type: 'dodge',
    element: '土',
    defaultStat: 'dodge',
    statLabel: '躲避力',
  },
  红宝石: {
    type: 'spellAbsorb',
    element: '火',
    defaultStat: 'spellAbsorbRate',
    statLabel: '法术吸收率',
  },
  黄宝石: {
    type: 'spellAbsorb',
    element: '土',
    defaultStat: 'spellAbsorbRate',
    statLabel: '法术吸收率',
  },
  蓝宝石: {
    type: 'spellAbsorb',
    element: '水',
    defaultStat: 'spellAbsorbRate',
    statLabel: '法术吸收率',
  },
  绿宝石: {
    type: 'spellAbsorb',
    element: '木',
    defaultStat: 'spellAbsorbRate',
    statLabel: '法术吸收率',
  },
};

export type SimulatorGemstoneDefinition = {
  name: string;
  type: string;
  element?: string;
  defaultStat: string;
  statLabel: string;
};

export const SIMULATOR_GEMSTONE_DEFINITIONS: SimulatorGemstoneDefinition[] =
  Object.entries(GEMSTONE_TYPE_ALIAS).map(([name, meta]) => ({
    name,
    type: meta.type,
    element: meta.element,
    defaultStat: meta.defaultStat,
    statLabel: meta.statLabel,
  }));

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toFiniteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toPositiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : undefined;
}

function parseNotesRecord(value: unknown): JsonRecord {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return isRecord(value) ? value : {};
}

function normalizeGemstoneStatMap(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value)
    .map(([key, rawValue]) => [key, toFiniteNumber(rawValue)] as const)
    .filter((entry): entry is [string, number] => entry[1] !== undefined);

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

function buildStructuredGemstone(
  record: JsonRecord,
  index: number
): EquipmentGemstone | null {
  const name =
    typeof record.name === 'string' && record.name.trim().length > 0
      ? record.name.trim()
      : '';
  const alias = name ? GEMSTONE_TYPE_ALIAS[name] : undefined;
  const level = toFiniteNumber(record.level);

  if (!name && level === undefined) {
    return null;
  }

  return {
    id:
      typeof record.id === 'string' && record.id.trim().length > 0
        ? record.id.trim()
        : `gemstone_${index + 1}`,
    name: name || '未命名宝石',
    imageUrl:
      typeof record.imageUrl === 'string' && record.imageUrl.trim().length > 0
        ? record.imageUrl.trim()
        : undefined,
    type:
      typeof record.type === 'string' && record.type.trim().length > 0
        ? record.type.trim()
        : alias?.type ?? 'unknown',
    element:
      typeof record.element === 'string' && record.element.trim().length > 0
        ? record.element.trim()
        : alias?.element,
    level,
    quantity: Math.max(1, Math.floor(toFiniteNumber(record.quantity) ?? 1)),
    stats: normalizeGemstoneStatMap(record.stats),
  };
}

function parseLegacyGemstoneEntry(
  rawEntry: string,
  fallbackLevel?: number,
  index = 0
): EquipmentGemstone | null {
  const trimmed = rawEntry.trim();
  if (!trimmed) {
    return null;
  }

  const matched = trimmed.match(/(\d+)\s*([^\d\s]+)/);
  const level = matched ? Number(matched[1]) : fallbackLevel;
  const name = matched ? matched[2].trim() : trimmed.replace(/^\+?\d+\s*/, '').trim();
  if (!name) {
    return null;
  }

  const alias = GEMSTONE_TYPE_ALIAS[name];

  return {
    id: `legacy_gemstone_${index + 1}`,
    name,
    type: alias?.type ?? 'unknown',
    element: alias?.element,
    level: Number.isFinite(level) ? level : undefined,
    quantity: 1,
  };
}

export function parseEquipmentGemstones(params: {
  gemstones?: unknown;
  gemstoneText?: unknown;
  fallbackLevel?: unknown;
}): EquipmentGemstone[] {
  if (Array.isArray(params.gemstones)) {
    return params.gemstones
      .filter(isRecord)
      .map((record, index) => buildStructuredGemstone(record, index))
      .filter((item): item is EquipmentGemstone => Boolean(item));
  }

  if (typeof params.gemstoneText !== 'string') {
    return [];
  }

  const fallbackLevel = Math.max(
    0,
    Math.floor(toFiniteNumber(params.fallbackLevel) ?? 0)
  );

  return params.gemstoneText
    .split(/[，,、;+]/)
    .map((entry, index) => parseLegacyGemstoneEntry(entry, fallbackLevel, index))
    .filter((item): item is EquipmentGemstone => Boolean(item));
}

export function findEquipmentGemstoneDefinition(name: unknown) {
  if (typeof name !== 'string') {
    return null;
  }

  const trimmed = name.trim();
  return trimmed ? GEMSTONE_TYPE_ALIAS[trimmed] ?? null : null;
}

export function createEquipmentGemstoneDraft(
  name: string,
  index: number
): EquipmentGemstone {
  const definition = findEquipmentGemstoneDefinition(name);

  return {
    id: `gemstone_${index + 1}`,
    name,
    type: definition?.type ?? 'unknown',
    element: definition?.element,
    quantity: 1,
  };
}

export function summarizeEquipmentGemstones(
  gemstones: EquipmentGemstone[] | undefined
) {
  if (!Array.isArray(gemstones) || gemstones.length === 0) {
    return undefined;
  }

  return gemstones
    .map((gemstone) => {
      const level =
        typeof gemstone.level === 'number' && Number.isFinite(gemstone.level)
          ? `${Math.max(0, Math.floor(gemstone.level))} `
          : '';
      return `${level}${gemstone.name}`.trim();
    })
    .join('，');
}

export function countEquipmentGemLevelTotal(
  gemstones: EquipmentGemstone[] | undefined
) {
  if (!Array.isArray(gemstones) || gemstones.length === 0) {
    return 0;
  }

  return gemstones.reduce((sum, gemstone) => {
    const level =
      typeof gemstone.level === 'number' && Number.isFinite(gemstone.level)
        ? gemstone.level
        : 0;
    const quantity =
      typeof gemstone.quantity === 'number' && Number.isFinite(gemstone.quantity)
        ? gemstone.quantity
        : 1;

    return sum + level * Math.max(1, Math.floor(quantity));
  }, 0);
}

export function sumEquipmentGemstoneStats(
  gemstones: EquipmentGemstone[] | undefined
) {
  if (!Array.isArray(gemstones) || gemstones.length === 0) {
    return {};
  }

  return gemstones.reduce<Record<string, number>>((totals, gemstone) => {
    const quantity =
      typeof gemstone.quantity === 'number' && Number.isFinite(gemstone.quantity)
        ? Math.max(1, Math.floor(gemstone.quantity))
        : 1;

    for (const [key, value] of Object.entries(gemstone.stats ?? {})) {
      const numericValue = toFiniteNumber(value);
      if (numericValue === undefined) {
        continue;
      }

      totals[key] = (totals[key] ?? 0) + numericValue * quantity;
    }

    return totals;
  }, {});
}

export function normalizeRuneColor(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const exactMatch =
    RUNE_COLOR_ALIAS[trimmed.toLowerCase()] ?? RUNE_COLOR_ALIAS[trimmed];
  if (exactMatch) {
    return exactMatch;
  }

  for (const [alias, normalized] of Object.entries(RUNE_COLOR_ALIAS)) {
    if (trimmed.toLowerCase().includes(alias.toLowerCase())) {
      return normalized;
    }
  }

  return null;
}

function normalizeSingleRuneStone(value: unknown, index: number): RuneStone | null {
  if (!isRecord(value)) {
    return null;
  }

  const type =
    typeof value.type === 'string' && value.type.trim().length > 0
      ? value.type.trim()
      : typeof value.color === 'string' && value.color.trim().length > 0
        ? value.color.trim()
        : 'empty';

  return {
    id:
      typeof value.id === 'string' && value.id.trim().length > 0
        ? value.id.trim()
        : `persisted_rune_${index + 1}`,
    name:
      typeof value.name === 'string' && value.name.trim().length > 0
        ? value.name.trim()
        : undefined,
    type,
    level: toFiniteNumber(value.level),
    quality:
      typeof value.quality === 'string' && value.quality.trim().length > 0
        ? value.quality.trim()
        : undefined,
    description:
      typeof value.description === 'string' && value.description.trim().length > 0
        ? value.description.trim()
        : undefined,
    price: toFiniteNumber(value.price),
    color:
      typeof value.color === 'string' && value.color.trim().length > 0
        ? value.color.trim()
        : normalizeRuneColor(type) ?? undefined,
    element:
      typeof value.element === 'string' && value.element.trim().length > 0
        ? value.element.trim()
        : undefined,
    stats:
      normalizeGemstoneStatMap(value.stats) ??
      ({} as NonNullable<RuneStone['stats']>),
  };
}

export function normalizeEquipmentRuneStoneSets(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const sets = value
    .filter(Array.isArray)
    .slice(0, 2)
    .map((set, setIndex) =>
      set
        .slice(0, 5)
        .map((entry, runeIndex) =>
          normalizeSingleRuneStone(entry, setIndex * 10 + runeIndex)
        )
        .filter((item): item is RuneStone => Boolean(item))
    )
    .filter((set) => set.length > 0);

  return sets.length > 0 ? sets : undefined;
}

export function normalizeEquipmentRuneStoneSetNames(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const names = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2);

  return names.length > 0 ? names : undefined;
}

export function extractActiveRuneSetMeta(value: unknown) {
  const notes = parseNotesRecord(value);
  const activeIndex = Math.max(
    0,
    Math.floor(toFiniteNumber(notes.activeRuneStoneSet) ?? 0)
  );
  const runeStoneSets = normalizeEquipmentRuneStoneSets(notes.runeStoneSets) ?? [];
  const rawActiveSet = runeStoneSets[activeIndex] ?? runeStoneSets[0] ?? [];
  const holeCount =
    toPositiveInteger(notes.holeCount) ??
    toPositiveInteger(notes.luckyHoles) ??
    rawActiveSet.length;
  const activeSet = rawActiveSet.slice(0, holeCount);
  const runeSetNames =
    normalizeEquipmentRuneStoneSetNames(notes.runeStoneSetsNames) ?? [];
  const activeName =
    typeof runeSetNames[activeIndex] === 'string'
      ? runeSetNames[activeIndex]
      : typeof runeSetNames[0] === 'string'
        ? runeSetNames[0]
        : '';
  const activeColors = activeSet
    .map((item) => normalizeRuneColor(item.color ?? item.type ?? item.name))
    .filter((item): item is string => Boolean(item));

  return {
    activeIndex,
    activeName,
    activeSet,
    activeColors,
    firstColor: activeColors[0] ?? null,
  };
}

export function matchesRuneColorsIgnoringOrder(actual: string[], expected: string[]) {
  if (actual.length !== expected.length) {
    return false;
  }

  const normalizedActual = [...actual].sort();
  const normalizedExpected = [...expected].sort();

  return normalizedActual.every((color, index) => color === normalizedExpected[index]);
}

export function isStrictStarAlignmentConfigActive(params: {
  notes: unknown;
  config: StarAlignmentConfig | undefined;
}) {
  const { config } = params;
  if (!config) {
    return false;
  }

  const runeMeta = extractActiveRuneSetMeta(params.notes);
  if (!runeMeta.activeName || runeMeta.activeColors.length === 0) {
    return false;
  }

  if (
    typeof config.comboName === 'string' &&
    config.comboName.trim().length > 0 &&
    runeMeta.activeName !== config.comboName.trim()
  ) {
    return false;
  }

  const expectedColors = Array.isArray(config.colors)
    ? config.colors
        .map((item) => normalizeRuneColor(item))
        .filter((item): item is string => Boolean(item))
    : [];

  if (expectedColors.length > 0 && runeMeta.activeColors.length === 0) {
    return false;
  }

  return true;
}
