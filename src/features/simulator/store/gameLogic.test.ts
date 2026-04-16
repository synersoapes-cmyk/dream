import assert from 'node:assert/strict';
import test from 'node:test';

import {
  computeCombatStatsWithPanelBaseline,
  computeDerivedStats,
} from '@/features/simulator/store/gameLogic';
import type {
  BaseAttributes,
  Equipment,
} from '@/features/simulator/store/gameTypes';

function createEquipment(): Equipment {
  return {
    id: 'weapon_1',
    name: '测试武器',
    type: 'weapon',
    mainStat: '法伤 +10',
    baseStats: { magicDamage: 10 },
    stats: { magicDamage: 10 },
    gemstones: [
      {
        id: 'gem_1',
        name: '舍利子',
        type: 'spirit',
        element: '土',
        level: 8,
        quantity: 2,
        stats: {
          spirit: 6,
        },
      },
      {
        id: 'gem_2',
        name: '黑宝石',
        type: 'speed',
        element: '水',
        level: 10,
        quantity: 1,
        stats: {
          speed: 8,
        },
      },
    ],
  };
}

test('computeDerivedStats includes structured gemstone stats in derived panel values', () => {
  const baseAttributes: BaseAttributes = {
    level: 0,
    hp: 0,
    magic: 0,
    potentialPoints: 0,
    physique: 0,
    magicPower: 100,
    strength: 0,
    endurance: 0,
    agility: 0,
    faction: '龙宫',
  };

  const result = computeDerivedStats(baseAttributes, [createEquipment()], null);

  assert.equal(result.magicPower, 112);
  assert.equal(result.spiritualPower, 112);
  assert.equal(result.magicDamage, 122);
  assert.equal(result.magicDefense, 112);
  assert.equal(result.speed, 8);
});

test('computeDerivedStats applies jade magic upper percent modifiers to panel mp', () => {
  const baseAttributes: BaseAttributes = {
    level: 0,
    hp: 0,
    magic: 100,
    potentialPoints: 0,
    physique: 0,
    magicPower: 0,
    strength: 0,
    endurance: 0,
    agility: 0,
    faction: '龙宫',
  };

  const jade: Equipment = {
    id: 'jade_1',
    name: '测试阳玉',
    type: 'jade',
    slot: 1,
    mainStat: '魔法值上限 +5%',
    baseStats: {},
    stats: {},
    effectModifiers: [
      {
        code: 'magic_upper_percent',
        value: 5,
        label: '魔法值上限 +5%',
      },
    ],
  };

  const result = computeDerivedStats(baseAttributes, [jade], null);

  assert.equal(result.magic, 367.5);
});

test('computeDerivedStats applies bodyStrength percent to base hp only', () => {
  const baseAttributes: BaseAttributes = {
    level: 0,
    hp: 100,
    magic: 0,
    potentialPoints: 0,
    physique: 10,
    magicPower: 0,
    strength: 0,
    endurance: 0,
    agility: 0,
    faction: '龙宫',
  };

  const armor: Equipment = {
    id: 'armor_1',
    name: '测试衣服',
    type: 'armor',
    mainStat: '气血 +200',
    baseStats: { hp: 200 },
    stats: { hp: 200 },
  };

  const result = computeDerivedStats(baseAttributes, [armor], null, {
    bodyStrength: 20,
  });

  assert.equal(result.hp, 854);
});

test('computeDerivedStats converts magic into mp magicDamage and magicDefense at the expected rates', () => {
  const baseAttributes: BaseAttributes = {
    level: 0,
    hp: 0,
    magic: 1,
    potentialPoints: 0,
    physique: 0,
    magicPower: 0,
    strength: 0,
    endurance: 0,
    agility: 0,
    faction: '龙宫',
  };

  const result = computeDerivedStats(baseAttributes, [], null);

  assert.equal(result.magic, 3.5);
  assert.equal(result.magicDamage, 0.7);
  assert.equal(result.magicDefense, 0.7);
});

