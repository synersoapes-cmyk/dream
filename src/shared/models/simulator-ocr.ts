import { and, asc, desc, eq, inArray, like, or } from 'drizzle-orm';

import { db } from '@/core/db';
import {
  candidateEquipment,
  gameCharacter,
  inventoryEntry,
  inventoryEquipmentAsset,
  ocrDictionary,
  ocrDraftItem,
  ocrJob,
  user,
} from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';

import { syncInventoryEntriesForCharacter } from './simulator-candidate';
import {
  ensureSimulatorDbReady,
  findActiveCharacter,
  findCandidateEquipmentRows,
  findSimulatorOcrJobById,
  inferOcrDraftConfidence,
  mapInventoryStatusToCandidateStatus,
  parseJsonObject,
  withTransientD1Retry,
} from './simulator-core';
import { mapCandidateEquipmentRow } from './simulator-mappers';
import type {
  AdminSimulatorInventoryEntryItem,
  AdminSimulatorOcrDictionaryItem,
  AdminSimulatorOcrJobItem,
  SimulatorCandidateEquipment,
  SimulatorInventoryEntry,
  SimulatorInventoryEquipmentAsset,
  SimulatorOcrDraftItem,
} from './simulator-types';

function mapAdminSimulatorOcrDictionaryItem(row: {
  id: string;
  dictType: string;
  rawText: string;
  normalizedText: string;
  priority: number;
  enabled: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}): AdminSimulatorOcrDictionaryItem {
  return {
    id: row.id,
    dictType: row.dictType,
    rawText: row.rawText,
    normalizedText: row.normalizedText,
    priority: Number(row.priority ?? 0),
    enabled: Boolean(row.enabled),
    createdBy: row.createdBy,
    createdAt: row.createdAt?.getTime?.() ?? 0,
    updatedAt: row.updatedAt?.getTime?.() ?? 0,
  };
}

function mapAdminSimulatorInventoryEntryRow(row: {
  inventory_entry: SimulatorInventoryEntry;
  game_character: { id: string; name: string };
  user: typeof user.$inferSelect;
  inventory_equipment_asset: SimulatorInventoryEquipmentAsset | null;
  candidate_equipment: SimulatorCandidateEquipment | null;
}): AdminSimulatorInventoryEntryItem {
  const payload = row.inventory_equipment_asset
    ? parseJsonObject(row.inventory_equipment_asset.payloadJson)
    : row.candidate_equipment
      ? parseJsonObject(row.candidate_equipment.equipmentJson)
      : {};

  const equipmentName =
    row.inventory_equipment_asset?.itemName?.trim() ||
    String(payload.name || '未命名装备');
  const equipmentType =
    row.inventory_equipment_asset?.itemSubtype?.trim() ||
    String(payload.type || '');

  return {
    id: row.inventory_entry.id,
    characterId: row.game_character.id,
    characterName: row.game_character.name,
    userId: row.user.id,
    userName: row.user.name,
    userEmail: row.user.email,
    itemType: row.inventory_entry.itemType,
    itemRefId: row.inventory_entry.itemRefId,
    sourceCandidateId: row.inventory_equipment_asset?.sourceCandidateId ?? null,
    sourceDraftId:
      row.inventory_entry.sourceDraftId ??
      row.inventory_equipment_asset?.sourceDraftId ??
      null,
    folderKey: row.inventory_entry.folderKey,
    price:
      row.inventory_entry.price === null ||
      row.inventory_entry.price === undefined
        ? null
        : Number(row.inventory_entry.price),
    status: row.inventory_entry.status,
    createdAt: row.inventory_entry.createdAt?.getTime?.() ?? 0,
    updatedAt: row.inventory_entry.updatedAt?.getTime?.() ?? 0,
    equipmentName,
    equipmentType,
    candidateStatus: row.candidate_equipment?.status ?? null,
  };
}

