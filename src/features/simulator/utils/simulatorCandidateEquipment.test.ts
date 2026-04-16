import assert from 'node:assert/strict';
import test from 'node:test';
import { useGameStore } from '@/features/simulator/store/gameStore';
import {
  applySimulatorCandidateEquipmentToStore,
  buildSimulatorCandidateEquipmentPayload,
  loadSimulatorCandidateEquipmentToStore,
} from '@/features/simulator/utils/simulatorCandidateEquipment';

import type { SimulatorCandidateEquipmentItem } from '@/shared/models/simulator-types';

function createItems(): SimulatorCandidateEquipmentItem[] {
  return [
    {
      id: 'pending_1',
      equipment: {
        id: 'eq_pending_1',
        name: '待确认法杖',
        type: 'weapon',
        mainStat: '法伤 +100',
        baseStats: { magicDamage: 100 },
        stats: { magicDamage: 100 },
      },
      timestamp: 1,
      status: 'pending',
    },
    {
      id: 'confirmed_1',
      equipment: {
        id: 'eq_confirmed_1',
        name: '已确认铠甲',
        type: 'armor',
        mainStat: '防御 +120',
        baseStats: { defense: 120 },
        stats: { defense: 120 },
      },
      timestamp: 2,
      status: 'confirmed',
    },
  ];
}

test('applySimulatorCandidateEquipmentToStore hydrates pending and confirmed equipment', () => {
  applySimulatorCandidateEquipmentToStore(createItems());

  const state = useGameStore.getState();
  assert.equal(state.pendingEquipments.length, 2);
  assert.equal(state.pendingEquipments[0]?.status, 'pending');
  assert.equal(state.pendingEquipments[1]?.status, 'confirmed');
  assert.equal(state.pendingEquipments[1]?.equipment.name, '已确认铠甲');
});

test('buildSimulatorCandidateEquipmentPayload reads latest confirmed status from store', () => {
  applySimulatorCandidateEquipmentToStore(createItems());
  useGameStore.getState().confirmPendingEquipment('pending_1');

  const payload = buildSimulatorCandidateEquipmentPayload(
    useGameStore.getState().pendingEquipments
  );
  const confirmedItem = payload.find((item) => item.id === 'pending_1');

  assert.equal(confirmedItem?.status, 'confirmed');
});

test('loadSimulatorCandidateEquipmentToStore fetches candidate library into store', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        code: 0,
        data: createItems(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )) as typeof fetch;

  try {
    useGameStore.setState((state) => ({
      ...state,
      pendingEquipments: [],
      selectedPendingIds: [],
    }));

    const items = await loadSimulatorCandidateEquipmentToStore();
    const state = useGameStore.getState();

    assert.equal(items.length, 2);
    assert.equal(state.pendingEquipments.length, 2);
    assert.equal(state.pendingEquipments[0]?.equipment.name, '待确认法杖');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
