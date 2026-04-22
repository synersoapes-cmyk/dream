import { buildSimulatorBundleStorePreview } from '@/features/simulator/utils/simulatorBundle';

import type { BaseAttributes, CombatStats } from '@/features/simulator/store/gameTypes';
import type { SimulatorCharacterBundle } from '@/shared/models/simulator-types';

export type SimulatorProfileReviewFieldKey =
  | 'faction'
  | 'level'
  | 'physique'
  | 'potentialPoints'
  | 'magicPower'
  | 'strength'
  | 'endurance'
  | 'agility'
  | 'hp'
  | 'magic'
  | 'damage'
  | 'defense'
  | 'magicDamage'
  | 'magicDefense'
  | 'speed'
  | 'hit'
  | 'dodge'
  | 'sealHit';

export type SimulatorProfilePayloadKey =
  | 'faction'
  | 'level'
  | 'physique'
  | 'potentialPoints'
  | 'magicPower'
  | 'strength'
  | 'endurance'
  | 'agility'
  | 'hp'
  | 'mp'
  | 'damage'
  | 'defense'
  | 'magicDamage'
  | 'magicDefense'
  | 'speed'
  | 'hit'
  | 'dodge'
  | 'sealHit';

export type SimulatorProfileReviewChange = {
  key: SimulatorProfileReviewFieldKey;
  label: string;
  payloadKey: SimulatorProfilePayloadKey;
  before: number | string;
  after: number | string;
  delta?: number;
};

export type SimulatorProfileReviewEditableValues = {
  faction: string;
  level: number;
  baseHp?: number;
  magic: number;
  potentialPoints: number;
  physique: number;
  magicPower: number;
  strength: number;
  endurance: number;
  agility: number;
  spiritualPower?: number;
  hp: number;
  mp: number;
  damage: number;
  defense: number;
  magicDamage: number;
  magicDefense: number;
  speed: number;
  hit: number;
  dodge: number;
  sealHit?: number;
  meridianConfig?: {
    physique: number;
    magic: number;
    strength: number;
    endurance: number;
    agility: number;
    magicPower: number;
  };
};

type ProfileReviewState = {
  baseAttributes: BaseAttributes;
  combatStats: CombatStats;
};

const PROFILE_REVIEW_FIELDS: Array<{
  key: SimulatorProfileReviewFieldKey;
  label: string;
  payloadKey: SimulatorProfilePayloadKey;
  getBefore: (state: ProfileReviewState) => number | string;
  getAfter: (state: ProfileReviewState) => number | string;
}> = [
  {
    key: 'faction',
    label: '门派',
    payloadKey: 'faction',
    getBefore: ({ baseAttributes }) => baseAttributes.faction,
    getAfter: ({ baseAttributes }) => baseAttributes.faction,
  },
  {
    key: 'level',
    label: '等级',
    payloadKey: 'level',
    getBefore: ({ baseAttributes }) => baseAttributes.level,
    getAfter: ({ baseAttributes }) => baseAttributes.level,
  },
  {
    key: 'physique',
    label: '体质',
    payloadKey: 'physique',
    getBefore: ({ baseAttributes }) => baseAttributes.physique,
    getAfter: ({ baseAttributes }) => baseAttributes.physique,
  },
  {
    key: 'potentialPoints',
    label: '潜力点',
    payloadKey: 'potentialPoints',
    getBefore: ({ baseAttributes }) => baseAttributes.potentialPoints,
    getAfter: ({ baseAttributes }) => baseAttributes.potentialPoints,
  },
  {
    key: 'magicPower',
    label: '魔力',
    payloadKey: 'magicPower',
    getBefore: ({ baseAttributes }) => baseAttributes.magicPower,
    getAfter: ({ baseAttributes }) => baseAttributes.magicPower,
  },
  {
    key: 'strength',
    label: '力量',
    payloadKey: 'strength',
    getBefore: ({ baseAttributes }) => baseAttributes.strength,
    getAfter: ({ baseAttributes }) => baseAttributes.strength,
  },
  {
    key: 'endurance',
    label: '耐力',
    payloadKey: 'endurance',
    getBefore: ({ baseAttributes }) => baseAttributes.endurance,
    getAfter: ({ baseAttributes }) => baseAttributes.endurance,
  },
  {
    key: 'agility',
    label: '敏捷',
    payloadKey: 'agility',
    getBefore: ({ baseAttributes }) => baseAttributes.agility,
    getAfter: ({ baseAttributes }) => baseAttributes.agility,
  },
  {
    key: 'hp',
    label: '气血',
    payloadKey: 'hp',
    getBefore: ({ combatStats }) => combatStats.hp,
    getAfter: ({ combatStats }) => combatStats.hp,
  },
  {
    key: 'magic',
    label: '魔法',
    payloadKey: 'mp',
    getBefore: ({ combatStats }) => combatStats.magic,
    getAfter: ({ combatStats }) => combatStats.magic,
  },
  {
    key: 'damage',
    label: '伤害',
    payloadKey: 'damage',
    getBefore: ({ combatStats }) => combatStats.damage,
    getAfter: ({ combatStats }) => combatStats.damage,
  },
  {
    key: 'defense',
    label: '防御',
    payloadKey: 'defense',
    getBefore: ({ combatStats }) => combatStats.defense,
    getAfter: ({ combatStats }) => combatStats.defense,
  },
  {
    key: 'magicDamage',
    label: '法伤',
    payloadKey: 'magicDamage',
    getBefore: ({ combatStats }) => combatStats.magicDamage,
    getAfter: ({ combatStats }) => combatStats.magicDamage,
  },
  {
    key: 'magicDefense',
    label: '法防',
    payloadKey: 'magicDefense',
    getBefore: ({ combatStats }) => combatStats.magicDefense,
    getAfter: ({ combatStats }) => combatStats.magicDefense,
  },
  {
    key: 'speed',
    label: '速度',
    payloadKey: 'speed',
    getBefore: ({ combatStats }) => combatStats.speed,
    getAfter: ({ combatStats }) => combatStats.speed,
  },
  {
    key: 'hit',
    label: '命中',
    payloadKey: 'hit',
    getBefore: ({ combatStats }) => combatStats.hit,
    getAfter: ({ combatStats }) => combatStats.hit,
  },
  {
    key: 'dodge',
    label: '躲避',
    payloadKey: 'dodge',
    getBefore: ({ combatStats }) => combatStats.dodge,
    getAfter: ({ combatStats }) => combatStats.dodge,
  },
  {
    key: 'sealHit',
    label: '封印命中',
    payloadKey: 'sealHit',
    getBefore: ({ combatStats }) => combatStats.sealHit ?? 0,
    getAfter: ({ combatStats }) => combatStats.sealHit ?? 0,
  },
];

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toOptionalFiniteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseJsonRecord(value: string | null | undefined): Record<string, unknown> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function buildSimulatorProfileReviewChanges(params: {
  beforeState: ProfileReviewState;
  afterState: ProfileReviewState;
}): SimulatorProfileReviewChange[] {
  return PROFILE_REVIEW_FIELDS.map((field) => {
    const before = field.getBefore(params.beforeState);
    const after = field.getAfter(params.afterState);

    return {
      key: field.key,
      label: field.label,
      payloadKey: field.payloadKey,
      before,
      after,
      delta:
        typeof before === 'number' && typeof after === 'number'
          ? after - before
          : undefined,
    };
  }).filter((item) => item.before !== item.after);
}

