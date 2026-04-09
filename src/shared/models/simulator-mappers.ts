import { asc, eq } from 'drizzle-orm';

import { db } from '@/core/db';
import { labSessionEquipment, user } from '@/config/db/schema';

import { parseJsonObject } from './simulator-core';
import type {
  AdminBattleTargetTemplateItem,
  AdminSimulatorLabSessionItem,
  AdminSimulatorPendingReviewItem,
  SimulatorBattleTargetTemplate,
  SimulatorCandidateEquipment,
  SimulatorCandidateEquipmentItem,
  SimulatorCharacter,
  SimulatorLabSeatPayload,
  SimulatorLabSession,
  SimulatorLabSessionBundle,
} from './simulator-types';

export const LAB_SEAT_META_SLOT = '__seat__';

export async function buildSimulatorLabSessionBundle(
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

export function mapCandidateEquipmentRow(
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

export function mapAdminCandidateEquipmentRow(row: {
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

export function mapAdminLabSessionItem(params: {
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

export function mapBattleTargetTemplateRow(
  row: SimulatorBattleTargetTemplate
): AdminBattleTargetTemplateItem {
  return {
    id: row.id,
    userId: row.userId ?? null,
    scope: row.scope,
    sceneType: row.sceneType,
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
