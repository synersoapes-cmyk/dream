import { inArray } from 'drizzle-orm';

import { db } from '@/core/db';
import { initD1ContextForDev } from '@/core/db/d1';
import { config } from '@/config/db/schema';

export type SimulatorSeedProfile = {
  school: string;
  level: number;
  physique: number;
  magic: number;
  strength: number;
  endurance: number;
  agility: number;
  potentialPoints: number;
  hp: number;
  mp: number;
  damage: number;
  defense: number;
  magicDamage: number;
  magicDefense: number;
  speed: number;
  hit: number;
  sealHit: number;
  rawBodyJson: string;
};

export type SimulatorSeedSkill = {
  skillCode: string;
  skillName: string;
  baseLevel: number;
  extraLevel: number;
  finalLevel: number;
};

export type SimulatorSeedCultivation = {
  cultivationType: string;
  level: number;
};

export type SimulatorSeedEquipmentAttr = {
  attrType: string;
  attrValue: number;
  attrGroup: string;
};

export type SimulatorSeedEquipment = {
  slot: string;
  snapshotSlot: string;
  name: string;
  level: number;
  quality: string;
  price: number;
  refineLevel: number;
  attrs: SimulatorSeedEquipmentAttr[];
};

export type SimulatorSeedCharacterMeta = {
  roleType: string;
  race: string;
  serverName: string;
  snapshotName: string;
  snapshotNotes: string;
};

export type SimulatorSeedBattleContext = {
  selfFormation: string;
  selfElement: string;
  formationCounterState: string;
  elementRelation: string;
  transformCardFactor: number;
  splitTargetCount: number;
  shenmuValue: number;
  magicResult: number;
  targetName: string;
  targetLevel: number;
  targetHp: number;
  targetDefense: number;
  targetMagicDefense: number;
  targetSpeed: number;
  targetMagicDefenseCultivation: number;
  targetElement: string;
  targetFormation: string;
};

export type SimulatorSeedConfig = {
  characterMeta: SimulatorSeedCharacterMeta;
  profile: SimulatorSeedProfile;
  skills: SimulatorSeedSkill[];
  cultivations: SimulatorSeedCultivation[];
  equipments: SimulatorSeedEquipment[];
  battleContext: SimulatorSeedBattleContext;
};

export const SIMULATOR_SEED_CONFIG_KEYS = {
  characterMeta: 'simulator.default.character_meta',
  profile: 'simulator.default.profile',
  skills: 'simulator.default.skills',
  cultivations: 'simulator.default.cultivations',
  equipments: 'simulator.default.equipments',
  battleContext: 'simulator.default.battle_context',
} as const;

export const DEFAULT_SIMULATOR_CHARACTER_META: SimulatorSeedCharacterMeta = {
  roleType: '法师',
  race: '仙族',
  serverName: '默认测试服',
  snapshotName: '默认初始快照',
  snapshotNotes: '新用户自动创建的实验室默认档案',
};

export const DEFAULT_SIMULATOR_PROFILE: SimulatorSeedProfile = {
  school: '龙宫',
  level: 89,
  physique: 40,
  magic: 210,
  strength: 20,
  endurance: 30,
  agility: 25,
  potentialPoints: 0,
  hp: 3850,
  mp: 1720,
  damage: 860,
  defense: 920,
  magicDamage: 1460,
  magicDefense: 1180,
  speed: 540,
  hit: 990,
  sealHit: 0,
  rawBodyJson: JSON.stringify({
    hp: 3850,
    magic: 210,
    physique: 40,
    strength: 20,
    endurance: 30,
    agility: 25,
    magicPower: 520,
    dodge: 180,
  }),
};

export const DEFAULT_SIMULATOR_SKILLS: SimulatorSeedSkill[] = [
  { skillCode: 'dragon_teng', skillName: '龙腾', baseLevel: 119, extraLevel: 0, finalLevel: 119 },
  { skillCode: 'dragon_roll', skillName: '龙卷雨击', baseLevel: 129, extraLevel: 0, finalLevel: 129 },
  { skillCode: 'dragon_yin', skillName: '龙吟', baseLevel: 110, extraLevel: 0, finalLevel: 110 },
  { skillCode: 'dragon_xiao', skillName: '龙啸', baseLevel: 105, extraLevel: 0, finalLevel: 105 },
];

export const DEFAULT_SIMULATOR_CULTIVATIONS: SimulatorSeedCultivation[] = [
  { cultivationType: 'physicalAttack', level: 0 },
  { cultivationType: 'physicalDefense', level: 15 },
  { cultivationType: 'magicAttack', level: 20 },
  { cultivationType: 'magicDefense', level: 15 },
  { cultivationType: 'petPhysicalAttack', level: 12 },
];

