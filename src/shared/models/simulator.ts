import { and, asc, desc, eq, inArray, like, or } from 'drizzle-orm';

import { db } from '@/core/db';
import { initD1ContextForDev, resetD1DevBindingCache } from '@/core/db/d1';
import {
  attributeRule,
  battleTargetTemplate,
  candidateEquipment,
  characterCultivation,
  characterProfile,
  characterSkill,
  characterSnapshot,
  equipmentAttr,
  equipmentBuild,
  equipmentItem,
  gameCharacter,
  labSession,
  labSessionEquipment,
  snapshotBattleContext,
  snapshotEquipmentSlot,
  user,
} from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';
import { createPerfTimer } from '@/shared/lib/perf';
import { inferBaseHpSource } from '@/shared/lib/simulator-base-hp';
import { getRequiredSimulatorSeedConfig } from '@/shared/models/simulator-template';

import {
  buildEquipmentNotesMeta,
  buildEquipmentSetEffectMeta,
  buildEquipmentSpecialEffectMeta,
  normalizeEquipmentPayload,
  normalizeLabSeatPayload,
  resolveLabSessionEquipmentReferenceId,
  toEquipmentAttrRows,
  toEquipmentSlotValue,
} from './simulator-payload';

export { resolveLabSessionEquipmentReferenceId } from './simulator-payload';

export type SimulatorCharacter = typeof gameCharacter.$inferSelect;
export type SimulatorSnapshot = typeof characterSnapshot.$inferSelect;
export type SimulatorProfile = typeof characterProfile.$inferSelect;
export type SimulatorSkill = typeof characterSkill.$inferSelect;
export type SimulatorCultivation = typeof characterCultivation.$inferSelect;
export type SimulatorRule = typeof attributeRule.$inferSelect;
export type SimulatorBattleContext = typeof snapshotBattleContext.$inferSelect;
export type SimulatorBattleTargetTemplate =
  typeof battleTargetTemplate.$inferSelect;
export type SimulatorLabSession = typeof labSession.$inferSelect;
export type SimulatorLabSessionEquipment =
  typeof labSessionEquipment.$inferSelect;
export type SimulatorCandidateEquipment =
  typeof candidateEquipment.$inferSelect;

type SimulatorEquipmentBuild = typeof equipmentBuild.$inferSelect;
type SimulatorEquipmentAttr = typeof equipmentAttr.$inferSelect;
type SimulatorSnapshotSlot = typeof snapshotEquipmentSlot.$inferSelect;
type SimulatorEquipmentRow = typeof equipmentItem.$inferSelect;

export type SimulatorEquipment = typeof equipmentItem.$inferSelect & {
  build: SimulatorEquipmentBuild | null;
  attrs: SimulatorEquipmentAttr[];
  snapshotSlot: string | null;
};

export type SimulatorCharacterBundle = {
  character: SimulatorCharacter;
  snapshot: SimulatorSnapshot | null;
  profile: SimulatorProfile | null;
  skills: SimulatorSkill[];
  cultivations: SimulatorCultivation[];
  battleContext: SimulatorBattleContext | null;
  battleTargetTemplate: SimulatorBattleTargetTemplate | null;
  rules: SimulatorRule[];
  equipments: SimulatorEquipment[];
};

export type SimulatorRollbackSnapshotSummary = Pick<
  SimulatorSnapshot,
  'id' | 'name' | 'source' | 'notes' | 'createdAt'
>;

export type SimulatorLabSeatPayload = {
  id: string;
  name: string;
  isSample: boolean;
  sort?: number;
  equipment: Array<Record<string, unknown>>;
};

export type SimulatorLabSessionBundle = {
  session: SimulatorLabSession | null;
  seats: SimulatorLabSeatPayload[];
};

export type SimulatorCandidateEquipmentItem = {
  id: string;
  equipment: Record<string, unknown>;
  timestamp: number;
  imagePreview?: string;
  rawText?: string;
  targetSetId?: string;
  targetEquipmentId?: string;
  targetRuneStoneSetIndex?: number;
  status: 'pending' | 'confirmed' | 'replaced';
};

export type AdminSimulatorPendingReviewItem =
  SimulatorCandidateEquipmentItem & {
    characterId: string;
    characterName: string;
    userId: string;
    userName: string;
    userEmail: string;
    source: string;
  };

export type AdminSimulatorLabSessionItem = {
  sessionId: string;
  sessionName: string;
  status: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
  baselineSnapshotId: string;
  characterId: string;
  characterName: string;
  userId: string;
  userName: string;
  userEmail: string;
  seatCount: number;
  compareSeatCount: number;
  seats: Array<{
    id: string;
    name: string;
    isSample: boolean;
    equipmentCount: number;
    equipmentNames: string[];
  }>;
};

type AdminSimulatorLabSessionRow = {
  lab_session: SimulatorLabSession;
  game_character: SimulatorCharacter;
  user: typeof user.$inferSelect;
};

type AdminSimulatorUserDiagnosticRow = {
  game_character: SimulatorCharacter;
  user: typeof user.$inferSelect;
};

export type AdminBattleTargetTemplateItem = {
  id: string;
  userId: string | null;
  scope: string;
  name: string;
  dungeonName: string;
  targetType: string;
  school: string;
  level: number;
  hp: number;
  defense: number;
  magicDefense: number;
  magicDefenseCultivation: number;
  speed: number;
  element: string;
  formation: string;
  notes: string;
  payload: Record<string, unknown>;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const ATTRIBUTE_RULE_CACHE_TTL_MS = 60 * 1000;
const TARGET_TEMPLATE_CACHE_TTL_MS = 60 * 1000;
const SIMULATOR_BUNDLE_CACHE_TTL_MS = 20 * 1000;

const attributeRuleCache = new Map<string, CacheEntry<SimulatorRule[]>>();
const battleTargetTemplateListCache = new Map<
  string,
  CacheEntry<AdminBattleTargetTemplateItem[]>
>();
const simulatorBundleCache = new Map<
  string,
  CacheEntry<SimulatorCharacterBundle>
>();

function getCachedValue<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string
): T | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

function setCachedValue<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number
) {
  cache.set(key, {
    expiresAt: Date.now() + ttlMs,
    value,
  });
}

export function clearSimulatorReadCache(options?: {
  attributeRules?: boolean;
  targetTemplates?: boolean;
}) {
  if (options?.attributeRules ?? true) {
    attributeRuleCache.clear();
  }

  if (options?.targetTemplates ?? true) {
    battleTargetTemplateListCache.clear();
  }
}

function getSimulatorBundleCacheKey(userId: string, characterId?: string) {
  return `${userId}::${characterId || '__active__'}`;
}

function primeSimulatorCharacterBundleCache(
  userId: string,
  bundle: SimulatorCharacterBundle
) {
  setCachedValue(
    simulatorBundleCache,
    getSimulatorBundleCacheKey(userId),
    bundle,
    SIMULATOR_BUNDLE_CACHE_TTL_MS
  );
  setCachedValue(
    simulatorBundleCache,
    getSimulatorBundleCacheKey(userId, bundle.character.id),
    bundle,
    SIMULATOR_BUNDLE_CACHE_TTL_MS
  );
}

function readSimulatorCharacterBundleCache(
  userId: string,
  characterId?: string
) {
  return getCachedValue(
    simulatorBundleCache,
    getSimulatorBundleCacheKey(userId, characterId)
  );
}

function clearSimulatorCharacterBundleCache(
  userId: string,
  characterId?: string
) {
  simulatorBundleCache.delete(getSimulatorBundleCacheKey(userId));
  if (characterId) {
    simulatorBundleCache.delete(
      getSimulatorBundleCacheKey(userId, characterId)
    );
  }
}

export type AdminSimulatorUserDiagnosticItem = {
  userId: string;
  userName: string;
  userEmail: string;
  userCreatedAt: number;
  characterId: string;
  characterName: string;
  school: string;
  roleType: string;
  level: number;
  snapshotId: string | null;
  snapshotName: string | null;
  profileSummary: {
    hp: number;
    mp: number;
    magicDamage: number;
    magicDefense: number;
    speed: number;
  } | null;
  battleContextSummary: {
    selfFormation: string;
    selfElement: string;
    targetName: string;
    targetFormation: string;
    targetElement: string;
    targetMagicDefense: number;
    splitTargetCount: number;
  } | null;
  candidateSummary: {
    total: number;
    pending: number;
    confirmed: number;
    replaced: number;
  };
  labSummary: {
    hasActiveSession: boolean;
    sessionName: string | null;
    compareSeatCount: number;
    updatedAt: number | null;
  };
};

async function ensureSimulatorDbReady() {
  await initD1ContextForDev();
}

function getErrorMessages(error: unknown): string[] {
  const messages: string[] = [];
  let current = error;
  let depth = 0;

  while (current && depth < 5) {
    if (current instanceof Error) {
      messages.push(current.message);
      current = (current as Error & { cause?: unknown }).cause;
      depth += 1;
      continue;
    }

    break;
  }

  return messages;
}

function isTransientD1Error(error: unknown): boolean {
  const combined = getErrorMessages(error).join(' | ').toLowerCase();

  return (
    combined.includes('network connection lost') ||
    combined.includes('failed to parse body as json') ||
    combined.includes('d1_error') ||
    combined.includes('internal_server_error')
  );
}

