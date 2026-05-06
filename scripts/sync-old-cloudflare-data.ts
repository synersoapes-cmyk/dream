import { and, count, eq, inArray } from 'drizzle-orm';

import { db } from '@/core/db';
import { initD1ContextForDev } from '@/core/db/d1';
import {
  battleTargetTemplate,
  candidateEquipment,
  characterProfile,
  characterSnapshot,
  config,
  gameCharacter,
  inventoryEntry,
  inventoryEquipmentAsset,
  ocrDictionary,
  ocrDraftItem,
  ocrJob,
  role,
  ruleAttribute,
  ruleDamageModifier,
  rulePublishLog,
  ruleSkillBonus,
  ruleSkillFormula,
  ruleVersion,
  snapshotBattleContext,
  starResonanceRule,
  user,
  userRole,
} from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';
import { buildSimulatorInventoryMirrorPayload } from '@/shared/lib/simulator-inventory-mirror';
import { clearSimulatorReadCache } from '@/shared/models/simulator-main';

type ApiEnvelope<T> = {
  code: number;
  message: string;
  data: T;
};

type UserRow = typeof user.$inferSelect;
type CharacterRow = typeof gameCharacter.$inferSelect;
type CandidateEquipmentRow = typeof candidateEquipment.$inferSelect;
type InventoryAssetRow = typeof inventoryEquipmentAsset.$inferSelect;
type InventoryEntryRow = typeof inventoryEntry.$inferSelect;

type OldRuleVersionSummary = {
  id: string;
};

