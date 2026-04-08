import type { BaseAttributes, CombatStats, Equipment, Treasure } from './gameTypes';

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

const sumEquipmentStats = (equipment: Equipment[]) => {
  const totals: Record<string, number> = {};

  for (const item of equipment) {
    const activeRuneSet =
      item.runeStoneSets && item.runeStoneSets.length > 0
        ? item.runeStoneSets[item.activeRuneStoneSet ?? 0] ?? item.runeStoneSets[0]
        : [];

    for (const [key, value] of Object.entries(item.stats ?? {})) {
      totals[key] = (totals[key] ?? 0) + Number(value ?? 0);
    }

    for (const runeStone of activeRuneSet ?? []) {
      for (const [key, value] of Object.entries(runeStone.stats ?? {})) {
        totals[key] = (totals[key] ?? 0) + Number(value ?? 0);
      }
    }
  }

  return totals;
};

export const computeDerivedStats = (
  baseAttributes: BaseAttributes,
  equipment: Equipment[],
  treasure: Treasure | null,
): CombatStats & Record<string, number> => {
  const equipmentTotals = sumEquipmentStats(equipment);
  const treasureTotals = treasure?.isActive ? treasure.stats ?? {} : {};

  const result: CombatStats & Record<string, number> = {
    hp:
      baseAttributes.hp * 5 +
      baseAttributes.physique * 12 +
      baseAttributes.endurance * 4 +
      (equipmentTotals.hp ?? 0) +
      (treasureTotals.hp ?? 0),
    magic:
      baseAttributes.magic * 1.6 +
      baseAttributes.magicPower * 0.25 +
      (equipmentTotals.magic ?? 0) +
      (treasureTotals.magic ?? 0),
    hit:
      baseAttributes.strength * 2 +
      baseAttributes.level * 6 +
      (equipmentTotals.hit ?? 0) +
      (treasureTotals.hit ?? 0),
    damage:
      baseAttributes.strength * 8 +
      baseAttributes.level * 6 +
      (equipmentTotals.damage ?? 0) +
      (treasureTotals.damage ?? 0),
    magicDamage:
      baseAttributes.magic * 5 +
      baseAttributes.magicPower * 1.2 +
      baseAttributes.level * 3 +
      (equipmentTotals.magicDamage ?? 0) +
      (treasureTotals.magicDamage ?? 0),
    defense:
      baseAttributes.endurance * 4 +
      baseAttributes.physique * 2 +
      baseAttributes.level * 3 +
      (equipmentTotals.defense ?? 0) +
      (treasureTotals.defense ?? 0),
    magicDefense:
      baseAttributes.magicPower * 0.6 +
      baseAttributes.endurance * 2 +
      baseAttributes.level * 2.6 +
      (equipmentTotals.magicDefense ?? 0) +
      (treasureTotals.magicDefense ?? 0),
    speed:
      baseAttributes.agility * 4 +
      baseAttributes.level * 2 +
      (equipmentTotals.speed ?? 0) +
      (treasureTotals.speed ?? 0),
    dodge:
      baseAttributes.agility * 2 +
      Math.floor(baseAttributes.level * 0.8) +
      (equipmentTotals.dodge ?? 0) +
      (treasureTotals.dodge ?? 0),
  };

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

  result.magicPower = baseAttributes.magicPower + (equipmentTotals.magicPower ?? 0);

  return result;
};
