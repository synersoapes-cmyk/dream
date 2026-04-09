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
  snapshotBattleContext,
  snapshotEquipmentSlot,
  snapshotJadeSlot,
  snapshotOrnamentSlot,
  user,
} from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';
import { createPerfTimer } from '@/shared/lib/perf';
import { inferBaseHpSource } from '@/shared/lib/simulator-base-hp';
import {
  toSimulatorJadeSlotKey,
  toSimulatorTrinketSlotKey,
} from '@/shared/lib/simulator-equipment';
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

function toOptionalInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

const EQUIPMENT_PLAN_NOTES_KEY = 'equipmentPlan';
const EQUIPMENT_ROLLBACK_SNAPSHOT_SOURCE = 'equipment_backup';
const ORNAMENT_SET_TIERS = [32, 28, 24, 16, 8] as const;

function isPrimaryEquipmentSlot(slot: string | null | undefined) {
  const normalized = String(slot ?? '')
    .trim()
    .toLowerCase();

  return ['weapon', 'helmet', 'necklace', 'armor', 'belt', 'shoes'].includes(
    normalized
  );
}

function isOrnamentSlot(slot: string | null | undefined) {
  const normalized = String(slot ?? '')
    .trim()
    .toLowerCase();

  return [
    'trinket1',
    'trinket2',
    'trinket3',
    'trinket4',
    'ring',
    'earring',
    'bracelet',
    'amulet',
    'pendant',
  ].includes(normalized);
}

function isJadeSlot(slot: string | null | undefined) {
  const normalized = String(slot ?? '')
    .trim()
    .toLowerCase();

  return ['jade1', 'jade2'].includes(normalized);
}

function toPersistedOrnamentSlot(slot: string | number | null | undefined) {
  return toSimulatorTrinketSlotKey(slot);
}

function toPersistedJadeSlot(slot: string | number | null | undefined) {
  return toSimulatorJadeSlotKey(slot);
}

function toGenericEquipmentBuild(params: {
  equipmentId: string;
  refineLevel?: number;
  specialEffectJson?: string | null;
  setEffectJson?: string | null;
  notesJson?: string | null;
}): SimulatorEquipmentBuild {
  return {
    equipmentId: params.equipmentId,
    holeCount: 0,
    gemLevelTotal: 0,
    refineLevel: params.refineLevel ?? 0,
    specialEffectJson: params.specialEffectJson ?? '{}',
    setEffectJson: params.setEffectJson ?? '{}',
    notesJson: params.notesJson ?? '{}',
  };
}

function toGenericEquipmentRow(params: {
  id: string;
  characterId: string;
  slot: string;
  name: string;
  level: number;
  quality: string;
  price: number;
  source: string;
  status: string;
  isLocked?: boolean;
  createdAt: Date;
  updatedAt: Date;
  build: SimulatorEquipmentBuild | null;
  attrs: SimulatorEquipmentAttr[];
  snapshotSlot: string | null;
}): SimulatorEquipment {
  return {
    id: params.id,
    characterId: params.characterId,
    slot: params.slot,
    name: params.name,
    level: params.level,
    quality: params.quality,
    price: params.price,
    source: params.source,
    status: params.status,
    isLocked: params.isLocked ?? false,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
    build: params.build,
    attrs: params.attrs,
    snapshotSlot: params.snapshotSlot,
  };
}

function buildOrnamentAttrRows(params: {
  ornament: Pick<SimulatorOrnamentRow, 'id' | 'mainAttrType' | 'mainAttrValue'>;
  subAttrs: Array<
    Pick<
      SimulatorOrnamentSubAttrRow,
      'id' | 'ornamentId' | 'attrType' | 'attrValue' | 'displayOrder'
    >
  >;
}): SimulatorEquipmentAttr[] {
  const rows: SimulatorEquipmentAttr[] = [];

  if (params.ornament.mainAttrType) {
    rows.push({
      id: `${params.ornament.id}:main`,
      equipmentId: params.ornament.id,
      attrGroup: 'main',
      attrType: params.ornament.mainAttrType,
      valueType: 'flat',
      attrValue: Number(params.ornament.mainAttrValue ?? 0),
      displayOrder: 0,
    });
  }

  rows.push(
    ...params.subAttrs.map((attr) => ({
      id: attr.id,
      equipmentId: params.ornament.id,
      attrGroup: 'extra',
      attrType: attr.attrType,
      valueType: 'flat',
      attrValue: Number(attr.attrValue ?? 0),
      displayOrder: Number(attr.displayOrder ?? 0) + 1,
    }))
  );

  return rows;
}

