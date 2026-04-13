import assert from 'node:assert/strict';
import test from 'node:test';

import type { Equipment } from '@/features/simulator/store/gameTypes';

import { buildLaboratoryRuneGuardSummary } from './simulator-rune-guard';

function createEquipment(overrides: Partial<Equipment>): Equipment {
  return {
    id: 'eq_1',
    name: '测试装备',
    type: 'armor',
    mainStat: '法伤 +100',
    baseStats: { magicDamage: 100 },
    stats: { magicDamage: 100 },
    runeStoneSetsNames: ['呼风唤雨'],
    runeStoneSets: [
      [
        { id: 'rune_1', type: 'black', stats: {} },
        { id: 'rune_2', type: 'yellow', stats: {} },
        { id: 'rune_3', type: 'blue', stats: {} },
      ],
    ],
    luckyHoles: '3',
    ...overrides,
  };
}

test('buildLaboratoryRuneGuardSummary emits skill-drop warnings and conflict messages together', () => {
  const sampleEquipment = [
    createEquipment({
      id: 'sample_weapon',
      type: 'weapon',
      name: '破浪诀武器',
      luckyHoles: '5',
      runeStoneSetsNames: ['破浪诀'],
      runeStoneSets: [
        [
          { id: 'rune_1', type: 'white', stats: {} },
          { id: 'rune_2', type: 'red', stats: {} },
          { id: 'rune_3', type: 'blue', stats: {} },
          { id: 'rune_4', type: 'black', stats: {} },
          { id: 'rune_5', type: 'green', stats: {} },
        ],
      ],
    }),
  ];
  const seatEquipment = [
    createEquipment({
      id: 'next_belt',
      type: 'belt',
      name: '冲突腰带',
      luckyHoles: '3',
      runeStoneSetsNames: ['逆鳞'],
      runeStoneSets: [
        [
          { id: 'rune_1', type: 'white', stats: {} },
          { id: 'rune_2', type: 'red', stats: {} },
          { id: 'rune_3', type: 'green', stats: {} },
          { id: 'rune_4', type: 'purple', stats: {} },
        ],
      ],
    }),
  ];

  const summary = buildLaboratoryRuneGuardSummary(sampleEquipment, seatEquipment);

  assert.equal(summary.requiresAttention, true);
  assert.match(summary.warnings[0] ?? '', /丢弃破浪诀将降低大量基础伤害/);
  assert.equal(summary.skillChanges[0]?.comboName, '破浪诀');
  assert.equal(summary.skillChanges[0]?.deltaBonusValue, -6);
  assert.match(summary.conflicts[0]?.message ?? '', /已强制按 3 孔最大可承载的二级组合计算/);
});
