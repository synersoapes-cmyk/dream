import type { BaseAttributes, CombatStats, Equipment, EquipmentSet } from './gameTypes';

export const initialBaseAttributes: BaseAttributes = {
  level: 109,
  hp: 4200,
  magic: 650,
  physique: 120,
  magicPower: 780,
  strength: 90,
  endurance: 100,
  agility: 110,
  faction: '大唐官府' as BaseAttributes['faction'],
};

export const initialCombatStats: CombatStats = {
  hp: 6800,
  magic: 1100,
  hit: 1450,
  damage: 1850,
  magicDamage: 1350,
  defense: 1280,
  magicDefense: 1180,
  speed: 620,
  dodge: 260,
};

const cloneRuneStoneSets = (equipment: Equipment): Equipment['runeStoneSets'] =>
  equipment.runeStoneSets?.map(set =>
    set.map(runeStone => ({
      ...runeStone,
      stats: { ...runeStone.stats },
    })),
  );

const cloneEquipment = (equipment: Equipment): Equipment => ({
  ...equipment,
  highlights: equipment.highlights ? [...equipment.highlights] : undefined,
  baseStats: { ...equipment.baseStats },
  stats: { ...equipment.stats },
  runeStoneSets: cloneRuneStoneSets(equipment),
  runeStoneSetsNames: equipment.runeStoneSetsNames ? [...equipment.runeStoneSetsNames] : undefined,
});

export const createInitialEquipment = (presetEquipments: Equipment[]): Equipment[] =>
  presetEquipments.map(cloneEquipment);

export const createInitialEquipmentSets = (presetEquipments: Equipment[]): EquipmentSet[] => {
  const names = ['当前方案', '高速方案', '爆发方案', '续航方案', '实验方案'];

  return names.map((name, index) => ({
    id: `set_${index + 1}`,
    name,
    items: createInitialEquipment(presetEquipments),
    isActive: index === 0,
  }));
};
