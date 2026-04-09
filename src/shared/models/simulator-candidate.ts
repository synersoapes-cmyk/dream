import { and, asc, desc, eq, like, or } from 'drizzle-orm';

import { db } from '@/core/db';
import {
  candidateEquipment,
  gameCharacter,
  inventoryEntry,
  inventoryEquipmentAsset,
  ocrDraftItem,
  user,
} from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';
import { createPerfTimer } from '@/shared/lib/perf';

import {
  deriveInventoryFolderKey,
  ensureSimulatorDbReady,
  findActiveCharacter,
  findCandidateEquipmentRows,
  insertValuesInChunks,
  mapCandidateStatusToDraftReviewStatus,
  parseJsonObject,
  withTransientD1Retry,
} from './simulator-core';
import {
  mapAdminCandidateEquipmentRow,
  mapCandidateEquipmentRow,
} from './simulator-mappers';
import type {
  AdminSimulatorPendingReviewItem,
  SimulatorCandidateEquipment,
  SimulatorCandidateEquipmentItem,
  SimulatorInventoryEquipmentAsset,
} from './simulator-types';

function toOptionalInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function buildInventoryAssetPayload(
  equipment: Record<string, unknown>,
  sourceDraftId?: string | null
) {
  return {
    itemType: 'equipment',
    sourceDraftId: sourceDraftId ?? null,
    itemName: String(equipment.name || '').trim(),
    itemSubtype: String(equipment.type || '').trim(),
    slotKey:
      equipment.slot === undefined || equipment.slot === null
        ? ''
        : String(equipment.slot).trim(),
    payloadJson: JSON.stringify(equipment ?? {}),
    priceSnapshot: toOptionalInteger(equipment.price),
  };
}