async function withTransientD1Retry<T>(
  label: string,
  operation: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isTransientD1Error(error) || attempt === maxAttempts) {
        throw error;
      }

      console.warn(
        `[simulator] transient D1 error during ${label}, retrying (${attempt}/${maxAttempts})`,
        error
      );

      await resetD1DevBindingCache();
      await new Promise((resolve) => setTimeout(resolve, attempt * 150));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Unknown simulator D1 error during ${label}`);
}

function chunkArray<T>(items: T[], chunkSize = 8): T[][] {
  if (items.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
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

const EQUIPMENT_PLAN_NOTES_KEY = 'equipmentPlan';
const EQUIPMENT_ROLLBACK_SNAPSHOT_SOURCE = 'equipment_backup';

type SimulatorEquipmentPlanNotes = {
  equipmentSets: Array<Record<string, unknown>>;
  activeSetIndex: number;
};

function sanitizeEquipmentPlanNotes(
  value: unknown
): SimulatorEquipmentPlanNotes | null {
  if (!isRecord(value)) {
    return null;
  }

  const equipmentSets = Array.isArray(value.equipmentSets)
    ? value.equipmentSets.filter(isRecord)
    : [];
  const activeSetIndex = Number.isInteger(value.activeSetIndex)
    ? Number(value.activeSetIndex)
    : 0;

  if (equipmentSets.length === 0) {
    return null;
  }

  return {
    equipmentSets,
    activeSetIndex: Math.max(0, activeSetIndex),
  };
}

function parseEquipmentPlanNotes(
  notesJson: string | null | undefined
): SimulatorEquipmentPlanNotes | null {
  const notes = parseJsonObject(notesJson);
  return sanitizeEquipmentPlanNotes(notes[EQUIPMENT_PLAN_NOTES_KEY]);
}

function createDefaultEquipmentPlanSet(
  index: number,
  equipment: Array<Record<string, unknown>>
) {
  return {
    id: `set_${index + 1}`,
    name: `配置${index + 1}`,
    items: equipment,
    isActive: false,
  };
}

function syncEquipmentPlanNotes(
  plan: SimulatorEquipmentPlanNotes | null,
  equipment: Array<Record<string, unknown>>
): SimulatorEquipmentPlanNotes | null {
  if (!plan) {
    return null;
  }

  const activeSetIndex = Math.max(0, plan.activeSetIndex);
  const equipmentSets = plan.equipmentSets.map((set) => ({ ...set }));

  while (equipmentSets.length <= activeSetIndex) {
    equipmentSets.push(
      createDefaultEquipmentPlanSet(equipmentSets.length, equipment)
    );
  }

  const syncedSets = equipmentSets.map((set, index) => ({
    ...set,
    items:
      index === activeSetIndex
        ? equipment.map((item) => ({ ...item }))
        : Array.isArray(set.items)
          ? set.items.filter(isRecord).map((item) => ({ ...item }))
          : [],
    isActive: index === activeSetIndex,
  }));

  return {
    activeSetIndex,
    equipmentSets: syncedSets,
  };
}

function mergeNotesJsonWithEquipmentPlan(
  notesJson: string | null | undefined,
  plan: SimulatorEquipmentPlanNotes | null
) {
  const notes = parseJsonObject(notesJson);

  if (!plan) {
    delete notes[EQUIPMENT_PLAN_NOTES_KEY];
  } else {
    notes[EQUIPMENT_PLAN_NOTES_KEY] = {
      activeSetIndex: plan.activeSetIndex,
      equipmentSets: plan.equipmentSets,
    };
  }

  return JSON.stringify(notes);
}

async function insertValuesInChunks(
  database: ReturnType<typeof db>,
  table: any,
  values: any[],
  chunkSize = 8
) {
  const queries = chunkArray(values, chunkSize).map((chunk) =>
    database.insert(table).values(chunk)
  );

  if (queries.length === 0) {
    return;
  }

  if (typeof database.batch === 'function') {
    await database.batch(queries);
    return;
  }

  for (const query of queries) {
    await query;
  }
}

async function findActiveCharacter(userId: string, characterId?: string) {
  const where = characterId
    ? and(
        eq(gameCharacter.userId, userId),
        eq(gameCharacter.id, characterId),
        eq(gameCharacter.status, 'active')
      )
    : and(eq(gameCharacter.userId, userId), eq(gameCharacter.status, 'active'));

  const [character] = await db()
    .select()
    .from(gameCharacter)
    .where(where)
    .orderBy(desc(gameCharacter.updatedAt))
    .limit(1);

  return character ?? null;
}

async function findCurrentSnapshot(character: SimulatorCharacter) {
  if (character.currentSnapshotId) {
    const [currentSnapshot] = await db()
      .select()
      .from(characterSnapshot)
      .where(eq(characterSnapshot.id, character.currentSnapshotId))
      .limit(1);

    if (currentSnapshot) {
      return currentSnapshot;
    }
  }

  const [typedSnapshot] = await db()
    .select()
    .from(characterSnapshot)
    .where(
      and(
        eq(characterSnapshot.characterId, character.id),
        eq(characterSnapshot.snapshotType, 'current')
      )
    )
    .orderBy(desc(characterSnapshot.createdAt))
    .limit(1);

  if (typedSnapshot) {
    return typedSnapshot;
  }

  const [latestSnapshot] = await db()
    .select()
    .from(characterSnapshot)
    .where(eq(characterSnapshot.characterId, character.id))
    .orderBy(desc(characterSnapshot.createdAt))
    .limit(1);

  return latestSnapshot ?? null;
}

async function findAttributeRules(params: {
  school: string;
  roleType: string;
}): Promise<SimulatorRule[]> {
  const cacheKey = `${params.school}::${params.roleType}`;
  const cachedRules = getCachedValue(attributeRuleCache, cacheKey);
  if (cachedRules) {
    return cachedRules;
  }

  try {
    const rules = await db()
      .select()
      .from(attributeRule)
      .where(
        and(
          eq(attributeRule.school, params.school),
          eq(attributeRule.roleType, params.roleType),
          eq(attributeRule.enabled, true)
        )
      )
      .orderBy(asc(attributeRule.sort), asc(attributeRule.sourceAttr));
    setCachedValue(
      attributeRuleCache,
      cacheKey,
      rules,
      ATTRIBUTE_RULE_CACHE_TTL_MS
    );
    return rules;
  } catch (error) {
    console.warn(
      'Failed to load simulator attribute rules, continuing without rules:',
      error
    );
    return [];
  }
}

async function findBattleTargetTemplateById(targetTemplateId?: string | null) {
  if (!targetTemplateId) {
    return null;
  }

  const [targetTemplate] = await db()
    .select()
    .from(battleTargetTemplate)
    .where(eq(battleTargetTemplate.id, targetTemplateId))
    .limit(1);

  return targetTemplate ?? null;
}

async function loadPersistedBundleEquipments(params: {
  characterId: string;
  snapshotId: string;
}): Promise<SimulatorEquipment[]> {
  const slotRows = await db()
    .select()
    .from(snapshotEquipmentSlot)
    .where(eq(snapshotEquipmentSlot.snapshotId, params.snapshotId))
    .orderBy(asc(snapshotEquipmentSlot.slot));

  const linkedEquipmentIds = slotRows.map(
    (row: SimulatorSnapshotSlot) => row.equipmentId
  );

  const equipmentRows = linkedEquipmentIds.length
    ? await db()
        .select()
        .from(equipmentItem)
        .where(inArray(equipmentItem.id, linkedEquipmentIds))
    : await db()
        .select()
        .from(equipmentItem)
        .where(eq(equipmentItem.characterId, params.characterId))
        .orderBy(asc(equipmentItem.slot), desc(equipmentItem.updatedAt));

  const equipmentIds = equipmentRows.map(
    (item: SimulatorEquipmentRow) => item.id
  );

  const [buildRows, attrRows] = equipmentIds.length
    ? await Promise.all([
        db()
          .select()
          .from(equipmentBuild)
          .where(inArray(equipmentBuild.equipmentId, equipmentIds)),
        db()
          .select()
          .from(equipmentAttr)
          .where(inArray(equipmentAttr.equipmentId, equipmentIds))
          .orderBy(asc(equipmentAttr.displayOrder)),
      ])
    : [[], []];

  const slotByEquipmentId = new Map(
    slotRows.map(
      (row: SimulatorSnapshotSlot) => [row.equipmentId, row.slot] as const
    )
  );
  const buildByEquipmentId = new Map(
    buildRows.map(
      (row: SimulatorEquipmentBuild) => [row.equipmentId, row] as const
    )
  );
  const attrsByEquipmentId = new Map<string, SimulatorEquipmentAttr[]>();

  for (const attr of attrRows) {
    const current = attrsByEquipmentId.get(attr.equipmentId) ?? [];
    current.push(attr);
    attrsByEquipmentId.set(attr.equipmentId, current);
  }

  return equipmentRows.map((item: SimulatorEquipmentRow) => ({
    ...item,
    build: buildByEquipmentId.get(item.id) ?? null,
    attrs: attrsByEquipmentId.get(item.id) ?? [],
    snapshotSlot: slotByEquipmentId.get(item.id) ?? null,
  }));
}

function formatEquipmentRollbackSnapshotName(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');

  return `应用前快照 ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function getNextSnapshotVersionNo(characterId: string) {
  const [latestSnapshot] = await db()
    .select({ versionNo: characterSnapshot.versionNo })
    .from(characterSnapshot)
    .where(eq(characterSnapshot.characterId, characterId))
    .orderBy(
      desc(characterSnapshot.versionNo),
      desc(characterSnapshot.createdAt)
    )
    .limit(1);

  return (latestSnapshot?.versionNo ?? 0) + 1;
}

async function loadSnapshotState(params: {
  characterId: string;
  snapshotId: string;
}) {
  const [profileRows, skills, cultivations, battleContextRows, equipments] =
    await Promise.all([
      db()
        .select()
        .from(characterProfile)
        .where(eq(characterProfile.snapshotId, params.snapshotId))
        .limit(1),
      db()
        .select()
        .from(characterSkill)
        .where(eq(characterSkill.snapshotId, params.snapshotId))
        .orderBy(
          desc(characterSkill.finalLevel),
          asc(characterSkill.skillName)
        ),
      db()
        .select()
        .from(characterCultivation)
        .where(eq(characterCultivation.snapshotId, params.snapshotId))
        .orderBy(asc(characterCultivation.cultivationType)),
      db()
        .select()
        .from(snapshotBattleContext)
        .where(eq(snapshotBattleContext.snapshotId, params.snapshotId))
        .limit(1),
      loadPersistedBundleEquipments({
        characterId: params.characterId,
        snapshotId: params.snapshotId,
      }),
    ]);

  return {
    profile: profileRows[0] ?? null,
    skills,
    cultivations,
    battleContext: battleContextRows[0] ?? null,
    equipments,
  };
}

type PersistedSnapshotState = {
  profile: SimulatorProfile | null;
  skills: SimulatorSkill[];
  cultivations: SimulatorCultivation[];
  battleContext: SimulatorBattleContext | null;
  equipments: SimulatorEquipment[];
};

async function insertSnapshotState(params: {
  snapshotId: string;
  characterId: string;
  profile: SimulatorProfile | null;
  skills: SimulatorSkill[];
  cultivations: SimulatorCultivation[];
  battleContext: SimulatorBattleContext | null;
  equipments: SimulatorEquipment[];
  now: Date;
}): Promise<PersistedSnapshotState> {
  const database = db();
  const batchQueries: any[] = [];
  const nextProfile = params.profile
    ? {
        snapshotId: params.snapshotId,
        school: params.profile.school,
        level: params.profile.level,
        physique: params.profile.physique,
        magic: params.profile.magic,
        strength: params.profile.strength,
        endurance: params.profile.endurance,
        agility: params.profile.agility,
        potentialPoints: params.profile.potentialPoints,
        hp: params.profile.hp,
        mp: params.profile.mp,
        damage: params.profile.damage,
        defense: params.profile.defense,
        magicDamage: params.profile.magicDamage,
        magicDefense: params.profile.magicDefense,
        speed: params.profile.speed,
        hit: params.profile.hit,
        sealHit: params.profile.sealHit,
        rawBodyJson: params.profile.rawBodyJson,
      }
    : null;
  const nextSkills = params.skills.map((skill) => ({
    id: getUuid(),
    snapshotId: params.snapshotId,
    skillCode: skill.skillCode,
    skillName: skill.skillName,
    baseLevel: skill.baseLevel,
    extraLevel: skill.extraLevel,
    finalLevel: skill.finalLevel,
    sourceDetailJson: skill.sourceDetailJson,
  }));
  const nextCultivations = params.cultivations.map((cultivation) => ({
    id: getUuid(),
    snapshotId: params.snapshotId,
    cultivationType: cultivation.cultivationType,
    level: cultivation.level,
  }));
  const nextBattleContext = params.battleContext
    ? {
        snapshotId: params.snapshotId,
        ruleVersionId: params.battleContext.ruleVersionId ?? null,
        selfFormation: params.battleContext.selfFormation,
        selfElement: params.battleContext.selfElement,
        formationCounterState: params.battleContext.formationCounterState,
        elementRelation: params.battleContext.elementRelation,
        transformCardFactor: params.battleContext.transformCardFactor,
        splitTargetCount: params.battleContext.splitTargetCount,
        shenmuValue: params.battleContext.shenmuValue,
        magicResult: params.battleContext.magicResult,
        targetTemplateId: params.battleContext.targetTemplateId ?? null,
        targetName: params.battleContext.targetName,
        targetLevel: params.battleContext.targetLevel,
        targetHp: params.battleContext.targetHp,
        targetDefense: params.battleContext.targetDefense,
        targetMagicDefense: params.battleContext.targetMagicDefense,
        targetSpeed: params.battleContext.targetSpeed,
        targetMagicDefenseCultivation:
          params.battleContext.targetMagicDefenseCultivation,
        targetElement: params.battleContext.targetElement,
        targetFormation: params.battleContext.targetFormation,
        notesJson: params.battleContext.notesJson,
        createdAt: params.now,
        updatedAt: params.now,
      }
    : null;

  if (nextProfile) {
    batchQueries.push(database.insert(characterProfile).values(nextProfile));
  }

  if (nextSkills.length > 0) {
    for (const chunk of chunkArray(nextSkills)) {
      batchQueries.push(database.insert(characterSkill).values(chunk));
    }
  }

  if (nextCultivations.length > 0) {
    for (const chunk of chunkArray(nextCultivations)) {
      batchQueries.push(database.insert(characterCultivation).values(chunk));
    }
  }

  if (nextBattleContext) {
    batchQueries.push(
      database.insert(snapshotBattleContext).values(nextBattleContext)
    );
  }

  if (params.equipments.length === 0) {
    if (batchQueries.length > 0) {
      if (typeof database.batch === 'function') {
        await database.batch(batchQueries);
      } else {
        for (const query of batchQueries) {
          await query;
        }
      }
    }
    return {
      profile: nextProfile,
      skills: nextSkills,
      cultivations: nextCultivations,
      battleContext: nextBattleContext,
      equipments: [],
    };
  }

  const equipmentIdMap = new Map<string, string>();
  const equipmentItemValues = params.equipments.map((equipment) => {
    const nextEquipmentId = getUuid();
    equipmentIdMap.set(equipment.id, nextEquipmentId);

    return {
      id: nextEquipmentId,
      characterId: params.characterId,
      slot: equipment.slot,
      name: equipment.name,
      level: equipment.level,
      quality: equipment.quality,
      price: equipment.price,
      source: equipment.source,
      status: equipment.status,
      isLocked: equipment.isLocked,
      createdAt: params.now,
      updatedAt: params.now,
    };
  });
  const equipmentBuildValues = params.equipments.map((equipment) => ({
    equipmentId: equipmentIdMap.get(equipment.id)!,
    holeCount: equipment.build?.holeCount ?? 0,
    gemLevelTotal: equipment.build?.gemLevelTotal ?? 0,
    refineLevel: equipment.build?.refineLevel ?? 0,
    specialEffectJson: equipment.build?.specialEffectJson ?? '{}',
    setEffectJson: equipment.build?.setEffectJson ?? '{}',
    notesJson: equipment.build?.notesJson ?? '{}',
  }));
  const equipmentAttrValues = params.equipments.flatMap((equipment) =>
    equipment.attrs.map((attr) => ({
      id: getUuid(),
      equipmentId: equipmentIdMap.get(equipment.id)!,
      attrGroup: attr.attrGroup,
      attrType: attr.attrType,
      valueType: attr.valueType,
      attrValue: attr.attrValue,
      displayOrder: attr.displayOrder,
    }))
  );
  const snapshotSlotValues = params.equipments.map((equipment) => ({
    id: getUuid(),
    snapshotId: params.snapshotId,
    slot: equipment.snapshotSlot ?? equipment.slot,
    equipmentId: equipmentIdMap.get(equipment.id)!,
  }));

  for (const chunk of chunkArray(equipmentItemValues)) {
    batchQueries.push(database.insert(equipmentItem).values(chunk));
  }
  for (const chunk of chunkArray(equipmentBuildValues)) {
    batchQueries.push(database.insert(equipmentBuild).values(chunk));
  }
  for (const chunk of chunkArray(equipmentAttrValues)) {
    batchQueries.push(database.insert(equipmentAttr).values(chunk));
  }
  for (const chunk of chunkArray(snapshotSlotValues)) {
    batchQueries.push(database.insert(snapshotEquipmentSlot).values(chunk));
  }

  const buildByEquipmentId = new Map(
    equipmentBuildValues.map((row) => [row.equipmentId, row] as const)
  );
  const attrsByEquipmentId = new Map<string, SimulatorEquipmentAttr[]>();

  for (const attr of equipmentAttrValues) {
    const current = attrsByEquipmentId.get(attr.equipmentId) ?? [];
    current.push(attr);
    attrsByEquipmentId.set(attr.equipmentId, current);
  }

  const nextEquipments = equipmentItemValues.map((row) => ({
    ...row,
    build: buildByEquipmentId.get(row.id) ?? null,
    attrs: attrsByEquipmentId.get(row.id) ?? [],
    snapshotSlot:
      snapshotSlotValues.find((slotRow) => slotRow.equipmentId === row.id)
        ?.slot ?? null,
  }));

  if (typeof database.batch === 'function') {
    await database.batch(batchQueries);
    return {
      profile: nextProfile,
      skills: nextSkills,
      cultivations: nextCultivations,
      battleContext: nextBattleContext,
      equipments: nextEquipments,
    };
  }

  for (const query of batchQueries) {
    await query;
  }

  return {
    profile: nextProfile,
    skills: nextSkills,
    cultivations: nextCultivations,
    battleContext: nextBattleContext,
    equipments: nextEquipments,
  };
}

