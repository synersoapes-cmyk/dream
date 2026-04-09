import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import { db } from '@/core/db';
import {
  characterCultivation,
  characterProfile,
  characterSkill,
  characterSnapshot,
  equipmentAttr,
  equipmentBuild,
  equipmentItem,
  jadeAttr,
  jadeItem,
  ornamentItem,
  ornamentSetEffect,
  ornamentSubAttr,
  snapshotBattleContext,
  snapshotEquipmentSlot,
  snapshotJadeSlot,
  snapshotOrnamentSlot,
  starResonanceRule,
  starStoneAttr,
  starStoneItem,
  characterStarResonance,
} from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';

import { chunkArray } from './simulator-core';
import {
  buildJadeAttrRows,
  buildOrnamentAttrRows,
  buildOrnamentSetEffectRows,
  buildStarStonePersistenceRows,
  isJadeSlot,
  isOrnamentSlot,
  resolveOrnamentMainAttr,
  toGenericEquipmentBuild,
  toGenericEquipmentRow,
  toOrnamentSetEffectSource,
  toPersistedJadeSlot,
  toPersistedOrnamentSlot,
} from './simulator-equipment-persistence';
import type {
  SimulatorBattleContext,
  SimulatorCharacter,
  SimulatorCultivation,
  SimulatorEquipment,
  SimulatorEquipmentAttr,
  SimulatorEquipmentBuild,
  SimulatorJadeAttrRow,
  SimulatorOcrJob,
  SimulatorOrnamentRow,
  SimulatorOrnamentSubAttrRow,
  SimulatorProfile,
  SimulatorRollbackSnapshotSummary,
  SimulatorSkill,
  SimulatorSnapshot,
  SimulatorStarResonanceRule,
} from './simulator-types';

export type PersistedSnapshotState = {
  profile: SimulatorProfile | null;
  skills: SimulatorSkill[];
  cultivations: SimulatorCultivation[];
  battleContext: SimulatorBattleContext | null;
  equipments: SimulatorEquipment[];
};

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

async function loadEnabledStarResonanceRules() {
  return db()
    .select()
    .from(starResonanceRule)
    .where(eq(starResonanceRule.enabled, true))
    .orderBy(asc(starResonanceRule.sort), asc(starResonanceRule.slot));
}

export async function insertSnapshotState(params: {
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

  const availableStarResonanceRules = await loadEnabledStarResonanceRules();
  const primaryEquipmentValues: Array<typeof equipmentItem.$inferInsert> = [];
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
    const starPersistence = buildStarStonePersistenceRows({
      snapshotId: params.snapshotId,
      characterId: params.characterId,
      equipmentId: nextId,
      slot: snapshotSlot,
      notesJson: nextPrimaryBuild.notesJson,
      availableRules: availableStarResonanceRules,
      createdAt,
      updatedAt,
    });
    starStoneValues.push(...starPersistence.starStoneRows);
    starStoneAttrValues.push(...starPersistence.starStoneAttrRows);
    if (starPersistence.resonanceRow) {
      starResonanceValues.push(starPersistence.resonanceRow);
    }

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
  for (const chunk of chunkArray(starStoneValues)) {
    batchQueries.push(database.insert(starStoneItem).values(chunk));
  }
  for (const chunk of chunkArray(starStoneAttrValues)) {
    batchQueries.push(database.insert(starStoneAttr).values(chunk));
  }
  for (const chunk of chunkArray(starResonanceValues)) {
    batchQueries.push(database.insert(characterStarResonance).values(chunk));
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
  } else {
    for (const query of batchQueries) {
      await query;
    }
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

export async function deleteCurrentSnapshotEquipments(params: {
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
    database
      .delete(characterStarResonance)
      .where(eq(characterStarResonance.snapshotId, params.snapshotId)),
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

export async function createEquipmentRollbackSnapshot(params: {
  character: SimulatorCharacter;
  snapshotState: PersistedSnapshotState;
  name?: string;
  notes?: string;
  source?: string;
}) {
  const now = new Date();
  const nextSnapshotId = getUuid();
  const nextVersionNo = await getNextSnapshotVersionNo(params.character.id);

  await db()
    .insert(characterSnapshot)
    .values({
      id: nextSnapshotId,
      characterId: params.character.id,
      snapshotType: 'history',
      name: params.name ?? formatEquipmentRollbackSnapshotName(now),
      versionNo: nextVersionNo,
      source: params.source ?? 'equipment_backup',
      notes: params.notes ?? '',
      createdAt: now,
      updatedAt: now,
    });

  await insertSnapshotState({
    snapshotId: nextSnapshotId,
    characterId: params.character.id,
    profile: params.snapshotState.profile,
    skills: params.snapshotState.skills,
    cultivations: params.snapshotState.cultivations,
    battleContext: params.snapshotState.battleContext,
    equipments: params.snapshotState.equipments,
    now,
  });
}

export async function findLatestEquipmentRollbackSnapshot(characterId: string) {
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
        eq(characterSnapshot.source, 'equipment_backup')
      )
    )
    .orderBy(
      desc(characterSnapshot.createdAt),
      desc(characterSnapshot.versionNo)
    )
    .limit(1);

  return snapshot as SimulatorRollbackSnapshotSummary | null;
}
