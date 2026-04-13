import { SIMULATOR_PRIMARY_EQUIPMENT_TYPES } from '@/shared/lib/simulator-equipment';

type JsonObject = Record<string, unknown>;

export type RegularSetEffect = {
  targetKey: 'magic';
  value: number;
};

export type RegularSetRuntimeTierRule = {
  tier: number;
  minCount: number;
  label?: string;
  effects: RegularSetEffect[];
};

export type RegularSetRuntimeRule = {
  setName: string;
  enabled: boolean;
  tiers: RegularSetRuntimeTierRule[];
};

export type ActiveRegularSetSummary = {
  setName: string;
  count: number;
  tier: number;
  effects: RegularSetEffect[];
};

type RegularSetSourceItem = {
  slot?: string;
  setName?: string;
};

const REGULAR_SET_EFFECT_LABELS: Record<RegularSetEffect['targetKey'], string> = {
  magic: '魔力',
};

const DEFAULT_REGULAR_SET_RULES: RegularSetRuntimeRule[] = [
  {
    setName: '*',
    enabled: true,
    tiers: [
      {
        tier: 5,
        minCount: 5,
        effects: [{ targetKey: 'magic', value: 20 }],
      },
      {
        tier: 3,
        minCount: 3,
        effects: [{ targetKey: 'magic', value: 10 }],
      },
    ],
  },
];

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

function normalizeSetName(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : '';
}

function isPrimarySlot(value: unknown) {
  return (SIMULATOR_PRIMARY_EQUIPMENT_TYPES as readonly string[]).includes(
    String(value ?? '').trim()
  );
}

function parseEffect(value: unknown): RegularSetEffect | null {
  const record = parseJsonObject(value);
  const targetKey = normalizeSetName(record.targetKey);
  const effectValue = toFiniteNumber(record.value, Number.NaN);

  if (targetKey !== 'magic' || !Number.isFinite(effectValue)) {
    return null;
  }

  return {
    targetKey: 'magic',
    value: effectValue,
  };
}

function parseTierRule(value: unknown): RegularSetRuntimeTierRule | null {
  const record = parseJsonObject(value);
  const tier = Math.max(0, Math.floor(toFiniteNumber(record.tier, Number.NaN)));
  const minCount = Math.max(
    0,
    Math.floor(toFiniteNumber(record.minCount, Number.NaN))
  );

  if (!Number.isFinite(tier) || !Number.isFinite(minCount) || tier <= 0 || minCount <= 0) {
    return null;
  }

  const rawEffects = Array.isArray(record.effects)
    ? record.effects
    : Array.isArray(record.modifiers)
      ? record.modifiers
      : [];
  const effects = rawEffects
    .map((item) => parseEffect(item))
    .filter((item): item is RegularSetEffect => Boolean(item));

  if (effects.length === 0) {
    return null;
  }

  return {
    tier,
    minCount,
    label: normalizeSetName(record.label) || undefined,
    effects,
  };
}

export function parseRegularSetRulesConfig(value: unknown): RegularSetRuntimeRule[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const record = parseJsonObject(item);
      const setName = normalizeSetName(record.setName);
      if (!setName) {
        return null;
      }

      const tiers = (Array.isArray(record.tiers) ? record.tiers : [])
        .map((tierRule) => parseTierRule(tierRule))
        .filter((tierRule): tierRule is RegularSetRuntimeTierRule => Boolean(tierRule))
        .sort((left, right) => right.minCount - left.minCount || right.tier - left.tier);

      if (tiers.length === 0) {
        return null;
      }

      return {
        setName,
        enabled: record.enabled !== false,
        tiers,
      } satisfies RegularSetRuntimeRule;
    })
    .filter((item): item is RegularSetRuntimeRule => Boolean(item))
    .filter((item) => item.enabled);
}

function resolveActiveRules(rules?: RegularSetRuntimeRule[]) {
  return rules && rules.length > 0 ? rules : DEFAULT_REGULAR_SET_RULES;
}

function findMatchedRule(
  setName: string,
  rules: RegularSetRuntimeRule[]
) {
  return (
    rules.find((rule) => rule.setName === setName) ??
    rules.find((rule) => rule.setName === '*') ??
    DEFAULT_REGULAR_SET_RULES[0]
  );
}

export function buildActiveRegularSetSummaries(
  equipment: RegularSetSourceItem[],
  rules?: RegularSetRuntimeRule[]
): ActiveRegularSetSummary[] {
  const grouped = new Map<string, number>();
  const activeRules = resolveActiveRules(rules);

  for (const item of equipment) {
    if (!isPrimarySlot(item.slot)) {
      continue;
    }

    const setName = normalizeSetName(item.setName);
    if (!setName) {
      continue;
    }

    grouped.set(setName, (grouped.get(setName) ?? 0) + 1);
  }

  return Array.from(grouped.entries())
    .map(([setName, count]) => {
      const matchedRule = findMatchedRule(setName, activeRules);
      const matchedTier = matchedRule.tiers.find((rule) => count >= rule.minCount);

      if (!matchedTier) {
        return null;
      }

      return {
        setName,
        count,
        tier: matchedTier.tier,
        effects: matchedTier.effects.map((effect) => ({ ...effect })),
      } satisfies ActiveRegularSetSummary;
    })
    .filter((item): item is ActiveRegularSetSummary => Boolean(item))
    .sort((left, right) => right.tier - left.tier || right.count - left.count);
}

export function resolveRegularSetAttributeBonuses(
  equipment: RegularSetSourceItem[],
  rules?: RegularSetRuntimeRule[]
) {
  const activeSets = buildActiveRegularSetSummaries(equipment, rules);
  const attributeSourceBonuses: Record<string, number> = {};

  for (const activeSet of activeSets) {
    for (const effect of activeSet.effects) {
      attributeSourceBonuses[effect.targetKey] =
        (attributeSourceBonuses[effect.targetKey] ?? 0) + effect.value;
    }
  }

  return {
    attributeSourceBonuses,
    activeSets,
  };
}

export function formatActiveRegularSetSummary(activeSet: ActiveRegularSetSummary) {
  const effectSummary = activeSet.effects
    .map((effect) => `${REGULAR_SET_EFFECT_LABELS[effect.targetKey]} +${effect.value}`)
    .join(' / ');

  return `${activeSet.setName}（${activeSet.tier}件）${effectSummary}`;
}