test('computeDerivedStats converts strength into hit magicDamage magicDefense and speed', () => {
  const baseAttributes: BaseAttributes = {
    level: 0,
    hp: 0,
    magic: 0,
    potentialPoints: 0,
    physique: 0,
    magicPower: 0,
    strength: 10,
    endurance: 0,
    agility: 0,
    faction: '龙宫',
  };

  const result = computeDerivedStats(baseAttributes, [], null);

  assert.equal(result.hit, 17);
  assert.equal(result.magicDamage, 4);
  assert.equal(result.magicDefense, 4);
  assert.equal(result.speed, 1);
});

test('computeDerivedStats converts endurance into defense magicDamage magicDefense and speed', () => {
  const baseAttributes: BaseAttributes = {
    level: 0,
    hp: 0,
    magic: 0,
    potentialPoints: 0,
    physique: 0,
    magicPower: 0,
    strength: 0,
    endurance: 10,
    agility: 0,
    faction: '龙宫',
  };

  const result = computeDerivedStats(baseAttributes, [], null);

  assert.equal(result.defense, 16);
  assert.equal(result.magicDamage, 2);
  assert.equal(result.magicDefense, 2);
  assert.equal(result.speed, 1);
});

test('computeDerivedStats converts physique into hp magicDamage magicDefense and speed', () => {
  const baseAttributes: BaseAttributes = {
    level: 0,
    hp: 0,
    magic: 0,
    potentialPoints: 0,
    physique: 10,
    magicPower: 0,
    strength: 0,
    endurance: 0,
    agility: 0,
    faction: '龙宫',
  };

  const result = computeDerivedStats(baseAttributes, [], null);

  assert.equal(result.hp, 45);
  assert.equal(result.magicDamage, 3);
  assert.equal(result.magicDefense, 3);
  assert.equal(result.speed, 1);
});

test('computeDerivedStats converts agility into speed at the expected rate', () => {
  const baseAttributes: BaseAttributes = {
    level: 0,
    hp: 0,
    magic: 0,
    potentialPoints: 0,
    physique: 0,
    magicPower: 0,
    strength: 0,
    endurance: 0,
    agility: 10,
    faction: '龙宫',
  };

  const result = computeDerivedStats(baseAttributes, [], null);

  assert.equal(result.speed, 7);
});

test('computeCombatStatsWithPanelBaseline preserves OCR panel when current and baseline inputs match', () => {
  const baseAttributes: BaseAttributes = {
    level: 0,
    hp: 0,
    magic: 100,
    potentialPoints: 0,
    physique: 0,
    magicPower: 0,
    strength: 0,
    endurance: 0,
    agility: 0,
    faction: '龙宫',
  };

  const equipment: Equipment[] = [
    {
      id: 'weapon_live',
      name: '当前武器',
      type: 'weapon',
      mainStat: '法伤 +120',
      baseStats: { magicDamage: 120 },
      stats: { magicDamage: 120 },
    },
  ];

  const result = computeCombatStatsWithPanelBaseline(
    {
      baseAttributes,
      equipment,
      treasure: null,
    },
    {
      panelStats: {
        hp: 3850,
        magic: 2200,
        hit: 990,
        damage: 0,
        magicDamage: 1460,
        defense: 920,
        magicDefense: 1180,
        speed: 540,
        dodge: 180,
        spiritualPower: 1180,
      },
      baseAttributes,
      equipment,
      treasure: null,
    }
  );

  assert.equal(result.magicDamage, 1460);
  assert.equal(result.magicDefense, 1180);
  assert.equal(result.speed, 540);
});

