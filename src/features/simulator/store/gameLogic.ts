import type {
  BaseAttributes,
  CombatStats,
  Equipment,
  MeridianConfig,
  Treasure,
} from './gameTypes';
import { resolveFormationSpeedFactor } from '@/shared/lib/simulator-battle-context';
import { sumEquipmentGemstoneStats } from '@/shared/lib/simulator-equipment-meta';
import {
  resolveRegularSetAttributeBonuses,
  type RegularSetRuntimeRule,
} from '@/shared/lib/simulator-regular-set';
import { resolveJiulongPanelSpiritDelta } from '@/shared/lib/simulator-rune-skill';
import {
  computeWeaponDamageToMagicDamageBonus,
  getPanelConversionProfile,
  getPrdPanelBaseConstant,
  resolveTrustedBasePanelConstant,
} from '@/shared/lib/simulator-core-rules';
import { resolveSimulatorStarRuntimeBonuses } from '@/shared/lib/simulator-rune-star-rules';

const COMBAT_STAT_KEYS: Array<keyof CombatStats> = [
  'hp',
  'magic',
  'hit',
  'damage',
  'magicDamage',
  'defense',
  'magicDefense',
  'speed',
  'dodge',
];

const normalizePercentValue = (value: number) =>
  Math.abs(value) >= 1 ? value / 100 : value;

const sumEquipmentEffectModifierPercent = (
  equipment: Equipment[],
  code: string
) =>
  equipment.reduce((sum, item) => {
    const matched = (item.effectModifiers ?? [])
      .filter((modifier) => modifier.code === code)
      .reduce(
        (modifierSum, modifier) =>
          modifierSum + normalizePercentValue(Number(modifier.value ?? 0)),
        0
      );

    return sum + matched;
  }, 0);

const sumSingleEquipmentStats = (item: Equipment) => {
  const totals: Record<string, number> = {};

  const activeRuneSet =
    item.runeStoneSets && item.runeStoneSets.length > 0
      ? item.runeStoneSets[item.activeRuneStoneSet ?? 0] ?? item.runeStoneSets[0]
      : [];

  for (const [key, value] of Object.entries(item.stats ?? {})) {
    totals[key] = (totals[key] ?? 0) + Number(value ?? 0);
  }

  for (const [key, value] of Object.entries(
    sumEquipmentGemstoneStats(item.gemstones)
  )) {
    totals[key] = (totals[key] ?? 0) + Number(value ?? 0);
  }

  for (const runeStone of activeRuneSet ?? []) {
    for (const [key, value] of Object.entries(runeStone.stats ?? {})) {
      totals[key] = (totals[key] ?? 0) + Number(value ?? 0);
    }
  }

  return totals;
};

const sumEquipmentStats = (equipment: Equipment[]) => {
  const totals: Record<string, number> = {};

  for (const item of equipment) {
    for (const [key, value] of Object.entries(sumSingleEquipmentStats(item))) {
      totals[key] = (totals[key] ?? 0) + Number(value ?? 0);
    }
  }

  return totals;
};

const sumWeaponDamageMagicDamageBonus = (equipment: Equipment[]) =>
  equipment.reduce((sum, item) => {
    if (item.type !== 'weapon') {
      return sum;
    }

    const itemTotals = sumSingleEquipmentStats(item);
    return sum + computeWeaponDamageToMagicDamageBonus(itemTotals.damage);
  }, 0);

type DerivedStatsInput = {
  baseAttributes: BaseAttributes;
  equipment: Equipment[];
  treasure: Treasure | null;
  bodyStrength?: number;
  meditation?: number;
  physicalFitness?: number;
  divineSpeed?: number;
  formation?: string;
  meridian?: MeridianConfig;
  regularSetRules?: RegularSetRuntimeRule[];
  runeSkillBaselineEquipment?: Equipment[];
};

type PanelBaselineInput = DerivedStatsInput & {
  panelStats: CombatStats;
};

