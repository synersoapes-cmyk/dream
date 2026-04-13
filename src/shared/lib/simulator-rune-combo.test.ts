import assert from 'node:assert/strict';
import test from 'node:test';

import { extractActiveRuneSetMeta } from '@/shared/lib/simulator-equipment-meta';

import {
  analyzeRuneComboConflict,
  resolveRuneComboActivation,
} from './simulator-rune-combo';

test('extractActiveRuneSetMeta truncates active rune colors by hole count', () => {
  const meta = extractActiveRuneSetMeta({
    activeRuneStoneSet: 0,
    holeCount: 3,
    runeStoneSets: [
      [
        { id: 'rune_1', type: 'black', stats: {} },
        { id: 'rune_2', type: 'red', stats: {} },
        { id: 'rune_3', type: 'white', stats: {} },
        { id: 'rune_4', type: 'blue', stats: {} },
      ],
    ],
    runeStoneSetsNames: ['龙腾'],
  });

  assert.deepEqual(meta.activeColors, ['黑', '红', '白']);
});

test('resolveRuneComboActivation rejects wrong slot even when colors are complete', () => {
  const result = resolveRuneComboActivation({
    type: 'weapon',
    luckyHoles: '5',
    activeRuneStoneSet: 0,
    runeStoneSetsNames: ['九龙诀'],
    runeStoneSets: [
      [
        { id: 'rune_1', type: 'white', stats: {} },
        { id: 'rune_2', type: 'red', stats: {} },
        { id: 'rune_3', type: 'yellow', stats: {} },
        { id: 'rune_4', type: 'blue', stats: {} },
        { id: 'rune_5', type: 'green', stats: {} },
      ],
    ],
  });

  assert.equal(result.isActivated, false);
  assert.equal(result.reason, 'slot_invalid');
});

test('resolveRuneComboActivation downgrades to lower tier when hole count truncates colors', () => {
  const result = resolveRuneComboActivation({
    type: 'necklace',
    luckyHoles: '3',
    activeRuneStoneSet: 0,
    runeStoneSetsNames: ['龙腾'],
    runeStoneSets: [
      [
        { id: 'rune_1', type: 'black', stats: {} },
        { id: 'rune_2', type: 'red', stats: {} },
        { id: 'rune_3', type: 'white', stats: {} },
        { id: 'rune_4', type: 'blue', stats: {} },
      ],
    ],
  });

  assert.equal(result.isActivated, true);
  assert.equal(result.matchedTier, 2);
  assert.deepEqual(result.activeColors, ['黑', '红', '白']);
});

test('analyzeRuneComboConflict reports hole-count conflicts and keeps downgraded tier', () => {
  const result = analyzeRuneComboConflict({
    type: 'belt',
    luckyHoles: '3',
    activeRuneStoneSet: 0,
    runeStoneSetsNames: ['逆鳞'],
    runeStoneSets: [
      [
        { id: 'rune_1', type: 'white', stats: {} },
        { id: 'rune_2', type: 'red', stats: {} },
        { id: 'rune_3', type: 'green', stats: {} },
        { id: 'rune_4', type: 'purple', stats: {} },
      ],
    ],
  });

  assert.equal(result?.reason, 'hole_capacity_conflict');
  assert.equal(result?.matchedTier, 2);
  assert.match(result?.message ?? '', /已强制按 3 孔最大可承载的二级组合计算/);
});

test('analyzeRuneComboConflict reports wrong-slot conflicts', () => {
  const result = analyzeRuneComboConflict({
    type: 'shoes',
    luckyHoles: '3',
    activeRuneStoneSet: 0,
    runeStoneSetsNames: ['九龙诀'],
    runeStoneSets: [
      [
        { id: 'rune_1', type: 'white', stats: {} },
        { id: 'rune_2', type: 'red', stats: {} },
        { id: 'rune_3', type: 'yellow', stats: {} },
      ],
    ],
  });

  assert.equal(result?.reason, 'slot_invalid');
  assert.match(result?.message ?? '', /当前部位无法激活/);
});
