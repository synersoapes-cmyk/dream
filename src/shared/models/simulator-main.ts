import { and, asc, desc, eq, inArray, like, or } from 'drizzle-orm';

import { db } from '@/core/db';
import {
  battleTargetTemplate,
  candidateEquipment,
  characterCultivation,
  characterProfile,
  characterSkill,
  characterSnapshot,
  equipmentAttr,
  equipmentBuild,
  equipmentItem,
  equipmentPlan,
  equipmentPlanItem,
  gameCharacter,
  inventoryEntry,
  jadeAttr,
  jadeItem,
  labSession,
  labSessionEquipment,
  ocrDictionary,
  ocrDraftItem,
  ocrJob,
  ornamentItem,
  ornamentSetEffect,
  ornamentSubAttr,
  ruleAttribute,
  ruleVersion,
  characterStarResonance,
  snapshotBattleContext,
  snapshotEquipmentSlot,
  snapshotJadeSlot,
  snapshotOrnamentSlot,
  starResonanceRule,
  starStoneAttr,
  starStoneItem,
  user,
} from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';
import { createPerfTimer } from '@/shared/lib/perf';
import { inferBaseHpSource } from '@/shared/lib/simulator-base-hp';
import { getRequiredSimulatorSeedConfig } from '@/shared/models/simulator-template';

import {
  chunkArray,
  ensureSimulatorDbReady,
  findActiveCharacter,
  findActiveLabSession,
  findCandidateEquipmentRows,
  findCurrentSnapshot,
  findSimulatorOcrJobById,
  insertValuesInChunks,
  isRecord,
  parseJsonObject,
  withTransientD1Retry,
} from './simulator-core';
import {
  buildJadeAttrRows,
  buildOrnamentAttrRows,
  buildOrnamentSetEffectRows,
  buildStarStonePersistenceRows,
  isJadeSlot,
  isOrnamentSlot,
  isPrimaryEquipmentSlot,
  mergeStarStateIntoNotesJson,
  resolveOrnamentMainAttr,
  toGenericEquipmentBuild,
  toGenericEquipmentRow,
  toOrnamentSetEffectSource,
  toPersistedJadeSlot,
  toPersistedOrnamentSlot,
} from './simulator-equipment-persistence';
import { buildSimulatorLabSessionBundle } from './simulator-mappers';
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
import {
  createEquipmentRollbackSnapshot,
  deleteCurrentSnapshotEquipments,
  findLatestEquipmentRollbackSnapshot,
  insertSnapshotState,
  type PersistedSnapshotState,
} from './simulator-snapshots';
import type {
  AdminBattleTargetTemplateItem,
  AdminSimulatorInventoryEntryItem,
  AdminSimulatorLabSessionItem,
  AdminSimulatorOcrDictionaryItem,
  AdminSimulatorOcrJobItem,
  AdminSimulatorPendingReviewItem,
  AdminSimulatorUserDiagnosticItem,
  SimulatorBattleContext,
  SimulatorBattleTargetTemplate,
  SimulatorCandidateEquipment,
  SimulatorCandidateEquipmentItem,
  SimulatorCharacter,
  SimulatorCharacterBundle,
  SimulatorCharacterSummary,
  SimulatorCharacterStarResonance,
  SimulatorCultivation,
  SimulatorEquipment,
  SimulatorEquipmentAttr,
  SimulatorEquipmentBuild,
  SimulatorEquipmentPlan,
  SimulatorEquipmentPlanItem,
  SimulatorEquipmentPlanState,
  SimulatorEquipmentRow,
  SimulatorInventoryEntry,
  SimulatorJadeAttrRow,
  SimulatorJadeRow,
  SimulatorLabSeatPayload,
  SimulatorLabSession,
  SimulatorLabSessionBundle,
  SimulatorLabSessionEquipment,
  SimulatorOcrDictionary,
  SimulatorOcrDraftItem,
  SimulatorOcrJob,
  SimulatorOrnamentRow,
  SimulatorOrnamentSubAttrRow,
  SimulatorProfile,
  SimulatorRollbackSnapshotSummary,
  SimulatorRule,
  SimulatorSkill,
  SimulatorStarResonanceRule,
  SimulatorStarStoneAttr,
  SimulatorStarStoneItem,
  SimulatorSnapshot,
  SimulatorSnapshotJadeSlot,
  SimulatorSnapshotOrnamentSlot,
  SimulatorSnapshotSlot,
} from './simulator-types';

export { resolveLabSessionEquipmentReferenceId } from './simulator-payload';

type AdminSimulatorLabSessionRow = {
  lab_session: SimulatorLabSession;
  game_character: SimulatorCharacter;
  user: typeof user.$inferSelect;
};

type AdminSimulatorUserDiagnosticRow = {
  game_character: SimulatorCharacter;
  user: typeof user.$inferSelect;
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const RULE_ATTRIBUTE_CACHE_TTL_MS = 60 * 1000;
const TARGET_TEMPLATE_CACHE_TTL_MS = 60 * 1000;
const SIMULATOR_BUNDLE_CACHE_TTL_MS = 20 * 1000;

const ruleAttributeCache = new Map<string, CacheEntry<SimulatorRule[]>>();
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
    ruleAttributeCache.clear();
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

function buildSimulatorCharacterBundle(params: {
  character: SimulatorCharacter;
  snapshot: SimulatorSnapshot;
  profile: SimulatorProfile | null;
  skills: SimulatorSkill[];
  cultivations: SimulatorCultivation[];
  battleContext: SimulatorBattleContext | null;
  battleTargetTemplate: SimulatorBattleTargetTemplate | null;
  rules: SimulatorRule[];
  equipments: SimulatorEquipment[];
  equipmentPlan: SimulatorEquipmentPlanState | null;
}): SimulatorCharacterBundle {
  return {
    character: params.character,
    snapshot: params.snapshot,
    profile: params.profile,
    skills: params.skills,
    cultivations: params.cultivations,
    battleContext: params.battleContext,
    battleTargetTemplate: params.battleTargetTemplate,
    rules: params.rules,
    equipments: params.equipments,
    equipmentPlan: params.equipmentPlan,
  };
}

function primeSimulatorCharacterBundleAndReturn(
  userId: string,
  bundle: SimulatorCharacterBundle,
  options?: { clearCharacterId?: string }
) {
  if (options?.clearCharacterId) {
    clearSimulatorCharacterBundleCache(userId, options.clearCharacterId);
  }

  primeSimulatorCharacterBundleCache(userId, bundle);
  return bundle;
}

type ActiveSimulatorContext = {
  character: SimulatorCharacter;
  snapshot: SimulatorSnapshot;
  profile: SimulatorProfile | null;
  skills: SimulatorSkill[];
  cultivations: SimulatorCultivation[];
  battleContext: SimulatorBattleContext | null;
  equipments: SimulatorEquipment[];
};

async function loadActiveSimulatorContext(
  userId: string,
  options?: { includeEquipments?: boolean }
): Promise<ActiveSimulatorContext | null> {
  const character = await findActiveCharacter(userId);
  if (!character) {
    return null;
  }

  const snapshot = await findCurrentSnapshot(character);
  if (!snapshot) {
    return null;
  }

  const includeEquipments = options?.includeEquipments ?? true;
  const [profileRows, skills, cultivations, battleContextRows, equipments] =
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
      includeEquipments
        ? loadPersistedBundleEquipments({
            characterId: character.id,
            snapshotId: snapshot.id,
          })
        : Promise.resolve([] as SimulatorEquipment[]),
    ]);

  return {
    character,
    snapshot,
    profile: profileRows[0] ?? null,
    skills,
    cultivations,
    battleContext: battleContextRows[0] ?? null,
    equipments,
  };
}