type OldTargetTemplate = {
  id: string;
  userId: string | null;
  scope: string;
  sceneType: string;
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

type OldStarRule = {
  id: string;
  scope: string;
  slot: string;
  comboName: string;
  requiredColors: string[];
  bonusAttrType: string;
  bonusAttrValue: number;
  globalBonus: Record<string, unknown>;
  sort: number;
  enabled: boolean;
  notes: string;
  createdAt: number;
  updatedAt: number;
};

type OldOcrDictionaryItem = {
  id: string;
  dictType: 'equipment_name' | 'skill_name' | 'attr_name' | 'set_name';
  rawText: string;
  normalizedText: string;
  priority: number;
  enabled: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};

type OldOcrConfig = {
  geminiApiKey: string;
  r2AccountId: string;
  r2Endpoint: string;
  r2AccessKey: string;
  r2SecretKey: string;
  r2BucketName: string;
  r2UploadPath: string;
};

type OldAdvisorConfig = {
  enabled: boolean;
  model: string;
  systemPrompt: string;
  temperature: number;
};

type OldRuleVersionDetail = {
  version: {
    id: string;
    ruleDomain: string;
    versionCode: string;
    versionName: string;
    status: string;
    isActive: boolean;
    sourceDocUrl: string;
    notes: string;
    createdBy: string;
    publishedBy: string;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  attributeConversions: Array<{
    id: string;
    versionId: string;
    school: string;
    roleType: string;
    sourceAttr: string;
    targetAttr: string;
    coefficient: number;
    valueType: string;
    conditionJson: string;
    sort: number;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  skillFormulas: Array<{
    id: string;
    versionId: string;
    school: string;
    roleType: string;
    skillCode: string;
    skillName: string;
    formulaKey: string;
    baseFormulaJson: string;
    extraFormulaJson: string;
    conditionJson: string;
    sort: number;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  modifiers: Array<{
    id: string;
    versionId: string;
    modifierDomain: string;
    modifierKey: string;
    modifierType: string;
    sourceKey: string;
    targetKey: string;
    value: number;
    valueJson: string;
    conditionJson: string;
    sort: number;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  skillBonuses: Array<{
    id: string;
    versionId: string;
    bonusGroup: string;
    ruleCode: string;
    skillCode: string;
    skillName: string;
    bonusType: string;
    bonusValue: number;
    conditionJson: string;
    conflictPolicy: string;
    limitPolicyJson: string;
    sort: number;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  publishLogs: Array<{
    id: string;
    versionId: string;
    action: string;
    operatorId: string;
    beforeSnapshotJson: string;
    afterSnapshotJson: string;
    notes: string;
    createdAt: string;
  }>;
};

type OldCandidateEquipment = {
  id: string;
  equipment: Record<string, unknown>;
  timestamp: number;
  imagePreview: string | null;
  rawText: string | null;
  status: 'pending' | 'confirmed' | 'replaced';
  characterId: string;
  characterName: string;
  userId: string;
  userName: string;
  userEmail: string;
  source: string;
};

type OldInventoryItem = {
  id: string;
  characterId: string;
  characterName: string;
  userId: string;
  userName: string;
  userEmail: string;
  itemType: string;
  itemRefId: string;
  sourceCandidateId: string | null;
  sourceDraftId: string | null;
  folderKey: string;
  price: number | null;
  status: 'active' | 'sold' | 'discarded';
  createdAt: number;
  updatedAt: number;
  equipmentName: string;
  equipmentType: string;
  candidateStatus: string | null;
  inventorySourceKind: 'candidate_library' | 'current_plan' | 'equipment_plan' | null;
  inventorySourceLabel: string | null;
};

type OldOcrJobDraft = {
  id: string;
  itemType: string;
  reviewStatus: string;
  confidenceScore: number;
  candidateStatus: string | null;
};

type OldOcrJob = {
  id: string;
  characterId: string;
  characterName: string;
  userId: string;
  userName: string;
  userEmail: string;
  sceneType: string;
  status: string;
  imageUrl: string;
  errorMessage: string;
  rawResult: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  draftItems: OldOcrJobDraft[];
};

type OldUserDiagnostic = {
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
};

type OldBusinessData = {
  candidates: OldCandidateEquipment[];
  inventory: OldInventoryItem[];
  ocrJobs: OldOcrJob[];
  diagnostics: OldUserDiagnostic[];
};

type OldUserSeed = {
  oldUserId: string;
  name: string;
  email: string;
  createdAt: number | null;
};

type OldCharacterSeed = {
  oldCharacterId: string;
  oldUserId: string;
  name: string;
  school: string;
  roleType: string;
  level: number;
  snapshotId: string | null;
  snapshotName: string | null;
  profileSummary: OldUserDiagnostic['profileSummary'];
  battleContextSummary: OldUserDiagnostic['battleContextSummary'];
  createdAt: number | null;
};

type UserMapping = {
  oldUserId: string;
  resolvedUserId: string;
  email: string;
};

type CharacterMapping = {
  oldCharacterId: string;
  resolvedCharacterId: string;
  resolvedUserId: string;
  name: string;
  snapshotId: string | null;
};

const OLD_BASE_URL =
  process.env.OLD_DREAM_BASE_URL || 'https://dream.xiao64702.workers.dev';
const CURRENT_BASE_URL =
  process.env.CURRENT_DREAM_BASE_URL || 'https://dream.picarowack.workers.dev';
const OLD_ADMIN_EMAIL = process.env.OLD_DREAM_ADMIN_EMAIL || 'admin@gmail.com';
const OLD_ADMIN_PASSWORD = process.env.OLD_DREAM_ADMIN_PASSWORD || 'admin123123';
const CURRENT_ADMIN_EMAIL =
  process.env.CURRENT_DREAM_ADMIN_EMAIL || 'admin@gmail.com';
const CURRENT_ADMIN_PASSWORD =
  process.env.CURRENT_DREAM_ADMIN_PASSWORD || 'admin123123';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toDate(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return new Date(0);
  }

  return typeof value === 'number' ? new Date(value) : new Date(value);
}

function toTimestamp(value: number | null | undefined, fallback = Date.now()) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function toOptionalInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function safeJsonStringify(value: unknown, fallback: Record<string, unknown> | unknown[] = {}) {
  try {
    return JSON.stringify(value ?? fallback);
  } catch {
    return JSON.stringify(fallback);
  }
}

function chunkArray<T>(items: T[], chunkSize = 1) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

async function insertInChunks<T>(rows: T[], insertChunk: (chunk: T[]) => Promise<void>) {
  for (const chunk of chunkArray(rows)) {
    await insertChunk(chunk);
  }
}

function deriveSlotKey(equipment: Record<string, unknown>, fallbackType = 'equipment') {
  const type = normalizeString(equipment.type, fallbackType) || fallbackType;
  const slot =
    equipment.slot === undefined || equipment.slot === null
      ? ''
      : String(equipment.slot).trim();

  return slot ? `${type}:${slot}` : type;
}

function parseFolderSlot(folderKey: string, equipmentType: string) {
  const segments = folderKey.split(':').filter(Boolean);
  const type = equipmentType.trim() || segments.at(-2)?.trim() || 'equipment';
  const slotCandidate = segments.at(-1)?.trim() || '';

  if (/^\d+$/.test(slotCandidate)) {
    return {
      type,
      slot: Number(slotCandidate),
    };
  }

  return {
    type,
    slot: null as number | null,
  };
}

function extractPlanId(folderKey: string) {
  if (!folderKey.startsWith('equipment_plan:')) {
    return null;
  }

  const segments = folderKey.split(':');
  return segments.length >= 4 ? segments[1] || null : null;
}

function buildMinimalEquipmentFromInventory(item: OldInventoryItem) {
  const parsed = parseFolderSlot(item.folderKey, item.equipmentType);

  return {
    id: item.itemRefId,
    name: item.equipmentName || '未命名装备',
    type: parsed.type,
    slot: parsed.slot,
    price: item.price ?? null,
  } satisfies Record<string, unknown>;
}

function normalizeImageKey(value: string | null | undefined) {
  const raw = normalizeString(value);
  if (!raw) {
    return '';
  }

  try {
    const url = new URL(raw);
    return url.pathname.replace(/^\/+/, '');
  } catch {
    return raw.replace(/^\/+/, '');
  }
}

function matchesImageKey(left: string, right: string) {
  if (!left || !right) {
    return false;
  }

  return left === right || left.endsWith(right) || right.endsWith(left);
}

function candidateOcrMatchScore(params: {
  candidate: OldCandidateEquipment;
  job: OldOcrJob;
}) {
  if (params.candidate.characterId !== params.job.characterId) {
    return Number.NEGATIVE_INFINITY;
  }

  if (params.job.sceneType !== 'equipment') {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;
  const candidateImageKey = normalizeImageKey(params.candidate.imagePreview);
  const jobImageKey = normalizeImageKey(params.job.imageUrl);
  if (matchesImageKey(candidateImageKey, jobImageKey)) {
    score += 1000;
  }

  const candidateRawText = normalizeString(params.candidate.rawText);
  const jobRawText = safeJsonStringify(params.job.rawResult);
  if (candidateRawText && candidateRawText === jobRawText) {
    score += 600;
  }

  const candidateEquipmentText = safeJsonStringify(params.candidate.equipment);
  if (candidateEquipmentText === jobRawText) {
    score += 500;
  }

  const timeDistance = Math.abs(
    toTimestamp(params.candidate.timestamp) - toTimestamp(params.job.updatedAt)
  );
  if (timeDistance <= 5 * 60 * 1000) {
    score += 300 - Math.round(timeDistance / 1000);
  } else if (timeDistance <= 24 * 60 * 60 * 1000) {
    score += 100 - Math.min(100, Math.round(timeDistance / 60000));
  }

  if (params.job.draftItems.length > 0) {
    score += 10;
  }

  return score;
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
    const body = await response.text();
    throw new Error(`Failed to sign in at ${baseUrl}: ${response.status} ${body}`);
  }

  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error(`Missing session cookie from ${baseUrl}`);
  }

  return setCookie.split(';')[0];
}

async function signUpCurrentAdmin() {
  const response = await fetch(`${CURRENT_BASE_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: CURRENT_ADMIN_EMAIL,
      password: CURRENT_ADMIN_PASSWORD,
      name: 'admin',
    }),
  });

  if (response.ok || response.status === 422) {
    return;
  }

  const body = await response.text();
  throw new Error(
    `Failed to ensure current admin user exists: ${response.status} ${body}`
  );
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

async function ensureAdminRoleBinding() {
  const database = db();

  const [currentUser] = await database
    .select()
    .from(user)
    .where(eq(user.email, CURRENT_ADMIN_EMAIL))
    .limit(1);

  if (!currentUser) {
    throw new Error(`Current user ${CURRENT_ADMIN_EMAIL} was not created`);
  }

  const [adminRole] = await database
    .select()
    .from(role)
    .where(eq(role.name, 'admin'))
    .limit(1);

  if (!adminRole) {
    throw new Error('Admin role is missing. Initialize RBAC before syncing.');
  }

  const [existingBinding] = await database
    .select()
    .from(userRole)
    .where(
      and(eq(userRole.userId, currentUser.id), eq(userRole.roleId, adminRole.id))
    )
    .limit(1);

  if (existingBinding) {
    return;
  }

  await database.insert(userRole).values({
    id: getUuid(),
    userId: currentUser.id,
    roleId: adminRole.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: null,
  });
}

async function syncConfigs(oldCookie: string) {
  const [ocrConfig, advisorConfig] = await Promise.all([
    fetchOldData<OldOcrConfig>(oldCookie, '/api/admin/simulator/ocr-config'),
    fetchOldData<OldAdvisorConfig>(
      oldCookie,
      '/api/admin/simulator/advisor-config'
    ),
  ]);

  const configValues = {
    gemini_api_key: ocrConfig.geminiApiKey || '',
    r2_account_id: ocrConfig.r2AccountId || '',
    r2_endpoint: ocrConfig.r2Endpoint || '',
    r2_access_key: ocrConfig.r2AccessKey || '',
    r2_secret_key: ocrConfig.r2SecretKey || '',
    r2_bucket_name: ocrConfig.r2BucketName || '',
    r2_upload_path: ocrConfig.r2UploadPath || '',
    simulator_advisor_enabled: String(Boolean(advisorConfig.enabled)),
    simulator_advisor_model: advisorConfig.model || '',
    simulator_advisor_system_prompt: advisorConfig.systemPrompt || '',
    simulator_advisor_temperature: String(advisorConfig.temperature ?? 0.3),
  };

  const database = db();
  const queries = Object.entries(configValues).map(([name, value]) =>
    database
      .insert(config)
      .values({ name, value })
      .onConflictDoUpdate({
        target: config.name,
        set: { value },
      })
  );

  if (queries.length > 0) {
    await database.batch(queries);
  }

  console.log('Synced OCR/advisor config values.');
}

async function syncTargetTemplates(cookie: string) {
  const items = await fetchOldData<OldTargetTemplate[]>(
    cookie,
    '/api/admin/simulator/target-templates?limit=500'
  );

  const database = db();
  const queries = items.map((item) =>
    database
      .insert(battleTargetTemplate)
      .values({
        id: item.id,
        userId: item.userId,
        scope: item.scope || 'system',
        sceneType: item.sceneType || 'dungeon',
        name: item.name,
        dungeonName: item.dungeonName || '',
        targetType: item.targetType || 'mob',
        school: item.school || '',
        level: Number(item.level || 0),
        hp: Number(item.hp || 0),
        defense: Number(item.defense || 0),
        magicDefense: Number(item.magicDefense || 0),
        magicDefenseCultivation: Number(item.magicDefenseCultivation || 0),
        speed: Number(item.speed || 0),
        element: item.element || '',
        formation: item.formation || '普通阵',
        notes: item.notes || '',
        payloadJson: JSON.stringify(item.payload || {}),
        enabled: Boolean(item.enabled),
        createdAt: toDate(item.createdAt),
        updatedAt: toDate(item.updatedAt),
      })
      .onConflictDoUpdate({
        target: battleTargetTemplate.id,
        set: {
          userId: item.userId,
          scope: item.scope || 'system',
          sceneType: item.sceneType || 'dungeon',
          name: item.name,
          dungeonName: item.dungeonName || '',
          targetType: item.targetType || 'mob',
          school: item.school || '',
          level: Number(item.level || 0),
          hp: Number(item.hp || 0),
          defense: Number(item.defense || 0),
          magicDefense: Number(item.magicDefense || 0),
          magicDefenseCultivation: Number(item.magicDefenseCultivation || 0),
          speed: Number(item.speed || 0),
          element: item.element || '',
          formation: item.formation || '普通阵',
          notes: item.notes || '',
          payloadJson: JSON.stringify(item.payload || {}),
          enabled: Boolean(item.enabled),
          createdAt: toDate(item.createdAt),
          updatedAt: toDate(item.updatedAt),
        },
      })
  );

  if (queries.length > 0) {
    await database.batch(queries);
  }

  console.log(`Synced ${items.length} target templates.`);
}

async function syncStarResonanceRules(cookie: string) {
  const items = await fetchOldData<OldStarRule[]>(
    cookie,
    '/api/admin/simulator/star-resonance-rules?limit=500'
  );

  const database = db();
  const queries = items.map((item) =>
    database
      .insert(starResonanceRule)
      .values({
        id: item.id,
        scope: item.scope || 'system',
        slot: item.slot,
        comboName: item.comboName,
        requiredColorsJson: JSON.stringify(item.requiredColors || []),
        bonusAttrType: item.bonusAttrType || '',
        bonusAttrValue: Number(item.bonusAttrValue || 0),
        globalBonusJson: JSON.stringify(item.globalBonus || {}),
        sort: Number(item.sort || 0),
        enabled: Boolean(item.enabled),
        notes: item.notes || '',
        createdAt: toDate(item.createdAt),
        updatedAt: toDate(item.updatedAt),
      })
      .onConflictDoUpdate({
        target: starResonanceRule.id,
        set: {
          scope: item.scope || 'system',
          slot: item.slot,
          comboName: item.comboName,
          requiredColorsJson: JSON.stringify(item.requiredColors || []),
          bonusAttrType: item.bonusAttrType || '',
          bonusAttrValue: Number(item.bonusAttrValue || 0),
          globalBonusJson: JSON.stringify(item.globalBonus || {}),
          sort: Number(item.sort || 0),
          enabled: Boolean(item.enabled),
          notes: item.notes || '',
          createdAt: toDate(item.createdAt),
          updatedAt: toDate(item.updatedAt),
        },
      })
  );

  if (queries.length > 0) {
    await database.batch(queries);
  }

  console.log(`Synced ${items.length} star resonance rules.`);
}

async function syncOcrDictionary(cookie: string) {
  const items = await fetchOldData<OldOcrDictionaryItem[]>(
    cookie,
    '/api/admin/simulator/ocr-dictionary?dictType=all&limit=1000'
  );

  const database = db();
  await database.delete(ocrDictionary);

  if (items.length > 0) {
    await database.insert(ocrDictionary).values(
      items.map((item) => ({
        id: item.id,
        dictType: item.dictType,
        rawText: item.rawText,
        normalizedText: item.normalizedText,
        priority: Number(item.priority || 0),
        enabled: Boolean(item.enabled),
        createdBy: item.createdBy || 'system',
        createdAt: toDate(item.createdAt),
        updatedAt: toDate(item.updatedAt),
      }))
    );
  }

  console.log(`Synced ${items.length} OCR dictionary entries.`);
}

async function syncRuleVersions(cookie: string) {
  const versions = await fetchOldData<OldRuleVersionSummary[]>(
    cookie,
    '/api/admin/simulator/rule-versions'
  );
  const details = await Promise.all(
    versions.map((version) =>
      fetchOldData<OldRuleVersionDetail>(
        cookie,
        `/api/admin/simulator/rule-versions/${version.id}`
      )
    )
  );

  const versionIds = details.map((detail) => detail.version.id);
  const database = db();

  if (versionIds.length > 0) {
    const versionUpserts = details.map((detail) =>
      database
        .insert(ruleVersion)
        .values({
          id: detail.version.id,
          ruleDomain: detail.version.ruleDomain,
          versionCode: detail.version.versionCode,
          versionName: detail.version.versionName,
          status: detail.version.status,
          isActive: Boolean(detail.version.isActive),
          sourceDocUrl: detail.version.sourceDocUrl || '',
          notes: detail.version.notes || '',
          createdBy: detail.version.createdBy || 'system',
          publishedBy: detail.version.publishedBy || '',
          publishedAt: detail.version.publishedAt
            ? toDate(detail.version.publishedAt)
            : null,
          createdAt: toDate(detail.version.createdAt),
          updatedAt: toDate(detail.version.updatedAt),
        })
        .onConflictDoUpdate({
          target: ruleVersion.id,
          set: {
            ruleDomain: detail.version.ruleDomain,
            versionCode: detail.version.versionCode,
            versionName: detail.version.versionName,
            status: detail.version.status,
            isActive: Boolean(detail.version.isActive),
            sourceDocUrl: detail.version.sourceDocUrl || '',
            notes: detail.version.notes || '',
            createdBy: detail.version.createdBy || 'system',
            publishedBy: detail.version.publishedBy || '',
            publishedAt: detail.version.publishedAt
              ? toDate(detail.version.publishedAt)
              : null,
            createdAt: toDate(detail.version.createdAt),
            updatedAt: toDate(detail.version.updatedAt),
          },
        })
    );
    await database.batch(versionUpserts);

    await database
      .delete(rulePublishLog)
      .where(inArray(rulePublishLog.versionId, versionIds));
    await database
      .delete(ruleSkillBonus)
      .where(inArray(ruleSkillBonus.versionId, versionIds));
    await database
      .delete(ruleDamageModifier)
      .where(inArray(ruleDamageModifier.versionId, versionIds));
    await database
      .delete(ruleSkillFormula)
      .where(inArray(ruleSkillFormula.versionId, versionIds));
    await database
      .delete(ruleAttribute)
      .where(inArray(ruleAttribute.versionId, versionIds));
  }

  const attributeRows = details.flatMap((detail) =>
    detail.attributeConversions.map((item) => ({
      id: item.id,
      versionId: item.versionId,
      school: item.school,
      roleType: item.roleType,
      sourceAttr: item.sourceAttr,
      targetAttr: item.targetAttr,
      coefficient: Number(item.coefficient || 0),
      valueType: item.valueType,
      conditionJson: item.conditionJson || '{}',
      sort: Number(item.sort || 0),
      enabled: Boolean(item.enabled),
      createdAt: toDate(item.createdAt),
      updatedAt: toDate(item.updatedAt),
    }))
  );

  const formulaRows = details.flatMap((detail) =>
    detail.skillFormulas.map((item) => ({
      id: item.id,
      versionId: item.versionId,
      school: item.school,
      roleType: item.roleType,
      skillCode: item.skillCode,
      skillName: item.skillName,
      formulaKey: item.formulaKey,
      baseFormulaJson: item.baseFormulaJson || '{}',
      extraFormulaJson: item.extraFormulaJson || '{}',
      conditionJson: item.conditionJson || '{}',
      sort: Number(item.sort || 0),
      enabled: Boolean(item.enabled),
      createdAt: toDate(item.createdAt),
      updatedAt: toDate(item.updatedAt),
    }))
  );

  const modifierRows = details.flatMap((detail) =>
    detail.modifiers.map((item) => ({
      id: item.id,
      versionId: item.versionId,
      modifierDomain: item.modifierDomain,
      modifierKey: item.modifierKey,
      modifierType: item.modifierType,
      sourceKey: item.sourceKey || '',
      targetKey: item.targetKey || '',
      value: Number(item.value || 0),
      valueJson: item.valueJson || '{}',
      conditionJson: item.conditionJson || '{}',
      sort: Number(item.sort || 0),
      enabled: Boolean(item.enabled),
      createdAt: toDate(item.createdAt),
      updatedAt: toDate(item.updatedAt),
    }))
  );

  const bonusRows = details.flatMap((detail) =>
    detail.skillBonuses.map((item) => ({
      id: item.id,
      versionId: item.versionId,
      bonusGroup: item.bonusGroup,
      ruleCode: item.ruleCode,
      skillCode: item.skillCode,
      skillName: item.skillName,
      bonusType: item.bonusType,
      bonusValue: Number(item.bonusValue || 0),
      conditionJson: item.conditionJson || '{}',
      conflictPolicy: item.conflictPolicy || 'take_max',
      limitPolicyJson: item.limitPolicyJson || '{}',
      sort: Number(item.sort || 0),
      enabled: Boolean(item.enabled),
      createdAt: toDate(item.createdAt),
      updatedAt: toDate(item.updatedAt),
    }))
  );

  const publishRows = details.flatMap((detail) =>
    detail.publishLogs.map((item) => ({
      id: item.id,
      versionId: item.versionId,
      action: item.action,
      operatorId: item.operatorId || 'system',
      beforeSnapshotJson: item.beforeSnapshotJson || '{}',
      afterSnapshotJson: item.afterSnapshotJson || '{}',
      notes: item.notes || '',
      createdAt: toDate(item.createdAt),
    }))
  );

  if (attributeRows.length > 0) {
    await insertInChunks(attributeRows, async (chunk) => {
      await database.insert(ruleAttribute).values(chunk);
    });
  }
  if (formulaRows.length > 0) {
    await insertInChunks(formulaRows, async (chunk) => {
      await database.insert(ruleSkillFormula).values(chunk);
    });
  }
  if (modifierRows.length > 0) {
    await insertInChunks(modifierRows, async (chunk) => {
      await database.insert(ruleDamageModifier).values(chunk);
    });
  }
  if (bonusRows.length > 0) {
    await insertInChunks(bonusRows, async (chunk) => {
      await database.insert(ruleSkillBonus).values(chunk);
    });
  }
  if (publishRows.length > 0) {
    await insertInChunks(publishRows, async (chunk) => {
      await database.insert(rulePublishLog).values(chunk);
    });
  }

  console.log(
    `Synced ${details.length} rule versions, ${attributeRows.length} attributes, ${formulaRows.length} formulas, ${modifierRows.length} modifiers, ${bonusRows.length} bonuses.`
  );
}

async function loadOldBusinessData(cookie: string): Promise<OldBusinessData> {
  const [candidates, inventory, ocrJobs, diagnostics] = await Promise.all([
    fetchOldData<OldCandidateEquipment[]>(
      cookie,
      '/api/admin/simulator/candidate-equipment?limit=500'
    ),
    fetchOldData<OldInventoryItem[]>(
      cookie,
      '/api/admin/simulator/inventory?limit=500'
    ),
    fetchOldData<OldOcrJob[]>(
      cookie,
      '/api/admin/simulator/ocr-jobs?limit=500'
    ),
    fetchOldData<OldUserDiagnostic[]>(
      cookie,
      '/api/admin/simulator/user-diagnostics?limit=500'
    ),
  ]);

  return {
    candidates,
    inventory,
    ocrJobs,
    diagnostics,
  };
}

function collectUserSeeds(data: OldBusinessData) {
  const seedByOldUserId = new Map<string, OldUserSeed>();

  const upsertSeed = (seed: OldUserSeed) => {
    const email = normalizeEmail(seed.email);
    if (!seed.oldUserId || !email) {
      return;
    }

    const existing = seedByOldUserId.get(seed.oldUserId);
    if (!existing) {
      seedByOldUserId.set(seed.oldUserId, {
        ...seed,
        email,
      });
      return;
    }

    seedByOldUserId.set(seed.oldUserId, {
      oldUserId: seed.oldUserId,
      email,
      name: seed.name || existing.name,
      createdAt:
        existing.createdAt === null
          ? seed.createdAt
          : seed.createdAt === null
            ? existing.createdAt
            : Math.min(existing.createdAt, seed.createdAt),
    });
  };

  for (const item of data.diagnostics) {
    upsertSeed({
      oldUserId: item.userId,
      name: item.userName,
      email: item.userEmail,
      createdAt: item.userCreatedAt,
    });
  }

  for (const item of [...data.candidates, ...data.inventory, ...data.ocrJobs]) {
    upsertSeed({
      oldUserId: item.userId,
      name: item.userName,
      email: item.userEmail,
      createdAt: null,
    });
  }

  return [...seedByOldUserId.values()];
}

function collectCharacterSeeds(data: OldBusinessData) {
  const seedByOldCharacterId = new Map<string, OldCharacterSeed>();

  const upsertSeed = (seed: OldCharacterSeed) => {
    if (!seed.oldCharacterId || !seed.oldUserId || !seed.name.trim()) {
      return;
    }

    const existing = seedByOldCharacterId.get(seed.oldCharacterId);
    if (!existing) {
      seedByOldCharacterId.set(seed.oldCharacterId, {
        ...seed,
        name: seed.name.trim(),
        school: seed.school || '龙宫',
        roleType: seed.roleType || '法师',
      });
      return;
    }

    seedByOldCharacterId.set(seed.oldCharacterId, {
      oldCharacterId: seed.oldCharacterId,
      oldUserId: seed.oldUserId,
      name: seed.name.trim() || existing.name,
      school: seed.school || existing.school || '龙宫',
      roleType: seed.roleType || existing.roleType || '法师',
      level: Number(seed.level || existing.level || 89),
      snapshotId: seed.snapshotId || existing.snapshotId || null,
      snapshotName: seed.snapshotName || existing.snapshotName || null,
      profileSummary: seed.profileSummary || existing.profileSummary,
      battleContextSummary: seed.battleContextSummary || existing.battleContextSummary,
      createdAt:
        existing.createdAt === null
          ? seed.createdAt
          : seed.createdAt === null
            ? existing.createdAt
            : Math.min(existing.createdAt, seed.createdAt),
    });
  };

  for (const item of data.diagnostics) {
    upsertSeed({
      oldCharacterId: item.characterId,
      oldUserId: item.userId,
      name: item.characterName,
      school: item.school,
      roleType: item.roleType,
      level: Number(item.level || 89),
      snapshotId: item.snapshotId || null,
      snapshotName: item.snapshotName || null,
      profileSummary: item.profileSummary,
      battleContextSummary: item.battleContextSummary,
      createdAt: item.userCreatedAt,
    });
  }

  for (const item of [...data.candidates, ...data.inventory, ...data.ocrJobs]) {
    upsertSeed({
      oldCharacterId: item.characterId,
      oldUserId: item.userId,
      name: item.characterName,
      school: '龙宫',
      roleType: '法师',
      level: 89,
      snapshotId: null,
      snapshotName: null,
      profileSummary: null,
      battleContextSummary: null,
      createdAt: null,
    });
  }

  return [...seedByOldCharacterId.values()];
}

async function resolveUsers(userSeeds: OldUserSeed[]) {
  const database = db();
  const emails = [...new Set(userSeeds.map((item) => normalizeEmail(item.email)).filter(Boolean))];

  const existingRows: UserRow[] =
    emails.length > 0
      ? await database.select().from(user).where(inArray(user.email, emails))
      : [];

  const existingByEmail = new Map(
    existingRows.map((row: (typeof existingRows)[number]) => [
      normalizeEmail(row.email),
      row,
    ] as const)
  );
  const mapping = new Map<string, UserMapping>();

  for (const seed of userSeeds) {
    const email = normalizeEmail(seed.email);
    const existing = existingByEmail.get(email);

    if (existing) {
      await database
        .update(user)
        .set({
          name: seed.name || existing.name,
          email: existing.email,
          createdAt:
            seed.createdAt !== null
              ? new Date(
                  Math.min(
                    existing.createdAt?.getTime?.() ?? Number.MAX_SAFE_INTEGER,
                    seed.createdAt
                  )
                )
              : existing.createdAt,
        })
        .where(eq(user.id, existing.id));

      mapping.set(seed.oldUserId, {
        oldUserId: seed.oldUserId,
        resolvedUserId: existing.id,
        email,
      });
      continue;
    }

    await database
      .insert(user)
      .values({
        id: seed.oldUserId,
        name: seed.name || email,
        email,
        emailVerified: false,
        image: null,
        createdAt: seed.createdAt !== null ? toDate(seed.createdAt) : new Date(),
        updatedAt: seed.createdAt !== null ? toDate(seed.createdAt) : new Date(),
        utmSource: '',
        ip: '',
        locale: '',
      })
      .onConflictDoUpdate({
        target: user.id,
        set: {
          name: seed.name || email,
          email,
        },
      });

    mapping.set(seed.oldUserId, {
      oldUserId: seed.oldUserId,
      resolvedUserId: seed.oldUserId,
      email,
    });
    existingByEmail.set(email, {
      id: seed.oldUserId,
      name: seed.name || email,
      email,
      emailVerified: false,
      image: null,
      createdAt: seed.createdAt !== null ? toDate(seed.createdAt) : new Date(),
      updatedAt: seed.createdAt !== null ? toDate(seed.createdAt) : new Date(),
      utmSource: '',
      ip: '',
      locale: '',
    });
  }

  console.log(`Resolved ${mapping.size} users.`);
  return mapping;
}

async function resolveCharacters(
  characterSeeds: OldCharacterSeed[],
  userMappings: Map<string, UserMapping>
) {
  const database = db();
  const resolvedUserIds = [
    ...new Set(
      characterSeeds
        .map((seed) => userMappings.get(seed.oldUserId)?.resolvedUserId)
        .filter((value): value is string => Boolean(value))
    ),
  ];

  const existingRows: CharacterRow[] =
    resolvedUserIds.length > 0
      ? await database
          .select()
          .from(gameCharacter)
          .where(inArray(gameCharacter.userId, resolvedUserIds))
      : [];

  const existingById = new Map(
    existingRows.map((row: (typeof existingRows)[number]) => [row.id, row] as const)
  );
  const existingByComposite = new Map(
    existingRows.map((row: (typeof existingRows)[number]) => [
      `${row.userId}::${row.name}`,
      row,
    ] as const)
  );
  const mapping = new Map<string, CharacterMapping>();

  for (const seed of characterSeeds) {
    const userMapping = userMappings.get(seed.oldUserId);
    if (!userMapping) {
      continue;
    }

    const resolvedUserId = userMapping.resolvedUserId;
    const existingByCharId = existingById.get(seed.oldCharacterId);
    const existingByName = existingByComposite.get(`${resolvedUserId}::${seed.name}`);
    const resolvedCharacterId =
      existingByCharId?.id || existingByName?.id || seed.oldCharacterId;

    await database
      .insert(gameCharacter)
      .values({
        id: resolvedCharacterId,
        userId: resolvedUserId,
        name: seed.name,
        serverName: '',
        school: seed.school || '龙宫',
        roleType: seed.roleType || '法师',
        level: Number(seed.level || 89),
        race: '',
        status: 'active',
        currentSnapshotId: seed.snapshotId || null,
        createdAt: seed.createdAt !== null ? toDate(seed.createdAt) : new Date(),
        updatedAt: seed.createdAt !== null ? toDate(seed.createdAt) : new Date(),
      })
      .onConflictDoUpdate({
        target: gameCharacter.id,
        set: {
          userId: resolvedUserId,
          name: seed.name,
          school: seed.school || '龙宫',
          roleType: seed.roleType || '法师',
          level: Number(seed.level || 89),
          status: 'active',
          currentSnapshotId: seed.snapshotId || null,
        },
      });

    mapping.set(seed.oldCharacterId, {
      oldCharacterId: seed.oldCharacterId,
      resolvedCharacterId,
      resolvedUserId,
      name: seed.name,
      snapshotId: seed.snapshotId || null,
    });
    existingById.set(resolvedCharacterId, {
      ...(existingByCharId || existingByName || {
        id: resolvedCharacterId,
        userId: resolvedUserId,
        name: seed.name,
        serverName: '',
        school: seed.school || '龙宫',
        roleType: seed.roleType || '法师',
        level: Number(seed.level || 89),
        race: '',
        status: 'active',
        currentSnapshotId: seed.snapshotId || null,
        createdAt: seed.createdAt !== null ? toDate(seed.createdAt) : new Date(),
        updatedAt: seed.createdAt !== null ? toDate(seed.createdAt) : new Date(),
      }),
      id: resolvedCharacterId,
      userId: resolvedUserId,
      name: seed.name,
    });
    existingByComposite.set(`${resolvedUserId}::${seed.name}`, existingById.get(resolvedCharacterId)!);
  }

  console.log(`Resolved ${mapping.size} characters.`);
  return mapping;
}

async function syncCharacterSnapshots(
  characterSeeds: OldCharacterSeed[],
  characterMappings: Map<string, CharacterMapping>
) {
  const database = db();

  for (const seed of characterSeeds) {
    const mapping = characterMappings.get(seed.oldCharacterId);
    if (!mapping) {
      continue;
    }

    const snapshotId = seed.snapshotId || `synced_snapshot_${mapping.resolvedCharacterId}`;
    const snapshotCreatedAt = seed.createdAt !== null ? toDate(seed.createdAt) : new Date();

    await database
      .insert(characterSnapshot)
      .values({
        id: snapshotId,
        characterId: mapping.resolvedCharacterId,
        snapshotType: 'current',
        name: seed.snapshotName || '历史同步快照',
        versionNo: 1,
        source: 'imported_old_cloudflare',
        notes: '由旧 Cloudflare 线上环境同步',
        createdAt: snapshotCreatedAt,
        updatedAt: snapshotCreatedAt,
      })
      .onConflictDoUpdate({
        target: characterSnapshot.id,
        set: {
          characterId: mapping.resolvedCharacterId,
          snapshotType: 'current',
          name: seed.snapshotName || '历史同步快照',
          source: 'imported_old_cloudflare',
          notes: '由旧 Cloudflare 线上环境同步',
        },
      });

    if (seed.profileSummary) {
      await database
        .insert(characterProfile)
        .values({
          snapshotId,
          school: seed.school || '龙宫',
          level: Number(seed.level || 89),
          physique: 0,
          magic: 0,
          strength: 0,
          endurance: 0,
          agility: 0,
          potentialPoints: 0,
          hp: Number(seed.profileSummary.hp || 0),
          mp: Number(seed.profileSummary.mp || 0),
          damage: 0,
          defense: 0,
          magicDamage: Number(seed.profileSummary.magicDamage || 0),
          magicDefense: Number(seed.profileSummary.magicDefense || 0),
          speed: Number(seed.profileSummary.speed || 0),
          hit: 0,
          sealHit: 0,
          rawBodyJson: '{}',
        })
        .onConflictDoUpdate({
          target: characterProfile.snapshotId,
          set: {
            school: seed.school || '龙宫',
            level: Number(seed.level || 89),
            hp: Number(seed.profileSummary.hp || 0),
            mp: Number(seed.profileSummary.mp || 0),
            magicDamage: Number(seed.profileSummary.magicDamage || 0),
            magicDefense: Number(seed.profileSummary.magicDefense || 0),
            speed: Number(seed.profileSummary.speed || 0),
          },
        });
    }

    if (seed.battleContextSummary) {
      await database
        .insert(snapshotBattleContext)
        .values({
          snapshotId,
          ruleVersionId: null,
          selfFormation: seed.battleContextSummary.selfFormation || '天覆阵',
          selfElement: seed.battleContextSummary.selfElement || '水',
          formationCounterState: '无克/普通',
          elementRelation: '无克/普通',
          transformCardFactor: 1,
          splitTargetCount: Number(seed.battleContextSummary.splitTargetCount || 1),
          shenmuValue: 0,
          magicResult: 0,
          targetTemplateId: null,
          targetName: seed.battleContextSummary.targetName || '默认目标',
          targetLevel: 0,
          targetHp: 0,
          targetDefense: 0,
          targetMagicDefense: Number(
            seed.battleContextSummary.targetMagicDefense || 0
          ),
          targetSpeed: 0,
          targetMagicDefenseCultivation: 0,
          targetElement: seed.battleContextSummary.targetElement || '',
          targetFormation: seed.battleContextSummary.targetFormation || '普通阵',
          notesJson: '{}',
          createdAt: snapshotCreatedAt,
          updatedAt: snapshotCreatedAt,
        })
        .onConflictDoUpdate({
          target: snapshotBattleContext.snapshotId,
          set: {
            selfFormation: seed.battleContextSummary.selfFormation || '天覆阵',
            selfElement: seed.battleContextSummary.selfElement || '水',
            splitTargetCount: Number(
              seed.battleContextSummary.splitTargetCount || 1
            ),
            targetName: seed.battleContextSummary.targetName || '默认目标',
            targetMagicDefense: Number(
              seed.battleContextSummary.targetMagicDefense || 0
            ),
            targetElement: seed.battleContextSummary.targetElement || '',
            targetFormation: seed.battleContextSummary.targetFormation || '普通阵',
          },
        });
    }

    await database
      .update(gameCharacter)
      .set({
        currentSnapshotId: snapshotId,
      })
      .where(eq(gameCharacter.id, mapping.resolvedCharacterId));
  }

  console.log(`Synced ${characterSeeds.length} snapshots/profiles/battle contexts.`);
}

function buildCandidateDraftHints(data: OldBusinessData) {
  const hintByCandidateId = new Map<
    string,
    { draftId: string | null; jobId: string | null }
  >();
  const draftJobMap = new Map<string, string>();

  for (const job of data.ocrJobs) {
    for (const draft of job.draftItems || []) {
      draftJobMap.set(draft.id, job.id);
    }
  }

  for (const item of data.inventory) {
    if (!item.sourceCandidateId) {
      continue;
    }

    hintByCandidateId.set(item.sourceCandidateId, {
      draftId: item.sourceDraftId || null,
      jobId:
        item.sourceDraftId && draftJobMap.has(item.sourceDraftId)
          ? draftJobMap.get(item.sourceDraftId) || null
          : null,
    });
  }

  return hintByCandidateId;
}

function inferCandidateOcrLinks(data: OldBusinessData) {
  const hintByCandidateId = buildCandidateDraftHints(data);
  const mapping = new Map<
    string,
    { ocrJobId: string | null; ocrDraftItemId: string | null }
  >();
  const usedJobIds = new Set<string>();

  for (const candidate of data.candidates) {
    const hinted = hintByCandidateId.get(candidate.id);
    if (hinted?.draftId || hinted?.jobId) {
      mapping.set(candidate.id, {
        ocrJobId: hinted.jobId || null,
        ocrDraftItemId: hinted.draftId || null,
      });
      if (hinted.jobId) {
        usedJobIds.add(hinted.jobId);
      }
      continue;
    }

    let bestJob: OldOcrJob | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const job of data.ocrJobs) {
      if (usedJobIds.has(job.id) || job.status !== 'success') {
        continue;
      }

      const score = candidateOcrMatchScore({
        candidate,
        job,
      });
      if (score > bestScore) {
        bestScore = score;
        bestJob = job;
      }
    }

    if (bestJob && bestScore > 0) {
      mapping.set(candidate.id, {
        ocrJobId: bestJob.id,
        ocrDraftItemId: bestJob.draftItems[0]?.id || null,
      });
      usedJobIds.add(bestJob.id);
    } else {
      mapping.set(candidate.id, {
        ocrJobId: null,
        ocrDraftItemId: null,
      });
    }
  }

  return mapping;
}

async function syncOcrJobsAndDrafts(
  data: OldBusinessData,
  characterMappings: Map<string, CharacterMapping>
) {
  const database = db();

  for (const job of data.ocrJobs) {
    const characterMapping = characterMappings.get(job.characterId);
    if (!characterMapping) {
      continue;
    }

    await database
      .insert(ocrJob)
      .values({
        id: job.id,
        characterId: characterMapping.resolvedCharacterId,
        sceneType: job.sceneType || 'equipment',
        imageUrl: job.imageUrl || '',
        status: job.status || 'pending',
        rawResultJson: safeJsonStringify(job.rawResult),
        errorMessage: job.errorMessage || '',
        createdAt: toDate(job.createdAt),
        updatedAt: toDate(job.updatedAt),
      })
      .onConflictDoUpdate({
        target: ocrJob.id,
        set: {
          characterId: characterMapping.resolvedCharacterId,
          sceneType: job.sceneType || 'equipment',
          imageUrl: job.imageUrl || '',
          status: job.status || 'pending',
          rawResultJson: safeJsonStringify(job.rawResult),
          errorMessage: job.errorMessage || '',
          createdAt: toDate(job.createdAt),
          updatedAt: toDate(job.updatedAt),
        },
      });

    for (const draft of job.draftItems || []) {
      await database
        .insert(ocrDraftItem)
        .values({
          id: draft.id,
          ocrJobId: job.id,
          characterId: characterMapping.resolvedCharacterId,
          itemType: draft.itemType || 'equipment',
          draftBodyJson: safeJsonStringify(job.rawResult),
          confidenceScore: Number(draft.confidenceScore || 0),
          reviewStatus: draft.reviewStatus || 'pending',
          reviewNote: '由旧 Cloudflare OCR 历史任务同步',
          createdAt: toDate(job.createdAt),
          updatedAt: toDate(job.updatedAt),
        })
        .onConflictDoUpdate({
          target: ocrDraftItem.id,
          set: {
            ocrJobId: job.id,
            characterId: characterMapping.resolvedCharacterId,
            itemType: draft.itemType || 'equipment',
            draftBodyJson: safeJsonStringify(job.rawResult),
            confidenceScore: Number(draft.confidenceScore || 0),
            reviewStatus: draft.reviewStatus || 'pending',
            reviewNote: '由旧 Cloudflare OCR 历史任务同步',
            createdAt: toDate(job.createdAt),
            updatedAt: toDate(job.updatedAt),
          },
        });
    }
  }

  const draftCount = data.ocrJobs.reduce(
    (sum, item) => sum + (item.draftItems?.length || 0),
    0
  );
  console.log(`Synced ${data.ocrJobs.length} OCR jobs and ${draftCount} drafts.`);
}

async function syncCandidateEquipmentData(
  data: OldBusinessData,
  characterMappings: Map<string, CharacterMapping>
) {
  const database = db();
  const linkMap = inferCandidateOcrLinks(data);
  const oldCandidateIdSet = new Set(data.candidates.map((item) => item.id));
  const resolvedCharacterIds = [
    ...new Set(
      data.candidates
        .map((item) => characterMappings.get(item.characterId)?.resolvedCharacterId)
        .filter((value): value is string => Boolean(value))
    ),
  ];
  const existingRows: CandidateEquipmentRow[] =
    resolvedCharacterIds.length > 0
      ? await database
          .select()
          .from(candidateEquipment)
          .where(inArray(candidateEquipment.characterId, resolvedCharacterIds))
      : [];
  const existingById = new Map(
    existingRows.map((row: (typeof existingRows)[number]) => [row.id, row] as const)
  );
  const nextSortByCharacterId = new Map<string, number>();

  for (const row of existingRows) {
    if (oldCandidateIdSet.has(row.id)) {
      continue;
    }

    nextSortByCharacterId.set(
      row.characterId,
      Math.max(nextSortByCharacterId.get(row.characterId) ?? -1, Number(row.sort || 0))
    );
  }

  const groups = new Map<string, OldCandidateEquipment[]>();
  for (const item of data.candidates) {
    const characterId =
      characterMappings.get(item.characterId)?.resolvedCharacterId || '';
    if (!characterId) {
      continue;
    }

    const current = groups.get(characterId) ?? [];
    current.push(item);
    groups.set(characterId, current);
  }

  for (const [resolvedCharacterId, rows] of groups) {
    rows.sort((left, right) => left.timestamp - right.timestamp);

    for (const item of rows) {
      const existing = existingById.get(item.id);
      const sort =
        existing?.sort ??
        ((nextSortByCharacterId.get(resolvedCharacterId) ?? -1) + 1);
      nextSortByCharacterId.set(
        resolvedCharacterId,
        Math.max(nextSortByCharacterId.get(resolvedCharacterId) ?? -1, sort)
      );

      const link = linkMap.get(item.id);
      await database
        .insert(candidateEquipment)
        .values({
          id: item.id,
          characterId: resolvedCharacterId,
          status: item.status,
          source: item.source || 'manual',
          equipmentJson: safeJsonStringify(item.equipment),
          imageKey: normalizeString(item.imagePreview) || null,
          rawText: normalizeString(item.rawText) || null,
          targetSetId: null,
          targetEquipmentId: null,
          targetRuneStoneSetIndex: null,
          ocrJobId: link?.ocrJobId || null,
          ocrDraftItemId: link?.ocrDraftItemId || null,
          sort,
          createdAt: toDate(item.timestamp),
          updatedAt: toDate(item.timestamp),
        })
        .onConflictDoUpdate({
          target: candidateEquipment.id,
          set: {
            characterId: resolvedCharacterId,
            status: item.status,
            source: item.source || 'manual',
            equipmentJson: safeJsonStringify(item.equipment),
            imageKey: normalizeString(item.imagePreview) || null,
            rawText: normalizeString(item.rawText) || null,
            ocrJobId: link?.ocrJobId || null,
            ocrDraftItemId: link?.ocrDraftItemId || null,
            sort,
            createdAt: toDate(item.timestamp),
            updatedAt: toDate(item.timestamp),
          },
        });
    }
  }

  console.log(`Synced ${data.candidates.length} candidate equipment rows.`);
}

async function syncInventoryData(
  data: OldBusinessData,
  characterMappings: Map<string, CharacterMapping>
) {
  const database = db();
  const candidateById = new Map(data.candidates.map((item) => [item.id, item] as const));
  const assetRows: InventoryAssetRow[] = await database
    .select()
    .from(inventoryEquipmentAsset);
  const entryRows: InventoryEntryRow[] = await database
    .select()
    .from(inventoryEntry);
  const existingAssetById = new Map(
    assetRows.map((row: (typeof assetRows)[number]) => [row.id, row] as const)
  );
  const existingAssetBySourceCandidateId = new Map(
    assetRows
      .filter((row: (typeof assetRows)[number]) => Boolean(row.sourceCandidateId))
      .map((row: (typeof assetRows)[number]) => [row.sourceCandidateId as string, row] as const)
  );
  const existingEntryById = new Map(
    entryRows.map((row: (typeof entryRows)[number]) => [row.id, row] as const)
  );
  const existingEntryByItemRefId = new Map(
    entryRows.map((row: (typeof entryRows)[number]) => [row.itemRefId, row] as const)
  );

  for (const item of data.inventory) {
    const characterMapping = characterMappings.get(item.characterId);
    if (!characterMapping) {
      continue;
    }

    const linkedCandidate = item.sourceCandidateId
      ? candidateById.get(item.sourceCandidateId) || null
      : null;
    const existingAssetByCandidate =
      item.sourceCandidateId
        ? existingAssetBySourceCandidateId.get(item.sourceCandidateId) || null
        : null;
    const assetId =
      existingAssetByCandidate?.id ||
      existingAssetById.get(item.itemRefId)?.id ||
      item.itemRefId;
    const existingEntryByAsset = existingEntryByItemRefId.get(assetId) || null;
    const entryId =
      existingEntryByAsset?.id || existingEntryById.get(item.id)?.id || item.id;

    const baseEquipment =
      linkedCandidate?.equipment || buildMinimalEquipmentFromInventory(item);
    const parsedFolder = parseFolderSlot(item.folderKey, item.equipmentType);
    const nextEquipment =
      item.inventorySourceKind === 'candidate_library'
        ? {
            ...baseEquipment,
            id: assetId,
            name:
              normalizeString(baseEquipment.name) ||
              item.equipmentName ||
              '未命名装备',
            type:
              normalizeString(baseEquipment.type) ||
              parsedFolder.type ||
              item.equipmentType ||
              'equipment',
            slot:
              baseEquipment.slot === undefined ||
              baseEquipment.slot === null ||
              baseEquipment.slot === ''
                ? parsedFolder.slot
                : baseEquipment.slot,
            price:
              baseEquipment.price === undefined || baseEquipment.price === null
                ? item.price
                : baseEquipment.price,
          }
        : {
            ...buildMinimalEquipmentFromInventory(item),
            id: assetId,
          };

    const payloadJson =
      item.inventorySourceKind === 'candidate_library'
        ? safeJsonStringify(nextEquipment)
        : buildSimulatorInventoryMirrorPayload({
            equipment: nextEquipment,
            meta: {
              mirrorManaged: true,
              sourceKind: item.inventorySourceKind || 'current_plan',
              sourceLabel: item.inventorySourceLabel || '历史同步',
              planId: extractPlanId(item.folderKey),
              isActivePlan: item.inventorySourceKind === 'current_plan',
            },
          });
    const slotKey = deriveSlotKey(nextEquipment, parsedFolder.type || 'equipment');
    const sourceDraftId =
      item.sourceDraftId && item.sourceDraftId.trim().length > 0
        ? item.sourceDraftId
        : null;

    await database
      .insert(inventoryEquipmentAsset)
      .values({
        id: assetId,
        characterId: characterMapping.resolvedCharacterId,
        itemType: item.itemType || 'equipment',
        sourceCandidateId: item.sourceCandidateId || null,
        sourceDraftId,
        itemName:
          normalizeString(nextEquipment.name) || item.equipmentName || '未命名装备',
        itemSubtype:
          normalizeString(nextEquipment.type) || item.equipmentType || 'equipment',
        slotKey,
        payloadJson,
        priceSnapshot:
          toOptionalInteger(nextEquipment.price) ?? toOptionalInteger(item.price),
        createdAt: toDate(item.createdAt),
        updatedAt: toDate(item.updatedAt),
      })
      .onConflictDoUpdate({
        target: inventoryEquipmentAsset.id,
        set: {
          characterId: characterMapping.resolvedCharacterId,
          itemType: item.itemType || 'equipment',
          sourceCandidateId: item.sourceCandidateId || null,
          sourceDraftId,
          itemName:
            normalizeString(nextEquipment.name) || item.equipmentName || '未命名装备',
          itemSubtype:
            normalizeString(nextEquipment.type) || item.equipmentType || 'equipment',
          slotKey,
          payloadJson,
          priceSnapshot:
            toOptionalInteger(nextEquipment.price) ?? toOptionalInteger(item.price),
          createdAt: toDate(item.createdAt),
          updatedAt: toDate(item.updatedAt),
        },
      });

    await database
      .insert(inventoryEntry)
      .values({
        id: entryId,
        characterId: characterMapping.resolvedCharacterId,
        itemType: item.itemType || 'equipment',
        itemRefId: assetId,
        sourceDraftId,
        folderKey: item.folderKey || 'equipment',
        price: toOptionalInteger(item.price),
        status: item.status || 'active',
        createdAt: toDate(item.createdAt),
        updatedAt: toDate(item.updatedAt),
      })
      .onConflictDoUpdate({
        target: inventoryEntry.id,
        set: {
          characterId: characterMapping.resolvedCharacterId,
          itemType: item.itemType || 'equipment',
          itemRefId: assetId,
          sourceDraftId,
          folderKey: item.folderKey || 'equipment',
          price: toOptionalInteger(item.price),
          status: item.status || 'active',
          createdAt: toDate(item.createdAt),
          updatedAt: toDate(item.updatedAt),
        },
      });

    existingAssetById.set(assetId, {
      ...(existingAssetById.get(assetId) || {
        id: assetId,
      }),
      id: assetId,
      characterId: characterMapping.resolvedCharacterId,
      itemType: item.itemType || 'equipment',
      sourceCandidateId: item.sourceCandidateId || null,
      sourceDraftId,
      itemName:
        normalizeString(nextEquipment.name) || item.equipmentName || '未命名装备',
      itemSubtype:
        normalizeString(nextEquipment.type) || item.equipmentType || 'equipment',
      slotKey,
      payloadJson,
      priceSnapshot:
        toOptionalInteger(nextEquipment.price) ?? toOptionalInteger(item.price),
      createdAt: toDate(item.createdAt),
      updatedAt: toDate(item.updatedAt),
    } as typeof inventoryEquipmentAsset.$inferSelect);

    if (item.sourceCandidateId) {
      existingAssetBySourceCandidateId.set(item.sourceCandidateId, existingAssetById.get(assetId)!);
    }

    existingEntryById.set(entryId, {
      ...(existingEntryById.get(entryId) || {
        id: entryId,
      }),
      id: entryId,
      characterId: characterMapping.resolvedCharacterId,
      itemType: item.itemType || 'equipment',
      itemRefId: assetId,
      sourceDraftId,
      folderKey: item.folderKey || 'equipment',
      price: toOptionalInteger(item.price),
      status: item.status || 'active',
      createdAt: toDate(item.createdAt),
      updatedAt: toDate(item.updatedAt),
    } as typeof inventoryEntry.$inferSelect);
    existingEntryByItemRefId.set(assetId, existingEntryById.get(entryId)!);
  }

  console.log(`Synced ${data.inventory.length} inventory rows.`);
}

async function syncBusinessData(oldCookie: string) {
  const data = await loadOldBusinessData(oldCookie);
  const userSeeds = collectUserSeeds(data);
  const characterSeeds = collectCharacterSeeds(data);
  const userMappings = await resolveUsers(userSeeds);
  const characterMappings = await resolveCharacters(characterSeeds, userMappings);

  await syncCharacterSnapshots(characterSeeds, characterMappings);
  await syncOcrJobsAndDrafts(data, characterMappings);
  await syncCandidateEquipmentData(data, characterMappings);
  await syncInventoryData(data, characterMappings);

  console.log(
    `Business sync summary: users=${userSeeds.length}, characters=${characterSeeds.length}, ocrJobs=${data.ocrJobs.length}, candidates=${data.candidates.length}, inventory=${data.inventory.length}.`
  );
}

async function printSummary() {
  const database = db();
  const [ruleCountRow] = await database
    .select({ count: count() })
    .from(ruleVersion);
  const [templateCountRow] = await database
    .select({ count: count() })
    .from(battleTargetTemplate);
  const [starCountRow] = await database
    .select({ count: count() })
    .from(starResonanceRule);
  const [ocrDictCountRow] = await database
    .select({ count: count() })
    .from(ocrDictionary);
  const [userCountRow] = await database.select({ count: count() }).from(user);
  const [characterCountRow] = await database
    .select({ count: count() })
    .from(gameCharacter);
  const [ocrJobCountRow] = await database
    .select({ count: count() })
    .from(ocrJob);
  const [draftCountRow] = await database
    .select({ count: count() })
    .from(ocrDraftItem);
  const [candidateCountRow] = await database
    .select({ count: count() })
    .from(candidateEquipment);
  const [inventoryCountRow] = await database
    .select({ count: count() })
    .from(inventoryEntry);
  const [adminUserRow] = await database
    .select()
    .from(user)
    .where(eq(user.email, CURRENT_ADMIN_EMAIL))
    .limit(1);

  console.log('Sync summary:');
  console.log(`- rule versions: ${Number(ruleCountRow?.count || 0)}`);
  console.log(`- target templates: ${Number(templateCountRow?.count || 0)}`);
  console.log(`- star resonance rules: ${Number(starCountRow?.count || 0)}`);
  console.log(`- ocr dictionary rows: ${Number(ocrDictCountRow?.count || 0)}`);
  console.log(`- users: ${Number(userCountRow?.count || 0)}`);
  console.log(`- characters: ${Number(characterCountRow?.count || 0)}`);
  console.log(`- ocr jobs: ${Number(ocrJobCountRow?.count || 0)}`);
  console.log(`- ocr drafts: ${Number(draftCountRow?.count || 0)}`);
  console.log(`- candidate equipment rows: ${Number(candidateCountRow?.count || 0)}`);
  console.log(`- inventory rows: ${Number(inventoryCountRow?.count || 0)}`);
  console.log(`- ensured current admin: ${adminUserRow?.email || 'missing'}`);
}

async function main() {
  console.log(`Logging into old site ${OLD_BASE_URL} as ${OLD_ADMIN_EMAIL}...`);
  const oldCookie = await login(OLD_BASE_URL, OLD_ADMIN_EMAIL, OLD_ADMIN_PASSWORD);

  console.log(`Ensuring current admin user ${CURRENT_ADMIN_EMAIL} exists...`);
  await signUpCurrentAdmin();

  await initD1ContextForDev();
  await ensureAdminRoleBinding();

  await syncConfigs(oldCookie);
  await syncTargetTemplates(oldCookie);
  await syncStarResonanceRules(oldCookie);
  await syncOcrDictionary(oldCookie);
  await syncRuleVersions(oldCookie);
  await syncBusinessData(oldCookie);

  clearSimulatorReadCache({
    attributeRules: true,
    targetTemplates: true,
  });

  await printSummary();
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('sync-old-cloudflare-data failed:', error);
    process.exit(1);
  });
