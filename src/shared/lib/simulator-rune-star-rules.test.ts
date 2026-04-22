import assert from 'node:assert/strict';
import test from 'node:test';

import type { Equipment } from '@/features/simulator/store/gameTypes';

import {
  buildSimulatorRecommendedRunePlan,
  getSimulatorStarPositionOptions,
  parseRuneComboRulesConfig,
  parseRuneStoneRulesConfig,
  resolveSimulatorStarRuntimeBonuses,
} from './simulator-rune-star-rules';

function createEquipment(overrides: Partial<Equipment>): Equipment {
  return {
    id: overrides.id ?? 'equipment',
    name: overrides.name ?? '装备',
    type: overrides.type ?? 'helmet',
    mainStat: '',
    baseStats: {},
    stats: {},
    ...overrides,
  };
}

test('PRD rune rule defaults expose full 1-3 level rune table', () => {
  const rules = parseRuneStoneRulesConfig(undefined);

  assert.equal(rules.length, 42);
  assert.ok(rules.some((rule) => rule.name === '水符石'));
  assert.ok(
    rules.some(
      (rule) =>
        rule.color === '白' &&
        rule.level === 3 &&
        rule.stats.magicDamage === 2 &&
        rule.stats.magicDefense === 3
    )
  );
});

test('PRD combo defaults normalize legacy 九龙诀 name to 海市蜃楼', () => {
  const rules = parseRuneComboRulesConfig(undefined);
  const rule = rules.find((item) => item.name === '海市蜃楼');

  assert.equal(rule?.aliases?.includes('九龙诀'), true);
  assert.deepEqual(rule?.tiers[0]?.colors, ['白', '红', '黑', '蓝', '黄']);
});

test('Longgong optimizer recommends 海市蜃楼 for helmet with PRD colors', () => {
  const recommendation = buildSimulatorRecommendedRunePlan(
    createEquipment({
      type: 'helmet',
      luckyHoles: '5',
    })
  );

  assert.equal(recommendation?.comboName, '海市蜃楼');
  assert.deepEqual(
    recommendation?.runeStoneSet.map((item) => item.color),
    ['白', '红', '黑', '蓝', '黄']
  );
  assert.match(recommendation?.expectedDeltaLabel ?? '', /九龙诀技能等级 \+6/);
});

test('star full-color PRD rule applies six black star stones as speed +10', () => {
  const blackStar =
    getSimulatorStarPositionOptions().find(
      (option) =>
        option.label.includes('黑') &&
        option.attrType === 'speed' &&
        option.attrValue === 3
    ) ?? null;

  assert.ok(blackStar);

  const equipment = (['weapon', 'helmet', 'necklace', 'armor', 'belt', 'shoes'] as const).map(
    (type) =>
      createEquipment({
        id: type,
        type,
        starPosition: blackStar.label,
        starPositionConfig: blackStar,
      })
  );
  const result = resolveSimulatorStarRuntimeBonuses(equipment);

  assert.equal(result.fullColorSetRule?.label, '全套黑色');
  assert.equal(result.panelStatBonuses.speed, 28);
});