export const computeDerivedStats = (
  baseAttributes: BaseAttributes,
  equipment: Equipment[],
  treasure: Treasure | null,
  options?: {
    bodyStrength?: number;
    meditation?: number;
    physicalFitness?: number;
    divineSpeed?: number;
    formation?: string;
    meridian?: MeridianConfig;
    regularSetRules?: RegularSetRuntimeRule[];
    runeSkillBaselineEquipment?: Equipment[];
  },
): CombatStats & Record<string, number> => {
  const meridian = options?.meridian;
  const regularSetBonuses = resolveRegularSetAttributeBonuses(
    equipment.map((item) => ({
      slot: item.type,
      setName: item.setName,
    })),
    options?.regularSetRules
  );
  const starBonuses = resolveSimulatorStarRuntimeBonuses(equipment);
  const effectiveBaseAttributes: BaseAttributes = {
    ...baseAttributes,
    physique: baseAttributes.physique + Number(meridian?.physique ?? 0),
    magic:
      baseAttributes.magic +
      Number(meridian?.magic ?? 0) +
      Number(regularSetBonuses.attributeSourceBonuses.magic ?? 0) +
      Number(starBonuses.attributeSourceBonuses.magic ?? 0),
    magicPower:
      baseAttributes.magicPower +
      Number(meridian?.magicPower ?? 0) +
      Number(starBonuses.attributeSourceBonuses.magicPower ?? 0) +
      Number(starBonuses.attributeSourceBonuses.spirit ?? 0),
    strength:
      baseAttributes.strength +
      Number(meridian?.strength ?? 0) +
      Number(starBonuses.attributeSourceBonuses.strength ?? 0),
    endurance:
      baseAttributes.endurance +
      Number(meridian?.endurance ?? 0) +
      Number(starBonuses.attributeSourceBonuses.endurance ?? 0),
    agility:
      baseAttributes.agility +
      Number(meridian?.agility ?? 0) +
      Number(starBonuses.attributeSourceBonuses.agility ?? 0),
  };
  effectiveBaseAttributes.physique += Number(
    starBonuses.attributeSourceBonuses.physique ?? 0
  );
  const equipmentTotals = sumEquipmentStats(equipment);
  const treasureTotals = treasure?.isActive ? treasure.stats ?? {} : {};
  const formationSpeedFactor = resolveFormationSpeedFactor(options?.formation);
  const bodyStrengthFactor =
    1 + normalizePercentValue(options?.bodyStrength ?? 0);
  const meditationFactor =
    1 + normalizePercentValue(options?.meditation ?? 0);
  const physicalFitnessFactor =
    1 + normalizePercentValue(options?.physicalFitness ?? 0);
  const divineSpeedBonus = Number(options?.divineSpeed ?? 0) * 1.5;
  const magicUpperPercent = sumEquipmentEffectModifierPercent(
    equipment,
    'magic_upper_percent'
  );
  const weaponDamageMagicDamageBonus =
    sumWeaponDamageMagicDamageBonus(equipment);
  const conversionProfile = getPanelConversionProfile({
    school: effectiveBaseAttributes.faction,
  });
  const jiulongPanelSpiritDelta = resolveJiulongPanelSpiritDelta(
    equipment,
    options?.runeSkillBaselineEquipment ?? []
  );
  const baseHp =
    resolveTrustedBasePanelConstant(
      baseAttributes.hp,
      getPrdPanelBaseConstant('hp')
    ) +
    effectiveBaseAttributes.physique * conversionProfile.hpPerPhysique;
  const baseMp =
    getPrdPanelBaseConstant('mp') +
    effectiveBaseAttributes.magic * conversionProfile.mpPerMagic;
  const derivedSpirit =
    effectiveBaseAttributes.magicPower +
    effectiveBaseAttributes.physique * 0.3 +
    effectiveBaseAttributes.magic * 0.7 +
    effectiveBaseAttributes.strength * 0.4 +
    effectiveBaseAttributes.endurance * 0.2 +
    (equipmentTotals.magicPower ?? 0) +
    (equipmentTotals.spirit ?? 0) +
    Number(treasureTotals.magicPower ?? 0) +
    Number(treasureTotals.spirit ?? 0) +
    jiulongPanelSpiritDelta;

  const result: CombatStats & Record<string, number> = {
    hp:
      baseHp * bodyStrengthFactor +
      (equipmentTotals.hp ?? 0) +
      (treasureTotals.hp ?? 0),
    magic:
      (baseMp * meditationFactor +
        (equipmentTotals.magic ?? 0) +
        (treasureTotals.magic ?? 0)) *
      (1 + magicUpperPercent),
    hit:
      effectiveBaseAttributes.strength * conversionProfile.hitPerStrength +
      (equipmentTotals.hit ?? 0) +
      (treasureTotals.hit ?? 0),
    damage:
      effectiveBaseAttributes.strength * conversionProfile.damagePerStrength +
      (equipmentTotals.damage ?? 0) +
      (treasureTotals.damage ?? 0),
    magicDamage:
      derivedSpirit +
      weaponDamageMagicDamageBonus +
      (equipmentTotals.magicDamage ?? 0) +
      (equipmentTotals.spellDamageLevel ?? 0) +
      (treasureTotals.magicDamage ?? 0),
    defense:
      effectiveBaseAttributes.endurance *
        conversionProfile.defensePerEndurance *
        physicalFitnessFactor +
      (equipmentTotals.defense ?? 0) +
      (treasureTotals.defense ?? 0),
    magicDefense:
      derivedSpirit +
      (equipmentTotals.magicDefense ?? 0) +
      (treasureTotals.magicDefense ?? 0),
    speed:
      (effectiveBaseAttributes.physique * 0.1 +
        effectiveBaseAttributes.strength * 0.1 +
        effectiveBaseAttributes.endurance * 0.1 +
        effectiveBaseAttributes.agility * 0.7 +
        divineSpeedBonus +
        (equipmentTotals.speed ?? 0) +
        (treasureTotals.speed ?? 0)) *
      formationSpeedFactor,
    dodge:
      effectiveBaseAttributes.agility +
      (equipmentTotals.dodge ?? 0) +
      (treasureTotals.dodge ?? 0),
  };

  for (const [key, value] of Object.entries(starBonuses.panelStatBonuses)) {
    result[key] = (result[key] ?? 0) + Number(value ?? 0);
  }

  for (const [key, value] of Object.entries(equipmentTotals)) {
    if (!COMBAT_STAT_KEYS.includes(key as keyof CombatStats)) {
      result[key] = (result[key] ?? 0) + Number(value ?? 0);
    }
  }

  for (const [key, value] of Object.entries(treasureTotals)) {
    if (!COMBAT_STAT_KEYS.includes(key as keyof CombatStats)) {
      result[key] = (result[key] ?? 0) + Number(value ?? 0);
    }
  }
  result.magicPower = derivedSpirit;
  result.spiritualPower = derivedSpirit;

  return result;
};