async function deleteEquipmentIdsInChunks(
  database: ReturnType<typeof db>,
  equipmentIds: string[]
) {
  if (equipmentIds.length === 0) {
    return;
  }

  const queries = chunkArray(equipmentIds).map((chunk) =>
    database.delete(equipmentItem).where(inArray(equipmentItem.id, chunk))
  );

  if (typeof database.batch === 'function') {
    await database.batch(queries);
    return;
  }

  for (const query of queries) {
    await query;
  }
}

async function deleteCurrentSnapshotEquipments(params: {
  characterId: string;
  snapshotId: string;
}) {
  const database = db();
  const [equipmentRows, snapshotRows] = await Promise.all([
    database
      .select({ id: equipmentItem.id })
      .from(equipmentItem)
      .where(eq(equipmentItem.characterId, params.characterId)),
    database
      .select({ id: characterSnapshot.id })
      .from(characterSnapshot)
      .where(eq(characterSnapshot.characterId, params.characterId)),
  ]);

  const protectedSnapshotIds = snapshotRows
    .map((row: { id: string }) => row.id)
    .filter((snapshotId: string) => snapshotId !== params.snapshotId);
  const protectedEquipmentRows: Array<{ equipmentId: string }> =
    protectedSnapshotIds.length
      ? await database
          .select({ equipmentId: snapshotEquipmentSlot.equipmentId })
          .from(snapshotEquipmentSlot)
          .where(
            inArray(snapshotEquipmentSlot.snapshotId, protectedSnapshotIds)
          )
      : [];
  const protectedEquipmentIds = new Set(
    protectedEquipmentRows.map(
      (row: { equipmentId: string }) => row.equipmentId
    )
  );
  const deletableEquipmentIds = equipmentRows
    .map((row: { id: string }) => row.id)
    .filter((equipmentId: string) => !protectedEquipmentIds.has(equipmentId));

  await database
    .delete(snapshotEquipmentSlot)
    .where(eq(snapshotEquipmentSlot.snapshotId, params.snapshotId));
  await deleteEquipmentIdsInChunks(database, deletableEquipmentIds);
}

async function createEquipmentRollbackSnapshot(params: {
  character: SimulatorCharacter;
  snapshot: SimulatorSnapshot;
  name?: string;
  notes?: string;
  source?: string;
}) {
  const now = new Date();
  const nextSnapshotId = getUuid();
  const nextVersionNo = await getNextSnapshotVersionNo(params.character.id);
  const snapshotState = await loadSnapshotState({
    characterId: params.character.id,
    snapshotId: params.snapshot.id,
  });

  await db()
    .insert(characterSnapshot)
    .values({
      id: nextSnapshotId,
      characterId: params.character.id,
      snapshotType: 'history',
      name: params.name ?? formatEquipmentRollbackSnapshotName(now),
      versionNo: nextVersionNo,
      source: params.source ?? EQUIPMENT_ROLLBACK_SNAPSHOT_SOURCE,
      notes: params.notes ?? '',
      createdAt: now,
      updatedAt: now,
    });

  await insertSnapshotState({
    snapshotId: nextSnapshotId,
    characterId: params.character.id,
    profile: snapshotState.profile,
    skills: snapshotState.skills,
    cultivations: snapshotState.cultivations,
    battleContext: snapshotState.battleContext,
    equipments: snapshotState.equipments,
    now,
  });
}

async function findLatestEquipmentRollbackSnapshot(characterId: string) {
  const [snapshot] = await db()
    .select({
      id: characterSnapshot.id,
      name: characterSnapshot.name,
      source: characterSnapshot.source,
      notes: characterSnapshot.notes,
      createdAt: characterSnapshot.createdAt,
    })
    .from(characterSnapshot)
    .where(
      and(
        eq(characterSnapshot.characterId, characterId),
        eq(characterSnapshot.snapshotType, 'history'),
        eq(characterSnapshot.source, EQUIPMENT_ROLLBACK_SNAPSHOT_SOURCE)
      )
    )
    .orderBy(
      desc(characterSnapshot.createdAt),
      desc(characterSnapshot.versionNo)
    )
    .limit(1);

  return snapshot ?? null;
}

export async function getSimulatorCharacterBundle(
  userId: string,
  characterId?: string
): Promise<SimulatorCharacterBundle | null> {
  await ensureSimulatorDbReady();

  const cachedBundle = readSimulatorCharacterBundleCache(userId, characterId);
  if (cachedBundle) {
    return cachedBundle;
  }

  return withTransientD1Retry('getSimulatorCharacterBundle', async () => {
    const timer = createPerfTimer('getSimulatorCharacterBundle', {
      slowThresholdMs: 250,
    });
    const character = await findActiveCharacter(userId, characterId);
    timer.mark('character');
    if (!character) {
      timer.finish({ status: 'missing_character' });
      return null;
    }

    const snapshot = await findCurrentSnapshot(character);
    timer.mark('snapshot');
    const [profileRows, skills, cultivations, battleContextRows, slotRows] =
      snapshot
        ? await Promise.all([
            db()
              .select()
              .from(characterProfile)
              .where(eq(characterProfile.snapshotId, snapshot.id))
              .limit(1),
            db()
              .select()
              .from(characterSkill)
              .where(eq(characterSkill.snapshotId, snapshot.id))
              .orderBy(
                desc(characterSkill.finalLevel),
                asc(characterSkill.skillName)
              ),
            db()
              .select()
              .from(characterCultivation)
              .where(eq(characterCultivation.snapshotId, snapshot.id))
              .orderBy(asc(characterCultivation.cultivationType)),
            db()
              .select()
              .from(snapshotBattleContext)
              .where(eq(snapshotBattleContext.snapshotId, snapshot.id))
              .limit(1),
            db()
              .select()
              .from(snapshotEquipmentSlot)
              .where(eq(snapshotEquipmentSlot.snapshotId, snapshot.id))
              .orderBy(asc(snapshotEquipmentSlot.slot)),
          ])
        : [[], [], [], [], []];
    timer.mark('snapshot_relations');

    const profile = profileRows[0] ?? null;
    const battleContext = battleContextRows[0] ?? null;

    const linkedEquipmentIds = slotRows.map(
      (row: SimulatorSnapshotSlot) => row.equipmentId
    );

    const [targetTemplate, rules, equipmentRows] = await Promise.all([
      findBattleTargetTemplateById(battleContext?.targetTemplateId),
      findAttributeRules({
        school: profile?.school ?? character.school,
        roleType: character.roleType,
      }),
      linkedEquipmentIds.length
        ? db()
            .select()
            .from(equipmentItem)
            .where(inArray(equipmentItem.id, linkedEquipmentIds))
        : db()
            .select()
            .from(equipmentItem)
            .where(eq(equipmentItem.characterId, character.id))
            .orderBy(asc(equipmentItem.slot), desc(equipmentItem.updatedAt)),
    ]);
    timer.mark('rules_and_equipment');

    const equipmentIds = equipmentRows.map(
      (item: SimulatorEquipmentRow) => item.id
    );

    const [buildRows, attrRows] = equipmentIds.length
      ? await Promise.all([
          db()
            .select()
            .from(equipmentBuild)
            .where(inArray(equipmentBuild.equipmentId, equipmentIds)),
          db()
            .select()
            .from(equipmentAttr)
            .where(inArray(equipmentAttr.equipmentId, equipmentIds))
            .orderBy(asc(equipmentAttr.displayOrder)),
        ])
      : [[], []];
    timer.mark('equipment_details');

    const slotByEquipmentId = new Map(
      slotRows.map(
        (row: SimulatorSnapshotSlot) => [row.equipmentId, row.slot] as const
      )
    );
    const buildByEquipmentId = new Map(
      buildRows.map(
        (row: SimulatorEquipmentBuild) => [row.equipmentId, row] as const
      )
    );
    const attrsByEquipmentId = new Map<string, SimulatorEquipmentAttr[]>();

    for (const attr of attrRows) {
      const current = attrsByEquipmentId.get(attr.equipmentId) ?? [];
      current.push(attr);
      attrsByEquipmentId.set(attr.equipmentId, current);
    }

    const equipments: SimulatorEquipment[] = equipmentRows.map(
      (item: SimulatorEquipmentRow) => ({
        ...item,
        build: buildByEquipmentId.get(item.id) ?? null,
        attrs: attrsByEquipmentId.get(item.id) ?? [],
        snapshotSlot: slotByEquipmentId.get(item.id) ?? null,
      })
    );

    const bundle = {
      character,
      snapshot: snapshot ?? null,
      profile,
      skills,
      cultivations,
      battleContext,
      battleTargetTemplate: targetTemplate,
      rules,
      equipments,
    };

    timer.finish({
      status: 'ok',
      equipmentCount: equipments.length,
      hasSnapshot: Boolean(snapshot),
      hasTargetTemplate: Boolean(targetTemplate),
      ruleCount: rules.length,
    });

    primeSimulatorCharacterBundleCache(userId, bundle);
    return bundle;
  });
}

export async function getLatestSimulatorEquipmentRollbackSnapshot(
  userId: string
): Promise<SimulatorRollbackSnapshotSummary | null> {
  await ensureSimulatorDbReady();

  return withTransientD1Retry(
    'getLatestSimulatorEquipmentRollbackSnapshot',
    async () => {
      const character = await findActiveCharacter(userId);
      if (!character) {
        return null;
      }

      return findLatestEquipmentRollbackSnapshot(character.id);
    }
  );
}

function getDefaultCharacterName(userName: string | null | undefined) {
  const normalized = String(userName || '').trim();
  if (!normalized) {
    return '默认龙宫号';
  }

  return `${normalized}的龙宫号`.slice(0, 40);
}