export const DEFAULT_SIMULATOR_EQUIPMENTS: SimulatorSeedEquipment[] = [
  {
    slot: 'weapon',
    snapshotSlot: 'weapon',
    name: '沧海灵杖',
    level: 90,
    quality: '稀有',
    price: 1880000,
    refineLevel: 8,
    attrs: [
      { attrType: 'magicDamage', attrValue: 220, attrGroup: 'base' },
      { attrType: 'hit', attrValue: 120, attrGroup: 'base' },
      { attrType: 'magic', attrValue: 18, attrGroup: 'extra' },
    ],
  },
  {
    slot: 'helmet',
    snapshotSlot: 'helmet',
    name: '玄冰宝冠',
    level: 90,
    quality: '稀有',
    price: 920000,
    refineLevel: 7,
    attrs: [
      { attrType: 'magicDefense', attrValue: 160, attrGroup: 'base' },
      { attrType: 'defense', attrValue: 65, attrGroup: 'base' },
      { attrType: 'magic', attrValue: 12, attrGroup: 'extra' },
    ],
  },
  {
    slot: 'necklace',
    snapshotSlot: 'necklace',
    name: '碧海项链',
    level: 90,
    quality: '珍品',
    price: 1280000,
    refineLevel: 8,
    attrs: [
      { attrType: 'magicDamage', attrValue: 128, attrGroup: 'base' },
      { attrType: 'magic', attrValue: 28, attrGroup: 'extra' },
    ],
  },
  {
    slot: 'armor',
    snapshotSlot: 'armor',
    name: '流云法袍',
    level: 90,
    quality: '稀有',
    price: 1040000,
    refineLevel: 7,
    attrs: [
      { attrType: 'defense', attrValue: 185, attrGroup: 'base' },
      { attrType: 'magicDefense', attrValue: 105, attrGroup: 'base' },
      { attrType: 'physique', attrValue: 16, attrGroup: 'extra' },
    ],
  },
  {
    slot: 'belt',
    snapshotSlot: 'belt',
    name: '星河腰带',
    level: 90,
    quality: '稀有',
    price: 760000,
    refineLevel: 6,
    attrs: [
      { attrType: 'speed', attrValue: 65, attrGroup: 'base' },
      { attrType: 'defense', attrValue: 48, attrGroup: 'base' },
      { attrType: 'agility', attrValue: 10, attrGroup: 'extra' },
    ],
  },
  {
    slot: 'shoes',
    snapshotSlot: 'shoes',
    name: '踏浪靴',
    level: 90,
    quality: '珍品',
    price: 830000,
    refineLevel: 6,
    attrs: [
      { attrType: 'speed', attrValue: 72, attrGroup: 'base' },
      { attrType: 'dodge', attrValue: 35, attrGroup: 'base' },
      { attrType: 'agility', attrValue: 12, attrGroup: 'extra' },
    ],
  },
  {
    slot: 'trinket1',
    snapshotSlot: 'trinket1',
    name: '灵符·潮声',
    level: 160,
    quality: '珍品',
    price: 2200000,
    refineLevel: 6,
    attrs: [
      { attrType: 'magicDamage', attrValue: 86, attrGroup: 'base' },
      { attrType: 'speed', attrValue: 16, attrGroup: 'extra' },
    ],
  },
  {
    slot: 'trinket2',
    snapshotSlot: 'trinket2',
    name: '灵石·观澜',
    level: 160,
    quality: '珍品',
    price: 1980000,
    refineLevel: 5,
    attrs: [
      { attrType: 'magicDamage', attrValue: 72, attrGroup: 'base' },
      { attrType: 'magic', attrValue: 32, attrGroup: 'extra' },
    ],
  },
  {
    slot: 'trinket3',
    snapshotSlot: 'trinket3',
    name: '灵佩·追云',
    level: 160,
    quality: '稀有',
    price: 1760000,
    refineLevel: 5,
    attrs: [
      { attrType: 'speed', attrValue: 28, attrGroup: 'base' },
      { attrType: 'magicDamage', attrValue: 60, attrGroup: 'extra' },
    ],
  },
  {
    slot: 'trinket4',
    snapshotSlot: 'trinket4',
    name: '灵玉·映月',
    level: 160,
    quality: '稀有',
    price: 1680000,
    refineLevel: 5,
    attrs: [
      { attrType: 'magicDamage', attrValue: 68, attrGroup: 'base' },
      { attrType: 'hit', attrValue: 35, attrGroup: 'extra' },
    ],
  },
  {
    slot: 'jade1',
    snapshotSlot: 'jade1',
    name: '阳玉',
    level: 120,
    quality: '珍品',
    price: 980000,
    refineLevel: 4,
    attrs: [
      { attrType: 'magicDamage', attrValue: 55, attrGroup: 'base' },
      { attrType: 'speed', attrValue: 12, attrGroup: 'extra' },
    ],
  },
  {
    slot: 'jade2',
    snapshotSlot: 'jade2',
    name: '阴玉',
    level: 120,
    quality: '珍品',
    price: 960000,
    refineLevel: 4,
    attrs: [
      { attrType: 'magicDefense', attrValue: 42, attrGroup: 'base' },
      { attrType: 'defense', attrValue: 36, attrGroup: 'extra' },
    ],
  },
];

