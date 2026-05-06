import { and, eq } from 'drizzle-orm';

import { db } from '@/core/db';
import { initD1ContextForDev } from '@/core/db/d1';
import {
  characterSkill,
  characterSnapshot,
  gameCharacter,
  labSession,
  user,
} from '@/config/db/schema';
import {
  selectSimulatorCharacter,
  updateSimulatorBattleContext,
  updateSimulatorCultivation,
  updateSimulatorProfile,
} from '@/shared/models/simulator-user';

type ApiEnvelope<T> = {
  code: number;
  message: string;
  data: T;
};

type OldCharacterSummary = {
  id: string;
  name: string;
  school: string;
  roleType: string;
  level: number;
  serverName: string;
};

type OldBundle = {
  character: {
    id: string;
    userId: string;
    name: string;
    serverName: string;
    school: string;
    roleType: string;
    level: number;
    race: string;
    status: string;
    currentSnapshotId: string | null;
  };
  snapshot: {
    id: string;
    name: string;
    source: string;
    notes: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  profile: {
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
  } | null;
  skills: Array<{
    id: string;
    skillCode: string;
    skillName: string;
    baseLevel: number;
    extraLevel: number;
    finalLevel: number;
    sourceDetailJson: string;
  }>;
  cultivations: Array<{
    id: string;
    cultivationType: string;
    level: number;
  }>;
  battleContext: {
    selfFormation: string;
    selfElement: string;
    formationCounterState: string;
    elementRelation: string;
    transformCardFactor: number;
    splitTargetCount: number;
    shenmuValue: number;
    magicResult: number;
    targetTemplateId: string | null;
    targetName: string;
    targetLevel: number;
    targetHp: number;
    targetDefense: number;
    targetMagicDefense: number;
    targetSpeed: number;
    targetMagicDefenseCultivation: number;
    targetElement: string;
    targetFormation: string;
    notesJson: string;
  } | null;
  equipmentPlan?: {
    activeSetIndex: number;
    equipmentSets: Array<{
      id: string;
      name: string;
      items: Array<Record<string, unknown>>;
      isActive?: boolean;
    }>;
  } | null;
  equipments?: Array<{
    id: string;
    slot: string;
    name: string;
    level: number;
    quality: string;
    price: number;
    build?: {
      refineLevel?: number;
      notesJson?: string;
    } | null;
    attrs?: Array<{
      attrGroup: string;
      attrType: string;
      attrValue: number;
    }>;
  }>;
};

type OldLabSessionBundle = {
  session: {
    id: string;
    name: string;
    notes: string;
  } | null;
  seats: Array<{
    id: string;
    name: string;
    isSample: boolean;
    inheritGemstones?: boolean;
    inheritRuneStones?: boolean;
    equipment?: Array<Record<string, unknown>>;
  }>;
};

const OLD_BASE_URL =
  process.env.OLD_DREAM_BASE_URL || 'https://dream.xiao64702.workers.dev';
const CURRENT_BASE_URL =
  process.env.CURRENT_DREAM_BASE_URL || 'https://dream.picarowack.workers.dev';
const CURRENT_ADMIN_EMAIL =
  process.env.CURRENT_DREAM_ADMIN_EMAIL || 'admin@gmail.com';
const CURRENT_ADMIN_PASSWORD =
  process.env.CURRENT_DREAM_ADMIN_PASSWORD || 'admin123123';
const OLD_ADMIN_EMAIL = process.env.OLD_DREAM_ADMIN_EMAIL || 'admin@gmail.com';
const OLD_ADMIN_PASSWORD = process.env.OLD_DREAM_ADMIN_PASSWORD || 'admin123123';

function normalizeString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseJsonObject(value: string | null | undefined) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function login(baseUrl: string, email: string, password: string) {
  const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      rememberMe: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to sign in at ${baseUrl}: ${response.status}`);
  }

  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error(`Missing session cookie from ${baseUrl}`);
  }

  return setCookie.split(';')[0];
}

async function fetchOldData<T>(cookie: string, path: string) {
  const response = await fetch(`${OLD_BASE_URL}${path}`, {
    headers: {
      cookie,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch ${path}: ${response.status} ${body}`);
  }

  const payload = (await response.json()) as ApiEnvelope<T>;
  if (payload.code !== 0) {
    throw new Error(`Old API ${path} failed: ${payload.message}`);
  }

  return payload.data;
}

