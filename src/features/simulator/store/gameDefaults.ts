import type { Cultivation, Skill, Treasure } from './gameTypes';

const defaultPhysicalSkills: Skill[] = [
  { name: '横扫千军', level: 140, type: 'physical', targets: 1 },
  { name: '后发制人', level: 130, type: 'physical', targets: 1 },
  { name: '破釜沉舟', level: 125, type: 'physical', targets: 3 },
  { name: '安神诀', level: 110, type: 'magic', targets: 1 },
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

const cloneSkillList = (skills: Skill[]): Skill[] =>
  skills.map((skill) => ({ ...skill }));

const cloneCultivation = (cultivation: Cultivation): Cultivation => ({
  ...cultivation,
});

export const createDefaultPhysicalSkills = (): Skill[] =>
  cloneSkillList(defaultPhysicalSkills);

export const createDefaultPhysicalCultivation = (): Cultivation =>
  cloneCultivation(defaultPhysicalCultivation);

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
