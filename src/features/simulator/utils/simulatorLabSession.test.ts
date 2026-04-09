import test from 'node:test';
import assert from 'node:assert/strict';

import { useGameStore } from '@/features/simulator/store/gameStore';
import { applySimulatorLabSessionToStore } from '@/features/simulator/utils/simulatorLabSession';
import type { SimulatorLabSessionBundle } from '@/shared/models/simulator-types';

function createSession(): SimulatorLabSessionBundle {
  return {
    session: {
      id: 'lab_1',
      characterId: 'char_1',
      baselineSnapshotId: 'snapshot_1',
      name: '当前实验室',
      status: 'active',
      notes: '',
      createdBy: 'user_1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    seats: [
      {
        id: 'sample',
        name: '样本席位',
        isSample: true,
        sort: 0,
        equipment: [],
      },
      {
        id: 'comp_cloud_1',
        name: '对比席位1',
        isSample: false,
        sort: 1,
        equipment: [
          {
            id: 'eq_cloud_1',
            name: '云端武器',
            type: 'weapon',
            mainStat: '法伤 +120',
            baseStats: { magicDamage: 120 },
            stats: { magicDamage: 120 },
            price: 8888,
          },
        ],
      },
    ],
  };
}

test('applySimulatorLabSessionToStore hydrates compare seats and preserves sample seat from current equipment', () => {
  useGameStore.setState((state) => ({
    ...state,
    equipment: [
      {
        id: 'current_weapon',
        name: '当前武器',
        type: 'weapon',
        mainStat: '法伤 +80',
        baseStats: { magicDamage: 80 },
        stats: { magicDamage: 80 },
      },
    ],
    experimentSeats: [
      {
        id: 'sample',
        name: '样本席位',
        isSample: true,
        equipment: [],
      },
    ],
  }));

  applySimulatorLabSessionToStore(createSession());

  const state = useGameStore.getState();
  assert.equal(state.experimentSeats.length, 2);
  assert.equal(state.experimentSeats[0]?.isSample, true);
  assert.equal(state.experimentSeats[0]?.equipment[0]?.name, '当前武器');
  assert.equal(state.experimentSeats[1]?.id, 'comp_cloud_1');
  assert.equal(state.experimentSeats[1]?.equipment[0]?.name, '云端武器');
});
