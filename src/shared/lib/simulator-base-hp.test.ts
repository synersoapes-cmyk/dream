import assert from 'node:assert/strict';
import test from 'node:test';

import { inferBaseHpSource } from '@/shared/lib/simulator-base-hp';

test('inferBaseHpSource falls back to plain panel hp when bodyStrength is absent', () => {
  assert.equal(
    inferBaseHpSource({
      panelHp: 4200,
      physique: 40,
      equipmentHp: 0,
    }),
    804
  );
});

test('inferBaseHpSource removes bodyStrength multiplier before inferring base hp', () => {
  assert.equal(
    inferBaseHpSource({
      panelHp: 4620,
      physique: 40,
      equipmentHp: 0,
      bodyStrength: 20,
    }),
    734
  );
});