export const DEFAULT_SIMULATOR_BATTLE_CONTEXT: SimulatorSeedBattleContext = {
  selfFormation: '天覆阵',
  selfElement: '水',
  formationCounterState: '无克/普通',
  elementRelation: '无克/普通',
  transformCardFactor: 1,
  splitTargetCount: 1,
  shenmuValue: 0,
  magicResult: 0,
  targetName: '默认目标',
  targetLevel: 0,
  targetHp: 0,
  targetDefense: 0,
  targetMagicDefense: 0,
  targetSpeed: 0,
  targetMagicDefenseCultivation: 0,
  targetElement: '',
  targetFormation: '普通阵',
};

const DEFAULT_SIMULATOR_SEED_CONFIG: SimulatorSeedConfig = {
  characterMeta: DEFAULT_SIMULATOR_CHARACTER_META,
  profile: DEFAULT_SIMULATOR_PROFILE,
  skills: DEFAULT_SIMULATOR_SKILLS,
  cultivations: DEFAULT_SIMULATOR_CULTIVATIONS,
  equipments: DEFAULT_SIMULATOR_EQUIPMENTS,
  battleContext: DEFAULT_SIMULATOR_BATTLE_CONTEXT,
};

export class SimulatorSeedConfigMissingError extends Error {
  constructor(missingKeys: string[]) {
    super(
      `Simulator default config is missing in database: ${missingKeys.join(', ')}`
    );
    this.name = 'SimulatorSeedConfigMissingError';
  }
}

export function serializeSimulatorSeedConfig(config: SimulatorSeedConfig) {
  return {
    [SIMULATOR_SEED_CONFIG_KEYS.characterMeta]: JSON.stringify(config.characterMeta),
    [SIMULATOR_SEED_CONFIG_KEYS.profile]: JSON.stringify(config.profile),
    [SIMULATOR_SEED_CONFIG_KEYS.skills]: JSON.stringify(config.skills),
    [SIMULATOR_SEED_CONFIG_KEYS.cultivations]: JSON.stringify(config.cultivations),
    [SIMULATOR_SEED_CONFIG_KEYS.equipments]: JSON.stringify(config.equipments),
    [SIMULATOR_SEED_CONFIG_KEYS.battleContext]: JSON.stringify(config.battleContext),
  };
}

export function parseSimulatorSeedConfigInput(input: {
  characterMeta: string;
  profile: string;
  skills: string;
  cultivations: string;
  equipments: string;
  battleContext: string;
}): SimulatorSeedConfig {
  return {
    characterMeta: parseSeedValue(
      input.characterMeta,
      DEFAULT_SIMULATOR_CHARACTER_META,
    ),
    profile: parseSeedValue(input.profile, DEFAULT_SIMULATOR_PROFILE),
    skills: parseSeedValue(input.skills, DEFAULT_SIMULATOR_SKILLS),
    cultivations: parseSeedValue(
      input.cultivations,
      DEFAULT_SIMULATOR_CULTIVATIONS,
    ),
    equipments: parseSeedValue(input.equipments, DEFAULT_SIMULATOR_EQUIPMENTS),
    battleContext: parseSeedValue(
      input.battleContext,
      DEFAULT_SIMULATOR_BATTLE_CONTEXT,
    ),
  };
}

function cloneSeedValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parseSeedValue<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) {
    return cloneSeedValue(fallback);
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return cloneSeedValue(fallback);
  }
}

async function ensureSimulatorSeedDbReady() {
  await initD1ContextForDev();
}

export async function seedSimulatorSeedConfig() {
  await ensureSimulatorSeedDbReady();

  const names = Object.values(SIMULATOR_SEED_CONFIG_KEYS);
  const rows = await db()
    .select({ name: config.name })
    .from(config)
    .where(inArray(config.name, names));

  const existing = new Set<string>(rows.map((row: { name: string }) => row.name));
  const missingRows = Object.entries(SIMULATOR_SEED_CONFIG_KEYS)
    .filter(([, name]) => !existing.has(name))
    .map(([key, name]) => ({
      name,
      value: JSON.stringify(
        DEFAULT_SIMULATOR_SEED_CONFIG[key as keyof SimulatorSeedConfig],
      ),
    }));

  if (missingRows.length > 0) {
    await db().insert(config).values(missingRows);
  }
}