test('computeCombatStatsWithPanelBaseline applies only incremental deltas on top of OCR panel', () => {
  const baseAttributes: BaseAttributes = {
    level: 0,
    hp: 0,
    magic: 100,
    potentialPoints: 0,
    physique: 0,
    magicPower: 0,
    strength: 0,
    endurance: 0,
    agility: 0,
    faction: '龙宫',
  };

  const baselineEquipment: Equipment[] = [
    {
      id: 'weapon_live',
      name: '当前武器',
      type: 'weapon',
      mainStat: '法伤 +120',
      baseStats: { magicDamage: 120 },
      stats: { magicDamage: 120 },
    },
  ];
  const upgradedEquipment: Equipment[] = [
    {
      id: 'weapon_upgrade',
      name: '升级武器',
      type: 'weapon',
      mainStat: '法伤 +220',
      baseStats: { magicDamage: 220 },
      stats: { magicDamage: 220 },
    },
  ];

  const result = computeCombatStatsWithPanelBaseline(
    {
      baseAttributes,
      equipment: upgradedEquipment,
      treasure: null,
    },
    {
      panelStats: {
        hp: 3850,
        magic: 2200,
        hit: 990,
        damage: 0,
        magicDamage: 1460,
        defense: 920,
        magicDefense: 1180,
        speed: 540,
        dodge: 180,
        spiritualPower: 1180,
      },
      baseAttributes,
      equipment: baselineEquipment,
      treasure: null,
    }
  );

  assert.equal(result.magicDamage, 1560);
  assert.equal(result.magicDefense, 1180);
});

test('computeDerivedStats applies meridian magic bonus to panel values', () => {
  const baseAttributes: BaseAttributes = {
    level: 0,
    hp: 0,
    magic: 100,
    potentialPoints: 0,
    physique: 0,
    magicPower: 0,
    strength: 0,
    endurance: 0,
    agility: 0,
    faction: '龙宫',
  };

  const result = computeDerivedStats(baseAttributes, [], null, {
    meridian: {
      physique: 0,
      magic: 10,
      strength: 0,
      endurance: 0,
      agility: 0,
      magicPower: 0,
    },
  });

  assert.equal(result.magic, 385);
  assert.equal(result.magicDamage, 77);
  assert.equal(result.magicDefense, 77);
  assert.equal(result.spiritualPower, 77);
});

test('computeDerivedStats converts weapon damage into magic damage at damage/4', () => {
  const baseAttributes: BaseAttributes = {
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
  };

  const weapon: Equipment = {
    id: 'weapon_damage_1',
    name: '测试法系武器',
    type: 'weapon',
    mainStat: '伤害 +400',
    baseStats: { damage: 400 },
    stats: { damage: 400 },
  };

  const result = computeDerivedStats(baseAttributes, [weapon], null);

  assert.equal(result.damage, 400);
  assert.equal(result.magicDamage, 100);
});

test('computeDerivedStats applies jade flat magic crit level immediately to panel stats', () => {
  const baseAttributes: BaseAttributes = {
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
  };

  const jade: Equipment = {
    id: 'jade_yang_1',
    name: '测试阳玉',
    type: 'jade',
    slot: 1,
    mainStat: '法术暴击等级 +88',
    baseStats: { magicCritLevel: 88 },
    stats: { magicCritLevel: 88 },
  };

  const result = computeDerivedStats(baseAttributes, [jade], null);

  assert.equal(result.magicCritLevel, 88);
});

test('computeDerivedStats applies three-piece regular set magic bonus', () => {
  const baseAttributes: BaseAttributes = {
    level: 0,
    hp: 0,
    magic: 100,
    potentialPoints: 0,
    physique: 0,
    magicPower: 0,
    strength: 0,
    endurance: 0,
    agility: 0,
    faction: '龙宫',
  };

  const result = computeDerivedStats(
    baseAttributes,
    [
      {
        id: 'weapon_set_1',
        name: '套装武器',
        type: 'weapon',
        setName: '炎魔神套',
        mainStat: '伤害 +100',
        baseStats: {},
        stats: {},
      },
      {
        id: 'helmet_set_1',
        name: '套装头盔',
        type: 'helmet',
        setName: '炎魔神套',
        mainStat: '防御 +50',
        baseStats: {},
        stats: {},
      },
      {
        id: 'armor_set_1',
        name: '套装衣服',
        type: 'armor',
        setName: '炎魔神套',
        mainStat: '防御 +80',
        baseStats: {},
        stats: {},
      },
    ],
    null
  );

  assert.equal(result.magic, 385);
  assert.equal(result.magicDamage, 77);
  assert.equal(result.magicDefense, 77);
});