function buildJadeAttrRows(params: {
  jade: Pick<SimulatorJadeRow, 'id'>;
  attrs: Array<
    Pick<
      SimulatorJadeAttrRow,
      'id' | 'jadeId' | 'attrType' | 'valueType' | 'attrValue' | 'displayOrder'
    >
  >;
}): SimulatorEquipmentAttr[] {
  return params.attrs.map((attr) => ({
    id: attr.id,
    equipmentId: params.jade.id,
    attrGroup: 'base',
    attrType: attr.attrType,
    valueType: attr.valueType,
    attrValue: Number(attr.attrValue ?? 0),
    displayOrder: Number(attr.displayOrder ?? 0),
  }));
}

function resolveOrnamentMainAttr(
  attrRows: Array<{
    attrType: string;
    valueType: string;
    attrValue: number;
    displayOrder: number;
  }>
) {
  const sorted = [...attrRows].sort(
    (left, right) => left.displayOrder - right.displayOrder
  );
  const [mainAttr, ...subAttrs] = sorted;

  return {
    mainAttrType: mainAttr?.attrType ?? '',
    mainAttrValue: mainAttr?.attrValue ?? 0,
    subAttrs,
  };
}

function parseEquipmentSetName(setEffectJson: string | null | undefined) {
  const setName = parseJsonObject(setEffectJson).setName;
  return typeof setName === 'string' ? setName.trim() : '';
}

function toOrnamentSetEffectSource(equipment: SimulatorEquipment) {
  const slot = equipment.snapshotSlot ?? equipment.slot;

  return {
    type: isOrnamentSlot(slot)
      ? 'trinket'
      : isJadeSlot(slot)
        ? 'jade'
        : 'equipment',
    setName: parseEquipmentSetName(equipment.build?.setEffectJson),
    level: equipment.level,
    slot,
  };
}