export async function provisionDefaultSimulatorCharacterForUser(params: {
  userId: string;
  userName?: string | null;
}) {
  await ensureSimulatorDbReady();

  const timer = createPerfTimer('provisionDefaultSimulatorCharacterForUser', {
    slowThresholdMs: 300,
  });

  const existing = await findActiveCharacter(params.userId);
  if (existing) {
    return getSimulatorCharacterBundle(params.userId, existing.id);
  }

  const seedConfig = await getRequiredSimulatorSeedConfig();
  const characterId = getUuid();
  const snapshotId = getUuid();
  const database = db();
  const now = new Date();

  const characterValue: SimulatorCharacter = {
    id: characterId,
    userId: params.userId,
    name: getDefaultCharacterName(params.userName),
    serverName: seedConfig.characterMeta.serverName,
    school: seedConfig.profile.school,
    roleType: seedConfig.characterMeta.roleType,
    level: seedConfig.profile.level,
    race: seedConfig.characterMeta.race,
    status: 'active',
    currentSnapshotId: snapshotId,
    createdAt: now,
    updatedAt: now,
  };
  const snapshotValue: SimulatorSnapshot = {
    id: snapshotId,
    characterId,
    snapshotType: 'current',
    name: seedConfig.characterMeta.snapshotName,
    versionNo: 1,
    source: 'system_default',
    notes: seedConfig.characterMeta.snapshotNotes,
    createdAt: now,
    updatedAt: now,
  };
  const profileValue: SimulatorProfile = {
    snapshotId,
    ...seedConfig.profile,
  };
  const battleContextValue: SimulatorBattleContext = {
    snapshotId,
    selfFormation: seedConfig.battleContext.selfFormation,
    selfElement: seedConfig.battleContext.selfElement,
    formationCounterState: seedConfig.battleContext.formationCounterState,
    elementRelation: seedConfig.battleContext.elementRelation,
    transformCardFactor: seedConfig.battleContext.transformCardFactor,
    splitTargetCount: seedConfig.battleContext.splitTargetCount,
    shenmuValue: seedConfig.battleContext.shenmuValue,
    magicResult: seedConfig.battleContext.magicResult,
    targetName: seedConfig.battleContext.targetName,
    targetLevel: seedConfig.battleContext.targetLevel,
    targetHp: seedConfig.battleContext.targetHp,
    targetDefense: seedConfig.battleContext.targetDefense,
    targetMagicDefense: seedConfig.battleContext.targetMagicDefense,
    targetSpeed: seedConfig.battleContext.targetSpeed,
    targetMagicDefenseCultivation:
      seedConfig.battleContext.targetMagicDefenseCultivation,
    targetElement: seedConfig.battleContext.targetElement,
    targetFormation: seedConfig.battleContext.targetFormation,
    notesJson: '{}',
    ruleVersionId: null,
    targetTemplateId: null,
    createdAt: now,
    updatedAt: now,
  };
  const characterInsert = database.insert(gameCharacter).values(characterValue);
  const snapshotInsert = database
    .insert(characterSnapshot)
    .values(snapshotValue);
  const profileInsert = database.insert(characterProfile).values(profileValue);
  const battleContextInsert = database
    .insert(snapshotBattleContext)
    .values(battleContextValue);
  let skillValues: SimulatorSkill[] = [];
  let cultivationValues: SimulatorCultivation[] = [];

  const batchQueries = [
    characterInsert,
    snapshotInsert,
    profileInsert,
    battleContextInsert,
  ];

  if (seedConfig.skills.length > 0) {
    skillValues = seedConfig.skills.map((skill) => ({
      id: getUuid(),
      snapshotId,
      skillCode: skill.skillCode,
      skillName: skill.skillName,
      baseLevel: skill.baseLevel,
      extraLevel: skill.extraLevel,
      finalLevel: skill.finalLevel,
      sourceDetailJson: '{}',
    }));

    for (const chunk of chunkArray(skillValues)) {
      batchQueries.push(database.insert(characterSkill).values(chunk));
    }
  }

  if (seedConfig.cultivations.length > 0) {
    cultivationValues = seedConfig.cultivations.map((cultivation) => ({
      id: getUuid(),
      snapshotId,
      cultivationType: cultivation.cultivationType,
      level: cultivation.level,
    }));

    for (const chunk of chunkArray(cultivationValues)) {
      batchQueries.push(database.insert(characterCultivation).values(chunk));
    }
  }

  let seededEquipments: SimulatorEquipment[] = [];
  if (seedConfig.equipments.length > 0) {
    const equipmentRows = seedConfig.equipments.map((equipment) => {
      const equipmentId = getUuid();
      return {
        equipmentId,
        slot: equipment.slot,
        snapshotSlot: equipment.snapshotSlot,
        name: equipment.name,
        level: equipment.level,
        quality: equipment.quality,
        price: equipment.price,
        refineLevel: equipment.refineLevel,
        attrs: equipment.attrs,
      };
    });

    const equipmentItemValues: SimulatorEquipmentRow[] = equipmentRows.map(
      (equipment) => ({
        id: equipment.equipmentId,
        characterId,
        slot: equipment.slot,
        name: equipment.name,
        level: equipment.level,
        quality: equipment.quality,
        price: equipment.price,
        source: 'system_default',
        status: 'equipped',
        isLocked: false,
        createdAt: now,
        updatedAt: now,
      })
    );
    const equipmentBuildValues: SimulatorEquipmentBuild[] = equipmentRows.map(
      (equipment) => ({
        equipmentId: equipment.equipmentId,
        holeCount: 0,
        gemLevelTotal: 0,
        refineLevel: equipment.refineLevel,
        specialEffectJson: '{}',
        setEffectJson: '{}',
        notesJson: '{}',
      })
    );
    const equipmentAttrValues: SimulatorEquipmentAttr[] = equipmentRows.flatMap(
      (equipment) =>
        equipment.attrs.map((attr, index) => ({
          id: getUuid(),
          equipmentId: equipment.equipmentId,
          attrGroup: attr.attrGroup,
          attrType: attr.attrType,
          valueType: 'flat',
          attrValue: attr.attrValue,
          displayOrder: index,
        }))
    );
    const snapshotSlotValues = equipmentRows.map((equipment) => ({
      id: getUuid(),
      snapshotId,
      slot: equipment.snapshotSlot,
      equipmentId: equipment.equipmentId,
    }));

    const buildByEquipmentId = new Map(
      equipmentBuildValues.map((row) => [row.equipmentId, row] as const)
    );
    const attrsByEquipmentId = new Map<string, SimulatorEquipmentAttr[]>();

    for (const attr of equipmentAttrValues) {
      const current = attrsByEquipmentId.get(attr.equipmentId) ?? [];
      current.push(attr);
      attrsByEquipmentId.set(attr.equipmentId, current);
    }

    seededEquipments = equipmentItemValues.map((row) => ({
      ...row,
      build: buildByEquipmentId.get(row.id) ?? null,
      attrs: attrsByEquipmentId.get(row.id) ?? [],
      snapshotSlot:
        snapshotSlotValues.find((slotRow) => slotRow.equipmentId === row.id)
          ?.slot ?? null,
    }));

    for (const chunk of chunkArray(equipmentItemValues)) {
      batchQueries.push(database.insert(equipmentItem).values(chunk));
    }
    for (const chunk of chunkArray(equipmentBuildValues)) {
      batchQueries.push(database.insert(equipmentBuild).values(chunk));
    }
    for (const chunk of chunkArray(equipmentAttrValues)) {
      batchQueries.push(database.insert(equipmentAttr).values(chunk));
    }
    for (const chunk of chunkArray(snapshotSlotValues)) {
      batchQueries.push(database.insert(snapshotEquipmentSlot).values(chunk));
    }
  }

  if (typeof database.batch === 'function') {
    await database.batch(batchQueries);
  } else {
    for (const query of batchQueries) {
      await query;
    }
  }

  const rules = await findAttributeRules({
    school: profileValue.school,
    roleType: characterValue.roleType,
  });
  timer.finish({
    status: 'ok',
    equipmentCount: seededEquipments.length,
    ruleCount: rules.length,
  });

  const bundle = {
    character: characterValue,
    snapshot: snapshotValue,
    profile: profileValue,
    skills: skillValues,
    cultivations: cultivationValues,
    battleContext: battleContextValue,
    battleTargetTemplate: null,
    rules,
    equipments: seededEquipments,
  };
  primeSimulatorCharacterBundleCache(params.userId, bundle);
  return bundle;
}

function parseProfileRawBody(value: string | null | undefined) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function updateSimulatorProfile(
  userId: string,
  payload: {
    level: number;
    faction: string;
    physique: number;
    magic: number;
    strength: number;
    endurance: number;
    agility: number;
    magicPower: number;
    hp: number;
    mp: number;
    damage: number;
    defense: number;
    magicDamage: number;
    magicDefense: number;
    speed: number;
    hit: number;
    dodge: number;
    sealHit?: number;
  }
) {
  await ensureSimulatorDbReady();

  const timer = createPerfTimer('updateSimulatorProfile:model', {
    slowThresholdMs: 250,
  });
  const character = await findActiveCharacter(userId);
  timer.mark('character');
  if (!character) {
    timer.finish({ status: 'missing_character' });
    return null;
  }

  const snapshot = await findCurrentSnapshot(character);
  timer.mark('snapshot');
  if (!snapshot) {
    timer.finish({ status: 'missing_snapshot' });
    return null;
  }

  const [
    existingProfileRows,
    skills,
    cultivations,
    existingContextRows,
    equipments,
  ] = await Promise.all([
    db()
      .select()
      .from(characterProfile)
      .where(eq(characterProfile.snapshotId, snapshot.id))
      .limit(1),
    db()
      .select()
      .from(characterSkill)
      .where(eq(characterSkill.snapshotId, snapshot.id))
      .orderBy(desc(characterSkill.finalLevel), asc(characterSkill.skillName)),
    db()
      .select()
      .from(characterCultivation)
      .where(eq(characterCultivation.snapshotId, snapshot.id))
      .orderBy(asc(characterCultivation.cultivationType)),
    db()
      .select()
      .from(snapshotBattleContext)
      .where(eq(snapshotBattleContext.snapshotId, snapshot.id))
      .limit(1),
    loadPersistedBundleEquipments({
      characterId: character.id,
      snapshotId: snapshot.id,
    }),
  ]);
  timer.mark('load_relations');

  const existingProfile = existingProfileRows[0] ?? null;
  const existingContext = existingContextRows[0] ?? null;
  const equipmentHpTotal = equipments.reduce((sum, item) => {
    const itemHp = item.attrs.reduce((itemSum, attr) => {
      if (attr.attrType !== 'hp') {
        return itemSum;
      }

      return itemSum + Number(attr.attrValue ?? 0);
    }, 0);

    return sum + itemHp;
  }, 0);

  const currentRawBody = parseProfileRawBody(existingProfile?.rawBodyJson);
  const nextBaseHp = inferBaseHpSource({
    panelHp: payload.hp,
    physique: payload.physique,
    endurance: payload.endurance,
    equipmentHp: equipmentHpTotal,
  });
  const nextRawBody = JSON.stringify({
    ...currentRawBody,
    baseHp: nextBaseHp,
    hp: payload.hp,
    magic: payload.magic,
    physique: payload.physique,
    strength: payload.strength,
    endurance: payload.endurance,
    agility: payload.agility,
    magicPower: payload.magicPower,
    dodge: payload.dodge,
  });
  const nextCharacter: SimulatorCharacter = {
    ...character,
    school: payload.faction,
    level: payload.level,
  };
  const nextProfile: SimulatorProfile = existingProfile
    ? {
        ...existingProfile,
        school: payload.faction,
        level: payload.level,
        physique: payload.physique,
        magic: payload.magic,
        strength: payload.strength,
        endurance: payload.endurance,
        agility: payload.agility,
        hp: payload.hp,
        mp: payload.mp,
        damage: payload.damage,
        defense: payload.defense,
        magicDamage: payload.magicDamage,
        magicDefense: payload.magicDefense,
        speed: payload.speed,
        hit: payload.hit,
        sealHit: payload.sealHit ?? existingProfile.sealHit ?? 0,
        rawBodyJson: nextRawBody,
      }
    : {
        snapshotId: snapshot.id,
        school: payload.faction,
        level: payload.level,
        physique: payload.physique,
        magic: payload.magic,
        strength: payload.strength,
        endurance: payload.endurance,
        agility: payload.agility,
        potentialPoints: 0,
        hp: payload.hp,
        mp: payload.mp,
        damage: payload.damage,
        defense: payload.defense,
        magicDamage: payload.magicDamage,
        magicDefense: payload.magicDefense,
        speed: payload.speed,
        hit: payload.hit,
        sealHit: payload.sealHit ?? existingProfile?.sealHit ?? 0,
        rawBodyJson: nextRawBody,
      };

  const [targetTemplate, rules] = await Promise.all([
    findBattleTargetTemplateById(existingContext?.targetTemplateId),
    findAttributeRules({
      school: payload.faction || character.school,
      roleType: character.roleType,
    }),
  ]);
  timer.mark('rules');

  await db()
    .update(gameCharacter)
    .set({
      school: payload.faction,
      level: payload.level,
    })
    .where(eq(gameCharacter.id, character.id));

  if (existingProfile) {
    await db()
      .update(characterProfile)
      .set({
        school: payload.faction,
        level: payload.level,
        physique: payload.physique,
        magic: payload.magic,
        strength: payload.strength,
        endurance: payload.endurance,
        agility: payload.agility,
        hp: payload.hp,
        mp: payload.mp,
        damage: payload.damage,
        defense: payload.defense,
        magicDamage: payload.magicDamage,
        magicDefense: payload.magicDefense,
        speed: payload.speed,
        hit: payload.hit,
        sealHit: payload.sealHit ?? existingProfile?.sealHit ?? 0,
        rawBodyJson: nextRawBody,
      })
      .where(eq(characterProfile.snapshotId, snapshot.id));
  } else {
    await db()
      .insert(characterProfile)
      .values({
        snapshotId: snapshot.id,
        school: payload.faction,
        level: payload.level,
        physique: payload.physique,
        magic: payload.magic,
        strength: payload.strength,
        endurance: payload.endurance,
        agility: payload.agility,
        potentialPoints: 0,
        hp: payload.hp,
        mp: payload.mp,
        damage: payload.damage,
        defense: payload.defense,
        magicDamage: payload.magicDamage,
        magicDefense: payload.magicDefense,
        speed: payload.speed,
        hit: payload.hit,
        sealHit: payload.sealHit ?? 0,
        rawBodyJson: nextRawBody,
      });
  }
  timer.mark('write_profile');

  const bundle: SimulatorCharacterBundle = {
    character: nextCharacter,
    snapshot,
    profile: nextProfile,
    skills,
    cultivations,
    battleContext: existingContext,
    battleTargetTemplate: targetTemplate,
    rules,
    equipments,
  };

  timer.finish({
    status: 'ok',
    equipmentCount: equipments.length,
    ruleCount: rules.length,
  });

  primeSimulatorCharacterBundleCache(userId, bundle);
  return bundle;
}

