import assert from 'node:assert/strict';
import test from 'node:test';

import { computeDerivedStats } from '@/features/simulator/store/gameLogic';
import type { Equipment } from '@/features/simulator/store/gameTypes';

import {
  calculateEquipmentTotalStats,
  mergeLaboratoryDisplayDiffs,
  mergeEquipmentWithInheritance,
  resolveLaboratorySeatEquipment,
} from './laboratory-utils';

function createEquipment(
  id: string,
  overrides?: Partial<Equipment>
): Equipment {
  return {
    id,
    name: id,
    type: 'weapon',
    mainStat: '法伤 +100',
    baseStats: { magicDamage: 100 },
    stats: { magicDamage: 100 },
    ...overrides,
  };
}

test('mergeEquipmentWithInheritance copies gemstones and rune stones from base equipment', () => {
  const baseEquipment = createEquipment('weapon_base', {
    forgeLevel: 12,
    gemstone: '12 舍利子',
    gemstones: [
      {
        id: 'gem_1',
        name: '舍利子',
        type: 'spirit',
        level: 12,
        stats: { spiritualPower: 96 },
      },
    ],
    runeStoneSetsNames: ['呼风唤雨'],
    activeRuneStoneSet: 0,
    runeSetEffect: '法术伤害 +6',
    luckyHoles: '5',
    runeStoneSets: [
      [
        {
          id: 'rune_1',
          name: '黑符石',
          type: 'black',
          stats: { magicDamage: 1.5 },
        },
      ],
    ],
  });
  const nextEquipment = createEquipment('weapon_candidate', {
    gemstones: [],
    runeStoneSets: [],
    runeStoneSetsNames: [],
  });

  const merged = mergeEquipmentWithInheritance(baseEquipment, nextEquipment, {
    inheritGemstones: true,
    inheritRuneStones: true,
  });

  assert.equal(merged.id, 'weapon_candidate');
  assert.equal(merged.gemstone, '12 舍利子');
  assert.equal(merged.gemstones?.[0]?.id, 'gem_1');
  assert.equal(merged.activeRuneStoneSet, 0);
  assert.equal(merged.runeStoneSetsNames?.[0], '呼风唤雨');
  assert.equal(merged.runeStoneSets?.[0]?.[0]?.id, 'rune_1');
  assert.equal(merged.luckyHoles, '5');
});

test('calculateEquipmentTotalStats counts cross-server fee into total price', () => {
  const totals = calculateEquipmentTotalStats([
    createEquipment('weapon_price', {
      price: 1000,
      crossServerFee: 200,
    }),
    createEquipment('weapon_free', {
      price: 500,
    }),
  ]);

  assert.equal(totals.totalPrice, 1700);
});

test('resolveLaboratorySeatEquipment uses sample equipment for the sample seat', () => {
  const sampleEquipment = [createEquipment('sample_weapon')];
  const seatEquipment = [createEquipment('stale_sample_weapon')];

  const resolved = resolveLaboratorySeatEquipment(
    {
      isSample: true,
      equipment: seatEquipment,
    },
    sampleEquipment
  );

  assert.equal(resolved, sampleEquipment);
  assert.equal(resolved[0]?.id, 'sample_weapon');
});

test('resolveLaboratorySeatEquipment keeps compare seat equipment unchanged', () => {
  const sampleEquipment = [createEquipment('sample_weapon')];
  const compareEquipment = [createEquipment('compare_weapon')];

  const resolved = resolveLaboratorySeatEquipment(
    {
      isSample: false,
      equipment: compareEquipment,
    },
    sampleEquipment
  );

  assert.equal(resolved, compareEquipment);
  assert.equal(resolved[0]?.id, 'compare_weapon');
});

test('mergeEquipmentWithInheritance keeps candidate build when inheritance is disabled', () => {
  const baseEquipment = createEquipment('weapon_base', {
    gemstone: '12 舍利子',
    gemstones: [
      {
        id: 'gem_1',
        name: '舍利子',
        type: 'spirit',
      },
    ],
    runeStoneSetsNames: ['呼风唤雨'],
    runeStoneSets: [
      [
        {
          id: 'rune_1',
          name: '黑符石',
          type: 'black',
          stats: { magicDamage: 1.5 },
        },
      ],
    ],
  });
  const nextEquipment = createEquipment('weapon_candidate', {
    gemstone: '11 太阳石',
    gemstones: [
      {
        id: 'gem_2',
        name: '太阳石',
        type: 'damage',
      },
    ],
    runeStoneSetsNames: ['破浪诀'],
    runeStoneSets: [
      [
        {
          id: 'rune_2',
          name: '白符石',
          type: 'white',
          stats: { magic: 2 },
        },
      ],
    ],
  });

  const merged = mergeEquipmentWithInheritance(baseEquipment, nextEquipment, {
    inheritGemstones: false,
    inheritRuneStones: false,
  });

  assert.equal(merged.gemstone, '11 太阳石');
  assert.equal(merged.gemstones?.[0]?.id, 'gem_2');
  assert.equal(merged.runeStoneSetsNames?.[0], '破浪诀');
  assert.equal(merged.runeStoneSets?.[0]?.[0]?.id, 'rune_2');
});