function buildOrnamentSetEffectRows(params: {
  snapshotId: string;
  equipments: Array<Record<string, unknown>>;
}) {
  const grouped = new Map<
    string,
    { totalLevel: number; slotCount: number; slots: string[] }
  >();

  for (const item of params.equipments) {
    const type = String(item.type || '').trim();
    const setName =
      typeof item.setName === 'string' && item.setName.trim().length > 0
        ? item.setName.trim()
        : '';

    if (type !== 'trinket' || !setName) {
      continue;
    }

    const current = grouped.get(setName) ?? {
      totalLevel: 0,
      slotCount: 0,
      slots: [],
    };
    current.totalLevel += toOptionalInteger(item.level) ?? 0;
    current.slotCount += 1;
    if (item.slot !== undefined && item.slot !== null) {
      current.slots.push(String(item.slot));
    }
    grouped.set(setName, current);
  }

  return Array.from(grouped.entries()).map(([setName, summary]) => ({
    id: getUuid(),
    snapshotId: params.snapshotId,
    setName,
    totalLevel: summary.totalLevel,
    tier: ORNAMENT_SET_TIERS.find((tier) => summary.totalLevel >= tier) ?? 0,
    effectJson: JSON.stringify({
      slotCount: summary.slotCount,
      slots: summary.slots,
    }),
  }));
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
  ]);

  const buildByEquipmentId = new Map(
    buildRows.map(
      (row: SimulatorEquipmentBuild) => [row.equipmentId, row] as const
    )
  );
  const primaryAttrsByEquipmentId = new Map<string, SimulatorEquipmentAttr[]>();
  const ornamentAttrsById = new Map<string, SimulatorOrnamentSubAttrRow[]>();
  const jadeAttrsById = new Map<string, SimulatorJadeAttrRow[]>();

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

  const rowsByOrder = new Map<string, SimulatorEquipment>();

  for (const item of primaryRows) {
    rowsByOrder.set(
      item.id,
      toGenericEquipmentRow({
        ...item,
        price: Number(item.price ?? 0),
        build: buildByEquipmentId.get(item.id) ?? null,
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

  const primaryEquipmentValues: Array<typeof equipmentItem.$inferInsert> = [];
  const primaryBuildValues: SimulatorEquipmentBuild[] = [];
  const primaryAttrValues: SimulatorEquipmentAttr[] = [];
  const primarySnapshotSlotValues: Array<
    typeof snapshotEquipmentSlot.$inferInsert
  > = [];
  const ornamentValues: Array<typeof ornamentItem.$inferInsert> = [];
  const ornamentAttrValues: Array<typeof ornamentSubAttr.$inferInsert> = [];
  const ornamentSnapshotSlotValues: Array<
    typeof snapshotOrnamentSlot.$inferInsert
  > = [];
  const jadeValues: Array<typeof jadeItem.$inferInsert> = [];
  const jadeAttrValues: Array<typeof jadeAttr.$inferInsert> = [];
  const jadeSnapshotSlotValues: Array<typeof snapshotJadeSlot.$inferInsert> =
    [];
  const nextEquipments: SimulatorEquipment[] = [];

  for (const equipment of params.equipments) {
    const nextId = getUuid();
    const snapshotSlot = equipment.snapshotSlot ?? equipment.slot;
    const createdAt = params.now;
    const updatedAt = params.now;

    if (isOrnamentSlot(snapshotSlot) || isOrnamentSlot(equipment.slot)) {
      const persistedSlot = toPersistedOrnamentSlot(snapshotSlot);
      const resolvedAttrs = resolveOrnamentMainAttr(
        equipment.attrs.map((attr) => ({
          attrType: attr.attrType,
          valueType: attr.valueType,
          attrValue: Number(attr.attrValue ?? 0),
          displayOrder: Number(attr.displayOrder ?? 0),
        }))
      );
      const nextOrnamentRow: typeof ornamentItem.$inferInsert = {
        id: nextId,
        characterId: params.characterId,
        slot: persistedSlot,
        name: equipment.name,
        level: equipment.level,
        quality: equipment.quality,
        mainAttrType: resolvedAttrs.mainAttrType,
        mainAttrValue: resolvedAttrs.mainAttrValue,
        price: equipment.price,
        source: equipment.source,
        status: equipment.status,
        specialEffectJson: equipment.build?.specialEffectJson ?? '{}',
        setEffectJson: equipment.build?.setEffectJson ?? '{}',
        notesJson: equipment.build?.notesJson ?? '{}',
        createdAt,
        updatedAt,
      };
      const nextOrnamentSubAttrs: SimulatorOrnamentSubAttrRow[] =
        resolvedAttrs.subAttrs.map((attr) => ({
          id: getUuid(),
          ornamentId: nextId,
          attrType: attr.attrType,
          attrValue: attr.attrValue,
          displayOrder: attr.displayOrder,
        }));

      ornamentValues.push(nextOrnamentRow);
      ornamentAttrValues.push(...nextOrnamentSubAttrs);
      ornamentSnapshotSlotValues.push({
        id: getUuid(),
        snapshotId: params.snapshotId,
        slot: persistedSlot,
        ornamentId: nextId,
      });

      nextEquipments.push(
        toGenericEquipmentRow({
          id: nextId,
          characterId: params.characterId,
          slot: persistedSlot,
          name: equipment.name,
          level: equipment.level,
          quality: equipment.quality,
          price: equipment.price,
          source: equipment.source,
          status: equipment.status,
          isLocked: false,
          createdAt,
          updatedAt,
          build: toGenericEquipmentBuild({
            equipmentId: nextId,
            specialEffectJson: equipment.build?.specialEffectJson,
            setEffectJson: equipment.build?.setEffectJson,
            notesJson: equipment.build?.notesJson,
          }),
          attrs: buildOrnamentAttrRows({
            ornament: {
              id: nextId,
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

    if (isJadeSlot(snapshotSlot) || isJadeSlot(equipment.slot)) {
      const persistedSlot = toPersistedJadeSlot(snapshotSlot);
      const nextJadeAttrs: SimulatorEquipmentAttr[] = equipment.attrs.map(
        (attr) => ({
          id: getUuid(),
          equipmentId: nextId,
          attrGroup: attr.attrGroup,
          attrType: attr.attrType,
          valueType: attr.valueType,
          attrValue: Number(attr.attrValue ?? 0),
          displayOrder: Number(attr.displayOrder ?? 0),
        })
      );
      const nextJadeRow: typeof jadeItem.$inferInsert = {
        id: nextId,
        characterId: params.characterId,
        slot: persistedSlot,
        name: equipment.name,
        quality: equipment.quality,
        fitLevel: equipment.level,
        price: equipment.price,
        source: equipment.source,
        status: equipment.status,
        specialEffectJson: equipment.build?.specialEffectJson ?? '{}',
        setEffectJson: equipment.build?.setEffectJson ?? '{}',
        notesJson: equipment.build?.notesJson ?? '{}',
        createdAt,
        updatedAt,
      };

      jadeValues.push(nextJadeRow);
      jadeAttrValues.push(
        ...nextJadeAttrs.map((attr) => ({
          id: attr.id,
          jadeId: nextId,
          attrType: attr.attrType,
          valueType: attr.valueType,
          attrValue: attr.attrValue,
          displayOrder: attr.displayOrder,
        }))
      );
      jadeSnapshotSlotValues.push({
        id: getUuid(),
        snapshotId: params.snapshotId,
        slot: persistedSlot,
        jadeId: nextId,
      });

      nextEquipments.push(
        toGenericEquipmentRow({
          id: nextId,
          characterId: params.characterId,
          slot: persistedSlot,
          name: equipment.name,
          level: equipment.level,
          quality: equipment.quality,
          price: equipment.price,
          source: equipment.source,
          status: equipment.status,
          isLocked: false,
          createdAt,
          updatedAt,
          build: toGenericEquipmentBuild({
            equipmentId: nextId,
            specialEffectJson: equipment.build?.specialEffectJson,
            setEffectJson: equipment.build?.setEffectJson,
            notesJson: equipment.build?.notesJson,
          }),
          attrs: nextJadeAttrs,
          snapshotSlot: persistedSlot,
        })
      );

      continue;
    }

    const nextPrimaryBuild: SimulatorEquipmentBuild = {
      equipmentId: nextId,
      holeCount: equipment.build?.holeCount ?? 0,
      gemLevelTotal: equipment.build?.gemLevelTotal ?? 0,
      refineLevel: equipment.build?.refineLevel ?? 0,
      specialEffectJson: equipment.build?.specialEffectJson ?? '{}',
      setEffectJson: equipment.build?.setEffectJson ?? '{}',
      notesJson: equipment.build?.notesJson ?? '{}',
    };
    const nextPrimaryAttrs: SimulatorEquipmentAttr[] = equipment.attrs.map(
      (attr) => ({
        id: getUuid(),
        equipmentId: nextId,
        attrGroup: attr.attrGroup,
        attrType: attr.attrType,
        valueType: attr.valueType,
        attrValue: Number(attr.attrValue ?? 0),
        displayOrder: Number(attr.displayOrder ?? 0),
      })
    );

    primaryEquipmentValues.push({
      id: nextId,
      characterId: params.characterId,
      slot: equipment.slot,
      name: equipment.name,
      level: equipment.level,
      quality: equipment.quality,
      price: equipment.price,
      source: equipment.source,
      status: equipment.status,
      isLocked: equipment.isLocked,
      createdAt,
      updatedAt,
    });
    primaryBuildValues.push(nextPrimaryBuild);
    primaryAttrValues.push(...nextPrimaryAttrs);
    primarySnapshotSlotValues.push({
      id: getUuid(),
      snapshotId: params.snapshotId,
      slot: snapshotSlot,
      equipmentId: nextId,
    });

    nextEquipments.push(
      toGenericEquipmentRow({
        id: nextId,
        characterId: params.characterId,
        slot: equipment.slot,
        name: equipment.name,
        level: equipment.level,
        quality: equipment.quality,
        price: equipment.price,
        source: equipment.source,
        status: equipment.status,
        isLocked: equipment.isLocked,
        createdAt,
        updatedAt,
        build: nextPrimaryBuild,
        attrs: nextPrimaryAttrs,
        snapshotSlot,
      })
    );
  }

  for (const chunk of chunkArray(primaryEquipmentValues)) {
    batchQueries.push(database.insert(equipmentItem).values(chunk));
  }
  for (const chunk of chunkArray(primaryBuildValues)) {
    batchQueries.push(database.insert(equipmentBuild).values(chunk));
  }
  for (const chunk of chunkArray(primaryAttrValues)) {
    batchQueries.push(database.insert(equipmentAttr).values(chunk));
  }
  for (const chunk of chunkArray(primarySnapshotSlotValues)) {
    batchQueries.push(database.insert(snapshotEquipmentSlot).values(chunk));
  }
  for (const chunk of chunkArray(ornamentValues)) {
    batchQueries.push(database.insert(ornamentItem).values(chunk));
  }
  for (const chunk of chunkArray(ornamentAttrValues)) {
    batchQueries.push(database.insert(ornamentSubAttr).values(chunk));
  }
  for (const chunk of chunkArray(ornamentSnapshotSlotValues)) {
    batchQueries.push(database.insert(snapshotOrnamentSlot).values(chunk));
  }
  for (const chunk of chunkArray(jadeValues)) {
    batchQueries.push(database.insert(jadeItem).values(chunk));
  }
  for (const chunk of chunkArray(jadeAttrValues)) {
    batchQueries.push(database.insert(jadeAttr).values(chunk));
  }
  for (const chunk of chunkArray(jadeSnapshotSlotValues)) {
    batchQueries.push(database.insert(snapshotJadeSlot).values(chunk));
  }
  const ornamentSetEffectValues = buildOrnamentSetEffectRows({
    snapshotId: params.snapshotId,
    equipments: nextEquipments.map((item) => toOrnamentSetEffectSource(item)),
  });
  for (const chunk of chunkArray(ornamentSetEffectValues)) {
    batchQueries.push(database.insert(ornamentSetEffect).values(chunk));
  }

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

async function deleteRowsByIdInChunks(
  database: ReturnType<typeof db>,
  table: any,
  column: any,
  ids: string[]
) {
  if (ids.length === 0) {
    return;
  }

  const queries = chunkArray(ids).map((chunk) =>
    database.delete(table).where(inArray(column, chunk))
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
  const [equipmentRows, ornamentRows, jadeRows, snapshotRows] =
    await Promise.all([
      database
        .select({ id: equipmentItem.id })
        .from(equipmentItem)
        .where(eq(equipmentItem.characterId, params.characterId)),
      database
        .select({ id: ornamentItem.id })
        .from(ornamentItem)
        .where(eq(ornamentItem.characterId, params.characterId)),
      database
        .select({ id: jadeItem.id })
        .from(jadeItem)
        .where(eq(jadeItem.characterId, params.characterId)),
      database
        .select({ id: characterSnapshot.id })
        .from(characterSnapshot)
        .where(eq(characterSnapshot.characterId, params.characterId)),
    ]);

  const protectedSnapshotIds = snapshotRows
    .map((row: { id: string }) => row.id)
    .filter((snapshotId: string) => snapshotId !== params.snapshotId);
  const [protectedEquipmentRows, protectedOrnamentRows, protectedJadeRows] =
    protectedSnapshotIds.length
      ? await Promise.all([
          database
            .select({ equipmentId: snapshotEquipmentSlot.equipmentId })
            .from(snapshotEquipmentSlot)
            .where(
              inArray(snapshotEquipmentSlot.snapshotId, protectedSnapshotIds)
            ),
          database
            .select({ ornamentId: snapshotOrnamentSlot.ornamentId })
            .from(snapshotOrnamentSlot)
            .where(
              inArray(snapshotOrnamentSlot.snapshotId, protectedSnapshotIds)
            ),
          database
            .select({ jadeId: snapshotJadeSlot.jadeId })
            .from(snapshotJadeSlot)
            .where(inArray(snapshotJadeSlot.snapshotId, protectedSnapshotIds)),
        ])
      : [[], [], []];
  const protectedEquipmentIds = new Set(
    protectedEquipmentRows.map(
      (row: { equipmentId: string }) => row.equipmentId
    )
  );
  const protectedOrnamentIds = new Set(
    protectedOrnamentRows.map((row: { ornamentId: string }) => row.ornamentId)
  );
  const protectedJadeIds = new Set(
    protectedJadeRows.map((row: { jadeId: string }) => row.jadeId)
  );
  const deletableEquipmentIds = equipmentRows
    .map((row: { id: string }) => row.id)
    .filter((equipmentId: string) => !protectedEquipmentIds.has(equipmentId));
  const deletableOrnamentIds = ornamentRows
    .map((row: { id: string }) => row.id)
    .filter((ornamentId: string) => !protectedOrnamentIds.has(ornamentId));
  const deletableJadeIds = jadeRows
    .map((row: { id: string }) => row.id)
    .filter((jadeId: string) => !protectedJadeIds.has(jadeId));

  await Promise.all([
    database
      .delete(snapshotEquipmentSlot)
      .where(eq(snapshotEquipmentSlot.snapshotId, params.snapshotId)),
    database
      .delete(snapshotOrnamentSlot)
      .where(eq(snapshotOrnamentSlot.snapshotId, params.snapshotId)),
    database
      .delete(snapshotJadeSlot)
      .where(eq(snapshotJadeSlot.snapshotId, params.snapshotId)),
    database
      .delete(ornamentSetEffect)
      .where(eq(ornamentSetEffect.snapshotId, params.snapshotId)),
  ]);
  await deleteRowsByIdInChunks(
    database,
    equipmentItem,
    equipmentItem.id,
    deletableEquipmentIds
  );
  await deleteRowsByIdInChunks(
    database,
    ornamentItem,
    ornamentItem.id,
    deletableOrnamentIds
  );
  await deleteRowsByIdInChunks(
    database,
    jadeItem,
    jadeItem.id,
    deletableJadeIds
  );
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

  const equipmentPlan = await loadCharacterEquipmentPlanState(nextCharacter.id);

  const bundle: SimulatorCharacterBundle = {
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

  const equipmentPlan = await loadCharacterEquipmentPlanState(character.id);

  const bundle: SimulatorCharacterBundle = {
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

  const equipmentPlan = await loadCharacterEquipmentPlanState(character.id);

  const bundle: SimulatorCharacterBundle = {
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
  };

  timer.finish({
    status: 'ok',
    equipmentCount: equipments.length,
    hasTargetTemplate: Boolean(targetTemplate),
  });

  primeSimulatorCharacterBundleCache(userId, bundle);
  return bundle;
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
    const [targetTemplateRows, rules, existingPlanNotes] = await Promise.all([
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
      loadCharacterEquipmentPlanState(character.id),
    ]);
    timer.mark('rules');

    const targetTemplate = targetTemplateRows[0] ?? null;

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
      const database = db();
      const primaryEquipmentValues: Array<typeof equipmentItem.$inferInsert> =
        [];
      const primaryBuildValues: SimulatorEquipmentBuild[] = [];
      const primaryAttrValues: SimulatorEquipmentAttr[] = [];
      const primarySnapshotSlotValues: Array<
        typeof snapshotEquipmentSlot.$inferInsert
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
      equipmentPlan: persistedPlan,
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
      const equipmentPlan = await loadCharacterEquipmentPlanState(character.id);
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
        battleContext: stripEquipmentPlanFromBattleContext(
          restoredState.battleContext
        ),
        battleTargetTemplate: targetTemplate,
        rules,
        equipments: restoredState.equipments,
        equipmentPlan,
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
