import test from 'node:test';
import assert from 'node:assert/strict';

import { useGameStore } from '@/features/simulator/store/gameStore';
import { applySimulatorCandidateEquipmentToStore } from '@/features/simulator/utils/simulatorCandidateEquipment';
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