function buildInventoryEntryJoinedQuery() {
  return db()
    .select()
    .from(inventoryEntry)
    .innerJoin(gameCharacter, eq(inventoryEntry.characterId, gameCharacter.id))
    .innerJoin(user, eq(gameCharacter.userId, user.id))
    .leftJoin(
      inventoryEquipmentAsset,
      eq(inventoryEntry.itemRefId, inventoryEquipmentAsset.id)
    )
    .leftJoin(
      candidateEquipment,
      eq(inventoryEquipmentAsset.sourceCandidateId, candidateEquipment.id)
    );
}

function mapInventoryListRow(row: {
  inventory_entry: SimulatorInventoryEntry;
  game_character: { id: string; name: string };
  user: typeof user.$inferSelect;
  inventory_equipment_asset: SimulatorInventoryEquipmentAsset | null;
  candidate_equipment: SimulatorCandidateEquipment | null;
}) {
  return mapAdminSimulatorInventoryEntryRow(
    row
  ) as AdminSimulatorInventoryEntryItem;
}

export async function createSimulatorOcrJob(
  userId: string,
  params: {
    sceneType: 'profile' | 'equipment' | 'ornament' | 'jade';
    imageUrl?: string;
  }
) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('createSimulatorOcrJob', async () => {
    const character = await findActiveCharacter(userId);
    if (!character) {
      return null;
    }

    const id = getUuid();
    await db()
      .insert(ocrJob)
      .values({
        id,
        characterId: character.id,
        sceneType: params.sceneType,
        imageUrl: params.imageUrl?.trim() ?? '',
        status: 'pending',
        rawResultJson: '{}',
        errorMessage: '',
      });

    return findSimulatorOcrJobById(id);
  });
}

export async function markSimulatorOcrJobFailed(params: {
  ocrJobId: string;
  errorMessage: string;
  rawResult?: Record<string, unknown>;
  imageUrl?: string;
}) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('markSimulatorOcrJobFailed', async () => {
    const existing = await findSimulatorOcrJobById(params.ocrJobId);
    if (!existing) {
      return null;
    }

    await db()
      .update(ocrJob)
      .set({
        status: 'failed',
        imageUrl: params.imageUrl?.trim() || existing.imageUrl,
        rawResultJson: JSON.stringify(
          params.rawResult ?? parseJsonObject(existing.rawResultJson)
        ),
        errorMessage: params.errorMessage.trim(),
      })
      .where(eq(ocrJob.id, params.ocrJobId));

    return findSimulatorOcrJobById(params.ocrJobId);
  });
}

export async function finalizeSimulatorEquipmentOcrJob(params: {
  ocrJobId: string;
  recognizedEquipment: Record<string, unknown>;
  rawResult: Record<string, unknown>;
  imageUrl: string;
  imageKey?: string;
}) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('finalizeSimulatorEquipmentOcrJob', async () => {
    const job = await findSimulatorOcrJobById(params.ocrJobId);
    if (!job) {
      return null;
    }

    await db()
      .update(ocrJob)
      .set({
        sceneType: 'equipment',
        imageUrl: params.imageUrl,
        status: 'success',
        rawResultJson: JSON.stringify(params.rawResult ?? {}),
        errorMessage: '',
      })
      .where(eq(ocrJob.id, params.ocrJobId));

    const draftId = getUuid();
    await db()
      .insert(ocrDraftItem)
      .values({
        id: draftId,
        ocrJobId: params.ocrJobId,
        characterId: job.characterId,
        itemType: 'equipment',
        draftBodyJson: JSON.stringify(params.recognizedEquipment ?? {}),
        confidenceScore: inferOcrDraftConfidence(params.rawResult),
        reviewStatus: 'approved',
        reviewNote: '前台 OCR 已自动同步到候选装备库',
      });

    const currentRows = await findCandidateEquipmentRows(job.characterId);
    const nextSort = currentRows.length;
    const candidateId = getUuid();

    await db()
      .insert(candidateEquipment)
      .values({
        id: candidateId,
        characterId: job.characterId,
        status: 'pending',
        source: 'ocr',
        equipmentJson: JSON.stringify(params.recognizedEquipment ?? {}),
        imageKey: params.imageKey ?? params.imageUrl,
        rawText: JSON.stringify(params.rawResult ?? {}),
        ocrJobId: params.ocrJobId,
        ocrDraftItemId: draftId,
        sort: nextSort,
      });

    await syncInventoryEntriesForCharacter(job.characterId, [
      ...currentRows.map((row: SimulatorCandidateEquipment) => ({
        id: row.id,
        status: row.status as 'pending' | 'confirmed' | 'replaced',
        equipment: parseJsonObject(row.equipmentJson),
        ocrDraftItemId: row.ocrDraftItemId ?? null,
      })),
      {
        id: candidateId,
        status: 'pending' as const,
        equipment: params.recognizedEquipment ?? {},
        ocrDraftItemId: draftId,
      },
    ]);

    const nextItems = [
      ...currentRows.map(mapCandidateEquipmentRow),
      {
        id: candidateId,
        equipment: params.recognizedEquipment ?? {},
        timestamp: Date.now(),
        imagePreview: params.imageKey ?? params.imageUrl,
        rawText: JSON.stringify(params.rawResult ?? {}),
        status: 'pending' as const,
      },
    ];

    return {
      item: nextItems[nextItems.length - 1] ?? null,
      items: nextItems,
      draftId,
    };
  });
}

