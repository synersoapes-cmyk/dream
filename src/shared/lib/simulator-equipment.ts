export const SIMULATOR_PRIMARY_EQUIPMENT_TYPES = [
  'weapon',
  'helmet',
  'necklace',
  'armor',
  'belt',
  'shoes',
] as const;

export const SIMULATOR_ACCESSORY_EQUIPMENT_TYPES = ['trinket', 'jade'] as const;

export const SIMULATOR_OCR_EQUIPMENT_TYPES = [
  ...SIMULATOR_PRIMARY_EQUIPMENT_TYPES,
  ...SIMULATOR_ACCESSORY_EQUIPMENT_TYPES,
] as const;

export const SIMULATOR_EQUIPMENT_TYPES = [
  ...SIMULATOR_OCR_EQUIPMENT_TYPES,
  'runeStone',
  'rune',
] as const;

export const SIMULATOR_TRINKET_SLOTS = [1, 2, 3, 4] as const;
export const SIMULATOR_JADE_SLOTS = [1, 2] as const;

export type SimulatorPrimaryEquipmentType =
  (typeof SIMULATOR_PRIMARY_EQUIPMENT_TYPES)[number];
export type SimulatorAccessoryEquipmentType =
  (typeof SIMULATOR_ACCESSORY_EQUIPMENT_TYPES)[number];
export type SimulatorOcrEquipmentType =
  (typeof SIMULATOR_OCR_EQUIPMENT_TYPES)[number];
export type SimulatorEquipmentType = (typeof SIMULATOR_EQUIPMENT_TYPES)[number];
export type SimulatorTrinketSlot = (typeof SIMULATOR_TRINKET_SLOTS)[number];
export type SimulatorJadeSlot = (typeof SIMULATOR_JADE_SLOTS)[number];

export type SimulatorEquipmentSlot =
  | SimulatorOcrEquipmentType
  | 'ring'
  | 'earring'
  | 'bracelet'
  | 'amulet'
  | (string & {});

const EQUIPMENT_TYPE_ALIAS_MAP: Record<string, SimulatorEquipmentType> = {
  weapon: 'weapon',
  arms: 'weapon',
  武器: 'weapon',
  helmet: 'helmet',
  head: 'helmet',
  headwear: 'helmet',
  头盔: 'helmet',
  necklace: 'necklace',
  项链: 'necklace',
  armor: 'armor',
  cloth: 'armor',
  clothes: 'armor',
  衣服: 'armor',
  belt: 'belt',
  腰带: 'belt',
  shoes: 'shoes',
  鞋子: 'shoes',
  trinket: 'trinket',
  ring: 'trinket',
  earring: 'trinket',
  bracelet: 'trinket',
  amulet: 'trinket',
  pendant: 'trinket',
  戒指: 'trinket',
  耳饰: 'trinket',
  手镯: 'trinket',
  佩饰: 'trinket',
  灵饰: 'trinket',
  jade: 'jade',
  jade1: 'jade',
  jade2: 'jade',
  玉佩: 'jade',
  玉魄: 'jade',
  阳玉: 'jade',
  阴玉: 'jade',
  runestone: 'runeStone',
  rune_stone: 'runeStone',
  符石: 'runeStone',
  rune: 'rune',
};

const DOMAIN_SLOT_ALIAS_MAP: Record<string, SimulatorEquipmentSlot> = {
  weapon: 'weapon',
  arms: 'weapon',
  武器: 'weapon',
  helmet: 'helmet',
  head: 'helmet',
  headwear: 'helmet',
  头盔: 'helmet',
  necklace: 'necklace',
  项链: 'necklace',
  armor: 'armor',
  cloth: 'armor',
  clothes: 'armor',
  衣服: 'armor',
  belt: 'belt',
  腰带: 'belt',
  shoes: 'shoes',
  鞋子: 'shoes',
  ring: 'ring',
  戒指: 'ring',
  earring: 'earring',
  耳饰: 'earring',
  bracelet: 'bracelet',
  手镯: 'bracelet',
  amulet: 'amulet',
  pendant: 'amulet',
  佩饰: 'amulet',
  trinket: 'trinket',
  灵饰: 'trinket',
  jade: 'jade',
  jade1: 'jade',
  jade2: 'jade',
  玉佩: 'jade',
  玉魄: 'jade',
  阳玉: 'jade',
  阴玉: 'jade',
};

export function normalizeSimulatorEquipmentType(
  value: string | null | undefined,
  fallback: SimulatorEquipmentType = 'weapon'
): SimulatorEquipmentType {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return fallback;
  }

  const normalized = raw.toLowerCase();
  const alias =
    EQUIPMENT_TYPE_ALIAS_MAP[raw] ?? EQUIPMENT_TYPE_ALIAS_MAP[normalized];
  if (alias) {
    return alias;
  }

  if (normalized.startsWith('trinket') || normalized.startsWith('ring')) {
    return 'trinket';
  }
  if (normalized.startsWith('jade')) {
    return 'jade';
  }
  if (normalized.startsWith('weapon')) {
    return 'weapon';
  }
  if (normalized.startsWith('helmet') || normalized.startsWith('head')) {
    return 'helmet';
  }
  if (normalized.startsWith('necklace')) {
    return 'necklace';
  }
  if (normalized.startsWith('armor') || normalized.startsWith('cloth')) {
    return 'armor';
  }
  if (normalized.startsWith('belt')) {
    return 'belt';
  }
  if (normalized.startsWith('shoes')) {
    return 'shoes';
  }

  return fallback;
}

export function isSimulatorOcrEquipmentType(
  value: string
): value is SimulatorOcrEquipmentType {
  return (SIMULATOR_OCR_EQUIPMENT_TYPES as readonly string[]).includes(value);
}

export function normalizeSimulatorOcrEquipmentType(
  value: string | null | undefined,
  fallback: SimulatorOcrEquipmentType = 'weapon'
): SimulatorOcrEquipmentType {
  const normalized = normalizeSimulatorEquipmentType(value, fallback);
  return isSimulatorOcrEquipmentType(normalized) ? normalized : fallback;
}

export function normalizeSimulatorEquipmentSlot(
  value: string | null | undefined,
  fallback: SimulatorEquipmentSlot = 'weapon'
): SimulatorEquipmentSlot {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return fallback;
  }

  const normalized = raw.toLowerCase();
  return (
    DOMAIN_SLOT_ALIAS_MAP[raw] ??
    DOMAIN_SLOT_ALIAS_MAP[normalized] ??
    (raw as SimulatorEquipmentSlot)
  );
}

export function extractSimulatorEquipmentSlotNumber(
  value: string | null | undefined
): number | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : undefined;
}
