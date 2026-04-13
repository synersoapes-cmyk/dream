type JsonObject = Record<string, unknown>;

export const ORNAMENT_SET_TIER_THRESHOLDS = [32, 28, 24, 16, 8] as const;
const ORNAMENT_SLOT_KEYS = new Set([
  'trinket1',
  'trinket2',
  'trinket3',
  'trinket4',
  'ring',
  'earring',
  'bracelet',
  'amulet',
]);

export type OrnamentSetRuntimeEffect = {
  type: 'panel_stat_bonus' | 'attribute_source_bonus' | 'skill_damage_addend';
  targetKey?: string;
  value: number;
  skillCode?: string;
  sourceKey?: string;
  modifierType?: 'addend' | 'multiplier';
  label?: string;
};

export type OrnamentSetRuntimeTierRule = {
  tier: number;
  label?: string;
  effects: OrnamentSetRuntimeEffect[];
};

export type OrnamentSetRuntimeRule = {
  setName: string;
  minCount: number;
  minTier: number;
  enabled: boolean;
  tiers: OrnamentSetRuntimeTierRule[];
};

export type OrnamentSetRuntimeEquipment = {
  id: string;
  slot: string;
  level: number;
  setName?: string;
};

export type ActiveOrnamentSetRuntimeEffect = OrnamentSetRuntimeEffect & {
  tier: number;
  setName: string;
};

export type ActiveOrnamentSetSummary = {
  setName: string;
  slotCount: number;
  totalLevel: number;
  tier: number;
  slots: string[];
  equipmentIds: string[];
  matchedRule: boolean;
  matchedTier: number;
  effects: ActiveOrnamentSetRuntimeEffect[];
};

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseJsonObject(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as JsonObject;
}

function parseEffect(value: unknown): OrnamentSetRuntimeEffect | null {
  const record = parseJsonObject(value);
  const type =
    typeof record.type === 'string' && record.type.trim().length > 0
      ? record.type.trim()
      : '';
  const parsedValue = toFiniteNumber(record.value, Number.NaN);

  if (
    !Number.isFinite(parsedValue) ||
    ![
      'panel_stat_bonus',
      'attribute_source_bonus',
      'skill_damage_addend',
    ].includes(type)
  ) {
    return null;
  }

  const targetKey =
    typeof record.targetKey === 'string' && record.targetKey.trim().length > 0
      ? record.targetKey.trim()
      : undefined;
  const skillCode =
    typeof record.skillCode === 'string' && record.skillCode.trim().length > 0
      ? record.skillCode.trim()
      : undefined;
  const sourceKey =
    typeof record.sourceKey === 'string' && record.sourceKey.trim().length > 0
      ? record.sourceKey.trim()
      : undefined;
  const modifierType =
    record.modifierType === 'multiplier' ? 'multiplier' : 'addend';

  if (
    (type === 'panel_stat_bonus' || type === 'attribute_source_bonus') &&
    !targetKey
  ) {
    return null;
  }

  return {
    type: type as OrnamentSetRuntimeEffect['type'],
    targetKey,
    value: parsedValue,
    skillCode,
    sourceKey,
    modifierType,
    label:
      typeof record.label === 'string' && record.label.trim().length > 0
        ? record.label.trim()
        : undefined,
  };
}

function parseTierRule(value: unknown): OrnamentSetRuntimeTierRule | null {
  const record = parseJsonObject(value);
  const tier = Math.max(0, Math.floor(toFiniteNumber(record.tier, Number.NaN)));

  if (!Number.isFinite(tier) || tier <= 0) {
    return null;
  }

  const rawEffects = Array.isArray(record.effects)
    ? record.effects
    : Array.isArray(record.modifiers)
      ? record.modifiers
      : [];
  const effects = rawEffects
    .map((item) => parseEffect(item))
    .filter((item): item is OrnamentSetRuntimeEffect => Boolean(item));

  return {
    tier,
    label:
      typeof record.label === 'string' && record.label.trim().length > 0
        ? record.label.trim()
        : undefined,
    effects,
  };
}

export function parseOrnamentSetRulesConfig(
  value: unknown
): OrnamentSetRuntimeRule[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const record = parseJsonObject(item);
      const setName =
        typeof record.setName === 'string' && record.setName.trim().length > 0
          ? record.setName.trim()
          : '';

      if (!setName) {
        return null;
      }

      const tiers = (Array.isArray(record.tiers) ? record.tiers : [])
        .map((tierRule) => parseTierRule(tierRule))
        .filter((tierRule): tierRule is OrnamentSetRuntimeTierRule => Boolean(tierRule))
        .sort((left, right) => right.tier - left.tier);

      return {
        setName,
        minCount: Math.max(1, Math.floor(toFiniteNumber(record.minCount, 4))),
        minTier: Math.max(0, Math.floor(toFiniteNumber(record.minTier, 8))),
        enabled: record.enabled !== false,
        tiers,
      } satisfies OrnamentSetRuntimeRule;
    })
    .filter((item): item is OrnamentSetRuntimeRule => Boolean(item))
    .filter((item) => item.enabled);
}

export function resolveOrnamentSetTier(totalLevel: number) {
  return (
    ORNAMENT_SET_TIER_THRESHOLDS.find((tier) => totalLevel >= tier) ?? 0
  );
}

export function buildActiveOrnamentSetSummaries(params: {
  equipment: OrnamentSetRuntimeEquipment[];
  rules: OrnamentSetRuntimeRule[];
}) {
  const grouped = new Map<
    string,
    {
      totalLevel: number;
      slotCount: number;
      slots: string[];
      equipmentIds: string[];
    }
  >();

  for (const item of params.equipment) {
    const setName =
      typeof item.setName === 'string' && item.setName.trim().length > 0
        ? item.setName.trim()
        : '';
    const normalizedSlot = String(item.slot ?? '').trim();

    if (!setName || !ORNAMENT_SLOT_KEYS.has(normalizedSlot)) {
      continue;
    }

    const current = grouped.get(setName) ?? {
      totalLevel: 0,
      slotCount: 0,
      slots: [],
      equipmentIds: [],
    };
    current.totalLevel += toFiniteNumber(item.level);
    current.slotCount += 1;
    current.slots.push(normalizedSlot);
    current.equipmentIds.push(item.id);
    grouped.set(setName, current);
  }

  const rulesByName = new Map(params.rules.map((item) => [item.setName, item] as const));

  return Array.from(grouped.entries())
    .map(([setName, summary]) => {
      const tier = resolveOrnamentSetTier(summary.totalLevel);
      const matchedRule = rulesByName.get(setName);
      const isActive =
        summary.slotCount >= (matchedRule?.minCount ?? 4) &&
        tier >= (matchedRule?.minTier ?? 8);
      const matchedTierRule = isActive
        ? matchedRule?.tiers.find((item) => tier >= item.tier)
        : undefined;

      return {
        setName,
        slotCount: summary.slotCount,
        totalLevel: summary.totalLevel,
        tier,
        slots: [...summary.slots],
        equipmentIds: [...summary.equipmentIds],
        matchedRule: Boolean(matchedRule),
        matchedTier: matchedTierRule?.tier ?? 0,
        effects: (matchedTierRule?.effects ?? []).map((effect) => ({
          ...effect,
          setName,
          tier: matchedTierRule?.tier ?? 0,
        })),
      } satisfies ActiveOrnamentSetSummary;
    })
    .filter((item) => item.slotCount >= 4 && item.tier >= 8);
}
