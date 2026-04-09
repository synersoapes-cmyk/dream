import { and, asc, desc, eq, or } from 'drizzle-orm';

import { db } from '@/core/db';
import {
  battleTargetTemplate,
  equipmentItem,
  gameCharacter,
  labSession,
  labSessionEquipment,
  user,
} from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';
import { createPerfTimer } from '@/shared/lib/perf';

import {
  ensureSimulatorDbReady,
  findActiveCharacter,
  findActiveLabSession,
  findCurrentSnapshot,
  insertValuesInChunks,
  parseJsonObject,
  withTransientD1Retry,
} from './simulator-core';
import { clearSimulatorReadCache } from './simulator-main';
import {
  buildSimulatorLabSessionBundle,
  LAB_SEAT_META_SLOT,
  mapAdminLabSessionItem,
  mapBattleTargetTemplateRow,
} from './simulator-mappers';
import {
  normalizeLabSeatPayload,
  resolveLabSessionEquipmentReferenceId,
  toEquipmentSlotValue,
} from './simulator-payload';
import type {
  AdminBattleTargetTemplateItem,
  AdminSimulatorLabSessionItem,
  SimulatorBattleTargetTemplate,
  SimulatorLabSeatPayload,
  SimulatorLabSession,
  SimulatorLabSessionBundle,
} from './simulator-types';

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
      rows.map(async (row: any) => {
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
      const rows = await db()
        .select()
        .from(battleTargetTemplate)
        .where(
          and(
            eq(battleTargetTemplate.enabled, true),
            userId
              ? or(
                  eq(battleTargetTemplate.scope, 'system'),
                  and(
                    eq(battleTargetTemplate.scope, 'user'),
                    eq(battleTargetTemplate.userId, userId)
                  )
                )
              : eq(battleTargetTemplate.scope, 'system')
          )
        )
        .orderBy(
          asc(battleTargetTemplate.dungeonName),
          asc(battleTargetTemplate.name),
          asc(battleTargetTemplate.level)
        );

      return rows.map(mapBattleTargetTemplateRow);
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
