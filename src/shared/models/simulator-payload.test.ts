import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeEquipmentPayload,
  toEquipmentSlotValue,
} from './simulator-payload';

test('toEquipmentSlotValue normalizes accessory slots to persisted slot keys', () => {
  assert.equal(toEquipmentSlotValue({ type: 'trinket', slot: 1 }), 'ring');
  assert.equal(toEquipmentSlotValue({ type: 'trinket', slot: 4 }), 'amulet');
  assert.equal(
    toEquipmentSlotValue({ type: 'trinket', slot: '耳饰' }),
    'earring'
  );
  assert.equal(toEquipmentSlotValue({ type: 'jade', slot: 1 }), 'jade1');
  assert.equal(toEquipmentSlotValue({ type: 'jade', slot: 2 }), 'jade2');
  assert.equal(toEquipmentSlotValue({ type: 'jade', slot: '阴玉' }), 'jade2');
});

test('normalizeEquipmentPayload dedupes invalid jade slots before persistence', () => {
  const normalized = normalizeEquipmentPayload([
    { id: 'jade-valid-1', type: 'jade', slot: 1 },
    { id: 'jade-valid-2', type: 'jade', slot: 2 },
    { id: 'jade-invalid-3', type: 'jade', slot: 3 },
    { id: 'jade-invalid-4', type: 'jade', slot: 4 },
  ]);

  assert.deepEqual(
    normalized.map((item) => item.id),
    ['jade-valid-1', 'jade-valid-2']
  );
});
