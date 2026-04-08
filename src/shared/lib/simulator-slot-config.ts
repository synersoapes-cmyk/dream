import {
  SIMULATOR_PRIMARY_EQUIPMENT_TYPES,
  type SimulatorEquipmentType,
  type SimulatorPrimaryEquipmentType,
} from '@/shared/lib/simulator-equipment';

export type SimulatorEquipmentCategoryKey = 'equipment' | 'trinket' | 'jade';
export type SimulatorSlotLabelVariant =
  | 'default'
  | 'laboratory'
  | 'equipmentPanel'
  | 'runeStone';

export type SimulatorSlotDefinition = {
  id: string;
  type: SimulatorEquipmentType;
  slot?: number;
  category: SimulatorEquipmentCategoryKey;
  labels: {
    default: string;
    laboratory?: string;
    equipmentPanel?: string;
    runeStone?: string;
  };
};

export const SIMULATOR_PRIMARY_SLOT_DEFINITIONS: SimulatorSlotDefinition[] = [
  {
    id: 'weapon',
    type: 'weapon',
    category: 'equipment',
    labels: {
      default: '武器',
      laboratory: '武器',
      equipmentPanel: '武器',
      runeStone: '武器',
    },
  },
  {
    id: 'helmet',
    type: 'helmet',
    category: 'equipment',
    labels: {
      default: '头盔',
      laboratory: '头盔',
      equipmentPanel: '头盔',
      runeStone: '头盔',
    },
  },
  {
    id: 'necklace',
    type: 'necklace',
    category: 'equipment',
    labels: {
      default: '项链',
      laboratory: '项链',
      equipmentPanel: '项链',
      runeStone: '项链',
    },
  },
  {
    id: 'armor',
    type: 'armor',
    category: 'equipment',
    labels: {
      default: '衣服',
      laboratory: '衣服',
      equipmentPanel: '铠甲',
      runeStone: '衣服',
    },
  },
  {
    id: 'belt',
    type: 'belt',
    category: 'equipment',
    labels: {
      default: '腰带',
      laboratory: '腰带',
      equipmentPanel: '腰带',
      runeStone: '腰带',
    },
  },
  {
    id: 'shoes',
    type: 'shoes',
    category: 'equipment',
    labels: {
      default: '鞋子',
      laboratory: '鞋子',
      equipmentPanel: '鞋子',
      runeStone: '鞋子',
    },
  },
];

export const SIMULATOR_TRINKET_SLOT_DEFINITIONS: SimulatorSlotDefinition[] = [
  {
    id: 'ring',
    type: 'trinket',
    slot: 1,
    category: 'trinket',
    labels: {
      default: '戒指',
      laboratory: '戒指',
      equipmentPanel: '灵符',
    },
  },
  {
    id: 'earring',
    type: 'trinket',
    slot: 2,
    category: 'trinket',
    labels: {
      default: '耳饰',
      laboratory: '耳饰',
      equipmentPanel: '灵石',
    },
  },
  {
    id: 'bracelet',
    type: 'trinket',
    slot: 3,
    category: 'trinket',
    labels: {
      default: '手镯',
      laboratory: '手镯',
      equipmentPanel: '灵珏',
    },
  },
  {
    id: 'pendant',
    type: 'trinket',
    slot: 4,
    category: 'trinket',
    labels: {
      default: '佩饰',
      laboratory: '佩饰',
      equipmentPanel: '灵玉',
    },
  },
];

export const SIMULATOR_JADE_SLOT_DEFINITIONS: SimulatorSlotDefinition[] = [
  {
    id: 'jade1',
    type: 'jade',
    slot: 1,
    category: 'jade',
    labels: {
      default: '阳玉',
      laboratory: '阳玉',
      equipmentPanel: '阳玉',
    },
  },
  {
    id: 'jade2',
    type: 'jade',
    slot: 2,
    category: 'jade',
    labels: {
      default: '阴玉',
      laboratory: '阴玉',
      equipmentPanel: '阴玉',
    },
  },
];

export const SIMULATOR_CATEGORY_CONFIG = [
  { key: 'equipment' as const, name: '装备' },
  { key: 'trinket' as const, name: '灵饰' },
  { key: 'jade' as const, name: '玉魄' },
];

export const SIMULATOR_SLOT_DEFINITIONS: SimulatorSlotDefinition[] = [
  ...SIMULATOR_PRIMARY_SLOT_DEFINITIONS,
  ...SIMULATOR_TRINKET_SLOT_DEFINITIONS,
  ...SIMULATOR_JADE_SLOT_DEFINITIONS,
];

export const SIMULATOR_RUNE_STONE_SLOT_DEFINITIONS =
  SIMULATOR_PRIMARY_SLOT_DEFINITIONS.filter((slot) => slot.type !== 'necklace');

export function getSimulatorSlotDefinitions(
  category: SimulatorEquipmentCategoryKey
) {
  switch (category) {
    case 'equipment':
      return SIMULATOR_PRIMARY_SLOT_DEFINITIONS;
    case 'trinket':
      return SIMULATOR_TRINKET_SLOT_DEFINITIONS;
    case 'jade':
      return SIMULATOR_JADE_SLOT_DEFINITIONS;
  }
}

export function getDefaultSimulatorSecondaryCategory(
  category: SimulatorEquipmentCategoryKey
) {
  return getSimulatorSlotDefinitions(category)[0]?.id ?? 'weapon';
}

export function getSimulatorSlotLabel(
  slot: SimulatorSlotDefinition,
  variant: SimulatorSlotLabelVariant = 'default'
) {
  if (variant === 'equipmentPanel') {
    return slot.labels.equipmentPanel ?? slot.labels.default;
  }
  if (variant === 'laboratory') {
    return slot.labels.laboratory ?? slot.labels.default;
  }
  if (variant === 'runeStone') {
    return (
      slot.labels.runeStone ?? slot.labels.laboratory ?? slot.labels.default
    );
  }
  return slot.labels.default;
}

export function findSimulatorSlotDefinition(
  type: SimulatorEquipmentType,
  slot?: number
) {
  return SIMULATOR_SLOT_DEFINITIONS.find(
    (definition) =>
      definition.type === type &&
      (definition.slot === undefined || definition.slot === slot)
  );
}

export function matchesSimulatorSlotDefinition(
  definition: Pick<SimulatorSlotDefinition, 'type' | 'slot'>,
  equipment: Pick<SimulatorSlotDefinition, 'type' | 'slot'>
) {
  return (
    definition.type === equipment.type &&
    (definition.slot === undefined || definition.slot === equipment.slot)
  );
}

export function isSimulatorPrimaryEquipmentType(
  type: SimulatorEquipmentType
): type is SimulatorPrimaryEquipmentType {
  return (SIMULATOR_PRIMARY_EQUIPMENT_TYPES as readonly string[]).includes(
    type
  );
}