test('M6-04 inheritGemstones keeps old gemstone segments for whiteboard comparison math', () => {
  const baseEquipment = createEquipment('weapon_base', {
    gemstone: '12 舍利子',
    gemstones: [
      {
        id: 'gem_1',
        name: '舍利子',
        type: 'spirit',
        level: 12,
        stats: { spirit: 96 },
      },
    ],
  });
  const whiteboardEquipment = createEquipment('weapon_whiteboard', {
    stats: { magicDamage: 120 },
    gemstones: [],
    gemstone: undefined,
    runeStoneSets: [],
    runeStoneSetsNames: [],
  });

  const merged = mergeEquipmentWithInheritance(baseEquipment, whiteboardEquipment, {
    inheritGemstones: true,
    inheritRuneStones: false,
  });
  const totals = calculateEquipmentTotalStats([merged]);
  const combatStats = computeDerivedStats(
    {
      level: 0,
      hp: 0,
      magic: 0,
      potentialPoints: 0,
      physique: 0,
      magicPower: 0,
      strength: 0,
      endurance: 0,
      agility: 0,
      faction: '龙宫',
    },
    [merged],
    null
  );

  assert.equal(merged.gemstones?.[0]?.id, 'gem_1');
  assert.equal(merged.runeStoneSets?.length ?? 0, 0);
  assert.equal(totals.totals.spirit, 96);
  assert.equal(combatStats.spiritualPower, 96);
  assert.equal(combatStats.magicDamage, 216);
});

test('M6-04 inheritRuneStones keeps old rune build while gemstone inheritance stays disabled', () => {
  const baseEquipment = createEquipment('weapon_base', {
    gemstones: [
      {
        id: 'gem_1',
        name: '舍利子',
        type: 'spirit',
        level: 12,
        stats: { spirit: 96 },
      },
    ],
    runeStoneSetsNames: ['呼风唤雨'],
    activeRuneStoneSet: 0,
    luckyHoles: '3',
    runeStoneSets: [
      [
        {
          id: 'rune_1',
          name: '黑符石',
          type: 'black',
          stats: { magicDamage: 1.5 },
        },
        {
          id: 'rune_2',
          name: '黄符石',
          type: 'yellow',
          stats: { hit: 2 },
        },
      ],
    ],
  });
  const whiteboardEquipment = createEquipment('weapon_whiteboard', {
    stats: { magicDamage: 120 },
    gemstones: [],
    gemstone: undefined,
    runeStoneSetsNames: ['破浪诀'],
    activeRuneStoneSet: 0,
    runeStoneSets: [
      [
        {
          id: 'rune_9',
          name: '白符石',
          type: 'white',
          stats: { magic: 2 },
        },
      ],
    ],
  });

  const merged = mergeEquipmentWithInheritance(baseEquipment, whiteboardEquipment, {
    inheritGemstones: false,
    inheritRuneStones: true,
  });
  const totals = calculateEquipmentTotalStats([merged]);
  const combatStats = computeDerivedStats(
    {
      level: 0,
      hp: 0,
      magic: 0,
      potentialPoints: 0,
      physique: 0,
      magicPower: 0,
      strength: 0,
      endurance: 0,
      agility: 0,
      faction: '龙宫',
    },
    [merged],
    null
  );

  assert.equal(merged.gemstones?.length ?? 0, 0);
  assert.equal(merged.runeStoneSetsNames?.[0], '呼风唤雨');
  assert.equal(merged.runeStoneSets?.[0]?.[0]?.id, 'rune_1');
  assert.equal(totals.totals.magicDamage, 121.5);
  assert.equal(totals.totals.hit, 2);
  assert.equal(combatStats.magicDamage, 121.5);
  assert.equal(combatStats.hit, 2);
});

test('mergeLaboratoryDisplayDiffs prefers canonical 灵力 key from combat stats aliases', () => {
  const displayDiffs = mergeLaboratoryDisplayDiffs({
    combatDiffs: {
      spiritualPower: 64,
      magicPower: 64,
      spirit: 64,
      magicDamage: 64,
    },
    diffs: {
      spirit: 64,
      magicDefense: 64,
    },
  });

  assert.deepEqual(displayDiffs, {
    spiritualPower: 64,
    magicDamage: 64,
    magicDefense: 64,
  });
});

test('mergeLaboratoryDisplayDiffs falls back to raw 灵力 aliases when combat stats omit them', () => {
  const displayDiffs = mergeLaboratoryDisplayDiffs({
    combatDiffs: {},
    diffs: {
      spirit: 96,
      hit: 12,
    },
  });

  assert.deepEqual(displayDiffs, {
    spiritualPower: 96,
    hit: 12,
  });
});
