import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOrnamentSetEffectRows } from '@/shared/models/simulator-equipment-persistence';

test('buildOrnamentSetEffectRows requires four matching trinkets before activation', () => {
  const rows = buildOrnamentSetEffectRows({
    snapshotId: 'snapshot_1',
    equipments: [
      {
        id: 'trinket_1',
        type: 'trinket',
        slot: 1,
        level: 80,
        setName: '健步如飞',
      },
      {
        id: 'trinket_2',
        type: 'trinket',
        slot: 2,
        level: 80,
        setName: '健步如飞',
      },
      {
        id: 'trinket_3',
        type: 'trinket',
        slot: 3,
        level: 80,
        setName: '健步如飞',
      },
    ],
  });

  assert.equal(rows.length, 0);
});

test('buildOrnamentSetEffectRows activates only when four matching trinkets reach tier threshold', () => {
  const rows = buildOrnamentSetEffectRows({
    snapshotId: 'snapshot_1',
    equipments: [
      {
        id: 'trinket_1',
        type: 'trinket',
        slot: 1,
        level: 80,
        setName: '健步如飞',
      },
      {
        id: 'trinket_2',
        type: 'trinket',
        slot: 2,
        level: 80,
        setName: '健步如飞',
      },
      {
        id: 'trinket_3',
        type: 'trinket',
        slot: 3,
        level: 80,
        setName: '健步如飞',
      },
      {
        id: 'trinket_4',
        type: 'trinket',
        slot: 4,
        level: 80,
        setName: '健步如飞',
      },
    ],
  });

  assert.equal(rows.length, 1);
  const row = rows[0];
  if (!row) {
    throw new Error('expected ornament set effect row to exist');
  }
  assert.equal(row.setName, '健步如飞');
  assert.equal(row.totalLevel, 320);
  assert.equal(row.tier, 32);

  const effect = JSON.parse(row.effectJson ?? '{}') as {
    slotCount?: number;
    slots?: string[];
  };
  assert.equal(effect.slotCount, 4);
  assert.deepEqual(effect.slots, ['1', '2', '3', '4']);
});
