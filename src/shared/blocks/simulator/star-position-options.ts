import type { StarPositionConfig } from '@/features/simulator/store/gameTypes';

export const STAR_POSITION_OPTIONS: StarPositionConfig[] = [
  {
    id: 'none',
    label: '无',
    attrType: '',
    attrValue: 0,
  },
  {
    id: 'damage_2_5',
    label: '伤害 +2.5',
    attrType: 'damage',
    attrValue: 2.5,
    starType: 'damage',
    yinYangState: 'yang',
  },
  {
    id: 'hp_10',
    label: '气血 +10',
    attrType: 'hp',
    attrValue: 10,
    starType: 'hp',
    yinYangState: 'yin',
  },
  {
    id: 'speed_1_5',
    label: '速度 +1.5',
    attrType: 'speed',
    attrValue: 1.5,
    starType: 'speed',
    yinYangState: 'yang',
  },
  {
    id: 'defense_2',
    label: '防御 +2',
    attrType: 'defense',
    attrValue: 2,
    starType: 'defense',
    yinYangState: 'yin',
  },
  {
    id: 'magic_damage_2_5',
    label: '法伤 +2.5',
    attrType: 'magicDamage',
    attrValue: 2.5,
    starType: 'magicDamage',
    yinYangState: 'yang',
  },
  {
    id: 'dodge_2',
    label: '躲避 +2',
    attrType: 'dodge',
    attrValue: 2,
    starType: 'dodge',
    yinYangState: 'yin',
  },
];

export function findStarPositionOptionByLabel(label: string | null | undefined) {
  const normalized = String(label || '').trim();
  return STAR_POSITION_OPTIONS.find((item) => item.label === normalized) ?? null;
}