export const computeCombatStatsWithPanelBaseline = (
  current: DerivedStatsInput,
  baseline?: PanelBaselineInput | null
): CombatStats & Record<string, number> => {
  const currentDerived = computeDerivedStats(
    current.baseAttributes,
    current.equipment,
    current.treasure,
    {
      bodyStrength: current.bodyStrength,
      formation: current.formation,
      meridian: current.meridian,
      regularSetRules: current.regularSetRules,
      runeSkillBaselineEquipment: current.runeSkillBaselineEquipment,
    }
  );

  if (!baseline) {
    return currentDerived;
  }

  const baselineDerived = computeDerivedStats(
    baseline.baseAttributes,
    baseline.equipment,
    baseline.treasure,
    {
      bodyStrength: baseline.bodyStrength,
      formation: baseline.formation,
      meridian: baseline.meridian,
      regularSetRules: baseline.regularSetRules,
      runeSkillBaselineEquipment:
        baseline.runeSkillBaselineEquipment ?? baseline.equipment,
    }
  );

  const keys = new Set<string>([
    ...Object.keys(baseline.panelStats ?? {}),
    ...Object.keys(currentDerived),
    ...Object.keys(baselineDerived),
  ]);
  const merged: CombatStats & Record<string, number> = {
    ...currentDerived,
  };
  const baselinePanelStats = baseline.panelStats as unknown as Record<
    string,
    number | undefined
  >;

  for (const key of keys) {
    merged[key] =
      Number(baselinePanelStats[key] ?? 0) +
      Number(currentDerived[key] ?? 0) -
      Number(baselineDerived[key] ?? 0);
  }

  return merged;
};
