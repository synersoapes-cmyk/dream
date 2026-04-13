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
        inheritGemstones: false,
        inheritRuneStones: false,
        equipment: [],
      },
      {
        id: 'comp_cloud_1',
        name: '对比席位1',
        isSample: false,
        sort: 1,
        inheritGemstones: false,
        inheritRuneStones: true,
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
  assert.equal(state.experimentSeats[1]?.inheritGemstones, false);
  assert.equal(state.experimentSeats[1]?.inheritRuneStones, true);
});

test('applySimulatorLabSessionToStore trims extra compare seats to the supported count', () => {
  const session = createSession();
  session.seats.push({
    id: 'comp_cloud_2',
    name: '对比席位2',
    isSample: false,
    sort: 2,
    equipment: [
      {
        id: 'eq_cloud_2',
        name: '第二件云端武器',
        type: 'weapon',
        mainStat: '法伤 +140',
        baseStats: { magicDamage: 140 },
        stats: { magicDamage: 140 },
      },
    ],
  });
  session.seats.push({
    id: 'comp_cloud_3',
    name: '对比席位3',
    isSample: false,
    sort: 3,
    equipment: [
      {
        id: 'eq_cloud_3',
        name: '第三件云端武器',
        type: 'weapon',
        mainStat: '法伤 +160',
        baseStats: { magicDamage: 160 },
        stats: { magicDamage: 160 },
      },
    ],
  });

  applySimulatorLabSessionToStore(session);

  const state = useGameStore.getState();
  const compareSeats = state.experimentSeats.filter((seat) => !seat.isSample);
  assert.equal(compareSeats.length, 2);
  assert.equal(compareSeats[0]?.id, 'comp_cloud_1');
  assert.equal(compareSeats[1]?.id, 'comp_cloud_2');
});
