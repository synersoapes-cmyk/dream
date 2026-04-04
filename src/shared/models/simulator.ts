import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import { db } from '@/core/db';
import { initD1ContextForDev } from '@/core/db/d1';
import {
  attributeRule,
  characterCultivation,
  characterProfile,
  characterSkill,
  characterSnapshot,
  equipmentAttr,
  equipmentBuild,
  equipmentItem,
  gameCharacter,
  snapshotEquipmentSlot,
} from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';
import { getRequiredSimulatorSeedConfig } from '@/shared/models/simulator-template';

export type SimulatorCharacter = typeof gameCharacter.$inferSelect;
export type SimulatorSnapshot = typeof characterSnapshot.$inferSelect;
export type SimulatorProfile = typeof characterProfile.$inferSelect;
export type SimulatorSkill = typeof characterSkill.$inferSelect;
export type SimulatorCultivation = typeof characterCultivation.$inferSelect;
export type SimulatorRule = typeof attributeRule.$inferSelect;

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
  rules: SimulatorRule[];
  equipments: SimulatorEquipment[];
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
  maxAttempts = 3,
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
        error,
      );

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

async function insertValuesInChunks(
  database: ReturnType<typeof db>,
  table: any,
  values: any[],
  chunkSize = 8,
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
        eq(gameCharacter.status, 'active'),
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
        eq(characterSnapshot.snapshotType, 'current'),
      ),
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
          eq(attributeRule.enabled, true),
        ),
      )
      .orderBy(asc(attributeRule.sort), asc(attributeRule.sourceAttr));
  } catch (error) {
    console.warn(
      'Failed to load simulator attribute rules, continuing without rules:',
      error,
    );
    return [];
  }
}

export async function getSimulatorCharacterBundle(
  userId: string,
  characterId?: string,
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
          .orderBy(desc(characterSkill.finalLevel), asc(characterSkill.skillName))
      : [];

    const cultivations = snapshot
      ? await db()
          .select()
          .from(characterCultivation)
          .where(eq(characterCultivation.snapshotId, snapshot.id))
          .orderBy(asc(characterCultivation.cultivationType))
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
      (row: SimulatorSnapshotSlot) => row.equipmentId,
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
      (item: SimulatorEquipmentRow) => item.id,
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
        (row: SimulatorSnapshotSlot) => [row.equipmentId, row.slot] as const,
      ),
    );
    const buildByEquipmentId = new Map(
      buildRows.map(
        (row: SimulatorEquipmentBuild) => [row.equipmentId, row] as const,
      ),
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
      }),
    );

    return {
      character,
      snapshot: snapshot ?? null,
      profile: profile ?? null,
      skills,
      cultivations,
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

  const batchQueries = [characterInsert, snapshotInsert, profileInsert];

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
      })),
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
  },
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
    await db().insert(characterProfile).values({
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
  },
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
    { cultivationType: 'petPhysicalDefense', level: payload.petPhysicalDefense },
    { cultivationType: 'petMagicAttack', level: payload.petMagicAttack },
    { cultivationType: 'petMagicDefense', level: payload.petMagicDefense },
  ];

  await db().insert(characterCultivation).values(
    cultivationRows.map((item) => ({
      id: getUuid(),
      snapshotId: snapshot.id,
      cultivationType: item.cultivationType,
      level: item.level,
    })),
  );

  return getSimulatorCharacterBundle(userId, character.id);
}

function toEquipmentSlotValue(item: {
  type: string;
  slot?: number;
}) {
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
  },
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
      const equipmentItemValues = equipmentRows.map(({ equipmentId, slot, item }) => ({
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
      }));
      const equipmentBuildValues = equipmentRows.map(({ equipmentId, item }) => ({
        equipmentId,
        holeCount: 0,
        gemLevelTotal: 0,
        refineLevel: item.forgeLevel ?? 0,
        specialEffectJson: JSON.stringify({
          highlights: item.highlights ?? [],
        }),
        setEffectJson: '{}',
        notesJson: '{}',
      }));

      const attrValues = equipmentRows.flatMap(({ equipmentId, attrRows }) =>
        attrRows.map((attr) => ({
          id: getUuid(),
          equipmentId,
          ...attr,
        })),
      );
      const snapshotSlotValues = equipmentRows.map(({ equipmentId, slot }) => ({
        id: getUuid(),
        snapshotId: snapshot.id,
        slot,
        equipmentId,
      }));

      await insertValuesInChunks(database, equipmentItem, equipmentItemValues);
      await insertValuesInChunks(database, equipmentBuild, equipmentBuildValues);
      if (attrValues.length > 0) {
        await insertValuesInChunks(database, equipmentAttr, attrValues);
      }
      await insertValuesInChunks(database, snapshotEquipmentSlot, snapshotSlotValues);
    }

    return getSimulatorCharacterBundle(userId, character.id);
  });
}
