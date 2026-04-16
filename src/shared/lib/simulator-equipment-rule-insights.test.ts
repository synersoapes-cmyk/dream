import assert from 'node:assert/strict';
import test from 'node:test';

import { buildEquipmentRuleInsights } from '@/shared/lib/simulator-equipment-rule-insights';

test('buildEquipmentRuleInsights explains activated rune combo', () => {
  const insights = buildEquipmentRuleInsights({
    id: 'helmet_1',
    name: '测试头盔',
    type: 'helmet',
    mainStat: '防御 +100',
    baseStats: {},
    stats: {},
    luckyHoles: '5',
    runeStoneSetsNames: ['九龙诀'],
    runeStoneSets: [
      [
        { id: 'r1', type: 'white', stats: {} },
        { id: 'r2', type: 'red', stats: {} },
        { id: 'r3', type: 'yellow', stats: {} },
        { id: 'r4', type: 'blue', stats: {} },
        { id: 'r5', type: 'green', stats: {} },
      ],
    ],
    activeRuneStoneSet: 0,
  });

  const runeInsight = insights.find((item) => item.id === 'rune-combo');
  assert.ok(runeInsight);
  assert.equal(runeInsight?.tone, 'success');
  assert.match(runeInsight?.summary ?? '', /已生效/);
  assert.ok(runeInsight?.details.some((item) => item.includes('头盔')));
  assert.ok(runeInsight?.details.some((item) => item.includes('四级组合')));
});

test('buildEquipmentRuleInsights explains wrong-slot rune combo', () => {
  const insights = buildEquipmentRuleInsights({
    id: 'shoes_1',
    name: '测试鞋子',
    type: 'shoes',
    mainStat: '速度 +50',
    baseStats: {},
    stats: {},
    luckyHoles: '3',
    runeStoneSetsNames: ['九龙诀'],
    runeStoneSets: [
      [
        { id: 'r1', type: 'white', stats: {} },
        { id: 'r2', type: 'red', stats: {} },
        { id: 'r3', type: 'yellow', stats: {} },
      ],
    ],
    activeRuneStoneSet: 0,
  });

  const runeInsight = insights.find((item) => item.id === 'rune-combo');
  assert.ok(runeInsight);
  assert.equal(runeInsight?.tone, 'warning');
  assert.match(runeInsight?.summary ?? '', /部位不对/);
});

test('buildEquipmentRuleInsights explains hole-capacity conflict', () => {
  const insights = buildEquipmentRuleInsights({
    id: 'weapon_1',
    name: '测试武器',
    type: 'weapon',
    mainStat: '伤害 +500',
    baseStats: {},
    stats: {},
    luckyHoles: '3',
    runeStoneSetsNames: ['破浪诀'],
    runeStoneSets: [
      [
        { id: 'r1', type: 'white', stats: {} },
        { id: 'r2', type: 'red', stats: {} },
        { id: 'r3', type: 'blue', stats: {} },
        { id: 'r4', type: 'black', stats: {} },
        { id: 'r5', type: 'green', stats: {} },
      ],
    ],
    activeRuneStoneSet: 0,
  });

  const runeInsight = insights.find((item) => item.id === 'rune-combo');
  assert.ok(runeInsight);
  assert.equal(runeInsight?.tone, 'warning');
  assert.match(runeInsight?.summary ?? '', /二级组合/);
});

test('buildEquipmentRuleInsights explains regular set count with equipped context', () => {
  const insights = buildEquipmentRuleInsights(
    {
      id: 'armor_1',
      name: '测试衣服',
      type: 'armor',
      mainStat: '防御 +200',
      baseStats: {},
      stats: {},
      setName: '动物套',
    },
    {
      allEquipment: [
        {
          id: 'helmet_1',
          name: '测试头盔',
          type: 'helmet',
          mainStat: '防御 +100',
          baseStats: {},
          stats: {},
          setName: '动物套',
        },
        {
          id: 'armor_1',
          name: '测试衣服',
          type: 'armor',
          mainStat: '防御 +200',
          baseStats: {},
          stats: {},
          setName: '动物套',
        },
        {
          id: 'belt_1',
          name: '测试腰带',
          type: 'belt',
          mainStat: '气血 +100',
          baseStats: {},
          stats: {},
          setName: '动物套',
        },
      ],
    }
  );

  const setInsight = insights.find((item) => item.id === 'regular-set');
  assert.ok(setInsight);
  assert.equal(setInsight?.tone, 'success');
  assert.match(setInsight?.summary ?? '', /已穿 3 件/);
  assert.ok(setInsight?.details.some((item) => item.includes('当前效果：魔力 +10')));
});

test('buildEquipmentRuleInsights keeps regular set as preview in laboratory context', () => {
  const insights = buildEquipmentRuleInsights({
    id: 'armor_2',
    name: '实验衣服',
    type: 'armor',
    mainStat: '防御 +180',
    baseStats: {},
    stats: {},
    setName: '动物套',
  });

  const setInsight = insights.find((item) => item.id === 'regular-set');
  assert.ok(setInsight);
  assert.equal(setInsight?.tone, 'neutral');
  assert.ok(setInsight?.details.some((item) => item.includes('单件预览')));
});
