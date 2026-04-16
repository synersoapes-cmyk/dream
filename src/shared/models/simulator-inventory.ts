import { and, desc, eq } from 'drizzle-orm';

import { db } from '@/core/db';
import {
  candidateEquipment,
  inventoryEntry,
  inventoryEquipmentAsset,
} from '@/config/db/schema';
import {
  buildSimulatorInventoryMirrorDescriptors,
  readSimulatorInventoryMirrorMeta,
} from '@/shared/lib/simulator-inventory-mirror';

import {
  ensureSimulatorDbReady,
  findActiveCharacter,
  mapInventoryStatusToCandidateStatus,
  parseJsonObject,
  withTransientD1Retry,
} from './simulator-core';
import type {
  SimulatorEquipmentPlanState,
  SimulatorInventoryEntry,
  SimulatorInventoryEquipmentAsset,
  SimulatorInventoryLibraryItem,
} from './simulator-types';

export type SimulatorInventoryLibraryStatusFilter =
  | 'active'
  | 'sold'
  | 'discarded'
  | 'all';

export async function syncMirroredInventoryEntriesForCharacter(params: {
  characterId: string;
  currentEquipment: Array<Record<string, unknown>>;
  equipmentPlan?: SimulatorEquipmentPlanState | null;
}) {
  const nextDescriptors = buildSimulatorInventoryMirrorDescriptors({
    characterId: params.characterId,
    currentEquipment: params.currentEquipment,
    equipmentPlan: params.equipmentPlan ?? null,
  });
  const nextDescriptorByAssetId = new Map(
    nextDescriptors.map((item) => [item.assetId, item] as const)
  );

  const [existingAssets, existingEntries] = await Promise.all([
    db()
      .select()
      .from(inventoryEquipmentAsset)
      .where(
        and(
          eq(inventoryEquipmentAsset.characterId, params.characterId),
          eq(inventoryEquipmentAsset.itemType, 'equipment')
        )
      ),
    db()
      .select()
      .from(inventoryEntry)
      .where(
        and(
          eq(inventoryEntry.characterId, params.characterId),
          eq(inventoryEntry.itemType, 'equipment')
        )
      ),
  ]);

  const managedAssets = (existingAssets as SimulatorInventoryEquipmentAsset[])
    .filter((asset) => {
      if (asset.sourceCandidateId) {
        return false;
      }

      return Boolean(
        readSimulatorInventoryMirrorMeta(parseJsonObject(asset.payloadJson))
      );
    })
    .map((asset) => [asset.id, asset] as const);
  const managedAssetById = new Map(managedAssets);
  const managedEntryByAssetId = new Map(
    (existingEntries as SimulatorInventoryEntry[])
      .filter((entry) => managedAssetById.has(entry.itemRefId))
      .map((entry) => [entry.itemRefId, entry] as const)
  );

  for (const descriptor of nextDescriptors) {
    const existingAsset = managedAssetById.get(descriptor.assetId);
    if (existingAsset) {
      await db()
        .update(inventoryEquipmentAsset)
        .set({
          itemName: descriptor.itemName,
          itemSubtype: descriptor.itemSubtype,
          slotKey: descriptor.slotKey,
          payloadJson: descriptor.payloadJson,
          priceSnapshot: descriptor.price,
        })
        .where(eq(inventoryEquipmentAsset.id, descriptor.assetId));
    } else {
      await db()
        .insert(inventoryEquipmentAsset)
        .values({
          id: descriptor.assetId,
          characterId: params.characterId,
          itemType: 'equipment',
          sourceCandidateId: null,
          sourceDraftId: null,
          itemName: descriptor.itemName,
          itemSubtype: descriptor.itemSubtype,
          slotKey: descriptor.slotKey,
          payloadJson: descriptor.payloadJson,
          priceSnapshot: descriptor.price,
        });
    }

    const existingEntry = managedEntryByAssetId.get(descriptor.assetId);
    if (existingEntry) {
      await db()
        .update(inventoryEntry)
        .set({
          folderKey: descriptor.folderKey,
          price: descriptor.price,
          status: 'active',
        })
        .where(eq(inventoryEntry.id, existingEntry.id));
    } else {
      await db()
        .insert(inventoryEntry)
        .values({
          id: descriptor.entryId,
          characterId: params.characterId,
          itemType: 'equipment',
          itemRefId: descriptor.assetId,
          sourceDraftId: null,
          folderKey: descriptor.folderKey,
          price: descriptor.price,
          status: 'active',
        });
    }
  }

  for (const [assetId] of managedAssets) {
    if (nextDescriptorByAssetId.has(assetId)) {
      continue;
    }

    const linkedEntry = managedEntryByAssetId.get(assetId);
    if (linkedEntry) {
      await db().delete(inventoryEntry).where(eq(inventoryEntry.id, linkedEntry.id));
    }
    await db()
      .delete(inventoryEquipmentAsset)
      .where(eq(inventoryEquipmentAsset.id, assetId));
  }
}