async function resolveSimulatorBundleDependencies(params: {
  character: SimulatorCharacter;
  profile: SimulatorProfile | null;
  battleContext: SimulatorBattleContext | null;
  schoolOverride?: string | null;
  targetTemplateIdOverride?: string | null;
  includeEquipmentPlan?: boolean;
}) {
  const targetTemplateId =
    params.targetTemplateIdOverride === undefined
      ? params.battleContext?.targetTemplateId
      : params.targetTemplateIdOverride;

  const [targetTemplate, rules, equipmentPlan] = await Promise.all([
    findBattleTargetTemplateById(targetTemplateId),
    findAttributeRules({
      school:
        params.schoolOverride ||
        params.profile?.school ||
        params.character.school,
      roleType: params.character.roleType,
    }),
    params.includeEquipmentPlan === false
      ? Promise.resolve(null)
      : loadCharacterEquipmentPlanState(params.character.id),
  ]);

  return {
    targetTemplate,
    rules,
    equipmentPlan,
  };
}

async function writeSnapshotBattleContext(params: {
  snapshotId: string;
  existingContext: SimulatorBattleContext | null;
  nextValue: Omit<SimulatorBattleContext, 'snapshotId' | 'createdAt' | 'updatedAt'>;
  now: Date;
}) {
  const nextBattleContext: SimulatorBattleContext = params.existingContext
    ? {
        ...params.existingContext,
        ...params.nextValue,
        updatedAt: params.now,
      }
    : {
        snapshotId: params.snapshotId,
        ...params.nextValue,
        createdAt: params.now,
        updatedAt: params.now,
      };

  if (params.existingContext) {
    await db()
      .update(snapshotBattleContext)
      .set(params.nextValue)
      .where(eq(snapshotBattleContext.snapshotId, params.snapshotId));
  } else {
    await db()
      .insert(snapshotBattleContext)
      .values({
        snapshotId: params.snapshotId,
        ...params.nextValue,
      });
  }

  return nextBattleContext;
}

function toOptionalInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

const EQUIPMENT_PLAN_NOTES_KEY = 'equipmentPlan';
const MANUAL_TARGETS_NOTES_KEY = 'manualTargets';
const COMBAT_TAB_NOTES_KEY = 'combatTab';
const SELECTED_DUNGEON_IDS_NOTES_KEY = 'selectedDungeonIds';
const EQUIPMENT_ROLLBACK_SNAPSHOT_SOURCE = 'equipment_backup';
async function loadEnabledStarResonanceRules() {
  const rows = await db()
    .select()
    .from(starResonanceRule)
    .where(eq(starResonanceRule.enabled, true))
    .orderBy(asc(starResonanceRule.sort), asc(starResonanceRule.slot));

  return rows;
}

type SimulatorEquipmentPlanNotes = SimulatorEquipmentPlanState;

function sanitizeEquipmentPlanNotes(
  value: unknown
): SimulatorEquipmentPlanNotes | null {
  if (!isRecord(value)) {
    return null;
  }

  const equipmentSets = Array.isArray(value.equipmentSets)
    ? value.equipmentSets.filter(isRecord).map((set, index) => ({
        id:
          typeof set.id === 'string' && set.id.trim().length > 0
            ? set.id.trim()
            : `set_${index + 1}`,
        name:
          typeof set.name === 'string' && set.name.trim().length > 0
            ? set.name.trim()
            : `配置${index + 1}`,
        items: Array.isArray(set.items)
          ? set.items.filter(isRecord).map((item) => ({ ...item }))
          : [],
        isActive: false,
      }))
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

function removeEquipmentPlanFromNotesJson(
  notesJson: string | null | undefined
) {
  const notes = parseJsonObject(notesJson);
  delete notes[EQUIPMENT_PLAN_NOTES_KEY];
  return JSON.stringify(notes);
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed =
    typeof value === 'number' && Number.isFinite(value) ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toPersistedManualTarget(
  value: unknown,
  index: number
): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  const id =
    typeof value.id === 'string' && value.id.trim().length > 0
      ? value.id.trim()
      : `manual_target_${index + 1}`;
  const name =
    typeof value.name === 'string' && value.name.trim().length > 0
      ? value.name.trim()
      : `手动目标${index + 1}`;
  const element =
    typeof value.element === 'string' && value.element.trim().length > 0
      ? value.element.trim()
      : '水';
  const formation =
    typeof value.formation === 'string' && value.formation.trim().length > 0
      ? value.formation.trim()
      : '普通阵';

  return {
    id,
    name,
    element,
    formation,
    magicDamage: toFiniteNumber(value.magicDamage, 0),
    spiritualPower: toFiniteNumber(value.spiritualPower, 0),
    magicCritLevel: toFiniteNumber(value.magicCritLevel, 0),
    speed: toFiniteNumber(value.speed, 0),
    hit: toFiniteNumber(value.hit, 0),
    fixedDamage: toFiniteNumber(value.fixedDamage, 0),
    pierceLevel: toFiniteNumber(value.pierceLevel, 0),
    elementalMastery: toFiniteNumber(value.elementalMastery, 0),
    hp: toFiniteNumber(value.hp, 0),
    magicDefense: toFiniteNumber(value.magicDefense, 0),
    defense: toFiniteNumber(value.defense, 0),
    block: toFiniteNumber(value.block, 0),
    antiCritLevel: toFiniteNumber(value.antiCritLevel, 0),
    sealResistLevel: toFiniteNumber(value.sealResistLevel, 0),
    dodge: toFiniteNumber(value.dodge, 0),
    elementalResistance: toFiniteNumber(value.elementalResistance, 0),
  };
}

function sanitizeSelectedDungeonIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const ids = value
    .filter(
      (item): item is string =>
        typeof item === 'string' && item.trim().length > 0
    )
    .map((item) => item.trim());

  return Array.from(new Set(ids)).slice(0, 5);
}

function buildBattleContextNotesJson(
  currentNotesJson: string | null | undefined,
  patch: {
    manualTargets?: unknown[];
    combatTab?: 'manual' | 'dungeon';
    selectedDungeonIds?: unknown[];
  }
) {
  const notes = parseJsonObject(removeEquipmentPlanFromNotesJson(currentNotesJson));

  if (patch.manualTargets !== undefined) {
    const manualTargets = patch.manualTargets
      .map(toPersistedManualTarget)
      .filter(
        (item): item is Record<string, unknown> => item !== null
      );
    notes[MANUAL_TARGETS_NOTES_KEY] = manualTargets;
  }

  if (patch.combatTab !== undefined) {
    notes[COMBAT_TAB_NOTES_KEY] =
      patch.combatTab === 'dungeon' ? 'dungeon' : 'manual';
  }

  if (patch.selectedDungeonIds !== undefined) {
    notes[SELECTED_DUNGEON_IDS_NOTES_KEY] = sanitizeSelectedDungeonIds(
      patch.selectedDungeonIds
    );
  }

  return JSON.stringify(notes);
}

function stripEquipmentPlanFromBattleContext(
  battleContext: SimulatorBattleContext | null
) {
  if (!battleContext) {
    return null;
  }

  return {
    ...battleContext,
    notesJson: removeEquipmentPlanFromNotesJson(battleContext.notesJson),
  };
}

