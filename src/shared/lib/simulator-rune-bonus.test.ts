import assert from 'node:assert/strict';
import test from 'node:test';

import type { Equipment } from '@/features/simulator/store/gameTypes';

import {
  buildRuneComboDropWarnings,
  diffActiveRuneComboEffects,
  resolveActiveRuneComboEffects,
} from './simulator-rune-bonus';

function createEquipment(
  id: string,
  overrides: Partial<Equipment> = {}
): Equipment {
  return {
    id,
    name: id,
    type: 'weapon',
    mainStat: '法伤 +100',
    baseStats: { magicDamage: 100 },
    stats: { magicDamage: 100 },
    runeStoneSetsNames: [],
    runeStoneSets: [],
    luckyHoles: '0',
    ...overrides,
  };
}

test('resolveActiveRuneComboEffects keeps only the highest school skill combo', () => {
  const result = resolveActiveRuneComboEffects([
    createEquipment('helmet_low', {
      type: 'helmet',
      luckyHoles: '3',
      runeStoneSetsNames: ['九龙诀'],
      runeStoneSets: [
        [
          { id: 'r1', type: 'white', stats: {} },
          { id: 'r2', type: 'red', stats: {} },
          { id: 'r3', type: 'yellow', stats: {} },
        ],
      ],
    }),
    createEquipment('helmet_high', {
      type: 'helmet',
      luckyHoles: '5',
      runeStoneSetsNames: ['九龙诀'],
      runeStoneSets: [
        [
          { id: 'r4', type: 'white', stats: {} },
          { id: 'r5', type: 'red', stats: {} },
          { id: 'r6', type: 'yellow', stats: {} },
          { id: 'r7', type: 'blue', stats: {} },
          { id: 'r8', type: 'green', stats: {} },
        ],
      ],
    }),
  ]);

  assert.equal(result.length, 1);
  assert.deepEqual(result[0], {
    comboName: '九龙诀',
    effectType: 'skill_level',
    effectLabel: '九龙诀技能等级',
    bonusValue: 6,
    matchedTier: 4,
    activeCount: 1,
    overflowCount: 1,
    sourceSlots: ['helmet'],
    ignoredSlots: ['helmet'],
  });
});

test('resolveActiveRuneComboEffects caps 隔山打牛 at two active sets', () => {
  const result = resolveActiveRuneComboEffects([
    createEquipment('necklace_1', {
      type: 'necklace',
      luckyHoles: '5',
      runeStoneSetsNames: ['隔山打牛'],
      runeStoneSets: [
        [
          { id: 'r1', type: 'white', stats: {} },
          { id: 'r2', type: 'red', stats: {} },
          { id: 'r3', type: 'purple', stats: {} },
          { id: 'r4', type: 'blue', stats: {} },
          { id: 'r5', type: 'yellow', stats: {} },
        ],
      ],
    }),
    createEquipment('armor_1', {
      type: 'armor',
      luckyHoles: '5',
      runeStoneSetsNames: ['隔山打牛'],
      runeStoneSets: [
        [
          { id: 'r6', type: 'white', stats: {} },
          { id: 'r7', type: 'red', stats: {} },
          { id: 'r8', type: 'purple', stats: {} },
          { id: 'r9', type: 'blue', stats: {} },
          { id: 'r10', type: 'yellow', stats: {} },
        ],
      ],
    }),
    createEquipment('belt_1', {
      type: 'belt',
      luckyHoles: '5',
      runeStoneSetsNames: ['隔山打牛'],
      runeStoneSets: [
        [
          { id: 'r11', type: 'white', stats: {} },
          { id: 'r12', type: 'red', stats: {} },
          { id: 'r13', type: 'purple', stats: {} },
          { id: 'r14', type: 'blue', stats: {} },
          { id: 'r15', type: 'yellow', stats: {} },
        ],
      ],
    }),
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.comboName, '隔山打牛');
  assert.equal(result[0]?.bonusValue, 140);
  assert.equal(result[0]?.activeCount, 2);
  assert.equal(result[0]?.overflowCount, 1);
});

test('diffActiveRuneComboEffects tracks downgrade and invalidation', () => {
  const previousEquipment = [
    createEquipment('belt_prev', {
      type: 'belt',
      luckyHoles: '5',
      runeStoneSetsNames: ['逆鳞'],
      runeStoneSets: [
        [
          { id: 'r1', type: 'white', stats: {} },
          { id: 'r2', type: 'red', stats: {} },
          { id: 'r3', type: 'green', stats: {} },
          { id: 'r4', type: 'purple', stats: {} },
          { id: 'r5', type: 'blue', stats: {} },
        ],
      ],
    }),
  ];

  const downgradedEquipment = [
    createEquipment('belt_next', {
      type: 'belt',
      luckyHoles: '3',
      runeStoneSetsNames: ['逆鳞'],
      runeStoneSets: [
        [
          { id: 'r1', type: 'white', stats: {} },
          { id: 'r2', type: 'red', stats: {} },
          { id: 'r3', type: 'green', stats: {} },
        ],
      ],
    }),
  ];

  const invalidEquipment = [
    createEquipment('belt_invalid', {
      type: 'belt',
      luckyHoles: '5',
      runeStoneSetsNames: ['逆鳞'],
      runeStoneSets: [
        [
          { id: 'r1', type: 'white', stats: {} },
          { id: 'r2', type: 'red', stats: {} },
          { id: 'r3', type: 'yellow', stats: {} },
          { id: 'r4', type: 'purple', stats: {} },
          { id: 'r5', type: 'blue', stats: {} },
        ],
      ],
    }),
  ];

  const downgradeDiff = diffActiveRuneComboEffects(
    previousEquipment,
    downgradedEquipment
  );
  const invalidDiff = diffActiveRuneComboEffects(previousEquipment, invalidEquipment);

  assert.deepEqual(downgradeDiff[0], {
    comboName: '逆鳞',
    effectType: 'skill_level',
    effectLabel: '逆鳞技能等级',
    previousBonusValue: 6,
    nextBonusValue: 2,
    deltaBonusValue: -4,
    previousMatchedTier: 4,
    nextMatchedTier: 2,
    previousActiveCount: 1,
    nextActiveCount: 1,
  });
  assert.deepEqual(invalidDiff[0], {
    comboName: '逆鳞',
    effectType: 'skill_level',
    effectLabel: '逆鳞技能等级',
    previousBonusValue: 6,
    nextBonusValue: 0,
    deltaBonusValue: -6,
    previousMatchedTier: 4,
    nextMatchedTier: null,
    previousActiveCount: 1,
    nextActiveCount: 0,
  });
});

test('buildRuneComboDropWarnings emits the configured high-risk warning', () => {
  const warnings = buildRuneComboDropWarnings([
    {
      comboName: '破浪诀',
      effectType: 'skill_level',
      effectLabel: '破浪诀技能等级',
      previousBonusValue: 6,
      nextBonusValue: 0,
      deltaBonusValue: -6,
      previousMatchedTier: 4,
      nextMatchedTier: null,
      previousActiveCount: 1,
      nextActiveCount: 0,
    },
  ]);

  assert.deepEqual(warnings, ['丢弃破浪诀将降低大量基础伤害']);
});