export async function listAdminSimulatorOcrJobs(params?: {
  status?: 'all' | 'pending' | 'success' | 'failed' | 'reviewing';
  limit?: number;
}) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('listAdminSimulatorOcrJobs', async () => {
    const status = params?.status ?? 'all';
    const limit = Math.max(1, Math.min(params?.limit ?? 50, 200));

    const rows = await db()
      .select()
      .from(ocrJob)
      .innerJoin(gameCharacter, eq(ocrJob.characterId, gameCharacter.id))
      .innerJoin(user, eq(gameCharacter.userId, user.id))
      .where(status === 'all' ? undefined : eq(ocrJob.status, status))
      .orderBy(desc(ocrJob.updatedAt), desc(ocrJob.createdAt))
      .limit(limit);

    const jobIds = rows.map((row: any) => row.ocr_job.id);
    const draftRows =
      jobIds.length > 0
        ? await db()
            .select()
            .from(ocrDraftItem)
            .where(inArray(ocrDraftItem.ocrJobId, jobIds))
            .orderBy(desc(ocrDraftItem.createdAt))
        : [];
    const draftIds = draftRows.map((row: SimulatorOcrDraftItem) => row.id);
    const candidateRows =
      draftIds.length > 0
        ? await db()
            .select({
              ocrDraftItemId: candidateEquipment.ocrDraftItemId,
              status: candidateEquipment.status,
            })
            .from(candidateEquipment)
            .where(inArray(candidateEquipment.ocrDraftItemId, draftIds))
        : [];
    const candidateStatusByDraftId = new Map(
      candidateRows
        .filter((row: { ocrDraftItemId: string | null; status: string }) =>
          Boolean(row.ocrDraftItemId)
        )
        .map((row: { ocrDraftItemId: string | null; status: string }) => [
          row.ocrDraftItemId as string,
          row.status,
        ])
    );

    const draftsByJobId = new Map<string, typeof draftRows>();
    for (const draft of draftRows) {
      const current = draftsByJobId.get(draft.ocrJobId) ?? [];
      current.push(draft);
      draftsByJobId.set(draft.ocrJobId, current);
    }

    return rows.map(
      (row: any): AdminSimulatorOcrJobItem => ({
        id: row.ocr_job.id,
        characterId: row.game_character.id,
        characterName: row.game_character.name,
        userId: row.user.id,
        userName: row.user.name,
        userEmail: row.user.email,
        sceneType: row.ocr_job.sceneType,
        status: row.ocr_job.status,
        imageUrl: row.ocr_job.imageUrl,
        errorMessage: row.ocr_job.errorMessage,
        rawResult: parseJsonObject(row.ocr_job.rawResultJson),
        createdAt: row.ocr_job.createdAt?.getTime?.() ?? 0,
        updatedAt: row.ocr_job.updatedAt?.getTime?.() ?? 0,
        draftItems: (draftsByJobId.get(row.ocr_job.id) ?? []).map(
          (draft: SimulatorOcrDraftItem) => ({
            id: draft.id,
            itemType: draft.itemType,
            reviewStatus: draft.reviewStatus,
            confidenceScore: Number(draft.confidenceScore ?? 0),
            candidateStatus: candidateStatusByDraftId.get(draft.id) ?? null,
          })
        ),
      })
    );
  });
}

