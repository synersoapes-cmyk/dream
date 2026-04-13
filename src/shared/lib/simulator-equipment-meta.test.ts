import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deriveEquipmentGemstoneStats,
  parseEquipmentGemstones,
} from './simulator-equipment-meta';

test('deriveEquipmentGemstoneStats maps standard gemstone level to structured stats', () => {
  assert.deepEqual(deriveEquipmentGemstoneStats('舍利子', 8), {
    spirit: 64,
  });
  assert.deepEqual(deriveEquipmentGemstoneStats('黑宝石', 10), {
    speed: 80,
  });
});

test('parseEquipmentGemstones backfills stats for structured gemstone rows with level only', () => {
  const gemstones = parseEquipmentGemstones({
    gemstones: [{ name: '太阳石', level: 11 }],
  });

  assert.equal(gemstones.length, 1);
  assert.deepEqual(gemstones[0]?.stats, { damage: 88 });
});

test('parseEquipmentGemstones backfills stats for legacy gemstone text', () => {
  const gemstones = parseEquipmentGemstones({
    gemstoneText: '8 舍利子，10 黑宝石',
  });

  assert.equal(gemstones.length, 2);
  assert.deepEqual(gemstones[0]?.stats, { spirit: 64 });
  assert.deepEqual(gemstones[1]?.stats, { speed: 80 });
});