export async function syncInventoryEntriesForCharacter(
  characterId: string,
  items: Array<{
    id: string;
    status: 'pending' | 'confirmed' | 'replaced';
    equipment: Record<string, unknown>;
    ocrDraftItemId?: string | null;
  }>
) {
  const existingAssets = await db()
    .select()
    .from(inventoryEquipmentAsset)
    .where(
      and(
        eq(inventoryEquipmentAsset.characterId, characterId),
        eq(inventoryEquipmentAsset.itemType, 'equipment')
      )
    );

  const existingEntries = await db()
    .select()
    .from(inventoryEntry)
    .where(
      and(
        eq(inventoryEntry.characterId, characterId),
        eq(inventoryEntry.itemType, 'equipment')
      )
    );

  const typedExistingAssets =
    existingAssets as SimulatorInventoryEquipmentAsset[];
  const assetBySourceCandidateId = new Map(
    typedExistingAssets
      .filter((asset) => Boolean(asset.sourceCandidateId))
      .map((asset) => [asset.sourceCandidateId as string, asset] as const)
  );
  const assetById = new Map(
    typedExistingAssets.map((asset) => [asset.id, asset] as const)
  );
  const typedExistingEntries = existingEntries as Array<{
    id: string;
    itemRefId: string;
    sourceDraftId: string | null;
    status: string;
  }>;
  const entryByItemRefId = new Map(
    typedExistingEntries.map((entry) => [entry.itemRefId, entry] as const)
  );

  const activeItemIds = new Set<string>();

  for (const item of items) {
    const nextFolderKey = deriveInventoryFolderKey(item.equipment);
    const nextPrice = toOptionalInteger(item.equipment.price);

    if (item.status === 'confirmed') {
      activeItemIds.add(item.id);
      const assetPayload = buildInventoryAssetPayload(
        item.equipment,
        item.ocrDraftItemId
      );
      const existingAsset = assetBySourceCandidateId.get(item.id);

      let assetId = existingAsset?.id;
      if (existingAsset) {
        await db()
          .update(inventoryEquipmentAsset)
          .set({
            sourceCandidateId: item.id,
            ...assetPayload,
          })
          .where(eq(inventoryEquipmentAsset.id, existingAsset.id));
      } else {
        assetId = getUuid();
        await db()
          .insert(inventoryEquipmentAsset)
          .values({
            id: assetId,
            characterId,
            sourceCandidateId: item.id,
            ...assetPayload,
          });
      }

      if (!assetId) {
        continue;
      }

      const existing = entryByItemRefId.get(assetId);
      if (existing) {
        await db()
          .update(inventoryEntry)
          .set({
            folderKey: nextFolderKey,
            price: nextPrice,
            status: 'active',
            sourceDraftId: item.ocrDraftItemId ?? existing.sourceDraftId,
          })
          .where(eq(inventoryEntry.id, existing.id));
      } else {
        await db()
          .insert(inventoryEntry)
          .values({
            id: getUuid(),
            characterId,
            itemType: 'equipment',
            itemRefId: assetId,
            sourceDraftId: item.ocrDraftItemId ?? null,
            folderKey: nextFolderKey,
            price: nextPrice,
            status: 'active',
          });
      }
    } else {
      const existingAsset = assetBySourceCandidateId.get(item.id);
      if (existingAsset) {
        await db()
          .update(inventoryEquipmentAsset)
          .set({
            sourceCandidateId: item.id,
            ...buildInventoryAssetPayload(item.equipment, item.ocrDraftItemId),
          })
          .where(eq(inventoryEquipmentAsset.id, existingAsset.id));
      }

      const existing = existingAsset
        ? entryByItemRefId.get(existingAsset.id)
        : null;
      if (existing) {
        await db()
          .update(inventoryEntry)
          .set({
            folderKey: nextFolderKey,
            price: nextPrice,
            status: 'discarded',
            sourceDraftId: item.ocrDraftItemId ?? existing.sourceDraftId,
          })
          .where(eq(inventoryEntry.id, existing.id));
      }
    }
  }

  for (const entry of typedExistingEntries) {
    const asset = assetById.get(entry.itemRefId);
    const sourceCandidateId = asset?.sourceCandidateId ?? null;

    if (!sourceCandidateId || activeItemIds.has(sourceCandidateId)) {
      continue;
    }

    const matched = items.find((item) => item.id === sourceCandidateId);
    if (!matched && entry.status !== 'discarded') {
      await db()
        .update(inventoryEntry)
        .set({ status: 'discarded' })
        .where(eq(inventoryEntry.id, entry.id));
    }
  }
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

    const existingRows = await findCandidateEquipmentRows(character.id);
    const existingRowById = new Map<string, SimulatorCandidateEquipment>(
      existingRows.map((row: SimulatorCandidateEquipment) => [row.id, row])
    );

    await db()
      .delete(candidateEquipment)
      .where(eq(candidateEquipment.characterId, character.id));

    const persistedItems: Array<typeof candidateEquipment.$inferInsert> =
      payload.items.map((item, index) => {
        const id = item.id || getUuid();
        const existing: SimulatorCandidateEquipment | undefined =
          existingRowById.get(id);

        return {
          id,
          characterId: character.id,
          status: item.status,
          source:
            existing?.source === 'ocr' || existing?.source === 'manual'
              ? existing.source
              : ('manual' as const),
          equipmentJson: JSON.stringify(item.equipment ?? {}),
          imageKey: item.imagePreview ?? existing?.imageKey ?? null,
          rawText: item.rawText ?? existing?.rawText ?? null,
          targetSetId: item.targetSetId ?? existing?.targetSetId ?? null,
          targetEquipmentId:
            item.targetEquipmentId ?? existing?.targetEquipmentId ?? null,
          targetRuneStoneSetIndex:
            item.targetRuneStoneSetIndex ??
            existing?.targetRuneStoneSetIndex ??
            null,
          ocrJobId: existing?.ocrJobId ?? null,
          ocrDraftItemId: existing?.ocrDraftItemId ?? null,
          sort: index,
        };
      });

    if (persistedItems.length > 0) {
      await insertValuesInChunks(db(), candidateEquipment, persistedItems);
    }

    await syncInventoryEntriesForCharacter(
      character.id,
      persistedItems.map((item: typeof candidateEquipment.$inferInsert) => ({
        id: item.id,
        status: item.status as 'pending' | 'confirmed' | 'replaced',
        equipment: parseJsonObject(item.equipmentJson),
        ocrDraftItemId: item.ocrDraftItemId ?? null,
      }))
    );

    const now = Date.now();
    const items = persistedItems.map(
      (item: typeof candidateEquipment.$inferInsert) => ({
        id: item.id,
        equipment: parseJsonObject(item.equipmentJson),
        timestamp: now,
        imagePreview: item.imageKey ?? undefined,
        rawText: item.rawText ?? undefined,
        targetSetId: item.targetSetId ?? undefined,
        targetEquipmentId: item.targetEquipmentId ?? undefined,
        targetRuneStoneSetIndex: item.targetRuneStoneSetIndex ?? undefined,
        status: item.status,
      })
    ) as SimulatorCandidateEquipmentItem[];
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
    ocrJobId?: string;
    ocrDraftItemId?: string;
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
        ocrJobId: payload.ocrJobId ?? null,
        ocrDraftItemId: payload.ocrDraftItemId ?? null,
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

export async function listAdminSimulatorCandidateEquipment(params?: {
  status?: 'all' | 'pending' | 'confirmed' | 'replaced';
  keyword?: string;
  limit?: number;
}) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry(
    'listAdminSimulatorCandidateEquipment',
    async () => {
      const status = params?.status || 'all';
      const keyword = params?.keyword?.trim() ?? '';
      const limit = Math.max(1, Math.min(params?.limit ?? 50, 1000));
      const conditions = [];

      if (status !== 'all') {
        conditions.push(eq(candidateEquipment.status, status));
      }

      if (keyword) {
        const pattern = `%${keyword}%`;
        conditions.push(
          or(
            like(user.name, pattern),
            like(user.email, pattern),
            like(gameCharacter.name, pattern),
            like(candidateEquipment.equipmentJson, pattern),
            like(candidateEquipment.rawText, pattern)
          )
        );
      }

      const rows = await db()
        .select()
        .from(candidateEquipment)
        .innerJoin(
          gameCharacter,
          eq(candidateEquipment.characterId, gameCharacter.id)
        )
        .innerJoin(user, eq(gameCharacter.userId, user.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
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
        .select({
          id: candidateEquipment.id,
          characterId: candidateEquipment.characterId,
          ocrDraftItemId: candidateEquipment.ocrDraftItemId,
        })
        .from(candidateEquipment)
        .where(eq(candidateEquipment.id, id))
        .limit(1);

      if (!row) {
        return false;
      }

      await db()
        .delete(candidateEquipment)
        .where(eq(candidateEquipment.id, id));

      const draftId = row.ocrDraftItemId;
      if (draftId) {
        await db()
          .update(ocrDraftItem)
          .set({
            reviewStatus: 'rejected',
            reviewNote: '候选装备记录已删除',
          })
          .where(eq(ocrDraftItem.id, draftId));
      }

      const remainingRows = await db()
        .select()
        .from(candidateEquipment)
        .where(eq(candidateEquipment.characterId, row.characterId));
      await syncInventoryEntriesForCharacter(
        row.characterId,
        remainingRows.map((item: SimulatorCandidateEquipment) => ({
          id: item.id,
          status: item.status as 'pending' | 'confirmed' | 'replaced',
          equipment: parseJsonObject(item.equipmentJson),
          ocrDraftItemId: item.ocrDraftItemId ?? null,
        }))
      );
      return true;
    }
  );
}

export async function updateAdminSimulatorCandidateEquipment(params: {
  id: string;
  status: 'pending' | 'confirmed' | 'replaced';
  equipment: Record<string, unknown>;
  rawText?: string;
}) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry(
    'updateAdminSimulatorCandidateEquipment',
    async () => {
      const [existing] = await db()
        .select()
        .from(candidateEquipment)
        .where(eq(candidateEquipment.id, params.id))
        .limit(1);

      if (!existing) {
        return null;
      }

      await db()
        .update(candidateEquipment)
        .set({
          status: params.status,
          equipmentJson: JSON.stringify(params.equipment ?? {}),
          rawText: params.rawText ?? null,
        })
        .where(eq(candidateEquipment.id, params.id));

      if (existing.ocrDraftItemId) {
        await db()
          .update(ocrDraftItem)
          .set({
            draftBodyJson: JSON.stringify(params.equipment ?? {}),
            reviewStatus: mapCandidateStatusToDraftReviewStatus(params.status),
            reviewNote:
              params.status === 'pending'
                ? ''
                : `候选装备审核状态同步为 ${params.status}`,
          })
          .where(eq(ocrDraftItem.id, existing.ocrDraftItemId));
      }

      const allRows = await db()
        .select()
        .from(candidateEquipment)
        .where(eq(candidateEquipment.characterId, existing.characterId));
      const nextRows = allRows.map((item: SimulatorCandidateEquipment) =>
        item.id === params.id
          ? {
              ...item,
              status: params.status,
              equipmentJson: JSON.stringify(params.equipment ?? {}),
              rawText: params.rawText ?? null,
            }
          : item
      );
      await syncInventoryEntriesForCharacter(
        existing.characterId,
        nextRows.map((item: SimulatorCandidateEquipment) => ({
          id: item.id,
          status: item.status as 'pending' | 'confirmed' | 'replaced',
          equipment: parseJsonObject(item.equipmentJson),
          ocrDraftItemId: item.ocrDraftItemId ?? null,
        }))
      );

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

      return row
        ? (mapAdminCandidateEquipmentRow(
            row
          ) as AdminSimulatorPendingReviewItem)
        : null;
    }
  );
}
