import assert from 'node:assert/strict';
import test from 'node:test';

import type { Equipment } from '@/features/simulator/store/gameTypes';

import {
  getConsolidatedRuneStoneSetInfo,
  getEquipmentRuneStoneSetInfo,
} from './RuneStoneHelper';

function createEquipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: 'eq_1',
    name: '测试装备',
    type: 'weapon',
    mainStat: '法伤 +100',
    baseStats: { magicDamage: 100 },
    stats: { magicDamage: 100 },
    runeStoneSetsNames: ['呼风唤雨'],
    runeStoneSets: [
      [
        {
          id: 'rune_1',
          name: '黑符石',
          type: 'black',
          stats: {},
        },
      ],
    ],
    luckyHoles: '1',
    ...overrides,
  };
}

test('getEquipmentRuneStoneSetInfo marks unopened rune sets as 未激活', () => {
  const info = getEquipmentRuneStoneSetInfo([
    createEquipment({
      luckyHoles: '0',
      runeStoneSets: [],
    }),
  ]);

  assert.deepEqual(info, ['未激活']);
  assert.equal(
    getConsolidatedRuneStoneSetInfo([
      createEquipment({
        luckyHoles: '0',
        runeStoneSets: [],
      }),
    ]),
    '未激活'
  );
});

test('getEquipmentRuneStoneSetInfo keeps active rune set names when holes are available', () => {
  const info = getEquipmentRuneStoneSetInfo([
    createEquipment({
      runeStoneSetsNames: ['九龙诀：四级'],
      runeStoneSets: [
        [
          { id: 'rune_1', name: '白符石', type: 'white', stats: {} },
          { id: 'rune_2', name: '红符石', type: 'red', stats: {} },
          { id: 'rune_3', name: '黄符石', type: 'yellow', stats: {} },
        ],
      ],
      type: 'helmet',
      luckyHoles: '5',
    }),
  ]);

  assert.deepEqual(info, ['九龙诀']);
});

test('getEquipmentRuneStoneSetInfo marks wrong-slot rune combo as 未激活', () => {
  const info = getEquipmentRuneStoneSetInfo([
    createEquipment({
      type: 'weapon',
      runeStoneSetsNames: ['九龙诀：四级'],
      runeStoneSets: [
        [
          { id: 'rune_1', name: '白符石', type: 'white', stats: {} },
          { id: 'rune_2', name: '红符石', type: 'red', stats: {} },
          { id: 'rune_3', name: '黄符石', type: 'yellow', stats: {} },
          { id: 'rune_4', name: '蓝符石', type: 'blue', stats: {} },
          { id: 'rune_5', name: '绿符石', type: 'green', stats: {} },
        ],
      ],
      luckyHoles: '5',
    }),
  ]);

  assert.deepEqual(info, ['未激活']);
});
