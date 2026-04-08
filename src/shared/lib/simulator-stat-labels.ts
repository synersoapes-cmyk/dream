export type SimulatorStatLabelVariant = 'default' | 'equipment' | 'mainStat';

const SIMULATOR_STAT_LABELS: Record<
  SimulatorStatLabelVariant,
  Record<string, string>
> = {
  default: {
    hp: '气血',
    magic: '魔法',
    hit: '命中',
    damage: '伤害',
    magicDamage: '法伤',
    defense: '防御',
    magicDefense: '法防',
    speed: '速度',
    dodge: '躲避',
    physique: '体质',
    magicPower: '魔力',
    strength: '力量',
    endurance: '耐力',
    agility: '敏捷',
    sealHit: '封印命中',
    fixedDamage: '固定伤害',
  },
  equipment: {
    hp: '气血',
    magic: '魔力',
    hit: '命中',
    damage: '伤害',
    magicDamage: '法伤',
    defense: '防御',
    magicDefense: '法防',
    speed: '速度',
    dodge: '躲避',
    physique: '体质',
    magicPower: '魔力',
    strength: '力量',
    endurance: '耐力',
    agility: '敏捷',
    sealHit: '封印命中',
    fixedDamage: '固定伤害',
  },
  mainStat: {
    hp: '气血',
    magic: '魔力',
    hit: '命中',
    damage: '伤害',
    magicDamage: '法伤',
    defense: '防御',
    magicDefense: '法防',
    speed: '速度',
    dodge: '躲避',
    physique: '体质',
    magicPower: '灵力',
    strength: '力量',
    endurance: '耐力',
    agility: '敏捷',
    sealHit: '封印命中',
    fixedDamage: '固定伤害',
  },
};

export function getSimulatorStatLabel(
  key: string,
  variant: SimulatorStatLabelVariant = 'default'
) {
  return SIMULATOR_STAT_LABELS[variant][key] ?? key;
}