export async function listAdminSimulatorOcrDictionary(params?: {
  dictType?: 'all' | 'equipment_name' | 'skill_name' | 'attr_name' | 'set_name';
  enabled?: boolean;
  limit?: number;
}) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('listAdminSimulatorOcrDictionary', async () => {
    const limit = Math.max(1, Math.min(params?.limit ?? 100, 300));
    const conditions = [];

    if (params?.dictType && params.dictType !== 'all') {
      conditions.push(eq(ocrDictionary.dictType, params.dictType));
    }

    if (typeof params?.enabled === 'boolean') {
      conditions.push(eq(ocrDictionary.enabled, params.enabled));
    }

    const rows = await db()
      .select()
      .from(ocrDictionary)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        desc(ocrDictionary.enabled),
        desc(ocrDictionary.priority),
        asc(ocrDictionary.dictType),
        asc(ocrDictionary.rawText)
      )
      .limit(limit);

    return rows.map(mapAdminSimulatorOcrDictionaryItem);
  });
}

export async function listAdminSimulatorInventoryEntries(params?: {
  status?: 'all' | 'active' | 'sold' | 'discarded';
  keyword?: string;
  limit?: number;
}) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry(
    'listAdminSimulatorInventoryEntries',
    async () => {
      const status = params?.status ?? 'all';
      const keyword = params?.keyword?.trim() ?? '';
      const limit = Math.max(1, Math.min(params?.limit ?? 100, 300));
      const conditions = [];

      if (status !== 'all') {
        conditions.push(eq(inventoryEntry.status, status));
      }

      if (keyword) {
        const pattern = `%${keyword}%`;
        conditions.push(
          or(
            like(user.name, pattern),
            like(user.email, pattern),
            like(gameCharacter.name, pattern),
            like(inventoryEntry.folderKey, pattern),
            like(inventoryEntry.itemRefId, pattern),
            like(inventoryEquipmentAsset.itemName, pattern),
            like(inventoryEquipmentAsset.itemSubtype, pattern),
            like(inventoryEquipmentAsset.payloadJson, pattern),
            like(candidateEquipment.equipmentJson, pattern)
          )
        );
      }

      const rows = await buildInventoryEntryJoinedQuery()
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(inventoryEntry.updatedAt), desc(inventoryEntry.createdAt))
        .limit(limit);

      return rows.map(mapInventoryListRow);
    }
  );
}

export async function updateAdminSimulatorInventoryEntry(
  id: string,
  input: {
    folderKey?: string;
    price?: number | null;
    status?: 'active' | 'sold' | 'discarded';
  }
) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry(
    'updateAdminSimulatorInventoryEntry',
    async () => {
      const [existing] = await db()
        .select()
        .from(inventoryEntry)
        .where(eq(inventoryEntry.id, id))
        .limit(1);

      if (!existing) {
        return null;
      }

      const nextStatus =
        input.status ?? (existing.status as 'active' | 'sold' | 'discarded');

      await db()
        .update(inventoryEntry)
        .set({
          folderKey: input.folderKey?.trim() || existing.folderKey,
          price:
            input.price === undefined
              ? existing.price
              : input.price === null
                ? null
                : Math.round(input.price),
          status: nextStatus,
        })
        .where(eq(inventoryEntry.id, id));

      const [linkedAsset] = await db()
        .select({
          sourceCandidateId: inventoryEquipmentAsset.sourceCandidateId,
        })
        .from(inventoryEquipmentAsset)
        .where(eq(inventoryEquipmentAsset.id, existing.itemRefId))
        .limit(1);

      if (linkedAsset?.sourceCandidateId) {
        const [linkedCandidate] = await db()
          .select({
            id: candidateEquipment.id,
            status: candidateEquipment.status,
          })
          .from(candidateEquipment)
          .where(eq(candidateEquipment.id, linkedAsset.sourceCandidateId))
          .limit(1);

        if (linkedCandidate) {
          const nextCandidateStatus =
            mapInventoryStatusToCandidateStatus(nextStatus);
          if (linkedCandidate.status !== nextCandidateStatus) {
            await db()
              .update(candidateEquipment)
              .set({
                status: nextCandidateStatus,
              })
              .where(eq(candidateEquipment.id, linkedCandidate.id));
          }
        }
      }

      const [row] = await buildInventoryEntryJoinedQuery()
        .where(eq(inventoryEntry.id, id))
        .limit(1);

      return row ? mapInventoryListRow(row as any) : null;
    }
  );
}

