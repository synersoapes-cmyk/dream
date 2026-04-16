import type { PendingEquipment } from '@/features/simulator/store/gameTypes';

import type { SimulatorInventoryLibraryItem } from '@/shared/models/simulator-types';

export function mapSimulatorInventoryLibraryItemToPendingEquipment(
  item: SimulatorInventoryLibraryItem
): PendingEquipment {
  return {
    id: item.id,
    equipment: item.equipment as unknown as PendingEquipment['equipment'],
    timestamp: item.timestamp,
    inventoryRefs: [
      {
        entryId: item.entryId,
        assetId: item.assetId,
        status: item.status,
        sourceKind: item.inventorySourceKind,
        sourceLabel: item.inventorySourceLabel,
        folderKey: item.folderKey,
        price: item.price,
      },
    ],
    status: 'confirmed',
  };
}