function buildEquipmentPlanItemSlotKey(
  item: Record<string, unknown>,
  sort: number
) {
  const type = String(item.type ?? '').trim();
  const slot =
    item.slot === undefined || item.slot === null
      ? ''
      : String(item.slot).trim();

  if (type && slot) {
    return `${type}:${slot}`;
  }

  if (type) {
    return type;
  }

  if (slot) {
    return slot;
  }

  return `item_${sort + 1}`;
}

async function loadCharacterEquipmentPlanState(
  characterId: string
): Promise<SimulatorEquipmentPlanNotes | null> {
  const planRows = (await db()
    .select()
    .from(equipmentPlan)
    .where(eq(equipmentPlan.characterId, characterId))
    .orderBy(asc(equipmentPlan.sort), desc(equipmentPlan.updatedAt))) as
    | SimulatorEquipmentPlan[]
    | [];

  if (planRows.length === 0) {
    return null;
  }

  const itemRows = planRows.length
    ? ((await db()
        .select()
        .from(equipmentPlanItem)
        .where(
          inArray(
            equipmentPlanItem.planId,
            planRows.map((row) => row.id)
          )
        )
        .orderBy(
          asc(equipmentPlanItem.planId),
          asc(equipmentPlanItem.sort),
          desc(equipmentPlanItem.updatedAt)
        )) as SimulatorEquipmentPlanItem[])
    : [];

  const itemsByPlanId = new Map<string, Array<Record<string, unknown>>>();
  for (const row of itemRows) {
    const current = itemsByPlanId.get(row.planId) ?? [];
    current.push(parseJsonObject(row.payloadJson));
    itemsByPlanId.set(row.planId, current);
  }

  let activeSetIndex = planRows.findIndex((row) => Boolean(row.isActive));
  if (activeSetIndex < 0) {
    activeSetIndex = 0;
  }

  return {
    activeSetIndex,
    equipmentSets: planRows.map((row, index) => ({
      id: row.id,
      name: row.name.trim() || `配置${index + 1}`,
      items: itemsByPlanId.get(row.id) ?? [],
      isActive: index === activeSetIndex,
    })),
  };
}

async function replaceCharacterEquipmentPlanState(params: {
  characterId: string;
  plan: SimulatorEquipmentPlanNotes | null;
  now: Date;
}): Promise<SimulatorEquipmentPlanNotes | null> {
  await db()
    .delete(equipmentPlan)
    .where(eq(equipmentPlan.characterId, params.characterId));

  if (!params.plan || params.plan.equipmentSets.length === 0) {
    return null;
  }

  const activeSetIndex = Math.max(0, params.plan.activeSetIndex);
  const nextPlans: Array<typeof equipmentPlan.$inferInsert> = [];
  const nextPlanItems: Array<typeof equipmentPlanItem.$inferInsert> = [];

  params.plan.equipmentSets.forEach((set, index) => {
    const planId =
      typeof set.id === 'string' && set.id.trim().length > 0
        ? set.id.trim()
        : getUuid();
    const items = Array.isArray(set.items)
      ? set.items.filter(isRecord).map((item) => ({ ...item }))
      : [];

    nextPlans.push({
      id: planId,
      characterId: params.characterId,
      name:
        typeof set.name === 'string' && set.name.trim().length > 0
          ? set.name.trim()
          : `配置${index + 1}`,
      sort: index,
      isActive: index === activeSetIndex,
      createdAt: params.now,
      updatedAt: params.now,
    });

    items.forEach((item, itemIndex) => {
      nextPlanItems.push({
        id: getUuid(),
        planId,
        slotKey: buildEquipmentPlanItemSlotKey(item, itemIndex),
        itemType: String(item.type || 'equipment').trim() || 'equipment',
        payloadJson: JSON.stringify(item),
        sort: itemIndex,
        createdAt: params.now,
        updatedAt: params.now,
      });
    });
  });

  await insertValuesInChunks(db(), equipmentPlan, nextPlans);
  await insertValuesInChunks(db(), equipmentPlanItem, nextPlanItems);

  return {
    activeSetIndex,
    equipmentSets: nextPlans.map((planRow, index) => ({
      id: planRow.id,
      name: planRow.name ?? '',
      items: nextPlanItems
        .filter((item) => item.planId === planRow.id)
        .sort((left, right) => (left.sort ?? 0) - (right.sort ?? 0))
        .map((item) => parseJsonObject(item.payloadJson)),
      isActive: index === activeSetIndex,
    })),
  };
}