export async function updateSimulatorCultivation(
  userId: string,
  payload: {
    physicalAttack: number;
    physicalDefense: number;
    magicAttack: number;
    magicDefense: number;
    petPhysicalAttack: number;
    petPhysicalDefense: number;
    petMagicAttack: number;
    petMagicDefense: number;
  }
) {
  await ensureSimulatorDbReady();

  const timer = createPerfTimer('updateSimulatorCultivation:model', {
    slowThresholdMs: 250,
  });
  const character = await findActiveCharacter(userId);
  timer.mark('character');
  if (!character) {
    timer.finish({ status: 'missing_character' });
    return null;
  }

  const snapshot = await findCurrentSnapshot(character);
  timer.mark('snapshot');
  if (!snapshot) {
    timer.finish({ status: 'missing_snapshot' });
    return null;
  }

  const [profileRows, skills, existingContextRows, equipments] =
    await Promise.all([
      db()
        .select()
        .from(characterProfile)
        .where(eq(characterProfile.snapshotId, snapshot.id))
        .limit(1),
      db()
        .select()
        .from(characterSkill)
        .where(eq(characterSkill.snapshotId, snapshot.id))
        .orderBy(
          desc(characterSkill.finalLevel),
          asc(characterSkill.skillName)
        ),
      db()
        .select()
        .from(snapshotBattleContext)
        .where(eq(snapshotBattleContext.snapshotId, snapshot.id))
        .limit(1),
      loadPersistedBundleEquipments({
        characterId: character.id,
        snapshotId: snapshot.id,
      }),
    ]);
  timer.mark('load_relations');

  const profile = profileRows[0] ?? null;
  const existingContext = existingContextRows[0] ?? null;
  const [targetTemplate, rules] = await Promise.all([
    findBattleTargetTemplateById(existingContext?.targetTemplateId),
    findAttributeRules({
      school: profile?.school ?? character.school,
      roleType: character.roleType,
    }),
  ]);
  timer.mark('rules');

  await db()
    .delete(characterCultivation)
    .where(eq(characterCultivation.snapshotId, snapshot.id));

  const cultivationRows = [
    { cultivationType: 'physicalAttack', level: payload.physicalAttack },
    { cultivationType: 'physicalDefense', level: payload.physicalDefense },
    { cultivationType: 'magicAttack', level: payload.magicAttack },
    { cultivationType: 'magicDefense', level: payload.magicDefense },
    { cultivationType: 'petPhysicalAttack', level: payload.petPhysicalAttack },
    {
      cultivationType: 'petPhysicalDefense',
      level: payload.petPhysicalDefense,
    },
    { cultivationType: 'petMagicAttack', level: payload.petMagicAttack },
    { cultivationType: 'petMagicDefense', level: payload.petMagicDefense },
  ];
  const nextCultivations: SimulatorCultivation[] = cultivationRows.map(
    (item) => ({
      id: getUuid(),
      snapshotId: snapshot.id,
      cultivationType: item.cultivationType,
      level: item.level,
    })
  );

  await db().insert(characterCultivation).values(nextCultivations);
  timer.mark('write_cultivation');

  const bundle: SimulatorCharacterBundle = {
    character,
    snapshot,
    profile,
    skills,
    cultivations: nextCultivations,
    battleContext: existingContext,
    battleTargetTemplate: targetTemplate,
    rules,
    equipments,
  };

  timer.finish({
    status: 'ok',
    cultivationCount: nextCultivations.length,
    equipmentCount: equipments.length,
  });

  primeSimulatorCharacterBundleCache(userId, bundle);
  return bundle;
}

export async function updateSimulatorBattleContext(
  userId: string,
  payload: {
    selfFormation: string;
    selfElement: string;
    formationCounterState?: string;
    elementRelation?: string;
    transformCardFactor?: number;
    splitTargetCount?: number;
    shenmuValue?: number;
    magicResult?: number;
    targetName: string;
    targetLevel?: number;
    targetHp?: number;
    targetDefense?: number;
    targetMagicDefense?: number;
    targetSpeed?: number;
    targetMagicDefenseCultivation?: number;
    targetElement?: string;
    targetFormation?: string;
    targetTemplateId?: string | null;
  }
) {
  await ensureSimulatorDbReady();

  const timer = createPerfTimer('updateSimulatorBattleContext:model', {
    slowThresholdMs: 250,
  });
  const character = await findActiveCharacter(userId);
  timer.mark('character');
  if (!character) {
    timer.finish({ status: 'missing_character' });
    return null;
  }

  const snapshot = await findCurrentSnapshot(character);
  timer.mark('snapshot');
  if (!snapshot) {
    timer.finish({ status: 'missing_snapshot' });
    return null;
  }

  const [profileRows, skills, cultivations, existingContextRows, equipments] =
    await Promise.all([
      db()
        .select()
        .from(characterProfile)
        .where(eq(characterProfile.snapshotId, snapshot.id))
        .limit(1),
      db()
        .select()
        .from(characterSkill)
        .where(eq(characterSkill.snapshotId, snapshot.id))
        .orderBy(
          desc(characterSkill.finalLevel),
          asc(characterSkill.skillName)
        ),
      db()
        .select()
        .from(characterCultivation)
        .where(eq(characterCultivation.snapshotId, snapshot.id))
        .orderBy(asc(characterCultivation.cultivationType)),
      db()
        .select()
        .from(snapshotBattleContext)
        .where(eq(snapshotBattleContext.snapshotId, snapshot.id))
        .limit(1),
      loadPersistedBundleEquipments({
        characterId: character.id,
        snapshotId: snapshot.id,
      }),
    ]);
  timer.mark('load_relations');

  const profile = profileRows[0] ?? null;
  const existingContext = existingContextRows[0] ?? null;

  const targetTemplateId =
    payload.targetTemplateId === undefined
      ? (existingContext?.targetTemplateId ?? null)
      : payload.targetTemplateId || null;
  const now = new Date();

  const [targetTemplate, rules] = await Promise.all([
    findBattleTargetTemplateById(targetTemplateId),
    findAttributeRules({
      school: profile?.school ?? character.school,
      roleType: character.roleType,
    }),
  ]);
  timer.mark('rules');

  const nextValue = {
    ruleVersionId: existingContext?.ruleVersionId ?? null,
    selfFormation: payload.selfFormation || '天覆阵',
    selfElement: payload.selfElement || '水',
    formationCounterState: payload.formationCounterState || '无克/普通',
    elementRelation: payload.elementRelation || '无克/普通',
    transformCardFactor: payload.transformCardFactor ?? 1,
    splitTargetCount: payload.splitTargetCount ?? 1,
    shenmuValue: payload.shenmuValue ?? 0,
    magicResult: payload.magicResult ?? 0,
    targetTemplateId,
    targetName: payload.targetName || '默认目标',
    targetLevel: payload.targetLevel ?? 0,
    targetHp: payload.targetHp ?? 0,
    targetDefense: payload.targetDefense ?? 0,
    targetMagicDefense: payload.targetMagicDefense ?? 0,
    targetSpeed:
      payload.targetSpeed ??
      targetTemplate?.speed ??
      existingContext?.targetSpeed ??
      0,
    targetMagicDefenseCultivation: payload.targetMagicDefenseCultivation ?? 0,
    targetElement: payload.targetElement || '',
    targetFormation: payload.targetFormation || '普通阵',
    notesJson: existingContext?.notesJson ?? '{}',
  };
  const nextBattleContext: SimulatorBattleContext = existingContext
    ? {
        ...existingContext,
        ...nextValue,
        updatedAt: now,
      }
    : {
        snapshotId: snapshot.id,
        ...nextValue,
        createdAt: now,
        updatedAt: now,
      };

  if (existingContext) {
    await db()
      .update(snapshotBattleContext)
      .set(nextValue)
      .where(eq(snapshotBattleContext.snapshotId, snapshot.id));
  } else {
    await db()
      .insert(snapshotBattleContext)
      .values({
        snapshotId: snapshot.id,
        ...nextValue,
      });
  }
  timer.mark('write_context');

  const bundle: SimulatorCharacterBundle = {
    character,
    snapshot,
    profile,
    skills,
    cultivations,
    battleContext: nextBattleContext,
    battleTargetTemplate: targetTemplate,
    rules,
    equipments,
  };

  timer.finish({
    status: 'ok',
    equipmentCount: equipments.length,
    hasTargetTemplate: Boolean(targetTemplate),
  });

  primeSimulatorCharacterBundleCache(userId, bundle);
  return bundle;
}

const LAB_SEAT_META_SLOT = '__seat__';

async function findActiveLabSession(characterId: string) {
  const [session] = await db()
    .select()
    .from(labSession)
    .where(
      and(
        eq(labSession.characterId, characterId),
        eq(labSession.status, 'active')
      )
    )
    .orderBy(desc(labSession.updatedAt))
    .limit(1);

  return session ?? null;
}

async function findCandidateEquipmentRows(characterId: string) {
  return db()
    .select()
    .from(candidateEquipment)
    .where(eq(candidateEquipment.characterId, characterId))
    .orderBy(asc(candidateEquipment.sort), desc(candidateEquipment.updatedAt));
}

async function buildSimulatorLabSessionBundle(
  session: SimulatorLabSession | null
): Promise<SimulatorLabSessionBundle> {
  if (!session) {
    return {
      session: null,
      seats: [],
    };
  }

  const rows = await db()
    .select()
    .from(labSessionEquipment)
    .where(eq(labSessionEquipment.sessionId, session.id))
    .orderBy(
      asc(labSessionEquipment.seatType),
      asc(labSessionEquipment.sort),
      asc(labSessionEquipment.slot)
    );

  const seatMap = new Map<string, SimulatorLabSeatPayload>();

  for (const row of rows) {
    const parsed = parseJsonObject(row.payloadJson);
    const seatId = row.seatType;
    const current: SimulatorLabSeatPayload = seatMap.get(seatId) ?? {
      id: seatId,
      name: String(
        parsed.seatName || (seatId === 'sample' ? '样本席位' : seatId)
      ),
      isSample: Boolean(parsed.isSample) || seatId === 'sample',
      equipment: [],
    };

    if (row.slot !== LAB_SEAT_META_SLOT) {
      const equipment = parsed.equipment;
      if (equipment && typeof equipment === 'object') {
        current.equipment.push(equipment as Record<string, unknown>);
      }
    } else {
      current.name = String(parsed.seatName || current.name);
      current.isSample = Boolean(parsed.isSample) || seatId === 'sample';
    }

    seatMap.set(seatId, current);
  }

  const seats = Array.from(seatMap.values()).sort((left, right) => {
    if (left.isSample && !right.isSample) {
      return -1;
    }

    if (!left.isSample && right.isSample) {
      return 1;
    }

    return left.name.localeCompare(right.name, 'zh-CN');
  });

  return {
    session,
    seats,
  };
}

function mapCandidateEquipmentRow(
  row: SimulatorCandidateEquipment
): SimulatorCandidateEquipmentItem {
  const payload = parseJsonObject(row.equipmentJson);

  return {
    id: row.id,
    equipment: payload,
    timestamp: row.updatedAt?.getTime?.() ?? row.createdAt?.getTime?.() ?? 0,
    imagePreview: row.imageKey ?? undefined,
    rawText: row.rawText ?? undefined,
    targetSetId: row.targetSetId ?? undefined,
    targetEquipmentId: row.targetEquipmentId ?? undefined,
    targetRuneStoneSetIndex: row.targetRuneStoneSetIndex ?? undefined,
    status: row.status as SimulatorCandidateEquipmentItem['status'],
  };
}