async function fetchCurrentData<T>(
  cookie: string,
  path: string,
  init?: {
    method?: string;
    body?: unknown;
  }
) {
  const response = await fetch(`${CURRENT_BASE_URL}${path}`, {
    method: init?.method || 'GET',
    headers: {
      cookie,
      'content-type': 'application/json',
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Current API ${path} failed: ${response.status} ${text}`);
  }

  const payload = JSON.parse(text) as ApiEnvelope<T>;
  if (payload.code !== 0) {
    throw new Error(`Current API ${path} failed: ${payload.message}`);
  }

  return payload.data;
}

async function fetchOldAdminBundles(cookie: string) {
  const characters = await fetchOldData<OldCharacterSummary[]>(
    cookie,
    '/api/simulator/characters'
  );

  const bundles: Array<{
    summary: OldCharacterSummary;
    bundle: OldBundle;
    lab: OldLabSessionBundle;
  }> = [];

  for (const character of characters) {
    const bundle = await fetchOldData<OldBundle>(
      cookie,
      `/api/simulator/current?characterId=${character.id}`
    );
    const lab = await fetchOldData<OldLabSessionBundle>(
      cookie,
      '/api/simulator/current/lab-session'
    );

    bundles.push({
      summary: character,
      bundle,
      lab,
    });
  }

  return bundles;
}

function buildProfilePayload(bundle: OldBundle) {
  const profile = bundle.profile;
  if (!profile) {
    return null;
  }

  const raw = parseJsonObject(profile.rawBodyJson);

  return {
    level: toFiniteNumber(profile.level, bundle.character.level || 89),
    faction:
      normalizeString(profile.school) ||
      normalizeString(bundle.character.school) ||
      '龙宫',
    baseHp: toFiniteNumber(raw.baseHp, 0),
    physique: toFiniteNumber(profile.physique, 0),
    magic: toFiniteNumber(profile.magic, 0),
    potentialPoints: toFiniteNumber(profile.potentialPoints, 0),
    strength: toFiniteNumber(profile.strength, 0),
    endurance: toFiniteNumber(profile.endurance, 0),
    agility: toFiniteNumber(profile.agility, 0),
    magicPower: toFiniteNumber(raw.magicPower, 0),
    spiritualPower: toFiniteNumber(raw.spiritualPower, 0),
    magicCritLevel: toFiniteNumber(raw.magicCritLevel, 0),
    spellDamageLevel: toFiniteNumber(raw.spellDamageLevel, 0),
    fixedDamage: toFiniteNumber(raw.fixedDamage, 0),
    pierceLevel: toFiniteNumber(raw.pierceLevel, 0),
    elementalMastery: toFiniteNumber(raw.elementalMastery, 0),
    block: toFiniteNumber(raw.block, 0),
    antiCritLevel: toFiniteNumber(raw.antiCritLevel, 0),
    sealResistLevel: toFiniteNumber(raw.sealResistLevel, 0),
    elementalResistance: toFiniteNumber(raw.elementalResistance, 0),
    hp: toFiniteNumber(profile.hp, 0),
    mp: toFiniteNumber(profile.mp, 0),
    damage: toFiniteNumber(profile.damage, 0),
    defense: toFiniteNumber(profile.defense, 0),
    magicDamage: toFiniteNumber(profile.magicDamage, 0),
    magicDefense: toFiniteNumber(profile.magicDefense, 0),
    speed: toFiniteNumber(profile.speed, 0),
    hit: toFiniteNumber(profile.hit, 0),
    dodge: toFiniteNumber(raw.dodge, 0),
    sealHit: toFiniteNumber(profile.sealHit, 0),
    meridianConfig: raw.meridianConfig,
    artifactConfig: raw.artifactConfig,
  };
}

function buildCultivationPayload(bundle: OldBundle) {
  const byType = new Map(
    bundle.cultivations.map((item) => [item.cultivationType, item.level] as const)
  );

  return {
    bodyStrength: toFiniteNumber(byType.get('bodyStrength'), 0),
    physicalAttack: toFiniteNumber(byType.get('physicalAttack'), 0),
    physicalDefense: toFiniteNumber(byType.get('physicalDefense'), 0),
    magicAttack: toFiniteNumber(byType.get('magicAttack'), 0),
    magicDefense: toFiniteNumber(byType.get('magicDefense'), 0),
    petPhysicalAttack: toFiniteNumber(byType.get('petPhysicalAttack'), 0),
    petPhysicalDefense: toFiniteNumber(byType.get('petPhysicalDefense'), 0),
    petMagicAttack: toFiniteNumber(byType.get('petMagicAttack'), 0),
    petMagicDefense: toFiniteNumber(byType.get('petMagicDefense'), 0),
  };
}

function buildBattleContextPayload(bundle: OldBundle) {
  const battleContext = bundle.battleContext;
  if (!battleContext) {
    return null;
  }

  const notes = parseJsonObject(battleContext.notesJson);

  return {
    selfFormation: battleContext.selfFormation || '天覆阵',
    selfElement: battleContext.selfElement || '水',
    formationCounterState:
      battleContext.formationCounterState || '无克/普通',
    elementRelation: battleContext.elementRelation || '无克/普通',
    transformCardFactor: toFiniteNumber(battleContext.transformCardFactor, 1),
    splitTargetCount: toFiniteNumber(battleContext.splitTargetCount, 1),
    shenmuValue: toFiniteNumber(battleContext.shenmuValue, 0),
    magicResult: toFiniteNumber(battleContext.magicResult, 0),
    targetName: battleContext.targetName || '默认目标',
    targetLevel: toFiniteNumber(battleContext.targetLevel, 0),
    targetHp: toFiniteNumber(battleContext.targetHp, 0),
    targetDefense: toFiniteNumber(battleContext.targetDefense, 0),
    targetMagicDefense: toFiniteNumber(battleContext.targetMagicDefense, 0),
    targetSpeed: toFiniteNumber(battleContext.targetSpeed, 0),
    targetMagicDefenseCultivation: toFiniteNumber(
      battleContext.targetMagicDefenseCultivation,
      0
    ),
    targetElement: battleContext.targetElement || '',
    targetFormation: battleContext.targetFormation || '普通阵',
    targetTemplateId:
      normalizeString(battleContext.targetTemplateId) || null,
    manualTargets: Array.isArray(notes.manualTargets)
      ? notes.manualTargets
      : undefined,
    combatTab:
      notes.combatTab === 'manual' || notes.combatTab === 'dungeon'
        ? notes.combatTab
        : undefined,
    selectedDungeonIds: Array.isArray(notes.selectedDungeonIds)
      ? notes.selectedDungeonIds
      : undefined,
    weather: typeof notes.weather === 'string' ? notes.weather : undefined,
    targetDefenseState:
      typeof notes.targetDefenseState === 'string'
        ? notes.targetDefenseState
        : undefined,
    targetMagicDefenseResult:
      notes.targetMagicDefenseResult === undefined
        ? undefined
        : toFiniteNumber(notes.targetMagicDefenseResult, 0),
    specialMagicDamageReductionFactor:
      notes.specialMagicDamageReductionFactor === undefined
        ? undefined
        : toFiniteNumber(notes.specialMagicDamageReductionFactor, 1),
  };
}

function buildEquipmentPayload(bundle: OldBundle) {
  const equipmentPlan = bundle.equipmentPlan;
  if (equipmentPlan?.equipmentSets?.length) {
    const activeSet =
      equipmentPlan.equipmentSets[equipmentPlan.activeSetIndex] ||
      equipmentPlan.equipmentSets[0];

    return {
      equipment: Array.isArray(activeSet?.items) ? activeSet.items : [],
      equipmentSets: equipmentPlan.equipmentSets,
      activeSetIndex: toFiniteNumber(equipmentPlan.activeSetIndex, 0),
    };
  }

  const slotToEquipment = (slot: string) => {
    const normalized = normalizeString(slot);
    if (normalized === 'ring') {
      return { type: 'trinket', slot: 1 };
    }
    if (normalized === 'earring') {
      return { type: 'trinket', slot: 2 };
    }
    if (normalized === 'bracelet') {
      return { type: 'trinket', slot: 3 };
    }
    if (normalized === 'amulet') {
      return { type: 'trinket', slot: 4 };
    }
    if (normalized === 'jade1') {
      return { type: 'jade', slot: 1 };
    }
    if (normalized === 'jade2') {
      return { type: 'jade', slot: 2 };
    }

    return { type: normalized || 'equipment', slot: undefined as number | undefined };
  };

  const convertedEquipment = (bundle.equipments || []).map((item) => {
    const slotInfo = slotToEquipment(item.slot);
    const baseStats: Record<string, number> = {};
    const stats: Record<string, number> = {};

    for (const attr of item.attrs || []) {
      const attrType = normalizeString(attr.attrType);
      const attrValue = toFiniteNumber(attr.attrValue, 0);
      if (!attrType) {
        continue;
      }

      stats[attrType] = attrValue;
      if (attr.attrGroup === 'base') {
        baseStats[attrType] = attrValue;
      }
    }

    return {
      id: item.id,
      name: item.name,
      type: slotInfo.type,
      slot: slotInfo.slot,
      level: toFiniteNumber(item.level, 0),
      quality: item.quality || '',
      price: toFiniteNumber(item.price, 0),
      forgeLevel: toFiniteNumber(item.build?.refineLevel, 0),
      baseStats,
      stats,
    } satisfies Record<string, unknown>;
  });

  if (convertedEquipment.length > 0) {
    return {
      equipment: convertedEquipment,
      equipmentSets: undefined,
      activeSetIndex: undefined,
    };
  }

  return {
    equipment: [] as Array<Record<string, unknown>>,
    equipmentSets: undefined,
    activeSetIndex: undefined,
  };
}

async function replaceSnapshotSkills(snapshotId: string, bundle: OldBundle) {
  const database = db();
  await database
    .delete(characterSkill)
    .where(eq(characterSkill.snapshotId, snapshotId));

  if (bundle.skills.length === 0) {
    return;
  }

  await database.insert(characterSkill).values(
    bundle.skills.map((item) => ({
      id: item.id,
      snapshotId,
      skillCode: item.skillCode || '',
      skillName: item.skillName,
      baseLevel: toFiniteNumber(item.baseLevel, 0),
      extraLevel: toFiniteNumber(item.extraLevel, 0),
      finalLevel: toFiniteNumber(item.finalLevel, 0),
      sourceDetailJson: item.sourceDetailJson || '{}',
    }))
  );
}

async function syncSingleCharacter(params: {
  currentUserId: string;
  resolvedCharacterId: string;
  bundle: OldBundle;
  lab: OldLabSessionBundle;
  currentCookie: string;
}) {
  const database = db();

  const selected = await selectSimulatorCharacter(
    params.currentUserId,
    params.resolvedCharacterId
  );
  if (!selected) {
    throw new Error(`Failed to select character ${params.resolvedCharacterId}`);
  }

  await database
    .update(gameCharacter)
    .set({
      name: params.bundle.character.name,
      serverName: params.bundle.character.serverName || '',
      school: params.bundle.character.school || '龙宫',
      roleType: params.bundle.character.roleType || '法师',
      level: toFiniteNumber(params.bundle.character.level, 89),
      race: params.bundle.character.race || '',
      status: params.bundle.character.status || 'active',
    })
    .where(eq(gameCharacter.id, params.resolvedCharacterId));

  const profilePayload = buildProfilePayload(params.bundle);
  if (profilePayload) {
    await updateSimulatorProfile(
      params.currentUserId,
      profilePayload,
      params.resolvedCharacterId
    );
  }

  await updateSimulatorCultivation(
    params.currentUserId,
    buildCultivationPayload(params.bundle)
  );

  const battleContextPayload = buildBattleContextPayload(params.bundle);
  if (battleContextPayload) {
    await updateSimulatorBattleContext(params.currentUserId, battleContextPayload);
  }

  const equipmentPayload = buildEquipmentPayload(params.bundle);
  if (equipmentPayload.equipment.length > 0) {
    await fetchCurrentData(
      params.currentCookie,
      `/api/simulator/current?characterId=${params.resolvedCharacterId}`
    );
    await fetchCurrentData(
      params.currentCookie,
      '/api/simulator/current/equipment',
      {
        method: 'PATCH',
        body: equipmentPayload,
      }
    );
  }

  if (params.lab.session || params.lab.seats.length > 0) {
    await fetchCurrentData(
      params.currentCookie,
      `/api/simulator/current?characterId=${params.resolvedCharacterId}`
    );
    await fetchCurrentData(
      params.currentCookie,
      '/api/simulator/current/lab-session',
      {
        method: 'PATCH',
        body: {
          name: params.lab.session?.name || '当前实验室',
          notes: params.lab.session?.notes || '',
          seats: params.lab.seats,
        },
      }
    );
  } else {
    await database
      .delete(labSession)
      .where(eq(labSession.characterId, params.resolvedCharacterId));
  }

  const [snapshotRow] = await database
    .select()
    .from(gameCharacter)
    .innerJoin(
      characterSnapshot,
      eq(gameCharacter.currentSnapshotId, characterSnapshot.id)
    )
    .where(eq(gameCharacter.id, params.resolvedCharacterId))
    .limit(1);

  const snapshotId = snapshotRow?.character_snapshot?.id;
  if (!snapshotId) {
    throw new Error(`Current snapshot missing for ${params.resolvedCharacterId}`);
  }

  await replaceSnapshotSkills(snapshotId, params.bundle);

  if (params.bundle.snapshot) {
    await database
      .update(characterSnapshot)
      .set({
        name: params.bundle.snapshot.name || '默认初始快照',
        source: params.bundle.snapshot.source || 'system_default',
        notes: params.bundle.snapshot.notes || '',
      })
      .where(eq(characterSnapshot.id, snapshotId));
  }
}

async function main() {
  console.log(`Logging into old site ${OLD_BASE_URL} as ${OLD_ADMIN_EMAIL}...`);
  const oldCookie = await login(OLD_BASE_URL, OLD_ADMIN_EMAIL, OLD_ADMIN_PASSWORD);
  console.log(
    `Logging into current site ${CURRENT_BASE_URL} as ${CURRENT_ADMIN_EMAIL}...`
  );
  const currentCookie = await login(
    CURRENT_BASE_URL,
    CURRENT_ADMIN_EMAIL,
    CURRENT_ADMIN_PASSWORD
  );

  await initD1ContextForDev();

  const [currentAdmin] = await db()
    .select()
    .from(user)
    .where(eq(user.email, CURRENT_ADMIN_EMAIL))
    .limit(1);

  if (!currentAdmin) {
    throw new Error(`Current admin user ${CURRENT_ADMIN_EMAIL} not found`);
  }

  const oldBundles = await fetchOldAdminBundles(oldCookie);
  console.log(`Fetched ${oldBundles.length} old admin character bundles.`);

  for (const item of oldBundles) {
    const [currentCharacter] = await db()
      .select()
      .from(gameCharacter)
      .where(
        and(
          eq(gameCharacter.userId, currentAdmin.id),
          eq(gameCharacter.name, item.bundle.character.name)
        )
      )
      .limit(1);

    if (!currentCharacter) {
      throw new Error(
        `Current character ${item.bundle.character.name} not found for ${CURRENT_ADMIN_EMAIL}`
      );
    }

    console.log(`Syncing full bundle for ${item.bundle.character.name}...`);
    await syncSingleCharacter({
      currentUserId: currentAdmin.id,
      resolvedCharacterId: currentCharacter.id,
      bundle: item.bundle,
      lab: item.lab,
      currentCookie,
    });
  }

  console.log('Completed old admin full bundle sync.');
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('sync-old-cloudflare-admin-bundles failed:', error);
    process.exit(1);
  });