async function findAttributeRules(params: {
  school: string;
  roleType: string;
}): Promise<SimulatorRule[]> {
  try {
    const [activeVersion] = await db()
      .select({ id: ruleVersion.id })
      .from(ruleVersion)
      .where(
        and(
          eq(ruleVersion.ruleDomain, 'damage'),
          eq(ruleVersion.status, 'published'),
          eq(ruleVersion.isActive, true)
        )
      )
      .orderBy(desc(ruleVersion.updatedAt), desc(ruleVersion.createdAt))
      .limit(1);

    if (!activeVersion) {
      return [];
    }

    const cacheKey = `${activeVersion.id}::${params.school}::${params.roleType}`;
    const cachedRules = getCachedValue(ruleAttributeCache, cacheKey);
    if (cachedRules) {
      return cachedRules;
    }

    const rules = await db()
      .select()
      .from(ruleAttribute)
      .where(
        and(
          eq(ruleAttribute.versionId, activeVersion.id),
          eq(ruleAttribute.school, params.school),
          eq(ruleAttribute.roleType, params.roleType),
          eq(ruleAttribute.enabled, true)
        )
      )
      .orderBy(asc(ruleAttribute.sort), asc(ruleAttribute.sourceAttr));
    setCachedValue(
      ruleAttributeCache,
      cacheKey,
      rules,
      RULE_ATTRIBUTE_CACHE_TTL_MS
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
  const database = db();
  const [primarySlotRows, ornamentSlotRows, jadeSlotRows] = await Promise.all([
    database
      .select()
      .from(snapshotEquipmentSlot)
      .where(eq(snapshotEquipmentSlot.snapshotId, params.snapshotId))
      .orderBy(asc(snapshotEquipmentSlot.slot)),
    database
      .select()
      .from(snapshotOrnamentSlot)
      .where(eq(snapshotOrnamentSlot.snapshotId, params.snapshotId))
      .orderBy(asc(snapshotOrnamentSlot.slot)),
    database
      .select()
      .from(snapshotJadeSlot)
      .where(eq(snapshotJadeSlot.snapshotId, params.snapshotId))
      .orderBy(asc(snapshotJadeSlot.slot)),
  ]);

  const linkedPrimaryIds = primarySlotRows.map(
    (row: SimulatorSnapshotSlot) => row.equipmentId
  );
  const linkedOrnamentIds = ornamentSlotRows.map(
    (row: SimulatorSnapshotOrnamentSlot) => row.ornamentId
  );
  const linkedJadeIds = jadeSlotRows.map(
    (row: SimulatorSnapshotJadeSlot) => row.jadeId
  );

  const [
    primaryRows,
    ornamentRows,
    jadeRows,
    buildRows,
    primaryAttrRows,
    ornamentAttrRows,
    jadeAttrRows,
    starStoneRows,
    starResonanceRows,
  ] = await Promise.all([
    linkedPrimaryIds.length
      ? database
          .select()
          .from(equipmentItem)
          .where(inArray(equipmentItem.id, linkedPrimaryIds))
      : database
          .select()
          .from(equipmentItem)
          .where(eq(equipmentItem.characterId, params.characterId))
          .orderBy(asc(equipmentItem.slot), desc(equipmentItem.updatedAt)),
    linkedOrnamentIds.length
      ? database
          .select()
          .from(ornamentItem)
          .where(inArray(ornamentItem.id, linkedOrnamentIds))
      : database
          .select()
          .from(ornamentItem)
          .where(eq(ornamentItem.characterId, params.characterId))
          .orderBy(asc(ornamentItem.slot), desc(ornamentItem.updatedAt)),
    linkedJadeIds.length
      ? database
          .select()
          .from(jadeItem)
          .where(inArray(jadeItem.id, linkedJadeIds))
      : database
          .select()
          .from(jadeItem)
          .where(eq(jadeItem.characterId, params.characterId))
          .orderBy(asc(jadeItem.slot), desc(jadeItem.updatedAt)),
    linkedPrimaryIds.length
      ? database
          .select()
          .from(equipmentBuild)
          .where(inArray(equipmentBuild.equipmentId, linkedPrimaryIds))
      : Promise.resolve([]),
    linkedPrimaryIds.length
      ? database
          .select()
          .from(equipmentAttr)
          .where(inArray(equipmentAttr.equipmentId, linkedPrimaryIds))
          .orderBy(asc(equipmentAttr.displayOrder))
      : Promise.resolve([]),
    linkedOrnamentIds.length
      ? database
          .select()
          .from(ornamentSubAttr)
          .where(inArray(ornamentSubAttr.ornamentId, linkedOrnamentIds))
          .orderBy(asc(ornamentSubAttr.displayOrder))
      : Promise.resolve([]),
    linkedJadeIds.length
      ? database
          .select()
          .from(jadeAttr)
          .where(inArray(jadeAttr.jadeId, linkedJadeIds))
          .orderBy(asc(jadeAttr.displayOrder))
      : Promise.resolve([]),
    linkedPrimaryIds.length
      ? database
          .select()
          .from(starStoneItem)
          .where(inArray(starStoneItem.equipmentId, linkedPrimaryIds))
          .orderBy(asc(starStoneItem.slot), desc(starStoneItem.updatedAt))
      : Promise.resolve([]),
    database
      .select()
      .from(characterStarResonance)
      .where(eq(characterStarResonance.snapshotId, params.snapshotId))
      .orderBy(asc(characterStarResonance.slot)),
  ]);

  const starStoneIds = starStoneRows.map(
    (row: SimulatorStarStoneItem) => row.id
  );
  const starResonanceRuleIds = starResonanceRows
    .map((row: SimulatorCharacterStarResonance) => row.ruleId)
    .filter(
      (ruleId: string | null): ruleId is string =>
        typeof ruleId === 'string' && ruleId.length > 0
    );
  const starStoneAttrRows =
    starStoneIds.length > 0
      ? await database
          .select()
          .from(starStoneAttr)
          .where(inArray(starStoneAttr.starStoneId, starStoneIds))
          .orderBy(asc(starStoneAttr.displayOrder))
      : [];
  const starResonanceRuleRows: SimulatorStarResonanceRule[] =
    starResonanceRuleIds.length > 0
      ? await database
          .select()
          .from(starResonanceRule)
          .where(inArray(starResonanceRule.id, starResonanceRuleIds))
      : [];

  const buildByEquipmentId = new Map(
    buildRows.map(
      (row: SimulatorEquipmentBuild) => [row.equipmentId, row] as const
    )
  );
  const primaryAttrsByEquipmentId = new Map<string, SimulatorEquipmentAttr[]>();
  const ornamentAttrsById = new Map<string, SimulatorOrnamentSubAttrRow[]>();
  const jadeAttrsById = new Map<string, SimulatorJadeAttrRow[]>();
  const starStoneRowsByEquipmentId = new Map<string, SimulatorStarStoneItem[]>();
  const starStoneAttrsById = new Map<string, SimulatorStarStoneAttr[]>();
  const starResonanceBySlot = new Map<string, SimulatorCharacterStarResonance>();
  const starResonanceRuleById = new Map<string, SimulatorStarResonanceRule>(
    starResonanceRuleRows.map((row) => [row.id, row] as const)
  );

  for (const attr of primaryAttrRows) {
    const current = primaryAttrsByEquipmentId.get(attr.equipmentId) ?? [];
    current.push(attr);
    primaryAttrsByEquipmentId.set(attr.equipmentId, current);
  }

  for (const attr of ornamentAttrRows) {
    const current = ornamentAttrsById.get(attr.ornamentId) ?? [];
    current.push(attr);
    ornamentAttrsById.set(attr.ornamentId, current);
  }

  for (const attr of jadeAttrRows) {
    const current = jadeAttrsById.get(attr.jadeId) ?? [];
    current.push(attr);
    jadeAttrsById.set(attr.jadeId, current);
  }

  for (const row of starStoneRows) {
    const equipmentId = row.equipmentId ?? '';
    if (!equipmentId) {
      continue;
    }

    const current = starStoneRowsByEquipmentId.get(equipmentId) ?? [];
    current.push(row);
    starStoneRowsByEquipmentId.set(equipmentId, current);
  }

  for (const attr of starStoneAttrRows) {
    const current = starStoneAttrsById.get(attr.starStoneId) ?? [];
    current.push(attr);
    starStoneAttrsById.set(attr.starStoneId, current);
  }

  for (const row of starResonanceRows) {
    starResonanceBySlot.set(row.slot, row);
  }

  const rowsByOrder = new Map<string, SimulatorEquipment>();

  for (const item of primaryRows) {
    const primaryBuild = buildByEquipmentId.get(item.id) as
      | SimulatorEquipmentBuild
      | undefined;
    const equipmentStarStoneRows = starStoneRowsByEquipmentId.get(item.id) ?? [];
    const mergedNotesJson = mergeStarStateIntoNotesJson({
      notesJson: primaryBuild?.notesJson ?? '{}',
      starStoneRows: equipmentStarStoneRows,
      starStoneAttrRows: equipmentStarStoneRows.flatMap(
        (row: SimulatorStarStoneItem) => starStoneAttrsById.get(row.id) ?? []
      ),
      resonanceRow: (() => {
        const slotKey =
          primarySlotRows.find(
            (row: SimulatorSnapshotSlot) => row.equipmentId === item.id
          )?.slot ?? item.slot;
        return starResonanceBySlot.get(slotKey) ?? null;
      })(),
      resonanceRule: (() => {
        const slotKey =
          primarySlotRows.find(
            (row: SimulatorSnapshotSlot) => row.equipmentId === item.id
          )?.slot ?? item.slot;
        const resonance = starResonanceBySlot.get(slotKey) ?? null;
        return resonance?.ruleId
          ? starResonanceRuleById.get(resonance.ruleId) ?? null
          : null;
      })(),
    });

    rowsByOrder.set(
      item.id,
      toGenericEquipmentRow({
        ...item,
        price: Number(item.price ?? 0),
        build: primaryBuild
          ? {
              ...primaryBuild,
              notesJson: mergedNotesJson,
            }
          : null,
        attrs: primaryAttrsByEquipmentId.get(item.id) ?? [],
        snapshotSlot:
          primarySlotRows.find(
            (row: SimulatorSnapshotSlot) => row.equipmentId === item.id
          )?.slot ?? null,
      })
    );
  }

  for (const item of ornamentRows) {
    rowsByOrder.set(
      item.id,
      toGenericEquipmentRow({
        id: item.id,
        characterId: item.characterId,
        slot: item.slot,
        name: item.name,
        level: Number(item.level ?? 0),
        quality: item.quality,
        price: Number(item.price ?? 0),
        source: item.source,
        status: item.status,
        isLocked: false,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        build: toGenericEquipmentBuild({
          equipmentId: item.id,
          specialEffectJson: item.specialEffectJson,
          setEffectJson: item.setEffectJson,
          notesJson: item.notesJson,
        }),
        attrs: buildOrnamentAttrRows({
          ornament: item,
          subAttrs: ornamentAttrsById.get(item.id) ?? [],
        }),
        snapshotSlot:
          ornamentSlotRows.find(
            (row: SimulatorSnapshotOrnamentSlot) => row.ornamentId === item.id
          )?.slot ?? null,
      })
    );
  }

  for (const item of jadeRows) {
    rowsByOrder.set(
      item.id,
      toGenericEquipmentRow({
        id: item.id,
        characterId: item.characterId,
        slot: item.slot,
        name: item.name,
        level: Number(item.fitLevel ?? 0),
        quality: item.quality,
        price: Number(item.price ?? 0),
        source: item.source,
        status: item.status,
        isLocked: false,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        build: toGenericEquipmentBuild({
          equipmentId: item.id,
          specialEffectJson: item.specialEffectJson,
          setEffectJson: item.setEffectJson,
          notesJson: item.notesJson,
        }),
        attrs: buildJadeAttrRows({
          jade: item,
          attrs: jadeAttrsById.get(item.id) ?? [],
        }),
        snapshotSlot:
          jadeSlotRows.find(
            (row: SimulatorSnapshotJadeSlot) => row.jadeId === item.id
          )?.slot ?? null,
      })
    );
  }

  const orderedIds = [
    ...primarySlotRows.map((row: SimulatorSnapshotSlot) => row.equipmentId),
    ...ornamentSlotRows.map(
      (row: SimulatorSnapshotOrnamentSlot) => row.ornamentId
    ),
    ...jadeSlotRows.map((row: SimulatorSnapshotJadeSlot) => row.jadeId),
  ];

  if (orderedIds.length === 0) {
    return [
      ...primaryRows.map(
        (row: SimulatorEquipmentRow) => rowsByOrder.get(row.id)!
      ),
      ...ornamentRows.map(
        (row: SimulatorOrnamentRow) => rowsByOrder.get(row.id)!
      ),
      ...jadeRows.map((row: SimulatorJadeRow) => rowsByOrder.get(row.id)!),
    ];
  }

  return orderedIds
    .map((id) => rowsByOrder.get(id) ?? null)
    .filter((item): item is SimulatorEquipment => Boolean(item));
}

async function loadSnapshotState(params: {
  characterId: string;
  snapshotId: string;
}): Promise<PersistedSnapshotState> {
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
    const [profileRows, skills, cultivations, battleContextRows, equipments] =
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
            loadPersistedBundleEquipments({
              characterId: character.id,
              snapshotId: snapshot.id,
            }),
          ])
        : [[], [], [], [], []];
    timer.mark('snapshot_relations');

    const profile = profileRows[0] ?? null;
    const battleContext = battleContextRows[0] ?? null;

    const [targetTemplate, rules, equipmentPlanNotes] = await Promise.all([
      findBattleTargetTemplateById(battleContext?.targetTemplateId),
      findAttributeRules({
        school: profile?.school ?? character.school,
        roleType: character.roleType,
      }),
      loadCharacterEquipmentPlanState(character.id),
    ]);
    timer.mark('rules_and_equipment');

    const normalizedBattleContext = battleContext
      ? {
          ...battleContext,
          notesJson: removeEquipmentPlanFromNotesJson(battleContext.notesJson),
        }
      : null;

    const bundle = {
      character,
      snapshot: snapshot ?? null,
      profile,
      skills,
      cultivations,
      battleContext: normalizedBattleContext,
      battleTargetTemplate: targetTemplate,
      rules,
      equipments,
      equipmentPlan: equipmentPlanNotes,
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

function normalizeCharacterName(name: string | null | undefined) {
  return String(name || '').trim().slice(0, 40);
}

async function findActiveCharacterByName(userId: string, name: string) {
  const [character] = await db()
    .select()
    .from(gameCharacter)
    .where(
      and(
        eq(gameCharacter.userId, userId),
        eq(gameCharacter.name, name),
        eq(gameCharacter.status, 'active')
      )
    )
    .limit(1);

  return character ?? null;
}

export async function listSimulatorCharacters(
  userId: string
): Promise<SimulatorCharacterSummary[]> {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('listSimulatorCharacters', async () => {
    return db()
      .select({
        id: gameCharacter.id,
        name: gameCharacter.name,
        school: gameCharacter.school,
        roleType: gameCharacter.roleType,
        level: gameCharacter.level,
        serverName: gameCharacter.serverName,
        updatedAt: gameCharacter.updatedAt,
        createdAt: gameCharacter.createdAt,
      })
      .from(gameCharacter)
      .where(
        and(
          eq(gameCharacter.userId, userId),
          eq(gameCharacter.status, 'active')
        )
      )
      .orderBy(desc(gameCharacter.updatedAt), desc(gameCharacter.createdAt));
  });
}

export async function selectSimulatorCharacter(userId: string, characterId: string) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('selectSimulatorCharacter', async () => {
    const character = await findActiveCharacter(userId, characterId);
    if (!character) {
      return false;
    }

    const now = new Date();
    await db()
      .update(gameCharacter)
      .set({ updatedAt: now })
      .where(eq(gameCharacter.id, characterId));

    clearSimulatorCharacterBundleCache(userId, characterId);
    return true;
  });
}

export async function renameSimulatorCharacter(params: {
  userId: string;
  characterId: string;
  name: string;
}) {
  await ensureSimulatorDbReady();

  const normalizedName = normalizeCharacterName(params.name);
  if (!normalizedName) {
    throw new Error('character name is required');
  }

  return withTransientD1Retry('renameSimulatorCharacter', async () => {
    const character = await findActiveCharacter(params.userId, params.characterId);
    if (!character) {
      return null;
    }

    const existing = await findActiveCharacterByName(params.userId, normalizedName);
    if (existing && existing.id !== params.characterId) {
      throw new Error('character name already exists');
    }

    const now = new Date();
    await db()
      .update(gameCharacter)
      .set({
        name: normalizedName,
        updatedAt: now,
      })
      .where(eq(gameCharacter.id, params.characterId));

    clearSimulatorCharacterBundleCache(params.userId, params.characterId);

    return {
      ...character,
      name: normalizedName,
      updatedAt: now,
    } satisfies SimulatorCharacter;
  });
}

export async function deleteSimulatorCharacter(params: {
  userId: string;
  characterId: string;
}) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('deleteSimulatorCharacter', async () => {
    const character = await findActiveCharacter(params.userId, params.characterId);
    if (!character) {
      return null;
    }

    const characters = await listSimulatorCharacters(params.userId);
    if (characters.length <= 1) {
      throw new Error('at least one character must remain');
    }

    const nextCharacter =
      characters.find((item) => item.id !== params.characterId) ?? null;

    if (!nextCharacter) {
      throw new Error('failed to select next character');
    }

    const now = new Date();
    const nextUpdatedAt = new Date(now.getTime() + 1);

    await db()
      .update(gameCharacter)
      .set({
        status: 'deleted',
        updatedAt: now,
      })
      .where(eq(gameCharacter.id, params.characterId));

    await db()
      .update(gameCharacter)
      .set({
        updatedAt: nextUpdatedAt,
      })
      .where(eq(gameCharacter.id, nextCharacter.id));

    clearSimulatorCharacterBundleCache(params.userId, params.characterId);
    clearSimulatorCharacterBundleCache(params.userId, nextCharacter.id);

    return {
      deletedCharacterId: params.characterId,
      nextCharacterId: nextCharacter.id,
      nextCharacterName: nextCharacter.name,
    };
  });
}

