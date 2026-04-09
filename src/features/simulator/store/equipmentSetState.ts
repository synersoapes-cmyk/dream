import type { Equipment, EquipmentSet } from './gameTypes';

const cloneRuneStoneSets = (equipment: Equipment): Equipment['runeStoneSets'] =>
  equipment.runeStoneSets?.map((set) =>
    set.map((runeStone) => ({
      ...runeStone,
      stats: { ...runeStone.stats },
    }))
  );

const cloneEffectModifiers = (
  equipment: Equipment
): Equipment['effectModifiers'] =>
  equipment.effectModifiers?.map((modifier) => ({ ...modifier }));

export const cloneEquipmentItem = (equipment: Equipment): Equipment => ({
  ...equipment,
  highlights: equipment.highlights ? [...equipment.highlights] : undefined,
  effectModifiers: cloneEffectModifiers(equipment),
  starPositionConfig: equipment.starPositionConfig
    ? { ...equipment.starPositionConfig }
    : undefined,
  starAlignmentConfig: equipment.starAlignmentConfig
    ? {
        ...equipment.starAlignmentConfig,
        colors: equipment.starAlignmentConfig.colors
          ? [...equipment.starAlignmentConfig.colors]
          : undefined,
      }
    : undefined,
  baseStats: { ...equipment.baseStats },
  stats: { ...equipment.stats },
  runeStoneSets: cloneRuneStoneSets(equipment),
  runeStoneSetsNames: equipment.runeStoneSetsNames
    ? [...equipment.runeStoneSetsNames]
    : undefined,
});

export const cloneEquipmentList = (equipment: Equipment[]): Equipment[] =>
  equipment.map(cloneEquipmentItem);

export const getDefaultEquipmentSetName = (index: number) => `配置${index + 1}`;

export const createEquipmentSet = (
  index: number,
  equipment: Equipment[],
  name?: string
): EquipmentSet => ({
  id: `set_${index + 1}`,
  name: name ?? getDefaultEquipmentSetName(index),
  items: cloneEquipmentList(equipment),
  isActive: false,
});

export const ensureEquipmentSets = (
  equipmentSets: EquipmentSet[],
  requiredIndex: number,
  fallbackEquipment: Equipment[]
): EquipmentSet[] => {
  const nextSets = equipmentSets.map((set, index) => ({
    ...set,
    items: cloneEquipmentList(set.items),
  }));

  while (nextSets.length <= requiredIndex) {
    nextSets.push(createEquipmentSet(nextSets.length, fallbackEquipment));
  }

  return nextSets;
};

export const syncEquipmentSetsWithActiveEquipment = (
  equipmentSets: EquipmentSet[],
  activeSetIndex: number,
  equipment: Equipment[]
): EquipmentSet[] => {
  const normalizedSets = ensureEquipmentSets(
    equipmentSets,
    activeSetIndex,
    equipment
  );

  return normalizedSets.map((set, index) => ({
    ...set,
    items: index === activeSetIndex ? cloneEquipmentList(equipment) : set.items,
    isActive: index === activeSetIndex,
  }));
};

type EquipmentSetStateFields = {
  equipment: Equipment[];
  equipmentSets: EquipmentSet[];
  activeSetIndex: number;
};

export const buildEquipmentSetStatePatch = (
  _state: unknown,
  fields: EquipmentSetStateFields
) => fields;
