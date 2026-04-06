import { and, asc, desc, eq, inArray, like, or } from 'drizzle-orm';

import { db } from '@/core/db';
import { initD1ContextForDev, resetD1DevBindingCache } from '@/core/db/d1';
import {
  attributeRule,
  battleTargetTemplate,
  characterCultivation,
  characterProfile,
  characterSkill,
  characterSnapshot,
  candidateEquipment,
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
import { getRequiredSimulatorSeedConfig } from '@/shared/models/simulator-template';

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

export type AdminSimulatorPendingReviewItem = SimulatorCandidateEquipmentItem & {
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

function parseJsonObject(value: string | null | undefined) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function insertValuesInChunks(
  database: ReturnType<typeof db>,
  table: any,
  values: any[],
  chunkSize = 8
) {
  for (const chunk of chunkArray(values, chunkSize)) {
    await database.insert(table).values(chunk);
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
  try {
    return await db()
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
  } catch (error) {
    console.warn(
      'Failed to load simulator attribute rules, continuing without rules:',
      error
    );
    return [];
  }
}

export async function getSimulatorCharacterBundle(
  userId: string,
  characterId?: string
): Promise<SimulatorCharacterBundle | null> {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('getSimulatorCharacterBundle', async () => {
    const character = await findActiveCharacter(userId, characterId);
    if (!character) {
      return null;
    }

    const snapshot = await findCurrentSnapshot(character);

    const [profile] = snapshot
      ? await db()
          .select()
          .from(characterProfile)
          .where(eq(characterProfile.snapshotId, snapshot.id))
          .limit(1)
      : [];

    const skills = snapshot
      ? await db()
          .select()
          .from(characterSkill)
          .where(eq(characterSkill.snapshotId, snapshot.id))
          .orderBy(
            desc(characterSkill.finalLevel),
            asc(characterSkill.skillName)
          )
      : [];

    const cultivations = snapshot
      ? await db()
          .select()
          .from(characterCultivation)
          .where(eq(characterCultivation.snapshotId, snapshot.id))
          .orderBy(asc(characterCultivation.cultivationType))
      : [];

    const [battleContext] = snapshot
      ? await db()
          .select()
          .from(snapshotBattleContext)
          .where(eq(snapshotBattleContext.snapshotId, snapshot.id))
          .limit(1)
      : [];

    const [targetTemplate] = battleContext?.targetTemplateId
      ? await db()
          .select()
          .from(battleTargetTemplate)
          .where(eq(battleTargetTemplate.id, battleContext.targetTemplateId))
          .limit(1)
      : [];

    const rules = await findAttributeRules({
      school: profile?.school ?? character.school,
      roleType: character.roleType,
    });

    const slotRows = snapshot
      ? await db()
          .select()
          .from(snapshotEquipmentSlot)
          .where(eq(snapshotEquipmentSlot.snapshotId, snapshot.id))
          .orderBy(asc(snapshotEquipmentSlot.slot))
      : [];

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
          .where(eq(equipmentItem.characterId, character.id))
          .orderBy(asc(equipmentItem.slot), desc(equipmentItem.updatedAt));

    const equipmentIds = equipmentRows.map(
      (item: SimulatorEquipmentRow) => item.id
    );

    const buildRows = equipmentIds.length
      ? await db()
          .select()
          .from(equipmentBuild)
          .where(inArray(equipmentBuild.equipmentId, equipmentIds))
      : [];

    const attrRows = equipmentIds.length
      ? await db()
          .select()
          .from(equipmentAttr)
          .where(inArray(equipmentAttr.equipmentId, equipmentIds))
          .orderBy(asc(equipmentAttr.displayOrder))
      : [];

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

    return {
      character,
      snapshot: snapshot ?? null,
      profile: profile ?? null,
      skills,
      cultivations,
      battleContext: battleContext ?? null,
      battleTargetTemplate: targetTemplate ?? null,
      rules,
      equipments,
    };
  });
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

  const existing = await findActiveCharacter(params.userId);
  if (existing) {
    return getSimulatorCharacterBundle(params.userId, existing.id);
  }

  const seedConfig = await getRequiredSimulatorSeedConfig();
  const characterId = getUuid();
  const snapshotId = getUuid();
  const database = db();

  const characterInsert = database.insert(gameCharacter).values({
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
  });
  const snapshotInsert = database.insert(characterSnapshot).values({
    id: snapshotId,
    characterId,
    snapshotType: 'current',
    name: seedConfig.characterMeta.snapshotName,
    versionNo: 1,
    source: 'system_default',
    notes: seedConfig.characterMeta.snapshotNotes,
  });
  const profileInsert = database.insert(characterProfile).values({
    snapshotId,
    ...seedConfig.profile,
  });
  const battleContextInsert = database.insert(snapshotBattleContext).values({
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
    targetMagicDefenseCultivation:
      seedConfig.battleContext.targetMagicDefenseCultivation,
    targetElement: seedConfig.battleContext.targetElement,
    targetFormation: seedConfig.battleContext.targetFormation,
  });

  const batchQueries = [
    characterInsert,
    snapshotInsert,
    profileInsert,
    battleContextInsert,
  ];

  if (seedConfig.skills.length > 0) {
    const skillValues = seedConfig.skills.map((skill) => ({
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
    const cultivationValues = seedConfig.cultivations.map((cultivation) => ({
      id: getUuid(),
      snapshotId,
      cultivationType: cultivation.cultivationType,
      level: cultivation.level,
    }));

    for (const chunk of chunkArray(cultivationValues)) {
      batchQueries.push(database.insert(characterCultivation).values(chunk));
    }
  }

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

    const equipmentItemValues = equipmentRows.map((equipment) => ({
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
    }));
    const equipmentBuildValues = equipmentRows.map((equipment) => ({
      equipmentId: equipment.equipmentId,
      holeCount: 0,
      gemLevelTotal: 0,
      refineLevel: equipment.refineLevel,
      specialEffectJson: '{}',
      setEffectJson: '{}',
      notesJson: '{}',
    }));
    const equipmentAttrValues = equipmentRows.flatMap((equipment) =>
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

  return getSimulatorCharacterBundle(params.userId, characterId);
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
  const character = await findActiveCharacter(userId);
  if (!character) {
    return null;
  }

  const snapshot = await findCurrentSnapshot(character);
  if (!snapshot) {
    return null;
  }

  const [existingProfile] = await db()
    .select()
    .from(characterProfile)
    .where(eq(characterProfile.snapshotId, snapshot.id))
    .limit(1);

  const currentRawBody = parseProfileRawBody(existingProfile?.rawBodyJson);
  const nextRawBody = JSON.stringify({
    ...currentRawBody,
    hp: payload.hp,
    magic: payload.magic,
    physique: payload.physique,
    strength: payload.strength,
    endurance: payload.endurance,
    agility: payload.agility,
    magicPower: payload.magicPower,
    dodge: payload.dodge,
  });

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
        sealHit: payload.sealHit ?? 0,
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

  return getSimulatorCharacterBundle(userId, character.id);
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
  const character = await findActiveCharacter(userId);
  if (!character) {
    return null;
  }

  const snapshot = await findCurrentSnapshot(character);
  if (!snapshot) {
    return null;
  }

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

  await db()
    .insert(characterCultivation)
    .values(
      cultivationRows.map((item) => ({
        id: getUuid(),
        snapshotId: snapshot.id,
        cultivationType: item.cultivationType,
        level: item.level,
      }))
    );

  return getSimulatorCharacterBundle(userId, character.id);
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
    targetMagicDefenseCultivation?: number;
    targetElement?: string;
    targetFormation?: string;
    targetTemplateId?: string | null;
  }
) {
  const character = await findActiveCharacter(userId);
  if (!character) {
    return null;
  }

  const snapshot = await findCurrentSnapshot(character);
  if (!snapshot) {
    return null;
  }

  const [existingContext] = await db()
    .select()
    .from(snapshotBattleContext)
    .where(eq(snapshotBattleContext.snapshotId, snapshot.id))
    .limit(1);

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
    targetTemplateId:
      payload.targetTemplateId === undefined
        ? existingContext?.targetTemplateId ?? null
        : payload.targetTemplateId || null,
    targetName: payload.targetName || '默认目标',
    targetLevel: payload.targetLevel ?? 0,
    targetHp: payload.targetHp ?? 0,
    targetDefense: payload.targetDefense ?? 0,
    targetMagicDefense: payload.targetMagicDefense ?? 0,
    targetMagicDefenseCultivation: payload.targetMagicDefenseCultivation ?? 0,
    targetElement: payload.targetElement || '',
    targetFormation: payload.targetFormation || '普通阵',
    notesJson: existingContext?.notesJson ?? '{}',
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

  return getSimulatorCharacterBundle(userId, character.id);
}

function toEquipmentSlotValue(item: { type: string; slot?: number }) {
  if (item.type === 'trinket') {
    return `trinket${item.slot ?? 1}`;
  }

  if (item.type === 'jade') {
    return `jade${item.slot ?? 1}`;
  }

  if (item.type === 'runeStone' || item.type === 'rune') {
    return item.slot ? `${item.type}${item.slot}` : item.type;
  }

  return item.type;
}

function normalizeEquipmentPayload<
  T extends {
    type: string;
    slot?: number;
  },
>(equipment: T[]): T[] {
  const deduped = new Map<string, T>();

  for (const item of equipment) {
    const slotKey = toEquipmentSlotValue(item);
    deduped.set(slotKey, item);
  }

  return Array.from(deduped.values());
}

function toEquipmentAttrRows(item: {
  stats?: Record<string, unknown>;
  baseStats?: Record<string, unknown>;
}) {
  const mergedStats = {
    ...(item.baseStats ?? {}),
    ...(item.stats ?? {}),
  };

  return Object.entries(mergedStats)
    .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
    .map(([attrType, attrValue], index) => ({
      attrGroup: 'base',
      attrType,
      valueType: 'flat' as const,
      attrValue: Number(attrValue),
      displayOrder: index,
    }));
}

const LAB_SEAT_META_SLOT = '__seat__';

async function findActiveLabSession(characterId: string) {
  const [session] = await db()
    .select()
    .from(labSession)
    .where(
      and(eq(labSession.characterId, characterId), eq(labSession.status, 'active'))
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

function buildLabSeatDefaultName(seatId: string, index: number) {
  if (seatId === 'sample') {
    return '样本席位';
  }

  return `对比席位${index + 1}`;
}

function normalizeLabSeatPayload(
  seats: Array<{
    id?: string;
    name?: string;
    isSample?: boolean;
    equipment?: Array<Record<string, unknown>>;
  }>
): SimulatorLabSeatPayload[] {
  const compareSeats: SimulatorLabSeatPayload[] = [];

  for (const seat of seats) {
    const normalizedId = String(seat?.id || '');
    const isSample = Boolean(seat?.isSample) || normalizedId === 'sample';
    const seatId = isSample ? 'sample' : normalizedId || `comp_${compareSeats.length + 1}`;

    const equipment = Array.isArray(seat?.equipment)
      ? normalizeEquipmentPayload(
          seat.equipment as Array<{
            type: string;
            slot?: number;
          }>
        )
      : [];

    const normalizedSeat: SimulatorLabSeatPayload = {
      id: seatId,
      name: String(
        seat?.name ||
          (isSample
            ? '样本席位'
            : buildLabSeatDefaultName(seatId, compareSeats.length))
      ),
      isSample,
      equipment: equipment as Array<Record<string, unknown>>,
    };

    if (isSample) {
      continue;
    }

    compareSeats.push(normalizedSeat);
  }

  return [
    {
      id: 'sample',
      name: '样本席位',
      isSample: true,
      equipment: [],
    },
    ...compareSeats.slice(0, 5),
  ];
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
    const current: SimulatorLabSeatPayload =
      seatMap.get(seatId) ??
      {
        id: seatId,
        name: String(parsed.seatName || (seatId === 'sample' ? '样本席位' : seatId)),
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

  return withTransientD1Retry('listSimulatorBattleTargetTemplates', async () => {
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

    return rows.map(mapBattleTargetTemplateRow);
  });
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

    await db().insert(battleTargetTemplate).values({
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
        payloadJson: JSON.stringify(input.payload ?? parseJsonObject(existing.payloadJson)),
        enabled: input.enabled ?? existing.enabled,
      })
      .where(eq(battleTargetTemplate.id, id));

    const [saved] = await db()
      .select()
      .from(battleTargetTemplate)
      .where(eq(battleTargetTemplate.id, id))
      .limit(1);

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
        const candidateRows = await findCandidateEquipmentRows(row.game_character.id);
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
    const character = await findActiveCharacter(userId);
    if (!character) {
      return null;
    }

    const snapshot = await findCurrentSnapshot(character);
    if (!snapshot) {
      return null;
    }

    const normalizedSeats = normalizeLabSeatPayload(payload.seats);
    const existingSession = await findActiveLabSession(character.id);
    const sessionId = existingSession?.id ?? getUuid();
    const sessionName =
      payload.name?.trim() || existingSession?.name || '默认实验室';
    const sessionNotes = payload.notes ?? existingSession?.notes ?? '';

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
        equipmentId:
          typeof equipment.id === 'string' && equipment.id.length > 0
            ? equipment.id
            : null,
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

    const nextSession = await findActiveLabSession(character.id);
    return buildSimulatorLabSessionBundle(nextSession);
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
    const character = await findActiveCharacter(userId);
    if (!character) {
      return null;
    }

    await db()
      .delete(candidateEquipment)
      .where(eq(candidateEquipment.characterId, character.id));

    if (payload.items.length > 0) {
      await insertValuesInChunks(
        db(),
        candidateEquipment,
        payload.items.map((item, index) => ({
          id: item.id || getUuid(),
          characterId: character.id,
          status: item.status,
          source: 'manual',
          equipmentJson: JSON.stringify(item.equipment ?? {}),
          imageKey: item.imagePreview ?? null,
          rawText: item.rawText ?? null,
          targetSetId: item.targetSetId ?? null,
          targetEquipmentId: item.targetEquipmentId ?? null,
          targetRuneStoneSetIndex: item.targetRuneStoneSetIndex ?? null,
          sort: index,
        }))
      );
    }

    const rows = await findCandidateEquipmentRows(character.id);
    return rows.map(mapCandidateEquipmentRow);
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
    const character = await findActiveCharacter(userId);
    if (!character) {
      return null;
    }

    const currentRows = await findCandidateEquipmentRows(character.id);
    const nextSort = currentRows.length;

    await db().insert(candidateEquipment).values({
      id: getUuid(),
      characterId: character.id,
      status: payload.status || 'pending',
      source: 'ocr',
      equipmentJson: JSON.stringify(payload.equipment ?? {}),
      imageKey: payload.imagePreview ?? null,
      rawText: payload.rawText ?? null,
      sort: nextSort,
    });

    const rows = await findCandidateEquipmentRows(character.id);
    return rows.map(mapCandidateEquipmentRow);
  });
}

export async function listAdminSimulatorPendingEquipment(params?: {
  status?: 'pending' | 'confirmed' | 'replaced';
  limit?: number;
}) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('listAdminSimulatorPendingEquipment', async () => {
    const status = params?.status || 'pending';
    const limit = Math.max(1, Math.min(params?.limit ?? 50, 200));

    const rows = await db()
      .select()
      .from(candidateEquipment)
      .innerJoin(gameCharacter, eq(candidateEquipment.characterId, gameCharacter.id))
      .innerJoin(user, eq(gameCharacter.userId, user.id))
      .where(eq(candidateEquipment.status, status))
      .orderBy(desc(candidateEquipment.updatedAt), asc(candidateEquipment.sort))
      .limit(limit);

    return rows.map(mapAdminCandidateEquipmentRow);
  });
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

      await db().delete(candidateEquipment).where(eq(candidateEquipment.id, id));
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
        .innerJoin(gameCharacter, eq(candidateEquipment.characterId, gameCharacter.id))
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
    }>;
  }
) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('updateSimulatorEquipment', async () => {
    const normalizedEquipment = normalizeEquipmentPayload(payload.equipment);

    const character = await findActiveCharacter(userId);
    if (!character) {
      return null;
    }

    const snapshot = await findCurrentSnapshot(character);
    if (!snapshot) {
      return null;
    }

    await db()
      .delete(equipmentItem)
      .where(eq(equipmentItem.characterId, character.id));

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
          specialEffectJson: JSON.stringify({
            highlights: item.highlights ?? [],
          }),
          setEffectJson: '{}',
          notesJson: '{}',
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
    }

    return getSimulatorCharacterBundle(userId, character.id);
  });
}
