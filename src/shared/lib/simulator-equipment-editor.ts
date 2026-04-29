import type { Equipment } from '@/features/simulator/store/gameTypes';

import { getSimulatorStatLabel } from '@/shared/lib/simulator-stat-labels';

import {
  isSimulatorOcrEquipmentType,
  type SimulatorOcrEquipmentType,
} from '@/shared/lib/simulator-equipment';

export const SIMULATOR_EDITABLE_STAT_KEYS = [
  'hp',
  'magic',
  'hit',
  'damage',
  'magicDamage',
  'spellDamageLevel',
  'defense',
  'magicDefense',
  'speed',
  'dodge',
  'physique',
  'magicPower',
  'strength',
  'endurance',
  'agility',
  'sealHit',
  'sealResistLevel',
  'fixedDamage',
  'magicCritLevel',
  'magicResult',
  'pierceLevel',
  'elementalMastery',
  'block',
  'antiCritLevel',
  'elementalResistance',
  'spiritualPower',
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
  weapon: ['damage', 'hit', 'magicDamage', 'spellDamageLevel'],
  helmet: ['defense', 'magicDefense', 'hp', 'magic'],
  necklace: ['magicDamage', 'spellDamageLevel', 'magic', 'speed', 'hp'],
  armor: ['defense', 'hp', 'physique', 'endurance'],
  belt: ['hp', 'defense', 'speed'],
  shoes: ['speed', 'defense', 'agility'],
  trinket: [
    'damage',
    'defense',
    'magicDamage',
    'spellDamageLevel',
    'magicDefense',
    'fixedDamage',
    'speed',
    'magicCritLevel',
    'magicResult',
    'sealHit',
    'pierceLevel',
    'hp',
    'block',
    'sealResistLevel',
    'antiCritLevel',
  ],
  jade: [
    'magicDamage',
    'spellDamageLevel',
    'magicCritLevel',
    'magicResult',
    'magic',
    'speed',
    'fixedDamage',
    'pierceLevel',
    'elementalMastery',
  ],
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
  luckyHoles: '开孔数',
  repairFailCount: '修理失败次数',
  specialEffect: '特效',
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
  'luckyHoles',
  'repairFailCount',
  'specialEffect',
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

export function formatSimulatorEquipmentStatValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function getSimulatorEquipmentInitialValueEntries(equipment: Equipment) {
  const seen = new Set<string>();
  const hintKeys = isSimulatorOcrEquipmentType(equipment.type)
    ? SIMULATOR_EQUIPMENT_TYPE_STAT_HINTS[equipment.type]
    : [];
  const baseEntries = Object.entries(equipment.baseStats ?? {}).filter(
    ([, value]) => typeof value === 'number' && Number.isFinite(value) && value !== 0
  );
  const orderedKeys = [
    ...hintKeys,
    ...baseEntries
      .map(([key]) => key)
      .filter((key) => !hintKeys.includes(key))
      .sort((left, right) =>
        getSimulatorStatLabel(left).localeCompare(getSimulatorStatLabel(right), 'zh-CN')
      ),
  ];

  return orderedKeys
    .filter((key) => {
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((key) => {
      const value = equipment.baseStats?.[key];
      return typeof value === 'number' && Number.isFinite(value) && value !== 0
        ? {
            key,
            label: getSimulatorStatLabel(key),
            value,
          }
        : null;
    })
    .filter(
      (
        entry
      ): entry is {
        key: string;
        label: string;
        value: number;
      } => Boolean(entry)
    );
}