function mapAdminCandidateEquipmentRow(row: {
  candidate_equipment: SimulatorCandidateEquipment;
  game_character: SimulatorCharacter;
  user: typeof user.$inferSelect;
}): AdminSimulatorPendingReviewItem {
  const mapped = mapCandidateEquipmentRow(row.candidate_equipment);

  return {
    ...mapped,
    characterId: row.game_character.id,
    characterName: row.game_character.name,
    userId: row.user.id,
    userName: row.user.name,
    userEmail: row.user.email,
    source: row.candidate_equipment.source,
  };
}

function mapAdminLabSessionItem(params: {
  session: SimulatorLabSession;
  character: SimulatorCharacter;
  userRecord: typeof user.$inferSelect;
  bundle: SimulatorLabSessionBundle;
}): AdminSimulatorLabSessionItem {
  const seats = params.bundle.seats.map((seat) => {
    const equipmentNames = seat.equipment
      .map((item) => String(item.name || '').trim())
      .filter((value) => value.length > 0)
      .slice(0, 6);

    return {
      id: seat.id,
      name: seat.name,
      isSample: seat.isSample,
      equipmentCount: seat.equipment.length,
      equipmentNames,
    };
  });

  return {
    sessionId: params.session.id,
    sessionName: params.session.name,
    status: params.session.status,
    notes: params.session.notes,
    createdAt: params.session.createdAt?.getTime?.() ?? 0,
    updatedAt: params.session.updatedAt?.getTime?.() ?? 0,
    baselineSnapshotId: params.session.baselineSnapshotId,
    characterId: params.character.id,
    characterName: params.character.name,
    userId: params.userRecord.id,
    userName: params.userRecord.name,
    userEmail: params.userRecord.email,
    seatCount: seats.length,
    compareSeatCount: seats.filter((seat) => !seat.isSample).length,
    seats,
  };
}

function mapBattleTargetTemplateRow(
  row: SimulatorBattleTargetTemplate
): AdminBattleTargetTemplateItem {
  return {
    id: row.id,
    userId: row.userId ?? null,
    scope: row.scope,
    name: row.name,
    dungeonName: row.dungeonName,
    targetType: row.targetType,
    school: row.school,
    level: row.level,
    hp: row.hp,
    defense: row.defense,
    magicDefense: row.magicDefense,
    magicDefenseCultivation: row.magicDefenseCultivation,
    speed: row.speed,
    element: row.element,
    formation: row.formation,
    notes: row.notes,
    payload: parseJsonObject(row.payloadJson),
    enabled: row.enabled,
    createdAt: row.createdAt?.getTime?.() ?? 0,
    updatedAt: row.updatedAt?.getTime?.() ?? 0,
  };
}

export async function getSimulatorLabSession(
  userId: string,
  characterId?: string
): Promise<SimulatorLabSessionBundle | null> {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('getSimulatorLabSession', async () => {
    const character = await findActiveCharacter(userId, characterId);
    if (!character) {
      return null;
    }

    const session = await findActiveLabSession(character.id);
    return buildSimulatorLabSessionBundle(session);
  });
}

export async function listAdminSimulatorLabSessions(params?: {
  limit?: number;
}): Promise<AdminSimulatorLabSessionItem[]> {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('listAdminSimulatorLabSessions', async () => {
    const rows = await db()
      .select()
      .from(labSession)
      .innerJoin(gameCharacter, eq(labSession.characterId, gameCharacter.id))
      .innerJoin(user, eq(gameCharacter.userId, user.id))
      .orderBy(desc(labSession.updatedAt))
      .limit(params?.limit ?? 30);

    const items = await Promise.all(
      rows.map(async (row: AdminSimulatorLabSessionRow) => {
        const bundle = await buildSimulatorLabSessionBundle(row.lab_session);
        return mapAdminLabSessionItem({
          session: row.lab_session,
          character: row.game_character,
          userRecord: row.user,
          bundle,
        });
      })
    );

    return items;
  });
}

export async function listAdminBattleTargetTemplates(params?: {
  enabled?: boolean;
  limit?: number;
}): Promise<AdminBattleTargetTemplateItem[]> {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('listAdminBattleTargetTemplates', async () => {
    const conditions = [];
    if (typeof params?.enabled === 'boolean') {
      conditions.push(eq(battleTargetTemplate.enabled, params.enabled));
    }

    const rows = await db()
      .select()
      .from(battleTargetTemplate)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        desc(battleTargetTemplate.enabled),
        asc(battleTargetTemplate.scope),
        asc(battleTargetTemplate.dungeonName),
        asc(battleTargetTemplate.name)
      )
      .limit(params?.limit ?? 100);

    return rows.map(mapBattleTargetTemplateRow);
  });
}

export async function listSimulatorBattleTargetTemplates(userId?: string) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry(
    'listSimulatorBattleTargetTemplates',
    async () => {
      const cacheKey = userId ? `user:${userId}` : 'system';
      const cachedItems = getCachedValue(
        battleTargetTemplateListCache,
        cacheKey
      );
      if (cachedItems) {
        return cachedItems;
      }

      const conditions = [eq(battleTargetTemplate.enabled, true)];
      if (userId) {
        conditions.push(
          or(
            eq(battleTargetTemplate.scope, 'system'),
            and(
              eq(battleTargetTemplate.scope, 'user'),
              eq(battleTargetTemplate.userId, userId)
            )
          )!
        );
      } else {
        conditions.push(eq(battleTargetTemplate.scope, 'system'));
      }

      const rows = await db()
        .select()
        .from(battleTargetTemplate)
        .where(and(...conditions))
        .orderBy(
          asc(battleTargetTemplate.dungeonName),
          asc(battleTargetTemplate.name),
          asc(battleTargetTemplate.level)
        );

      const items = rows.map(mapBattleTargetTemplateRow);
      setCachedValue(
        battleTargetTemplateListCache,
        cacheKey,
        items,
        TARGET_TEMPLATE_CACHE_TTL_MS
      );
      return items;
    }
  );
}

export async function createAdminBattleTargetTemplate(input: {
  name: string;
  dungeonName?: string;
  targetType?: string;
  school?: string;
  level?: number;
  hp?: number;
  defense?: number;
  magicDefense?: number;
  magicDefenseCultivation?: number;
  speed?: number;
  element?: string;
  formation?: string;
  notes?: string;
  payload?: Record<string, unknown>;
  enabled?: boolean;
}): Promise<AdminBattleTargetTemplateItem> {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('createAdminBattleTargetTemplate', async () => {
    const id = getUuid();

    await db()
      .insert(battleTargetTemplate)
      .values({
        id,
        userId: null,
        scope: 'system',
        name: input.name.trim(),
        dungeonName: input.dungeonName?.trim() ?? '',
        targetType: input.targetType?.trim() ?? 'mob',
        school: input.school?.trim() ?? '',
        level: input.level ?? 0,
        hp: input.hp ?? 0,
        defense: input.defense ?? 0,
        magicDefense: input.magicDefense ?? 0,
        magicDefenseCultivation: input.magicDefenseCultivation ?? 0,
        speed: input.speed ?? 0,
        element: input.element?.trim() ?? '',
        formation: input.formation?.trim() ?? '普通阵',
        notes: input.notes?.trim() ?? '',
        payloadJson: JSON.stringify(input.payload ?? {}),
        enabled: input.enabled ?? true,
      });

    const [saved] = await db()
      .select()
      .from(battleTargetTemplate)
      .where(eq(battleTargetTemplate.id, id))
      .limit(1);

    if (!saved) {
      throw new Error('failed to create battle target template');
    }

    clearSimulatorReadCache({
      attributeRules: false,
      targetTemplates: true,
    });
    return mapBattleTargetTemplateRow(saved);
  });
}

export async function updateAdminBattleTargetTemplate(
  id: string,
  input: {
    name?: string;
    dungeonName?: string;
    targetType?: string;
    school?: string;
    level?: number;
    hp?: number;
    defense?: number;
    magicDefense?: number;
    magicDefenseCultivation?: number;
    speed?: number;
    element?: string;
    formation?: string;
    notes?: string;
    payload?: Record<string, unknown>;
    enabled?: boolean;
  }
): Promise<AdminBattleTargetTemplateItem | null> {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('updateAdminBattleTargetTemplate', async () => {
    const [existing] = await db()
      .select()
      .from(battleTargetTemplate)
      .where(eq(battleTargetTemplate.id, id))
      .limit(1);

    if (!existing) {
      return null;
    }

    await db()
      .update(battleTargetTemplate)
      .set({
        name: input.name?.trim() ?? existing.name,
        dungeonName: input.dungeonName?.trim() ?? existing.dungeonName,
        targetType: input.targetType?.trim() ?? existing.targetType,
        school: input.school?.trim() ?? existing.school,
        level: input.level ?? existing.level,
        hp: input.hp ?? existing.hp,
        defense: input.defense ?? existing.defense,
        magicDefense: input.magicDefense ?? existing.magicDefense,
        magicDefenseCultivation:
          input.magicDefenseCultivation ?? existing.magicDefenseCultivation,
        speed: input.speed ?? existing.speed,
        element: input.element?.trim() ?? existing.element,
        formation: input.formation?.trim() ?? existing.formation,
        notes: input.notes?.trim() ?? existing.notes,
        payloadJson: JSON.stringify(
          input.payload ?? parseJsonObject(existing.payloadJson)
        ),
        enabled: input.enabled ?? existing.enabled,
      })
      .where(eq(battleTargetTemplate.id, id));

    const [saved] = await db()
      .select()
      .from(battleTargetTemplate)
      .where(eq(battleTargetTemplate.id, id))
      .limit(1);

    clearSimulatorReadCache({
      attributeRules: false,
      targetTemplates: true,
    });
    return saved ? mapBattleTargetTemplateRow(saved) : null;
  });
}

export async function deleteAdminBattleTargetTemplate(id: string) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('deleteAdminBattleTargetTemplate', async () => {
    const [existing] = await db()
      .select({ id: battleTargetTemplate.id })
      .from(battleTargetTemplate)
      .where(eq(battleTargetTemplate.id, id))
      .limit(1);

    if (!existing) {
      return false;
    }

    await db()
      .delete(battleTargetTemplate)
      .where(eq(battleTargetTemplate.id, id));

    clearSimulatorReadCache({
      attributeRules: false,
      targetTemplates: true,
    });
    return true;
  });
}

export async function listAdminSimulatorUserDiagnostics(params?: {
  keyword?: string;
  limit?: number;
}): Promise<AdminSimulatorUserDiagnosticItem[]> {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('listAdminSimulatorUserDiagnostics', async () => {
    const keyword = params?.keyword?.trim() ?? '';
    const where = keyword
      ? or(
          like(user.name, `%${keyword}%`),
          like(user.email, `%${keyword}%`),
          like(gameCharacter.name, `%${keyword}%`)
        )
      : undefined;

    const rows = await db()
      .select()
      .from(gameCharacter)
      .innerJoin(user, eq(gameCharacter.userId, user.id))
      .where(
        where
          ? and(eq(gameCharacter.status, 'active'), where)
          : eq(gameCharacter.status, 'active')
      )
      .orderBy(desc(gameCharacter.updatedAt), desc(user.createdAt))
      .limit(params?.limit ?? 30);

    const items = await Promise.all(
      rows.map(async (row: AdminSimulatorUserDiagnosticRow) => {
        const bundle = await getSimulatorCharacterBundle(
          row.user.id,
          row.game_character.id
        );
        const candidateRows = await findCandidateEquipmentRows(
          row.game_character.id
        );
        const activeSession = await findActiveLabSession(row.game_character.id);
        const labBundle = activeSession
          ? await buildSimulatorLabSessionBundle(activeSession)
          : null;

        return {
          userId: row.user.id,
          userName: row.user.name,
          userEmail: row.user.email,
          userCreatedAt: row.user.createdAt?.getTime?.() ?? 0,
          characterId: row.game_character.id,
          characterName: row.game_character.name,
          school: row.game_character.school,
          roleType: row.game_character.roleType,
          level: row.game_character.level,
          snapshotId: bundle?.snapshot?.id ?? null,
          snapshotName: bundle?.snapshot?.name ?? null,
          profileSummary: bundle?.profile
            ? {
                hp: Number(bundle.profile.hp ?? 0),
                mp: Number(bundle.profile.mp ?? 0),
                magicDamage: Number(bundle.profile.magicDamage ?? 0),
                magicDefense: Number(bundle.profile.magicDefense ?? 0),
                speed: Number(bundle.profile.speed ?? 0),
              }
            : null,
          battleContextSummary: bundle?.battleContext
            ? {
                selfFormation: bundle.battleContext.selfFormation,
                selfElement: bundle.battleContext.selfElement,
                targetName: bundle.battleContext.targetName,
                targetFormation: bundle.battleContext.targetFormation,
                targetElement: bundle.battleContext.targetElement,
                targetMagicDefense: Number(
                  bundle.battleContext.targetMagicDefense ?? 0
                ),
                splitTargetCount: Number(
                  bundle.battleContext.splitTargetCount ?? 1
                ),
              }
            : null,
          candidateSummary: {
            total: candidateRows.length,
            pending: candidateRows.filter(
              (item: SimulatorCandidateEquipment) => item.status === 'pending'
            ).length,
            confirmed: candidateRows.filter(
              (item: SimulatorCandidateEquipment) => item.status === 'confirmed'
            ).length,
            replaced: candidateRows.filter(
              (item: SimulatorCandidateEquipment) => item.status === 'replaced'
            ).length,
          },
          labSummary: {
            hasActiveSession: Boolean(activeSession),
            sessionName: activeSession?.name ?? null,
            compareSeatCount:
              labBundle?.seats.filter((seat) => !seat.isSample).length ?? 0,
            updatedAt: activeSession?.updatedAt?.getTime?.() ?? null,
          },
        };
      })
    );

    return items;
  });
}

