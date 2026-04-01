import type {
  AccountData,
  BaseAttributes,
  CombatStats,
  Cultivation,
  Equipment,
  EquipmentSet,
  Skill,
  Treasure,
} from './gameTypes';

const defaultPhysicalSkills: Skill[] = [
  { name: '横扫千军', level: 140, type: 'physical', targets: 1 },
  { name: '后发制人', level: 130, type: 'physical', targets: 1 },
  { name: '破釜沉舟', level: 125, type: 'physical', targets: 3 },
  { name: '安神诀', level: 110, type: 'magic', targets: 1 },
];

const defaultMagicSkills: Skill[] = [
  { name: '龙腾', level: 140, type: 'magic', targets: 1 },
  { name: '龙卷雨击', level: 130, type: 'magic', targets: 4 },
  { name: '龙戏珠', level: 125, type: 'magic', targets: 5 },
  { name: '龙吟', level: 110, type: 'magic', targets: 3 },
];

const defaultPhysicalCultivation: Cultivation = {
  physicalAttack: 25,
  physicalDefense: 20,
  magicAttack: 0,
  magicDefense: 20,
  petPhysicalAttack: 20,
  petPhysicalDefense: 20,
  petMagicAttack: 20,
  petMagicDefense: 20,
};

const defaultMagicCultivation: Cultivation = {
  physicalAttack: 0,
  physicalDefense: 20,
  magicAttack: 25,
  magicDefense: 20,
  petPhysicalAttack: 20,
  petPhysicalDefense: 20,
  petMagicAttack: 20,
  petMagicDefense: 20,
};

const defaultNewAccountCultivation: Cultivation = {
  physicalAttack: 20,
  physicalDefense: 20,
  magicAttack: 25,
  magicDefense: 20,
  petPhysicalAttack: 20,
  petPhysicalDefense: 20,
  petMagicAttack: 20,
  petMagicDefense: 20,
};

const cloneSkillList = (skills: Skill[]): Skill[] => skills.map(skill => ({ ...skill }));

const cloneCultivation = (cultivation: Cultivation): Cultivation => ({ ...cultivation });

const cloneTreasure = (treasure: Treasure): Treasure => ({
  ...treasure,
  stats: { ...treasure.stats },
});

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

const cloneEquipmentList = (equipment: Equipment[]): Equipment[] => equipment.map(cloneEquipment);

const cloneEquipmentSets = (equipmentSets: EquipmentSet[]): EquipmentSet[] =>
  equipmentSets.map(set => ({
    ...set,
    items: cloneEquipmentList(set.items),
  }));

type DefaultSeedArgs = {
  baseAttributes: BaseAttributes;
  combatStats: CombatStats;
  equipment: Equipment[];
  equipmentSets: EquipmentSet[];
};

export const createDefaultPhysicalSkills = (): Skill[] => cloneSkillList(defaultPhysicalSkills);

export const createDefaultMagicSkills = (): Skill[] => cloneSkillList(defaultMagicSkills);

export const createDefaultPhysicalCultivation = (): Cultivation =>
  cloneCultivation(defaultPhysicalCultivation);

export const createDefaultMagicCultivation = (): Cultivation =>
  cloneCultivation(defaultMagicCultivation);

export const createDefaultNewAccountCultivation = (): Cultivation =>
  cloneCultivation(defaultNewAccountCultivation);

export const createDefaultPhysicalTreasure = (): Treasure => ({
  id: 't1',
  name: '干将莫邪',
  type: '法宝',
  level: 15,
  tier: 4,
  stats: { damage: 150 },
  description: '大唐专属四级法宝，大幅提升物理伤害能力。',
  isActive: true,
});

export const createDefaultMagicTreasure = (): Treasure => ({
  id: 't2',
  name: '镇海珠',
  type: '法宝',
  level: 15,
  tier: 4,
  stats: { magicDamage: 150 },
  description: '龙宫专属四级法宝，大幅提升法术伤害能力。',
  isActive: true,
});

export const createDefaultPhysicalAccount = (
  id: string,
  name: string,
  seed: DefaultSeedArgs,
): AccountData => ({
  id,
  name,
  baseAttributes: { ...seed.baseAttributes },
  combatStats: { ...seed.combatStats },
  equipment: cloneEquipmentList(seed.equipment),
  equipmentSets: cloneEquipmentSets(seed.equipmentSets),
  activeSetIndex: 0,
  skills: createDefaultPhysicalSkills(),
  cultivation: createDefaultPhysicalCultivation(),
  treasure: cloneTreasure(createDefaultPhysicalTreasure()),
});

export const createDefaultMagicAccount = (
  id: string,
  name: string,
  seed: DefaultSeedArgs,
): AccountData => ({
  id,
  name,
  baseAttributes: { ...seed.baseAttributes },
  combatStats: { ...seed.combatStats },
  equipment: cloneEquipmentList(seed.equipment),
  equipmentSets: cloneEquipmentSets(seed.equipmentSets),
  activeSetIndex: 0,
  skills: createDefaultMagicSkills(),
  cultivation: createDefaultMagicCultivation(),
  treasure: cloneTreasure(createDefaultMagicTreasure()),
});

export const createNewMagicAccount = (
  id: string,
  name: string,
  seed: DefaultSeedArgs,
): AccountData => ({
  id,
  name,
  baseAttributes: { ...seed.baseAttributes },
  combatStats: { ...seed.combatStats },
  equipment: cloneEquipmentList(seed.equipment),
  equipmentSets: cloneEquipmentSets(seed.equipmentSets),
  activeSetIndex: 0,
  skills: createDefaultMagicSkills(),
  cultivation: createDefaultNewAccountCultivation(),
  treasure: null,
});

export const createDefaultAccounts = (seed: DefaultSeedArgs): AccountData[] => [
  createDefaultPhysicalAccount('default_account_1', '我的大唐', seed),
  createDefaultMagicAccount('default_account_2', '龙宫小号', seed),
];
