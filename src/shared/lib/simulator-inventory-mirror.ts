import { md5 } from '@/shared/lib/hash';
import type { SimulatorEquipmentPlanState } from '@/shared/models/simulator-types';

export type SimulatorInventoryMirrorSourceKind =
  | 'candidate_library'
  | 'current_plan'
  | 'equipment_plan';

export type SimulatorInventoryMirrorMeta = {
  mirrorManaged: boolean;
  sourceKind: SimulatorInventoryMirrorSourceKind;
  sourceLabel: string;
  planId?: string | null;
  isActivePlan?: boolean;
};

export type SimulatorInventoryMirrorDescriptor = {
  assetId: string;
  entryId: string;
  sourceKind: SimulatorInventoryMirrorSourceKind;
  sourceLabel: string;
  folderKey: string;
  itemName: string;
  itemSubtype: string;
  slotKey: string;
  price: number | null;
  payloadJson: string;
};

function toOptionalInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function toRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function deriveInventorySlotKey(equipment: Record<string, unknown>) {
  const type = String(equipment.type || 'equipment').trim() || 'equipment';
  const slot =
    equipment.slot === undefined || equipment.slot === null
      ? ''
      : String(equipment.slot).trim();

  return slot ? `${type}:${slot}` : type;
}

function buildInventoryFolderKey(params: {
  sourceKind: SimulatorInventoryMirrorSourceKind;
  planId?: string | null;
  equipment: Record<string, unknown>;
}) {
  const baseSlotKey = deriveInventorySlotKey(params.equipment);

  if (params.sourceKind === 'equipment_plan') {
    return params.planId
      ? `equipment_plan:${params.planId}:${baseSlotKey}`
      : `equipment_plan:${baseSlotKey}`;
  }

  if (params.sourceKind === 'current_plan') {
    return `current_plan:${baseSlotKey}`;
  }

  return baseSlotKey;
}

function buildMirrorIdentityKey(params: {
  characterId: string;
  sourceKind: SimulatorInventoryMirrorSourceKind;
  planId?: string | null;
  equipment: Record<string, unknown>;
}) {
  return [
    params.characterId,
    params.sourceKind,
    params.planId ?? '',
    deriveInventorySlotKey(params.equipment),
  ].join('::');
}

export function buildSimulatorInventoryMirrorPayload(params: {
  equipment: Record<string, unknown>;
  meta: SimulatorInventoryMirrorMeta;
}) {
  return JSON.stringify({
    ...params.equipment,
    _inventoryMeta: params.meta,
  });
}

export function readSimulatorInventoryMirrorMeta(
  payload: Record<string, unknown> | null | undefined
) {
  const meta = toRecord(payload?._inventoryMeta);
  if (meta.mirrorManaged !== true) {
    return null;
  }

  const sourceKind = String(meta.sourceKind || '').trim();
  if (
    sourceKind !== 'current_plan' &&
    sourceKind !== 'equipment_plan' &&
    sourceKind !== 'candidate_library'
  ) {
    return null;
  }

  return {
    mirrorManaged: true,
    sourceKind,
    sourceLabel: String(meta.sourceLabel || '').trim(),
    planId:
      typeof meta.planId === 'string' && meta.planId.trim().length > 0
        ? meta.planId.trim()
        : null,
    isActivePlan: meta.isActivePlan === true,
  } as SimulatorInventoryMirrorMeta;
}

function buildDescriptor(params: {
  characterId: string;
  sourceKind: SimulatorInventoryMirrorSourceKind;
  sourceLabel: string;
  equipment: Record<string, unknown>;
  planId?: string | null;
  isActivePlan?: boolean;
}) {
  const mirrorKey = buildMirrorIdentityKey({
    characterId: params.characterId,
    sourceKind: params.sourceKind,
    planId: params.planId,
    equipment: params.equipment,
  });
  const digest = md5(mirrorKey);
  const itemName = String(params.equipment.name || '').trim() || '未命名装备';
  const itemSubtype =
    String(params.equipment.type || '').trim() || 'equipment';
  const slotKey = deriveInventorySlotKey(params.equipment);

  return {
    assetId: `inv_mirror_asset_${digest}`,
    entryId: `inv_mirror_entry_${digest}`,
    sourceKind: params.sourceKind,
    sourceLabel: params.sourceLabel,
    folderKey: buildInventoryFolderKey({
      sourceKind: params.sourceKind,
      planId: params.planId,
      equipment: params.equipment,
    }),
    itemName,
    itemSubtype,
    slotKey,
    price: toOptionalInteger(
      params.equipment.price ?? params.equipment.priceSnapshot
    ),
    payloadJson: buildSimulatorInventoryMirrorPayload({
      equipment: params.equipment,
      meta: {
        mirrorManaged: true,
        sourceKind: params.sourceKind,
        sourceLabel: params.sourceLabel,
        planId: params.planId ?? null,
        isActivePlan: params.isActivePlan === true,
      },
    }),
  } satisfies SimulatorInventoryMirrorDescriptor;
}

export function buildSimulatorInventoryMirrorDescriptors(params: {
  characterId: string;
  currentEquipment: Array<Record<string, unknown>>;
  equipmentPlan: SimulatorEquipmentPlanState | null | undefined;
}) {
  const descriptors: SimulatorInventoryMirrorDescriptor[] = [];
  const seenAssetIds = new Set<string>();
  const activeSetIndex = Math.max(0, params.equipmentPlan?.activeSetIndex ?? 0);
  const activeSet =
    params.equipmentPlan?.equipmentSets?.[activeSetIndex] ?? null;
  const activeSetName = activeSet?.name?.trim() || '当前方案';

  params.currentEquipment.forEach((equipment) => {
    const descriptor = buildDescriptor({
      characterId: params.characterId,
      sourceKind: 'current_plan',
      sourceLabel: activeSetName,
      equipment,
      planId: activeSet?.id ?? null,
      isActivePlan: true,
    });

    if (!seenAssetIds.has(descriptor.assetId)) {
      descriptors.push(descriptor);
      seenAssetIds.add(descriptor.assetId);
    }
  });

  params.equipmentPlan?.equipmentSets?.forEach((set, index) => {
    if (index === activeSetIndex) {
      return;
    }

    set.items
      .map(toRecord)
      .filter((item) => Object.keys(item).length > 0)
      .forEach((equipment) => {
        const descriptor = buildDescriptor({
          characterId: params.characterId,
          sourceKind: 'equipment_plan',
          sourceLabel: set.name?.trim() || `方案${index + 1}`,
          equipment,
          planId: set.id,
          isActivePlan: false,
        });

        if (!seenAssetIds.has(descriptor.assetId)) {
          descriptors.push(descriptor);
          seenAssetIds.add(descriptor.assetId);
        }
      });
  });

  return descriptors;
}