async function loadSimulatorSeedConfigRows() {
  await ensureSimulatorSeedDbReady();

  const names = Object.values(SIMULATOR_SEED_CONFIG_KEYS);
  const rows = await db()
    .select({ name: config.name, value: config.value })
    .from(config)
    .where(inArray(config.name, names));

  return new Map<string, string | null>(
    rows.map((row: { name: string; value: string | null }) => [
      row.name,
      row.value,
    ]),
  );
}

export async function getSimulatorSeedConfig(): Promise<SimulatorSeedConfig> {
  try {
    const valueByName = await loadSimulatorSeedConfigRows();

    return {
      characterMeta: parseSeedValue(
        valueByName.get(SIMULATOR_SEED_CONFIG_KEYS.characterMeta),
        DEFAULT_SIMULATOR_CHARACTER_META,
      ),
      profile: parseSeedValue(
        valueByName.get(SIMULATOR_SEED_CONFIG_KEYS.profile),
        DEFAULT_SIMULATOR_PROFILE,
      ),
      skills: parseSeedValue(
        valueByName.get(SIMULATOR_SEED_CONFIG_KEYS.skills),
        DEFAULT_SIMULATOR_SKILLS,
      ),
      cultivations: parseSeedValue(
        valueByName.get(SIMULATOR_SEED_CONFIG_KEYS.cultivations),
        DEFAULT_SIMULATOR_CULTIVATIONS,
      ),
      equipments: parseSeedValue(
        valueByName.get(SIMULATOR_SEED_CONFIG_KEYS.equipments),
        DEFAULT_SIMULATOR_EQUIPMENTS,
      ),
      battleContext: parseSeedValue(
        valueByName.get(SIMULATOR_SEED_CONFIG_KEYS.battleContext),
        DEFAULT_SIMULATOR_BATTLE_CONTEXT,
      ),
    };
  } catch (error) {
    console.warn(
      'Failed to load simulator seed config from D1, using built-in defaults:',
      error,
    );

    return cloneSeedValue(DEFAULT_SIMULATOR_SEED_CONFIG);
  }
}

export async function getRequiredSimulatorSeedConfig(): Promise<SimulatorSeedConfig> {
  try {
    let valueByName = await loadSimulatorSeedConfigRows();
    const missingKeys = Object.values(SIMULATOR_SEED_CONFIG_KEYS).filter(
      (key) => !valueByName.has(key) || !valueByName.get(key)
    );

    if (missingKeys.length > 0) {
      await seedSimulatorSeedConfig();
      valueByName = await loadSimulatorSeedConfigRows();
    }

    const stillMissingKeys = Object.values(SIMULATOR_SEED_CONFIG_KEYS).filter(
      (key) => !valueByName.has(key) || !valueByName.get(key)
    );

    if (stillMissingKeys.length > 0) {
      throw new SimulatorSeedConfigMissingError(stillMissingKeys);
    }

    return {
      characterMeta: parseSeedValue(
        valueByName.get(SIMULATOR_SEED_CONFIG_KEYS.characterMeta),
        DEFAULT_SIMULATOR_CHARACTER_META,
      ),
      profile: parseSeedValue(
        valueByName.get(SIMULATOR_SEED_CONFIG_KEYS.profile),
        DEFAULT_SIMULATOR_PROFILE,
      ),
      skills: parseSeedValue(
        valueByName.get(SIMULATOR_SEED_CONFIG_KEYS.skills),
        DEFAULT_SIMULATOR_SKILLS,
      ),
      cultivations: parseSeedValue(
        valueByName.get(SIMULATOR_SEED_CONFIG_KEYS.cultivations),
        DEFAULT_SIMULATOR_CULTIVATIONS,
      ),
      equipments: parseSeedValue(
        valueByName.get(SIMULATOR_SEED_CONFIG_KEYS.equipments),
        DEFAULT_SIMULATOR_EQUIPMENTS,
      ),
      battleContext: parseSeedValue(
        valueByName.get(SIMULATOR_SEED_CONFIG_KEYS.battleContext),
        DEFAULT_SIMULATOR_BATTLE_CONTEXT,
      ),
    };
  } catch (error) {
    console.warn(
      'Failed to load required simulator seed config from D1, using built-in defaults:',
      error,
    );

    return cloneSeedValue(DEFAULT_SIMULATOR_SEED_CONFIG);
  }
}
