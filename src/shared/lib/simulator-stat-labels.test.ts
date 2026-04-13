import assert from 'node:assert/strict';
import test from 'node:test';

import { getSimulatorStatLabel } from './simulator-stat-labels';

test('default magic stat label matches player-facing 魔力 wording', () => {
  assert.equal(getSimulatorStatLabel('magic'), '魔力');
});