test('computeDerivedStats upgrades regular set bonus from three to five pieces', () => {
  const baseAttributes: BaseAttributes = {
    level: 0,
    hp: 0,
    magic: 100,
    potentialPoints: 0,
    physique: 0,
    magicPower: 0,
    strength: 0,
    endurance: 0,
    agility: 0,
    faction: '龙宫',
  };

  const result = computeDerivedStats(
    baseAttributes,
    ['weapon', 'helmet', 'necklace', 'armor', 'belt'].map((type, index) => ({
      id: `regular_set_${index + 1}`,
      name: `套装部件${index + 1}`,
      type: type as Equipment['type'],
      setName: '炎魔神套',
      mainStat: '测试属性',
      baseStats: {},
      stats: {},
    })),
    null
  );

  assert.equal(result.magic, 420);
  assert.equal(result.magicDamage, 84);
  assert.equal(result.magicDefense, 84);
});

test('computeDerivedStats prefers configured regular set rules over defaults', () => {
  const baseAttributes: BaseAttributes = {
    level: 0,
    hp: 0,
    magic: 100,
    potentialPoints: 0,
    physique: 0,
    magicPower: 0,
    strength: 0,
    endurance: 0,
    agility: 0,
    faction: '龙宫',
  };

  const result = computeDerivedStats(
    baseAttributes,
    [
      {
        id: 'weapon_set_custom_1',
        name: '套装武器',
        type: 'weapon',
        setName: '炎魔神套',
        mainStat: '伤害 +100',
        baseStats: {},
        stats: {},
      },
      {
        id: 'helmet_set_custom_1',
        name: '套装头盔',
        type: 'helmet',
        setName: '炎魔神套',
        mainStat: '防御 +50',
        baseStats: {},
        stats: {},
      },
      {
        id: 'armor_set_custom_1',
        name: '套装衣服',
        type: 'armor',
        setName: '炎魔神套',
        mainStat: '防御 +80',
        baseStats: {},
        stats: {},
      },
    ],
    null,
    {
      regularSetRules: [
        {
          setName: '*',
          enabled: true,
          tiers: [
            {
              tier: 3,
              minCount: 3,
              effects: [{ targetKey: 'magic', value: 12 }],
            },
          ],
        },
      ],
    }
  );

  assert.equal(result.magic, 392);
  assert.ok(Math.abs(result.magicDamage - 78.4) < 1e-9);
  assert.ok(Math.abs(result.magicDefense - 78.4) < 1e-9);
});

test('M5-06 九龙诀额外等级会同步抬升前台灵力法伤与法防', () => {
  const baseAttributes: BaseAttributes = {
    level: 0,
    hp: 0,
    magic: 0,
    potentialPoints: 0,
    physique: 0,
    magicPower: 520,
    strength: 0,
    endurance: 0,
    agility: 0,
    faction: '龙宫',
  };

  const helmet: Equipment = {
    id: 'helmet_jiulong_lv6',
    name: '九龙诀头盔',
    type: 'helmet',
    mainStat: '防御 +80',
    baseStats: {},
    stats: {},
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
  };

  const result = computeDerivedStats(baseAttributes, [helmet], null);

  assert.equal(result.spiritualPower, 526);
  assert.equal(result.magicDamage, 526);
  assert.equal(result.magicDefense, 526);
});

test('M5-17 九龙诀基础技能收益已内置于基准面板时不会重复叠加', () => {
  const baseAttributes: BaseAttributes = {
    level: 0,
    hp: 0,
    magic: 0,
    potentialPoints: 0,
    physique: 0,
    magicPower: 520,
    strength: 0,
    endurance: 0,
    agility: 0,
    faction: '龙宫',
  };

  const helmet: Equipment = {
    id: 'helmet_jiulong_existing',
    name: '当前九龙诀头盔',
    type: 'helmet',
    mainStat: '防御 +80',
    baseStats: {},
    stats: {},
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
  };

  const result = computeDerivedStats(baseAttributes, [helmet], null, {
    runeSkillBaselineEquipment: [helmet],
  });

  assert.equal(result.spiritualPower, 520);
  assert.equal(result.magicDamage, 520);
  assert.equal(result.magicDefense, 520);
});
