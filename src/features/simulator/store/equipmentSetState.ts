import type {
  AccountData,
  Equipment,
  EquipmentSet,
  GameState,
} from './gameTypes';

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
  baseStats: { ...equipment.baseStats },
  stats: { ...equipment.stats },
  runeStoneSets: cloneRuneStoneSets(equipment),
  runeStoneSetsNames: equipment.runeStoneSetsNames
    ? [...equipment.runeStoneSetsNames]
    : undefined,
});

export const cloneEquipmentList = (equipment: Equipment[]): Equipment[] =>
  equipment.map(cloneEquipmentItem);

const createEquipmentSet = (
  index: number,
  equipment: Equipment[],
  name?: string
): EquipmentSet => ({
  id: `set_${index + 1}`,
  name: name ?? `配置${index + 1}`,
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

type SyncedAccountFields = Pick<
  AccountData,
  'equipment' | 'equipmentSets' | 'activeSetIndex'
>;

export const syncActiveAccountCollections = (
  accounts: AccountData[],
  activeAccountId: string,
  fields: SyncedAccountFields
): AccountData[] =>
  accounts.map((account) =>
    account.id === activeAccountId ? { ...account, ...fields } : account
  );

export const buildEquipmentSetStatePatch = (
  state: Pick<GameState, 'accounts' | 'activeAccountId'>,
  fields: SyncedAccountFields
) => ({
  ...fields,
  accounts: syncActiveAccountCollections(
    state.accounts,
    state.activeAccountId,
    fields
  ),
});