export async function listSimulatorInventoryLibraryItems(params: {
  userId: string;
  characterId?: string;
  status?: SimulatorInventoryLibraryStatusFilter;
}) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry(
    'listSimulatorInventoryLibraryItems',
    async () => {
      const character = params.characterId
        ? {
            id: params.characterId,
          }
        : await findActiveCharacter(params.userId);

      if (!character?.id) {
        return [] as SimulatorInventoryLibraryItem[];
      }

      const conditions = [
        eq(inventoryEntry.characterId, character.id),
        eq(inventoryEntry.itemType, 'equipment'),
        eq(inventoryEquipmentAsset.itemType, 'equipment'),
      ];
      const statusFilter = params.status ?? 'active';
      if (statusFilter !== 'all') {
        conditions.push(eq(inventoryEntry.status, statusFilter));
      }

      const rows = await db()
        .select()
        .from(inventoryEntry)
        .innerJoin(
          inventoryEquipmentAsset,
          eq(inventoryEntry.itemRefId, inventoryEquipmentAsset.id)
        )
        .where(and(...conditions))
        .orderBy(desc(inventoryEntry.updatedAt), desc(inventoryEntry.createdAt));

      return rows.map((row: {
        inventory_entry: SimulatorInventoryEntry;
        inventory_equipment_asset: SimulatorInventoryEquipmentAsset;
      }) => {
        const payload = parseJsonObject(row.inventory_equipment_asset.payloadJson);
        const mirrorMeta = readSimulatorInventoryMirrorMeta(payload);
        const nextEquipment = {
          ...payload,
          id:
            typeof payload.id === 'string' && payload.id.trim().length > 0
              ? payload.id
              : row.inventory_equipment_asset.id,
          name:
            typeof payload.name === 'string' && payload.name.trim().length > 0
              ? payload.name
              : row.inventory_equipment_asset.itemName || '未命名装备',
          type:
            typeof payload.type === 'string' && payload.type.trim().length > 0
              ? payload.type
              : row.inventory_equipment_asset.itemSubtype || 'equipment',
          price:
            payload.price === undefined || payload.price === null
              ? row.inventory_entry.price
              : payload.price,
        };

        return {
          id: row.inventory_entry.id,
          characterId: character.id,
          entryId: row.inventory_entry.id,
          assetId: row.inventory_equipment_asset.id,
          folderKey: row.inventory_entry.folderKey,
          price:
            row.inventory_entry.price === null ||
            row.inventory_entry.price === undefined
              ? null
              : Number(row.inventory_entry.price),
          status: row.inventory_entry.status,
          timestamp:
            row.inventory_entry.updatedAt?.getTime?.() ??
            row.inventory_entry.createdAt?.getTime?.() ??
            0,
          inventorySourceKind:
            mirrorMeta?.sourceKind ??
            (row.inventory_equipment_asset.sourceCandidateId
              ? 'candidate_library'
              : null),
          inventorySourceLabel:
            mirrorMeta?.sourceLabel?.trim() ||
            (row.inventory_equipment_asset.sourceCandidateId
              ? '候选装备库'
              : null),
          equipment: nextEquipment,
        } satisfies SimulatorInventoryLibraryItem;
      });
    }
  );
}

export async function updateSimulatorInventoryLibraryEntry(params: {
  userId: string;
  id: string;
  status?: 'active' | 'sold' | 'discarded';
  price?: number | null;
}) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry(
    'updateSimulatorInventoryLibraryEntry',
    async () => {
      const character = await findActiveCharacter(params.userId);
      if (!character?.id) {
        return null;
      }

      const [existing] = await db()
        .select()
        .from(inventoryEntry)
        .where(
          and(
            eq(inventoryEntry.id, params.id),
            eq(inventoryEntry.characterId, character.id),
            eq(inventoryEntry.itemType, 'equipment')
          )
        )
        .limit(1);

      if (!existing) {
        return null;
      }

      const nextStatus =
        params.status ??
        (existing.status as 'active' | 'sold' | 'discarded');

      await db()
        .update(inventoryEntry)
        .set({
          price:
            params.price === undefined
              ? existing.price
              : params.price === null
                ? null
                : Math.round(params.price),
          status: nextStatus,
        })
        .where(eq(inventoryEntry.id, existing.id));

      const [linkedAsset] = await db()
        .select({
          id: inventoryEquipmentAsset.id,
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

      const [row] = await db()
        .select()
        .from(inventoryEntry)
        .innerJoin(
          inventoryEquipmentAsset,
          eq(inventoryEntry.itemRefId, inventoryEquipmentAsset.id)
        )
        .where(eq(inventoryEntry.id, existing.id))
        .limit(1);

      if (!row) {
        return null;
      }

      const payload = parseJsonObject(row.inventory_equipment_asset.payloadJson);
      const mirrorMeta = readSimulatorInventoryMirrorMeta(payload);

      return {
        id: row.inventory_entry.id,
        characterId: character.id,
        entryId: row.inventory_entry.id,
        assetId: row.inventory_equipment_asset.id,
        folderKey: row.inventory_entry.folderKey,
        price:
          row.inventory_entry.price === null ||
          row.inventory_entry.price === undefined
            ? null
            : Number(row.inventory_entry.price),
        status: row.inventory_entry.status,
        timestamp:
          row.inventory_entry.updatedAt?.getTime?.() ??
          row.inventory_entry.createdAt?.getTime?.() ??
          0,
        inventorySourceKind:
          mirrorMeta?.sourceKind ??
          (row.inventory_equipment_asset.sourceCandidateId
            ? 'candidate_library'
            : null),
        inventorySourceLabel:
          mirrorMeta?.sourceLabel?.trim() ||
          (row.inventory_equipment_asset.sourceCandidateId
            ? '候选装备库'
            : null),
        equipment: {
          ...payload,
          id:
            typeof payload.id === 'string' && payload.id.trim().length > 0
              ? payload.id
              : row.inventory_equipment_asset.id,
          name:
            typeof payload.name === 'string' && payload.name.trim().length > 0
              ? payload.name
              : row.inventory_equipment_asset.itemName || '未命名装备',
          type:
            typeof payload.type === 'string' && payload.type.trim().length > 0
              ? payload.type
              : row.inventory_equipment_asset.itemSubtype || 'equipment',
          price:
            payload.price === undefined || payload.price === null
              ? row.inventory_entry.price
              : payload.price,
        },
      } satisfies SimulatorInventoryLibraryItem;
    }
  );
}
