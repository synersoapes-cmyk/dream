import type { PendingEquipment } from '@/features/simulator/store/gameTypes';
import { useGameStore } from '@/features/simulator/store/gameStore';
import type { SimulatorCandidateEquipmentItem } from '@/shared/models/simulator';

export function applySimulatorCandidateEquipmentToStore(
  items: SimulatorCandidateEquipmentItem[]
) {
  const nextItems: PendingEquipment[] = items.map((item) => ({
    id: item.id,
    equipment: item.equipment as unknown as PendingEquipment['equipment'],
    timestamp: item.timestamp,
    imagePreview: item.imagePreview,
    rawText: item.rawText,
    targetSetId: item.targetSetId,
    targetEquipmentId: item.targetEquipmentId,
    targetRuneStoneSetIndex: item.targetRuneStoneSetIndex,
    status: item.status,
  }));

  useGameStore.setState((state) => ({
    ...state,
    pendingEquipments: nextItems,
    selectedPendingIds: state.selectedPendingIds.filter((id) =>
      nextItems.some((item) => item.id === id)
    ),
  }));
}