export async function updateSimulatorLabSession(
  userId: string,
  payload: {
    name?: string;
    notes?: string;
    seats: Array<{
      id?: string;
      name?: string;
      isSample?: boolean;
      equipment?: Array<Record<string, unknown>>;
    }>;
  }
) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('updateSimulatorLabSession', async () => {
    const timer = createPerfTimer('updateSimulatorLabSession:model', {
      slowThresholdMs: 250,
    });
    const character = await findActiveCharacter(userId);
    timer.mark('character');
    if (!character) {
      timer.finish({ status: 'missing_character' });
      return null;
    }

    const snapshot = await findCurrentSnapshot(character);
    timer.mark('snapshot');
    if (!snapshot) {
      timer.finish({ status: 'missing_snapshot' });
      return null;
    }

    const normalizedSeats = normalizeLabSeatPayload(payload.seats);
    const existingSession = await findActiveLabSession(character.id);
    const sessionId = existingSession?.id ?? getUuid();
    const sessionName =
      payload.name?.trim() || existingSession?.name || '默认实验室';
    const sessionNotes = payload.notes ?? existingSession?.notes ?? '';
    const now = new Date();
    const persistedEquipmentRows: Array<{ id: string }> = await db()
      .select({ id: equipmentItem.id })
      .from(equipmentItem)
      .where(eq(equipmentItem.characterId, character.id));
    const persistedEquipmentIds = new Set(
      persistedEquipmentRows.map((row) => row.id)
    );
    timer.mark('load_equipment_refs');

    if (existingSession) {
      await db()
        .update(labSession)
        .set({
          baselineSnapshotId: snapshot.id,
          name: sessionName,
          notes: sessionNotes,
        })
        .where(eq(labSession.id, existingSession.id));
    } else {
      await db().insert(labSession).values({
        id: sessionId,
        characterId: character.id,
        baselineSnapshotId: snapshot.id,
        name: sessionName,
        status: 'active',
        notes: sessionNotes,
        createdBy: userId,
      });
    }

    await db()
      .delete(labSessionEquipment)
      .where(eq(labSessionEquipment.sessionId, sessionId));

    const equipmentRows = normalizedSeats.flatMap((seat, seatIndex) => {
      const metaRow = {
        id: getUuid(),
        sessionId,
        seatType: seat.id,
        slot: LAB_SEAT_META_SLOT,
        equipmentId: null,
        payloadJson: JSON.stringify({
          seatId: seat.id,
          seatName: seat.name,
          isSample: seat.isSample,
        }),
        source: 'meta',
        inheritGemstones: false,
        inheritRuneStones: false,
        sort: seatIndex * 100,
      };

      const itemRows = seat.equipment.map((equipment, equipmentIndex) => ({
        id: getUuid(),
        sessionId,
        seatType: seat.id,
        slot: toEquipmentSlotValue({
          type: String(equipment.type || 'weapon'),
          slot:
            typeof equipment.slot === 'number'
              ? equipment.slot
              : Number(equipment.slot) || undefined,
        }),
        equipmentId: resolveLabSessionEquipmentReferenceId(
          equipment.id,
          persistedEquipmentIds
        ),
        payloadJson: JSON.stringify({
          seatId: seat.id,
          seatName: seat.name,
          isSample: seat.isSample,
          equipment,
        }),
        source: 'manual',
        inheritGemstones: false,
        inheritRuneStones: false,
        sort: seatIndex * 100 + equipmentIndex + 1,
      }));

      return [metaRow, ...itemRows];
    });

    if (equipmentRows.length > 0) {
      await insertValuesInChunks(db(), labSessionEquipment, equipmentRows);
    }
    timer.mark('write_session');

    const nextSession: SimulatorLabSession = existingSession
      ? {
          ...existingSession,
          baselineSnapshotId: snapshot.id,
          name: sessionName,
          notes: sessionNotes,
          updatedAt: now,
        }
      : {
          id: sessionId,
          characterId: character.id,
          baselineSnapshotId: snapshot.id,
          name: sessionName,
          status: 'active',
          notes: sessionNotes,
          createdBy: userId,
          createdAt: now,
          updatedAt: now,
        };
    const nextSeats = normalizedSeats.map((seat, index) => ({
      ...seat,
      sort: index * 100,
      equipment: seat.equipment.map((equipment) => ({ ...equipment })),
    }));

    timer.finish({
      status: 'ok',
      seatCount: nextSeats.length,
      persistedEquipmentRefCount: persistedEquipmentIds.size,
    });

    return {
      session: nextSession,
      seats: nextSeats,
    };
  });
}

export async function getSimulatorCandidateEquipment(
  userId: string,
  characterId?: string
): Promise<SimulatorCandidateEquipmentItem[] | null> {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('getSimulatorCandidateEquipment', async () => {
    const character = await findActiveCharacter(userId, characterId);
    if (!character) {
      return null;
    }

    const rows = await findCandidateEquipmentRows(character.id);
    return rows.map(mapCandidateEquipmentRow);
  });
}

export async function updateSimulatorCandidateEquipment(
  userId: string,
  payload: {
    items: Array<{
      id?: string;
      equipment: Record<string, unknown>;
      imagePreview?: string;
      rawText?: string;
      targetSetId?: string;
      targetEquipmentId?: string;
      targetRuneStoneSetIndex?: number;
      status: 'pending' | 'confirmed' | 'replaced';
    }>;
  }
) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('updateSimulatorCandidateEquipment', async () => {
    const timer = createPerfTimer('updateSimulatorCandidateEquipment:model', {
      slowThresholdMs: 250,
    });
    const character = await findActiveCharacter(userId);
    timer.mark('character');
    if (!character) {
      timer.finish({ status: 'missing_character' });
      return null;
    }

    await db()
      .delete(candidateEquipment)
      .where(eq(candidateEquipment.characterId, character.id));

    const persistedItems = payload.items.map((item, index) => ({
      id: item.id || getUuid(),
      characterId: character.id,
      status: item.status,
      source: 'manual' as const,
      equipmentJson: JSON.stringify(item.equipment ?? {}),
      imageKey: item.imagePreview ?? null,
      rawText: item.rawText ?? null,
      targetSetId: item.targetSetId ?? null,
      targetEquipmentId: item.targetEquipmentId ?? null,
      targetRuneStoneSetIndex: item.targetRuneStoneSetIndex ?? null,
      sort: index,
    }));

    if (persistedItems.length > 0) {
      await insertValuesInChunks(db(), candidateEquipment, persistedItems);
    }

    const now = Date.now();
    const items = persistedItems.map((item) => ({
      id: item.id,
      equipment: parseJsonObject(item.equipmentJson),
      timestamp: now,
      imagePreview: item.imageKey ?? undefined,
      rawText: item.rawText ?? undefined,
      targetSetId: item.targetSetId ?? undefined,
      targetEquipmentId: item.targetEquipmentId ?? undefined,
      targetRuneStoneSetIndex: item.targetRuneStoneSetIndex ?? undefined,
      status: item.status,
    })) as SimulatorCandidateEquipmentItem[];
    timer.finish({
      status: 'ok',
      itemCount: items.length,
    });
    return items;
  });
}

export async function appendSimulatorCandidateEquipment(
  userId: string,
  payload: {
    equipment: Record<string, unknown>;
    imagePreview?: string;
    rawText?: string;
    status?: 'pending' | 'confirmed' | 'replaced';
  }
) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('appendSimulatorCandidateEquipment', async () => {
    const timer = createPerfTimer('appendSimulatorCandidateEquipment:model', {
      slowThresholdMs: 250,
    });
    const character = await findActiveCharacter(userId);
    timer.mark('character');
    if (!character) {
      timer.finish({ status: 'missing_character' });
      return null;
    }

    const currentRows = await findCandidateEquipmentRows(character.id);
    timer.mark('current_rows');
    const nextSort = currentRows.length;
    const insertedId = getUuid();
    const now = Date.now();

    await db()
      .insert(candidateEquipment)
      .values({
        id: insertedId,
        characterId: character.id,
        status: payload.status || 'pending',
        source: 'ocr',
        equipmentJson: JSON.stringify(payload.equipment ?? {}),
        imageKey: payload.imagePreview ?? null,
        rawText: payload.rawText ?? null,
        sort: nextSort,
      });

    const nextItems = [
      ...currentRows.map(mapCandidateEquipmentRow),
      {
        id: insertedId,
        equipment: payload.equipment ?? {},
        timestamp: now,
        imagePreview: payload.imagePreview ?? undefined,
        rawText: payload.rawText ?? undefined,
        status: payload.status || 'pending',
      },
    ] as SimulatorCandidateEquipmentItem[];
    timer.finish({
      status: 'ok',
      itemCount: nextItems.length,
    });
    return nextItems;
  });
}

export async function listAdminSimulatorPendingEquipment(params?: {
  status?: 'pending' | 'confirmed' | 'replaced';
  limit?: number;
}) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry(
    'listAdminSimulatorPendingEquipment',
    async () => {
      const status = params?.status || 'pending';
      const limit = Math.max(1, Math.min(params?.limit ?? 50, 200));

      const rows = await db()
        .select()
        .from(candidateEquipment)
        .innerJoin(
          gameCharacter,
          eq(candidateEquipment.characterId, gameCharacter.id)
        )
        .innerJoin(user, eq(gameCharacter.userId, user.id))
        .where(eq(candidateEquipment.status, status))
        .orderBy(
          desc(candidateEquipment.updatedAt),
          asc(candidateEquipment.sort)
        )
        .limit(limit);

      return rows.map(mapAdminCandidateEquipmentRow);
    }
  );
}

export async function deleteAdminSimulatorCandidateEquipment(id: string) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry(
    'deleteAdminSimulatorCandidateEquipment',
    async () => {
      const [row] = await db()
        .select({ id: candidateEquipment.id })
        .from(candidateEquipment)
        .where(eq(candidateEquipment.id, id))
        .limit(1);

      if (!row) {
        return false;
      }

      await db()
        .delete(candidateEquipment)
        .where(eq(candidateEquipment.id, id));
      return true;
    }
  );
}

export async function updateAdminSimulatorPendingEquipmentReview(params: {
  id: string;
  status: 'pending' | 'confirmed' | 'replaced';
  equipment: Record<string, unknown>;
  rawText?: string;
}) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry(
    'updateAdminSimulatorPendingEquipmentReview',
    async () => {
      await db()
        .update(candidateEquipment)
        .set({
          status: params.status,
          equipmentJson: JSON.stringify(params.equipment ?? {}),
          rawText: params.rawText ?? null,
        })
        .where(eq(candidateEquipment.id, params.id));

      const [row] = await db()
        .select()
        .from(candidateEquipment)
        .innerJoin(
          gameCharacter,
          eq(candidateEquipment.characterId, gameCharacter.id)
        )
        .innerJoin(user, eq(gameCharacter.userId, user.id))
        .where(eq(candidateEquipment.id, params.id))
        .limit(1);

      return row ? mapAdminCandidateEquipmentRow(row) : null;
    }
  );
}