export function buildSimulatorProfileReviewChangesFromBundles(params: {
  beforeBundle: SimulatorCharacterBundle;
  afterBundle: SimulatorCharacterBundle;
}) {
  const beforePreview = buildSimulatorBundleStorePreview(params.beforeBundle);
  const afterPreview = buildSimulatorBundleStorePreview(params.afterBundle);

  return buildSimulatorProfileReviewChanges({
    beforeState: {
      baseAttributes: beforePreview.baseAttributes,
      combatStats: beforePreview.combatStats,
    },
    afterState: {
      baseAttributes: afterPreview.baseAttributes,
      combatStats: afterPreview.combatStats,
    },
  });
}

export function buildSimulatorProfileEditableValuesFromBundle(
  bundle: SimulatorCharacterBundle
): SimulatorProfileReviewEditableValues {
  const rawBody = parseJsonRecord(bundle.profile?.rawBodyJson);

  return {
    faction: bundle.character.school || '龙宫',
    level: toFiniteNumber(bundle.profile?.level),
    baseHp: toOptionalFiniteNumber(rawBody.baseHp),
    magic: toFiniteNumber(bundle.profile?.magic),
    potentialPoints: toFiniteNumber(bundle.profile?.potentialPoints),
    physique: toFiniteNumber(bundle.profile?.physique),
    magicPower: toFiniteNumber(rawBody.magicPower ?? rawBody.spiritualPower),
    strength: toFiniteNumber(bundle.profile?.strength),
    endurance: toFiniteNumber(bundle.profile?.endurance),
    agility: toFiniteNumber(bundle.profile?.agility),
    spiritualPower: toOptionalFiniteNumber(
      rawBody.spiritualPower ?? rawBody.magicPower
    ),
    hp: toFiniteNumber(bundle.profile?.hp),
    mp: toFiniteNumber(bundle.profile?.mp),
    damage: toFiniteNumber(bundle.profile?.damage),
    defense: toFiniteNumber(bundle.profile?.defense),
    magicDamage: toFiniteNumber(bundle.profile?.magicDamage),
    magicDefense: toFiniteNumber(bundle.profile?.magicDefense),
    speed: toFiniteNumber(bundle.profile?.speed),
    hit: toFiniteNumber(bundle.profile?.hit),
    dodge: toFiniteNumber(rawBody.dodge),
    sealHit: toOptionalFiniteNumber(bundle.profile?.sealHit),
    meridianConfig: {
      physique: 0,
      magic: 0,
      strength: 0,
      endurance: 0,
      agility: 0,
      magicPower: 0,
    },
  };
}
