import { useGameStore } from '@/features/simulator/store/gameStore';
import type { PendingEquipment } from '@/features/simulator/store/gameTypes';

import type { SimulatorCandidateEquipmentItem } from '@/shared/models/simulator-types';

export function mapSimulatorCandidateEquipmentItemToPendingEquipment(
  item: SimulatorCandidateEquipmentItem
): PendingEquipment {
  return {
    id: item.id,
    equipment: item.equipment as unknown as PendingEquipment['equipment'],
    timestamp: item.timestamp,
    imagePreview: item.imagePreview,
    rawText: item.rawText,
    targetSetId: item.targetSetId,
    targetEquipmentId: item.targetEquipmentId,
    targetRuneStoneSetIndex: item.targetRuneStoneSetIndex,
    status: item.status,
  };
}

export function buildSimulatorCandidateEquipmentPayload(
  items: PendingEquipment[]
) {
  return items.map((item) => ({
    id: item.id,
    equipment: item.equipment,
    imagePreview: item.imagePreview,
    rawText: item.rawText,
    targetSetId: item.targetSetId,
    targetEquipmentId: item.targetEquipmentId,
    targetRuneStoneSetIndex: item.targetRuneStoneSetIndex,
    status: item.status,
  }));
}

export function applySimulatorCandidateEquipmentToStore(
  items: SimulatorCandidateEquipmentItem[]
) {
  const nextItems: PendingEquipment[] = items.map(
    mapSimulatorCandidateEquipmentItemToPendingEquipment
  );

  useGameStore.setState((state) => ({
    ...state,
    pendingEquipments: nextItems,
    selectedPendingIds: state.selectedPendingIds.filter((id) =>
      nextItems.some((item) => item.id === id)
    ),
  }));
}

export async function loadSimulatorCandidateEquipmentToStore() {
  const response = await fetch('/api/simulator/current/candidate-equipment', {
    method: 'GET',
    cache: 'no-store',
  });

  const payload = await response.json();
  if (
    !response.ok ||
    payload?.code !== 0 ||
    !Array.isArray(payload?.data)
  ) {
    throw new Error(payload?.message || '读取候选装备失败');
  }

  applySimulatorCandidateEquipmentToStore(payload.data);
  return payload.data as SimulatorCandidateEquipmentItem[];
}
