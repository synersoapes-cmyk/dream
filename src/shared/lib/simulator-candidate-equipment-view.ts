import type { PendingEquipment } from '@/features/simulator/store/gameTypes';

import {
  matchesSimulatorSlotDefinition,
  type SimulatorEquipmentCategoryKey,
  type SimulatorSlotDefinition,
} from '@/shared/lib/simulator-slot-config';

export type SimulatorCandidateEquipmentSortKey =
  | 'newest'
  | 'oldest'
  | 'totalPriceDesc'
  | 'totalPriceAsc';

export function getCandidateEquipmentTimestampValue(
  item: Pick<PendingEquipment, 'timestamp'>
) {
  const rawValue = item.timestamp;

  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue === 'string') {
    const parsed = Date.parse(rawValue);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

export function getCandidateEquipmentTotalPrice(
  item: Pick<PendingEquipment, 'equipment'>
) {
  return (
    Number(item.equipment.price || 0) +
    Number(item.equipment.crossServerFee || 0)
  );
}

export function filterCandidateEquipmentItems<
  T extends Pick<PendingEquipment, 'equipment'>,
>(
  items: T[],
  options: {
    category: SimulatorEquipmentCategoryKey;
    slotDefinition?: SimulatorSlotDefinition | null;
  }
) {
  return items.filter((item) => {
    const matchesCategory =
      options.category === 'equipment'
        ? item.equipment.type !== 'trinket' && item.equipment.type !== 'jade'
        : item.equipment.type === options.category;

    if (!matchesCategory) {
      return false;
    }

    if (!options.slotDefinition) {
      return true;
    }

    return matchesSimulatorSlotDefinition(
      options.slotDefinition,
      item.equipment
    );
  });
}

export function sortCandidateEquipmentItems<
  T extends Pick<PendingEquipment, 'equipment' | 'timestamp'>,
>(items: T[], sortKey: SimulatorCandidateEquipmentSortKey) {
  return [...items].sort((left, right) => {
    switch (sortKey) {
      case 'oldest':
        return (
          getCandidateEquipmentTimestampValue(left) -
          getCandidateEquipmentTimestampValue(right)
        );
      case 'totalPriceDesc':
        return (
          getCandidateEquipmentTotalPrice(right) -
            getCandidateEquipmentTotalPrice(left) ||
          getCandidateEquipmentTimestampValue(right) -
            getCandidateEquipmentTimestampValue(left)
        );
      case 'totalPriceAsc':
        return (
          getCandidateEquipmentTotalPrice(left) -
            getCandidateEquipmentTotalPrice(right) ||
          getCandidateEquipmentTimestampValue(right) -
            getCandidateEquipmentTimestampValue(left)
        );
      case 'newest':
      default:
        return (
          getCandidateEquipmentTimestampValue(right) -
          getCandidateEquipmentTimestampValue(left)
        );
    }
  });
}
