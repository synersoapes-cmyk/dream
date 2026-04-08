import type { Equipment } from '@/features/simulator/store/gameTypes';

import type { SimulatorOcrEquipmentType } from '@/shared/lib/simulator-equipment';

export const SIMULATOR_EDITABLE_STAT_KEYS = [
  'hp',
  'magic',
  'hit',
  'damage',
  'magicDamage',
  'defense',
  'magicDefense',
  'speed',
  'dodge',
  'physique',
  'magicPower',
  'strength',
  'endurance',
  'agility',
] as const;

export const SIMULATOR_EQUIPMENT_TYPE_OPTIONS: Array<{
  value: SimulatorOcrEquipmentType;
  label: string;
}> = [
  { value: 'weapon', label: '武器' },
  { value: 'helmet', label: '头盔' },
  { value: 'necklace', label: '项链' },
  { value: 'armor', label: '衣服' },
  { value: 'belt', label: '腰带' },
  { value: 'shoes', label: '鞋子' },
  { value: 'trinket', label: '灵饰' },
  { value: 'jade', label: '玉魄' },
];

export const SIMULATOR_EQUIPMENT_TYPE_STAT_HINTS: Record<
  SimulatorOcrEquipmentType,
  string[]
> = {
  weapon: ['damage', 'hit', 'magicDamage'],
  helmet: ['defense', 'magicDefense', 'hp', 'magic'],
  necklace: ['magicDamage', 'magic', 'speed', 'hp'],
  armor: ['defense', 'hp', 'physique', 'endurance'],
  belt: ['hp', 'defense', 'speed'],
  shoes: ['speed', 'defense', 'agility'],
  trinket: ['damage', 'magicDamage', 'speed', 'defense', 'magicDefense'],
  jade: ['damage', 'magicDamage', 'hp', 'defense', 'magicDefense', 'speed'],
};

export const SIMULATOR_EQUIPMENT_FIELD_LABELS = {
  name: '名称',
  type: '类型',
  slot: '槽位',
  mainStat: '主属性描述',
  extraStat: '附加描述',
  level: '等级',
  element: '五行',
  durability: '耐久',
  forgeLevel: '锻炼等级',
  gemstone: '宝石',
  price: '售价',
  crossServerFee: '跨服费',
  highlights: '亮点标签',
  equippableRoles: '装备角色',
} satisfies Partial<Record<keyof Equipment, string>>;

export const SIMULATOR_CHANGE_TRACKED_FIELDS: Array<keyof Equipment> = [
  'name',
  'type',
  'slot',
  'mainStat',
  'extraStat',
  'level',
  'element',
  'durability',
  'forgeLevel',
  'gemstone',
  'price',
  'crossServerFee',
  'highlights',
];

export function getSimulatorEquipmentFieldLabel(key: string) {
  return (
    SIMULATOR_EQUIPMENT_FIELD_LABELS[
      key as keyof typeof SIMULATOR_EQUIPMENT_FIELD_LABELS
    ] ?? key
  );
}