export async function createSimulatorCharacter(params: {
  userId: string;
  name: string;
}) {
  await ensureSimulatorDbReady();

  const timer = createPerfTimer('createSimulatorCharacter', {
    slowThresholdMs: 300,
  });
  const normalizedName = normalizeCharacterName(params.name);
  if (!normalizedName) {
    throw new Error('character name is required');
  }

  const existing = await findActiveCharacterByName(params.userId, normalizedName);
  if (existing) {
    throw new Error('character name already exists');
  }

  const seedConfig = await getRequiredSimulatorSeedConfig();
  const characterId = getUuid();
  const snapshotId = getUuid();
  const database = db();
  const now = new Date();

  const characterValue: SimulatorCharacter = {
    id: characterId,
    userId: params.userId,
    name: normalizedName,
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
  let seededPersistableEquipments: SimulatorEquipment[] = [];
  if (seedConfig.equipments.length > 0) {
    seededPersistableEquipments = seedConfig.equipments.map((equipment) => {
      const snapshotSlot = equipment.snapshotSlot || equipment.slot;
      const attrs = equipment.attrs.map((attr, index) => ({
        id: getUuid(),
        equipmentId: 'seed',
        attrGroup: attr.attrGroup,
        attrType: attr.attrType,
        valueType: 'flat',
        attrValue: attr.attrValue,
        displayOrder: index,
      }));

      return toGenericEquipmentRow({
        id: getUuid(),
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
        build: {
          equipmentId: 'seed',
          holeCount: 0,
          gemLevelTotal: 0,
          refineLevel: equipment.refineLevel,
          specialEffectJson: '{}',
          setEffectJson: '{}',
          notesJson: '{}',
        },
        attrs,
        snapshotSlot,
      });
    });
  }

  if (typeof database.batch === 'function') {
    await database.batch(batchQueries);
  } else {
    for (const query of batchQueries) {
      await query;
    }
  }

  if (seededPersistableEquipments.length > 0) {
    const persistedState = await insertSnapshotState({
      snapshotId,
      characterId,
      profile: null,
      skills: [],
      cultivations: [],
      battleContext: null,
      equipments: seededPersistableEquipments,
      now,
    });
    seededEquipments = persistedState.equipments;
  }

  const rules = await findAttributeRules({
    school: profileValue.school,
    roleType: characterValue.roleType,
  });
  const equipmentPlan = await loadCharacterEquipmentPlanState(characterId);
  timer.finish({
    status: 'ok',
    equipmentCount: seededEquipments.length,
    ruleCount: rules.length,
  });

  return primeSimulatorCharacterBundleAndReturn(
    params.userId,
    buildSimulatorCharacterBundle({
      character: characterValue,
      snapshot: snapshotValue,
      profile: profileValue,
      skills: skillValues,
      cultivations: cultivationValues,
      battleContext: battleContextValue,
      battleTargetTemplate: null,
      rules,
      equipments: seededEquipments,
      equipmentPlan,
    })
  );
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
  let seededPersistableEquipments: SimulatorEquipment[] = [];
  if (seedConfig.equipments.length > 0) {
    seededPersistableEquipments = seedConfig.equipments.map((equipment) => {
      const snapshotSlot = equipment.snapshotSlot || equipment.slot;
      const attrs = equipment.attrs.map((attr, index) => ({
        id: getUuid(),
        equipmentId: 'seed',
        attrGroup: attr.attrGroup,
        attrType: attr.attrType,
        valueType: 'flat',
        attrValue: attr.attrValue,
        displayOrder: index,
      }));

      return toGenericEquipmentRow({
        id: getUuid(),
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
        build: {
          equipmentId: 'seed',
          holeCount: 0,
          gemLevelTotal: 0,
          refineLevel: equipment.refineLevel,
          specialEffectJson: '{}',
          setEffectJson: '{}',
          notesJson: '{}',
        },
        attrs,
        snapshotSlot,
      });
    });
  }

  if (typeof database.batch === 'function') {
    await database.batch(batchQueries);
  } else {
    for (const query of batchQueries) {
      await query;
    }
  }

  if (seededPersistableEquipments.length > 0) {
    const persistedState = await insertSnapshotState({
      snapshotId,
      characterId,
      profile: null,
      skills: [],
      cultivations: [],
      battleContext: null,
      equipments: seededPersistableEquipments,
      now,
    });
    seededEquipments = persistedState.equipments;
  }

  const rules = await findAttributeRules({
    school: profileValue.school,
    roleType: characterValue.roleType,
  });
  const equipmentPlan = await loadCharacterEquipmentPlanState(characterId);
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
    equipmentPlan,
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
  const context = await loadActiveSimulatorContext(userId);
  timer.mark('load_context');
  if (!context) {
    timer.finish({ status: 'missing_character_or_snapshot' });
    return null;
  }
  const {
    character,
    snapshot,
    profile: existingProfile,
    skills,
    cultivations,
    battleContext: existingContext,
    equipments,
  } = context;
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
  const existingSealHit = existingProfile?.sealHit ?? 0;
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
        sealHit: payload.sealHit ?? existingSealHit,
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
        sealHit: payload.sealHit ?? existingSealHit,
        rawBodyJson: nextRawBody,
      };

  const { targetTemplate, rules, equipmentPlan } =
    await resolveSimulatorBundleDependencies({
      character,
      profile: existingProfile,
      battleContext: existingContext,
      schoolOverride: payload.faction,
    });
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

  const bundle = buildSimulatorCharacterBundle({
    character: nextCharacter,
    snapshot,
    profile: nextProfile,
    skills,
    cultivations,
    battleContext: stripEquipmentPlanFromBattleContext(existingContext),
    battleTargetTemplate: targetTemplate,
    rules,
    equipments,
    equipmentPlan,
  });

  timer.finish({
    status: 'ok',
    equipmentCount: equipments.length,
    ruleCount: rules.length,
  });

  return primeSimulatorCharacterBundleAndReturn(userId, bundle);
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
  const context = await loadActiveSimulatorContext(userId);
  timer.mark('load_context');
  if (!context) {
    timer.finish({ status: 'missing_character_or_snapshot' });
    return null;
  }
  const {
    character,
    snapshot,
    profile,
    skills,
    battleContext: existingContext,
    equipments,
  } = context;
  const { targetTemplate, rules, equipmentPlan } =
    await resolveSimulatorBundleDependencies({
      character,
      profile,
      battleContext: existingContext,
    });
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

  const bundle = buildSimulatorCharacterBundle({
    character,
    snapshot,
    profile,
    skills,
    cultivations: nextCultivations,
    battleContext: stripEquipmentPlanFromBattleContext(existingContext),
    battleTargetTemplate: targetTemplate,
    rules,
    equipments,
    equipmentPlan,
  });

  timer.finish({
    status: 'ok',
    cultivationCount: nextCultivations.length,
    equipmentCount: equipments.length,
  });

  return primeSimulatorCharacterBundleAndReturn(userId, bundle);
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
    manualTargets?: unknown[];
    combatTab?: 'manual' | 'dungeon';
    selectedDungeonIds?: unknown[];
  }
) {
  await ensureSimulatorDbReady();

  const timer = createPerfTimer('updateSimulatorBattleContext:model', {
    slowThresholdMs: 250,
  });
  const context = await loadActiveSimulatorContext(userId);
  timer.mark('load_context');
  if (!context) {
    timer.finish({ status: 'missing_character_or_snapshot' });
    return null;
  }
  const {
    character,
    snapshot,
    profile,
    skills,
    cultivations,
    battleContext: existingContext,
    equipments,
  } = context;

  const targetTemplateId =
    payload.targetTemplateId === undefined
      ? (existingContext?.targetTemplateId ?? null)
      : payload.targetTemplateId || null;
  const now = new Date();

  const { targetTemplate, rules, equipmentPlan } =
    await resolveSimulatorBundleDependencies({
      character,
      profile,
      battleContext: existingContext,
      targetTemplateIdOverride: targetTemplateId,
    });
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
    notesJson: buildBattleContextNotesJson(existingContext?.notesJson, {
      manualTargets: payload.manualTargets,
      combatTab: payload.combatTab,
      selectedDungeonIds: payload.selectedDungeonIds,
    }),
  };
  const nextBattleContext = await writeSnapshotBattleContext({
    snapshotId: snapshot.id,
    existingContext,
    nextValue,
    now,
  });
  timer.mark('write_context');

  const bundle = buildSimulatorCharacterBundle({
    character,
    snapshot,
    profile,
    skills,
    cultivations,
    battleContext: stripEquipmentPlanFromBattleContext(nextBattleContext),
    battleTargetTemplate: targetTemplate,
    rules,
    equipments,
    equipmentPlan,
  });

  timer.finish({
    status: 'ok',
    equipmentCount: equipments.length,
    hasTargetTemplate: Boolean(targetTemplate),
  });

  return primeSimulatorCharacterBundleAndReturn(userId, bundle);
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

    const context = await loadActiveSimulatorContext(userId, {
      includeEquipments: false,
    });
    timer.mark('load_context');
    if (!context) {
      timer.finish({ status: 'missing_character_or_snapshot' });
      return null;
    }
    const {
      character,
      snapshot,
      profile,
      skills,
      cultivations,
      battleContext: existingContext,
    } = context;
    const { targetTemplate, rules, equipmentPlan: existingPlanNotes } =
      await resolveSimulatorBundleDependencies({
        character,
        profile,
        battleContext: existingContext,
      });
    timer.mark('rules');

    const nextPlan = syncEquipmentPlanNotes(
      sanitizeEquipmentPlanNotes({
        equipmentSets:
          payload.equipmentSets ?? existingPlanNotes?.equipmentSets,
        activeSetIndex:
          payload.activeSetIndex ?? existingPlanNotes?.activeSetIndex ?? 0,
      }),
      payload.equipment.filter(isRecord).map((item) => ({ ...item }))
    );
    const nextNotesJson = removeEquipmentPlanFromNotesJson(
      existingContext?.notesJson
    );

    const now = new Date();
    let nextEquipments: SimulatorEquipment[] = [];

    if (payload.createHistorySnapshot) {
      const snapshotState = await loadSnapshotState({
        characterId: character.id,
        snapshotId: snapshot.id,
      });
      await createEquipmentRollbackSnapshot({
        character,
        snapshotState,
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
      const database = db();
      const availableStarResonanceRules = await loadEnabledStarResonanceRules();
      const primaryEquipmentValues: Array<typeof equipmentItem.$inferInsert> =
        [];
      const primaryBuildValues: SimulatorEquipmentBuild[] = [];
      const primaryAttrValues: SimulatorEquipmentAttr[] = [];
      const primarySnapshotSlotValues: Array<
        typeof snapshotEquipmentSlot.$inferInsert
      > = [];
      const starStoneValues: Array<typeof starStoneItem.$inferInsert> = [];
      const starStoneAttrValues: Array<typeof starStoneAttr.$inferInsert> = [];
      const starResonanceValues: Array<
        typeof characterStarResonance.$inferInsert
      > = [];
      const ornamentValues: Array<typeof ornamentItem.$inferInsert> = [];
      const ornamentAttrValues: Array<typeof ornamentSubAttr.$inferInsert> = [];
      const ornamentSnapshotSlotValues: Array<
        typeof snapshotOrnamentSlot.$inferInsert
      > = [];
      const jadeValues: Array<typeof jadeItem.$inferInsert> = [];
      const jadeAttrValues: Array<typeof jadeAttr.$inferInsert> = [];
      const jadeSnapshotSlotValues: Array<
        typeof snapshotJadeSlot.$inferInsert
      > = [];

      for (const item of normalizedEquipment) {
        const equipmentId = getUuid();
        const slot = toEquipmentSlotValue(item);
        const attrRows = toEquipmentAttrRows(item).map((attr) => ({
          ...attr,
          attrValue: Number(attr.attrValue ?? 0),
          displayOrder: Number(attr.displayOrder ?? 0),
        }));
        const buildMeta = {
          specialEffectJson: JSON.stringify(
            buildEquipmentSpecialEffectMeta(item as Record<string, unknown>)
          ),
          setEffectJson: JSON.stringify(
            buildEquipmentSetEffectMeta(item as Record<string, unknown>)
          ),
          notesJson: JSON.stringify(
            buildEquipmentNotesMeta(item as Record<string, unknown>)
          ),
        };

        if (item.type === 'trinket') {
          const persistedSlot = toPersistedOrnamentSlot(item.slot ?? slot);
          const resolvedAttrs = resolveOrnamentMainAttr(attrRows);
          const nextOrnamentRow: typeof ornamentItem.$inferInsert = {
            id: equipmentId,
            characterId: character.id,
            slot: persistedSlot,
            name: item.name,
            level: item.level ?? 0,
            quality: item.quality ?? '',
            mainAttrType: resolvedAttrs.mainAttrType,
            mainAttrValue: resolvedAttrs.mainAttrValue,
            price: item.price ?? 0,
            source: 'manual',
            status: 'equipped',
            ...buildMeta,
            createdAt: now,
            updatedAt: now,
          };
          const nextOrnamentSubAttrs: SimulatorOrnamentSubAttrRow[] =
            resolvedAttrs.subAttrs.map((attr) => ({
              id: getUuid(),
              ornamentId: equipmentId,
              attrType: attr.attrType,
              attrValue: attr.attrValue,
              displayOrder: attr.displayOrder,
            }));

          ornamentValues.push(nextOrnamentRow);
          ornamentAttrValues.push(...nextOrnamentSubAttrs);
          ornamentSnapshotSlotValues.push({
            id: getUuid(),
            snapshotId: snapshot.id,
            slot: persistedSlot,
            ornamentId: equipmentId,
          });

          nextEquipments.push(
            toGenericEquipmentRow({
              id: equipmentId,
              characterId: character.id,
              slot: persistedSlot,
              name: item.name,
              level: item.level ?? 0,
              quality: item.quality ?? '',
              price: item.price ?? 0,
              source: 'manual',
              status: 'equipped',
              isLocked: false,
              createdAt: now,
              updatedAt: now,
              build: toGenericEquipmentBuild({
                equipmentId,
                ...buildMeta,
              }),
              attrs: buildOrnamentAttrRows({
                ornament: {
                  id: equipmentId,
                  mainAttrType: resolvedAttrs.mainAttrType,
                  mainAttrValue: resolvedAttrs.mainAttrValue,
                },
                subAttrs: nextOrnamentSubAttrs,
              }),
              snapshotSlot: persistedSlot,
            })
          );
          continue;
        }

        if (item.type === 'jade') {
          const persistedSlot = toPersistedJadeSlot(item.slot ?? slot);
          const nextJadeAttrs: SimulatorEquipmentAttr[] = attrRows.map(
            (attr) => ({
              id: getUuid(),
              equipmentId,
              attrGroup: attr.attrGroup,
              attrType: attr.attrType,
              valueType: attr.valueType,
              attrValue: attr.attrValue,
              displayOrder: attr.displayOrder,
            })
          );
          const nextJadeRow: typeof jadeItem.$inferInsert = {
            id: equipmentId,
            characterId: character.id,
            slot: persistedSlot,
            name: item.name,
            quality: item.quality ?? '',
            fitLevel: item.level ?? 0,
            price: item.price ?? 0,
            source: 'manual',
            status: 'equipped',
            ...buildMeta,
            createdAt: now,
            updatedAt: now,
          };

          jadeValues.push(nextJadeRow);
          jadeAttrValues.push(
            ...nextJadeAttrs.map((attr) => ({
              id: attr.id,
              jadeId: equipmentId,
              attrType: attr.attrType,
              valueType: attr.valueType,
              attrValue: attr.attrValue,
              displayOrder: attr.displayOrder,
            }))
          );
          jadeSnapshotSlotValues.push({
            id: getUuid(),
            snapshotId: snapshot.id,
            slot: persistedSlot,
            jadeId: equipmentId,
          });

          nextEquipments.push(
            toGenericEquipmentRow({
              id: equipmentId,
              characterId: character.id,
              slot: persistedSlot,
              name: item.name,
              level: item.level ?? 0,
              quality: item.quality ?? '',
              price: item.price ?? 0,
              source: 'manual',
              status: 'equipped',
              isLocked: false,
              createdAt: now,
              updatedAt: now,
              build: toGenericEquipmentBuild({
                equipmentId,
                ...buildMeta,
              }),
              attrs: nextJadeAttrs,
              snapshotSlot: persistedSlot,
            })
          );
          continue;
        }

        const nextPrimaryBuild: SimulatorEquipmentBuild = {
          equipmentId,
          holeCount: 0,
          gemLevelTotal: 0,
          refineLevel: item.forgeLevel ?? 0,
          ...buildMeta,
        };
        const nextPrimaryAttrs: SimulatorEquipmentAttr[] = attrRows.map(
          (attr) => ({
            id: getUuid(),
            equipmentId,
            attrGroup: attr.attrGroup,
            attrType: attr.attrType,
            valueType: attr.valueType,
            attrValue: attr.attrValue,
            displayOrder: attr.displayOrder,
          })
        );

        primaryEquipmentValues.push({
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
          createdAt: now,
          updatedAt: now,
        });
        primaryBuildValues.push(nextPrimaryBuild);
        primaryAttrValues.push(...nextPrimaryAttrs);
        primarySnapshotSlotValues.push({
          id: getUuid(),
          snapshotId: snapshot.id,
          slot,
          equipmentId,
        });
        const starPersistence = buildStarStonePersistenceRows({
          snapshotId: snapshot.id,
          characterId: character.id,
          equipmentId,
          slot,
          notesJson: buildMeta.notesJson,
          availableRules: availableStarResonanceRules,
          createdAt: now,
          updatedAt: now,
        });
        starStoneValues.push(...starPersistence.starStoneRows);
        starStoneAttrValues.push(...starPersistence.starStoneAttrRows);
        if (starPersistence.resonanceRow) {
          starResonanceValues.push(starPersistence.resonanceRow);
        }

        nextEquipments.push(
          toGenericEquipmentRow({
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
            createdAt: now,
            updatedAt: now,
            build: nextPrimaryBuild,
            attrs: nextPrimaryAttrs,
            snapshotSlot: slot,
          })
        );
      }

      await insertValuesInChunks(
        database,
        equipmentItem,
        primaryEquipmentValues
      );
      await insertValuesInChunks(database, equipmentBuild, primaryBuildValues);
      await insertValuesInChunks(database, equipmentAttr, primaryAttrValues);
      await insertValuesInChunks(
        database,
        snapshotEquipmentSlot,
        primarySnapshotSlotValues
      );
      await insertValuesInChunks(database, starStoneItem, starStoneValues);
      await insertValuesInChunks(database, starStoneAttr, starStoneAttrValues);
      await insertValuesInChunks(
        database,
        characterStarResonance,
        starResonanceValues
      );
      await insertValuesInChunks(database, ornamentItem, ornamentValues);
      await insertValuesInChunks(database, ornamentSubAttr, ornamentAttrValues);
      await insertValuesInChunks(
        database,
        snapshotOrnamentSlot,
        ornamentSnapshotSlotValues
      );
      await insertValuesInChunks(database, jadeItem, jadeValues);
      await insertValuesInChunks(database, jadeAttr, jadeAttrValues);
      await insertValuesInChunks(
        database,
        snapshotJadeSlot,
        jadeSnapshotSlotValues
      );

      const ornamentSetEffects = buildOrnamentSetEffectRows({
        snapshotId: snapshot.id,
        equipments: nextEquipments.map((item) =>
          toOrnamentSetEffectSource(item)
        ),
      });
      await insertValuesInChunks(
        database,
        ornamentSetEffect,
        ornamentSetEffects
      );
    }
    timer.mark('write_equipment');

    const persistedPlan = await replaceCharacterEquipmentPlanState({
      characterId: character.id,
      plan: nextPlan,
      now,
    });
    timer.mark('write_equipment_plan');

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

    const nextBattleContext = await writeSnapshotBattleContext({
      snapshotId: snapshot.id,
      existingContext,
      nextValue: nextBattleContextValue,
      now,
    });
    timer.mark('write_context');

    const bundle = buildSimulatorCharacterBundle({
      character,
      snapshot,
      profile,
      skills,
      cultivations,
      battleContext: nextBattleContext,
      battleTargetTemplate: targetTemplate,
      rules,
      equipments: nextEquipments,
      equipmentPlan: persistedPlan,
    });

    timer.finish({
      status: 'ok',
      equipmentCount: nextEquipments.length,
      createdHistorySnapshot: Boolean(payload.createHistorySnapshot),
      reusedSnapshotRelations: true,
      ruleCount: rules.length,
    });

    return primeSimulatorCharacterBundleAndReturn(userId, bundle);
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
      const equipmentPlan = await loadCharacterEquipmentPlanState(character.id);
      timer.mark('reload_bundle');

      const bundle = buildSimulatorCharacterBundle({
        character,
        snapshot: {
          ...currentSnapshot,
          updatedAt: now,
        },
        profile: restoredState.profile,
        skills: restoredState.skills,
        cultivations: restoredState.cultivations,
        battleContext: stripEquipmentPlanFromBattleContext(
          restoredState.battleContext
        ),
        battleTargetTemplate: targetTemplate,
        rules,
        equipments: restoredState.equipments,
        equipmentPlan,
      });

      timer.finish({
        status: 'ok',
        equipmentCount: bundle.equipments.length,
      });

      return primeSimulatorCharacterBundleAndReturn(userId, bundle, {
        clearCharacterId: character.id,
      });
    }
  );
}