export async function updateSimulatorEquipment(
  userId: string,
  payload: {
    equipment: Array<{
      id?: string;
      name: string;
      type: string;
      slot?: number;
      quality?: string;
      level?: number;
      price?: number;
      forgeLevel?: number;
      highlights?: string[];
      stats?: Record<string, unknown>;
      baseStats?: Record<string, unknown>;
      crossServerFee?: number;
      runeStoneSets?: Array<Array<Record<string, unknown>>>;
      runeStoneSetsNames?: string[];
      activeRuneStoneSet?: number;
      runeSetEffect?: string;
      setName?: string;
      extraStat?: string;
      description?: string;
      equippableRoles?: string;
      element?: string;
      durability?: number;
      gemstone?: string;
      luckyHoles?: string;
      starPosition?: string;
      starAlignment?: string;
      factionRequirement?: string;
      positionRequirement?: string;
      specialEffect?: string;
      manufacturer?: string;
      refinementEffect?: string;
      imageUrl?: string;
    }>;
    equipmentSets?: Array<Record<string, unknown>>;
    activeSetIndex?: number;
    createHistorySnapshot?: boolean;
    historySnapshotName?: string;
    historySnapshotNotes?: string;
    historySnapshotSource?: string;
  }
) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('updateSimulatorEquipment', async () => {
    const timer = createPerfTimer('updateSimulatorEquipment:model', {
      slowThresholdMs: 250,
    });
    const normalizedEquipment = normalizeEquipmentPayload(payload.equipment);

    const character = await findActiveCharacter(userId);
    timer.mark('character');
    if (!character) {
      timer.finish({ status: 'missing_character' });
      return null;
    }

    const snapshot = await findCurrentSnapshot(character);
    timer.mark('snapshot');
    if (!snapshot) {
      timer.finish({ status: 'missing_snapshot' });
      return null;
    }

    const [existingContextRows, profileRows, skills, cultivations] =
      await Promise.all([
        db()
          .select()
          .from(snapshotBattleContext)
          .where(eq(snapshotBattleContext.snapshotId, snapshot.id))
          .limit(1),
        db()
          .select()
          .from(characterProfile)
          .where(eq(characterProfile.snapshotId, snapshot.id))
          .limit(1),
        db()
          .select()
          .from(characterSkill)
          .where(eq(characterSkill.snapshotId, snapshot.id))
          .orderBy(
            desc(characterSkill.finalLevel),
            asc(characterSkill.skillName)
          ),
        db()
          .select()
          .from(characterCultivation)
          .where(eq(characterCultivation.snapshotId, snapshot.id))
          .orderBy(asc(characterCultivation.cultivationType)),
      ]);
    timer.mark('snapshot_relations');

    const existingContext = existingContextRows[0] ?? null;
    const profile = profileRows[0] ?? null;
    const [targetTemplateRows, rules] = await Promise.all([
      existingContext?.targetTemplateId
        ? db()
            .select()
            .from(battleTargetTemplate)
            .where(
              eq(battleTargetTemplate.id, existingContext.targetTemplateId)
            )
            .limit(1)
        : Promise.resolve([]),
      findAttributeRules({
        school: profile?.school ?? character.school,
        roleType: character.roleType,
      }),
    ]);
    timer.mark('rules');

    const targetTemplate = targetTemplateRows[0] ?? null;

    const nextPlan = syncEquipmentPlanNotes(
      sanitizeEquipmentPlanNotes({
        equipmentSets:
          payload.equipmentSets ??
          parseEquipmentPlanNotes(existingContext?.notesJson)?.equipmentSets,
        activeSetIndex:
          payload.activeSetIndex ??
          parseEquipmentPlanNotes(existingContext?.notesJson)?.activeSetIndex ??
          0,
      }),
      payload.equipment.filter(isRecord).map((item) => ({ ...item }))
    );
    const nextNotesJson = mergeNotesJsonWithEquipmentPlan(
      existingContext?.notesJson,
      nextPlan
    );

    const now = new Date();
    let nextEquipments: SimulatorEquipment[] = [];

    if (payload.createHistorySnapshot) {
      await createEquipmentRollbackSnapshot({
        character,
        snapshot,
        name: payload.historySnapshotName,
        notes: payload.historySnapshotNotes,
        source: payload.historySnapshotSource,
      });
      timer.mark('history_snapshot');
    }

    await deleteCurrentSnapshotEquipments({
      characterId: character.id,
      snapshotId: snapshot.id,
    });
    timer.mark('delete_existing');

    if (normalizedEquipment.length > 0) {
      const equipmentRows = normalizedEquipment.map((item) => {
        const equipmentId = getUuid();
        const slot = toEquipmentSlotValue(item);
        const attrRows = toEquipmentAttrRows(item);

        return {
          equipmentId,
          slot,
          item,
          attrRows,
        };
      });

      const database = db();
      const equipmentItemValues = equipmentRows.map(
        ({ equipmentId, slot, item }) => ({
          id: equipmentId,
          characterId: character.id,
          slot,
          name: item.name,
          level: item.level ?? 0,
          quality: item.quality ?? '',
          price: item.price ?? 0,
          source: 'manual',
          status: 'equipped',
          isLocked: false,
        })
      );
      const equipmentBuildValues = equipmentRows.map(
        ({ equipmentId, item }) => ({
          equipmentId,
          holeCount: 0,
          gemLevelTotal: 0,
          refineLevel: item.forgeLevel ?? 0,
          specialEffectJson: JSON.stringify(
            buildEquipmentSpecialEffectMeta(item as Record<string, unknown>)
          ),
          setEffectJson: JSON.stringify(
            buildEquipmentSetEffectMeta(item as Record<string, unknown>)
          ),
          notesJson: JSON.stringify(
            buildEquipmentNotesMeta(item as Record<string, unknown>)
          ),
        })
      );

      const attrValues = equipmentRows.flatMap(({ equipmentId, attrRows }) =>
        attrRows.map((attr) => ({
          id: getUuid(),
          equipmentId,
          ...attr,
        }))
      );
      const snapshotSlotValues = equipmentRows.map(({ equipmentId, slot }) => ({
        id: getUuid(),
        snapshotId: snapshot.id,
        slot,
        equipmentId,
      }));

      await insertValuesInChunks(database, equipmentItem, equipmentItemValues);
      await insertValuesInChunks(
        database,
        equipmentBuild,
        equipmentBuildValues
      );
      if (attrValues.length > 0) {
        await insertValuesInChunks(database, equipmentAttr, attrValues);
      }
      await insertValuesInChunks(
        database,
        snapshotEquipmentSlot,
        snapshotSlotValues
      );

      const buildByEquipmentId = new Map(
        equipmentBuildValues.map((row) => [row.equipmentId, row] as const)
      );
      const attrsByEquipmentId = new Map<string, SimulatorEquipmentAttr[]>();

      for (const attr of attrValues) {
        const current = attrsByEquipmentId.get(attr.equipmentId) ?? [];
        current.push(attr);
        attrsByEquipmentId.set(attr.equipmentId, current);
      }

      nextEquipments = equipmentItemValues.map((row) => ({
        ...row,
        createdAt: now,
        updatedAt: now,
        build: buildByEquipmentId.get(row.id) ?? null,
        attrs: attrsByEquipmentId.get(row.id) ?? [],
        snapshotSlot:
          snapshotSlotValues.find((slotRow) => slotRow.equipmentId === row.id)
            ?.slot ?? null,
      }));
    }
    timer.mark('write_equipment');

    const nextBattleContextValue = {
      ruleVersionId: existingContext?.ruleVersionId ?? null,
      selfFormation: existingContext?.selfFormation ?? '天覆阵',
      selfElement: existingContext?.selfElement ?? '水',
      formationCounterState:
        existingContext?.formationCounterState ?? '无克/普通',
      elementRelation: existingContext?.elementRelation ?? '无克/普通',
      transformCardFactor: existingContext?.transformCardFactor ?? 1,
      splitTargetCount: existingContext?.splitTargetCount ?? 1,
      shenmuValue: existingContext?.shenmuValue ?? 0,
      magicResult: existingContext?.magicResult ?? 0,
      targetTemplateId: existingContext?.targetTemplateId ?? null,
      targetName: existingContext?.targetName ?? '默认目标',
      targetLevel: existingContext?.targetLevel ?? 0,
      targetHp: existingContext?.targetHp ?? 0,
      targetDefense: existingContext?.targetDefense ?? 0,
      targetMagicDefense: existingContext?.targetMagicDefense ?? 0,
      targetSpeed: existingContext?.targetSpeed ?? targetTemplate?.speed ?? 0,
      targetMagicDefenseCultivation:
        existingContext?.targetMagicDefenseCultivation ?? 0,
      targetElement: existingContext?.targetElement ?? '',
      targetFormation: existingContext?.targetFormation ?? '普通阵',
      notesJson: nextNotesJson,
    };

    const nextBattleContext: SimulatorBattleContext = existingContext
      ? {
          ...existingContext,
          ...nextBattleContextValue,
          updatedAt: now,
        }
      : {
          snapshotId: snapshot.id,
          ...nextBattleContextValue,
          createdAt: now,
          updatedAt: now,
        };

    if (existingContext) {
      await db()
        .update(snapshotBattleContext)
        .set(nextBattleContextValue)
        .where(eq(snapshotBattleContext.snapshotId, snapshot.id));
    } else {
      await db()
        .insert(snapshotBattleContext)
        .values({
          snapshotId: snapshot.id,
          ...nextBattleContextValue,
        });
    }
    timer.mark('write_context');

    const bundle: SimulatorCharacterBundle = {
      character,
      snapshot,
      profile,
      skills,
      cultivations,
      battleContext: nextBattleContext,
      battleTargetTemplate: targetTemplate,
      rules,
      equipments: nextEquipments,
    };

    timer.finish({
      status: 'ok',
      equipmentCount: nextEquipments.length,
      createdHistorySnapshot: Boolean(payload.createHistorySnapshot),
      reusedSnapshotRelations: true,
      ruleCount: rules.length,
    });

    primeSimulatorCharacterBundleCache(userId, bundle);
    return bundle;
  });
}

export async function rollbackSimulatorEquipmentToLatestSnapshot(
  userId: string
) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry(
    'rollbackSimulatorEquipmentToLatestSnapshot',
    async () => {
      const timer = createPerfTimer(
        'rollbackSimulatorEquipmentToLatestSnapshot:model',
        {
          slowThresholdMs: 300,
        }
      );

      const character = await findActiveCharacter(userId);
      timer.mark('character');
      if (!character) {
        timer.finish({ status: 'missing_character' });
        return null;
      }

      const [currentSnapshot, latestRollbackSnapshot] = await Promise.all([
        findCurrentSnapshot(character),
        findLatestEquipmentRollbackSnapshot(character.id),
      ]);
      timer.mark('snapshots');

      if (!currentSnapshot || !latestRollbackSnapshot) {
        timer.finish({
          status: currentSnapshot
            ? 'missing_rollback_snapshot'
            : 'missing_snapshot',
        });
        return null;
      }

      const snapshotState = await loadSnapshotState({
        characterId: character.id,
        snapshotId: latestRollbackSnapshot.id,
      });
      timer.mark('load_snapshot_state');

      const now = new Date();
      const database = db();

      if (typeof database.batch === 'function') {
        await database.batch([
          database
            .delete(characterProfile)
            .where(eq(characterProfile.snapshotId, currentSnapshot.id)),
          database
            .delete(characterSkill)
            .where(eq(characterSkill.snapshotId, currentSnapshot.id)),
          database
            .delete(characterCultivation)
            .where(eq(characterCultivation.snapshotId, currentSnapshot.id)),
          database
            .delete(snapshotBattleContext)
            .where(eq(snapshotBattleContext.snapshotId, currentSnapshot.id)),
        ]);
      } else {
        await database
          .delete(characterProfile)
          .where(eq(characterProfile.snapshotId, currentSnapshot.id));
        await database
          .delete(characterSkill)
          .where(eq(characterSkill.snapshotId, currentSnapshot.id));
        await database
          .delete(characterCultivation)
          .where(eq(characterCultivation.snapshotId, currentSnapshot.id));
        await database
          .delete(snapshotBattleContext)
          .where(eq(snapshotBattleContext.snapshotId, currentSnapshot.id));
      }
      await deleteCurrentSnapshotEquipments({
        characterId: character.id,
        snapshotId: currentSnapshot.id,
      });
      timer.mark('clear_current_state');

      const restoredState = await insertSnapshotState({
        snapshotId: currentSnapshot.id,
        characterId: character.id,
        profile: snapshotState.profile,
        skills: snapshotState.skills,
        cultivations: snapshotState.cultivations,
        battleContext: snapshotState.battleContext,
        equipments: snapshotState.equipments,
        now,
      });
      await database
        .update(characterSnapshot)
        .set({
          updatedAt: now,
        })
        .where(eq(characterSnapshot.id, currentSnapshot.id));
      timer.mark('restore_current_state');

      const [targetTemplate, rules] = await Promise.all([
        findBattleTargetTemplateById(
          restoredState.battleContext?.targetTemplateId
        ),
        findAttributeRules({
          school: restoredState.profile?.school ?? character.school,
          roleType: character.roleType,
        }),
      ]);
      timer.mark('reload_bundle');

      const bundle: SimulatorCharacterBundle = {
        character,
        snapshot: {
          ...currentSnapshot,
          updatedAt: now,
        },
        profile: restoredState.profile,
        skills: restoredState.skills,
        cultivations: restoredState.cultivations,
        battleContext: restoredState.battleContext,
        battleTargetTemplate: targetTemplate,
        rules,
        equipments: restoredState.equipments,
      };

      clearSimulatorCharacterBundleCache(userId, character.id);
      primeSimulatorCharacterBundleCache(userId, bundle);

      timer.finish({
        status: 'ok',
        equipmentCount: bundle.equipments.length,
      });

      return bundle;
    }
  );
}