export async function listEnabledSimulatorOcrDictionaryEntries(params?: {
  dictType?: 'equipment_name' | 'skill_name' | 'attr_name' | 'set_name';
}) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry(
    'listEnabledSimulatorOcrDictionaryEntries',
    async () => {
      const conditions = [eq(ocrDictionary.enabled, true)];
      if (params?.dictType) {
        conditions.push(eq(ocrDictionary.dictType, params.dictType));
      }

      return db()
        .select()
        .from(ocrDictionary)
        .where(and(...conditions))
        .orderBy(desc(ocrDictionary.priority), desc(ocrDictionary.updatedAt));
    }
  );
}

export async function createAdminSimulatorOcrDictionary(input: {
  dictType: 'equipment_name' | 'skill_name' | 'attr_name' | 'set_name';
  rawText: string;
  normalizedText: string;
  priority?: number;
  enabled?: boolean;
  createdBy?: string;
}) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('createAdminSimulatorOcrDictionary', async () => {
    const id = getUuid();
    await db()
      .insert(ocrDictionary)
      .values({
        id,
        dictType: input.dictType,
        rawText: input.rawText.trim(),
        normalizedText: input.normalizedText.trim(),
        priority: input.priority ?? 0,
        enabled: input.enabled ?? true,
        createdBy: input.createdBy?.trim() || 'system',
      });

    const [saved] = await db()
      .select()
      .from(ocrDictionary)
      .where(eq(ocrDictionary.id, id))
      .limit(1);

    if (!saved) {
      throw new Error('failed to create OCR dictionary');
    }

    return mapAdminSimulatorOcrDictionaryItem(
      saved
    ) as AdminSimulatorOcrDictionaryItem;
  });
}

export async function updateAdminSimulatorOcrDictionary(
  id: string,
  input: {
    dictType?: 'equipment_name' | 'skill_name' | 'attr_name' | 'set_name';
    rawText?: string;
    normalizedText?: string;
    priority?: number;
    enabled?: boolean;
  }
) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('updateAdminSimulatorOcrDictionary', async () => {
    const [existing] = await db()
      .select()
      .from(ocrDictionary)
      .where(eq(ocrDictionary.id, id))
      .limit(1);

    if (!existing) {
      return null;
    }

    await db()
      .update(ocrDictionary)
      .set({
        dictType: input.dictType ?? existing.dictType,
        rawText: input.rawText?.trim() ?? existing.rawText,
        normalizedText: input.normalizedText?.trim() ?? existing.normalizedText,
        priority: input.priority ?? existing.priority,
        enabled: input.enabled ?? existing.enabled,
      })
      .where(eq(ocrDictionary.id, id));

    const [saved] = await db()
      .select()
      .from(ocrDictionary)
      .where(eq(ocrDictionary.id, id))
      .limit(1);

    return saved
      ? (mapAdminSimulatorOcrDictionaryItem(
          saved
        ) as AdminSimulatorOcrDictionaryItem)
      : null;
  });
}

export async function deleteAdminSimulatorOcrDictionary(id: string) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('deleteAdminSimulatorOcrDictionary', async () => {
    const [existing] = await db()
      .select({ id: ocrDictionary.id })
      .from(ocrDictionary)
      .where(eq(ocrDictionary.id, id))
      .limit(1);

    if (!existing) {
      return false;
    }

    await db().delete(ocrDictionary).where(eq(ocrDictionary.id, id));
    return true;
  });
}
