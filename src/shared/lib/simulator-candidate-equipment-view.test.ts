import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  Equipment,
  PendingEquipment,
} from '@/features/simulator/store/gameTypes';

import {
  filterCandidateEquipmentItems,
  getCandidateEquipmentTimestampValue,
  getCandidateEquipmentTotalPrice,
  sortCandidateEquipmentItems,
} from '@/shared/lib/simulator-candidate-equipment-view';
import { getSimulatorSlotDefinitions } from '@/shared/lib/simulator-slot-config';

function createPendingItem(
  overrides: Omit<Partial<PendingEquipment>, 'equipment' | 'timestamp'> & {
    id: string;
    type: PendingEquipment['equipment']['type'];
    timestamp?: number | string;
    equipment?: Partial<Equipment>;
  }
): PendingEquipment {
  return {
    id: overrides.id,
    equipment: {
      id: `${overrides.id}_equipment`,
      name: overrides.id,
      type: overrides.type,
      slot: overrides.equipment?.slot,
      mainStat: '测试属性',
      baseStats: {},
      stats: {},
      price: overrides.equipment?.price,
      crossServerFee: overrides.equipment?.crossServerFee,
      ...overrides.equipment,
    },
    timestamp: (overrides.timestamp ?? 0) as PendingEquipment['timestamp'],
    status: overrides.status ?? 'pending',
  };
}

test('sortCandidateEquipmentItems defaults newest first and supports total price sorting', () => {
  const items = [
    createPendingItem({
      id: 'old_weapon',
      type: 'weapon',
      timestamp: 100,
      equipment: { price: 1000, crossServerFee: 0 },
    }),
    createPendingItem({
      id: 'new_armor',
      type: 'armor',
      timestamp: 300,
      equipment: { price: 500, crossServerFee: 100 },
    }),
    createPendingItem({
      id: 'mid_weapon',
      type: 'weapon',
      timestamp: 200,
      equipment: { price: 900, crossServerFee: 200 },
    }),
  ];

  assert.deepEqual(
    sortCandidateEquipmentItems(items, 'newest').map((item) => item.id),
    ['new_armor', 'mid_weapon', 'old_weapon']
  );
  assert.deepEqual(
    sortCandidateEquipmentItems(items, 'oldest').map((item) => item.id),
    ['old_weapon', 'mid_weapon', 'new_armor']
  );
  assert.deepEqual(
    sortCandidateEquipmentItems(items, 'totalPriceDesc').map((item) => item.id),
    ['mid_weapon', 'old_weapon', 'new_armor']
  );
  assert.deepEqual(
    sortCandidateEquipmentItems(items, 'totalPriceAsc').map((item) => item.id),
    ['new_armor', 'old_weapon', 'mid_weapon']
  );
});

test('filterCandidateEquipmentItems supports primary category and slot-level filters', () => {
  const items = [
    createPendingItem({
      id: 'weapon_item',
      type: 'weapon',
    }),
    createPendingItem({
      id: 'armor_item',
      type: 'armor',
    }),
    createPendingItem({
      id: 'ring_item',
      type: 'trinket',
      equipment: { slot: 1 },
    }),
    createPendingItem({
      id: 'jade_item',
      type: 'jade',
      equipment: { slot: 2 },
    }),
  ];

  const armorDefinition = getSimulatorSlotDefinitions('equipment').find(
    (item) => item.id === 'armor'
  );
  const ringDefinition = getSimulatorSlotDefinitions('trinket').find(
    (item) => item.id === 'ring'
  );

  assert.ok(armorDefinition);
  assert.ok(ringDefinition);

  assert.deepEqual(
    filterCandidateEquipmentItems(items, {
      category: 'equipment',
      slotDefinition: null,
    }).map((item) => item.id),
    ['weapon_item', 'armor_item']
  );
  assert.deepEqual(
    filterCandidateEquipmentItems(items, {
      category: 'equipment',
      slotDefinition: armorDefinition,
    }).map((item) => item.id),
    ['armor_item']
  );
  assert.deepEqual(
    filterCandidateEquipmentItems(items, {
      category: 'trinket',
      slotDefinition: ringDefinition,
    }).map((item) => item.id),
    ['ring_item']
  );
});

test('candidate equipment helpers normalize timestamp strings and total price', () => {
  const item = createPendingItem({
    id: 'timestamp_string',
    type: 'weapon',
    timestamp: '2026-04-15T08:00:00.000Z',
    equipment: {
      price: 1888,
      crossServerFee: 112,
    },
  });

  assert.equal(getCandidateEquipmentTotalPrice(item), 2000);
  assert.equal(
    getCandidateEquipmentTimestampValue(item),
    Date.parse('2026-04-15T08:00:00.000Z')
  );
});
