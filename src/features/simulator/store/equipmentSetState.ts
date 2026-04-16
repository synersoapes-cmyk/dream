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

const cloneGemstones = (equipment: Equipment): Equipment['gemstones'] =>
  equipment.gemstones?.map((gemstone) => ({
    ...gemstone,
    stats: gemstone.stats ? { ...gemstone.stats } : undefined,
  }));

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
  gemstones: cloneGemstones(equipment),
  runeStoneSets: cloneRuneStoneSets(equipment),
  runeStoneSetsNames: equipment.runeStoneSetsNames
    ? [...equipment.runeStoneSetsNames]
    : undefined,
});

export const cloneEquipmentList = (equipment: Equipment[]): Equipment[] =>
  equipment.map(cloneEquipmentItem);

export const replaceEquipmentInList = (
  equipmentList: Equipment[],
  equipment: Equipment
): Equipment[] => {
  const existingIndex = equipmentList.findIndex(
    (item) =>
      item.type === equipment.type &&
      (equipment.slot === undefined || item.slot === equipment.slot)
  );

  const nextEquipment = cloneEquipmentList(equipmentList);
  if (existingIndex !== -1) {
    nextEquipment[existingIndex] = cloneEquipmentItem(equipment);
    return nextEquipment;
  }

  return [...nextEquipment, cloneEquipmentItem(equipment)];
};

export const removeEquipmentFromList = (
  equipmentList: Equipment[],
  equipment: Equipment
): Equipment[] => {
  return cloneEquipmentList(equipmentList).filter((item) => {
    if (item.type !== equipment.type) {
      return true;
    }

    if (equipment.slot !== undefined) {
      return item.slot !== equipment.slot;
    }

    return false;
  });
};

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
