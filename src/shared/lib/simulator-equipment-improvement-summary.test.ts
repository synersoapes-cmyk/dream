import assert from 'node:assert/strict';
import test from 'node:test';

import type { Equipment } from '@/features/simulator/store/gameTypes';

import {
  buildEquipmentImprovementDiffSummary,
  buildEquipmentImprovementSummary,
} from '@/shared/lib/simulator-equipment-improvement-summary';

function createHelmetEquipment(): Equipment {
  return {
    id: 'helmet_1',
    name: '测试头盔',
    type: 'helmet',
    mainStat: '法伤 +32',
    extraStat: '魔力 +12 耐力 +8',
    specialEffect: '罗汉金钟',
    setName: '混沌兽',
    runeSetEffect: '招云',
    highlights: ['无级别限制', '高法伤'],
    luckyHoles: '5',
    runeStoneSetsNames: ['海市蜃楼'],
    activeRuneStoneSet: 0,
    runeStoneSets: [
      [
        { id: 'r1', type: 'white', color: '白', stats: {} },
        { id: 'r2', type: 'red', color: '红', stats: {} },
        { id: 'r3', type: 'black', color: '黑', stats: {} },
        { id: 'r4', type: 'blue', color: '蓝', stats: {} },
        { id: 'r5', type: 'yellow', color: '黄', stats: {} },
      ],
    ],
    stats: {
      magicDamage: 32,
      spellDamageLevel: 18,
      magicCritLevel: 175,
      magicResult: 15,
      spiritualPower: 20,
      speed: 6,
    },
    baseStats: {
      magicDamage: 32,
      spellDamageLevel: 18,
      magicCritLevel: 175,
      magicResult: 15,
      spiritualPower: 20,
      speed: 6,
    },
  };
}

function createWeaponEquipment(overrides?: Partial<Equipment>): Equipment {
  return {
    id: 'weapon_1',
    name: '测试武器',
    type: 'weapon',
    mainStat: '伤害 +440 法伤 +32',
    stats: {
      damage: 440,
      magicDamage: 32,
      spellDamageLevel: 18,
      magicCritLevel: 175,
    },
    baseStats: {
      damage: 440,
      magicDamage: 32,
      spellDamageLevel: 18,
      magicCritLevel: 175,
    },
    ...overrides,
  };
}

test('buildEquipmentImprovementSummary exposes raw magic stats crit rate spirit equivalent and effects', () => {
  const summary = buildEquipmentImprovementSummary(createHelmetEquipment());

  assert.equal(summary.metrics.magicDamage, 32);
  assert.equal(summary.metrics.spellDamageLevel, 18);
  assert.equal(summary.metrics.magicCritLevel, 175);
  assert.equal(summary.metrics.magicCritRate, 10);
  assert.equal(summary.metrics.spiritEquivalentTotal, 80);

  assert.ok(
    summary.numericSummary.some(
      (item) => item.key === 'magicCritRate' && item.value === '+10.00%'
    )
  );
  assert.ok(
    summary.numericSummary.some(
      (item) =>
        item.key === 'extraAttributes' &&
        item.value.includes('魔力 +12') &&
        item.value.includes('耐力 +8')
    )
  );
  assert.ok(
    summary.spiritEquivalentSummary.some(
      (item) =>
        item.key === 'extraAttributeEquivalent' &&
        item.value === '+10' &&
        item.note?.includes('魔力 +12 -> 灵力约 +8.4')
    )
  );
  assert.ok(
    summary.effectSummary.some(
      (item) =>
        item.key === 'specialEffect' && item.value.includes('罗汉金钟')
    )
  );
  assert.ok(
    summary.effectSummary.some(
      (item) =>
        item.key === 'runeCombo' &&
        item.value.includes('海市蜃楼') &&
        item.value.includes('四级组合')
    )
  );
});

test('buildEquipmentImprovementDiffSummary compares spell damage crit rate spirit equivalent and effect changes', () => {
  const baseline = createWeaponEquipment({
    id: 'weapon_base',
    name: '旧武器',
    specialEffect: '罗汉金钟',
    stats: {
      damage: 400,
      magicDamage: 20,
      spellDamageLevel: 10,
      magicCritLevel: 70,
    },
    baseStats: {
      damage: 400,
      magicDamage: 20,
      spellDamageLevel: 10,
      magicCritLevel: 70,
    },
  });
  const candidate = createWeaponEquipment({
    id: 'weapon_next',
    name: '新武器',
    specialEffect: '晶清诀',
  });

  const diff = buildEquipmentImprovementDiffSummary(candidate, baseline);

  assert.ok(
    diff.numericSummary.some(
      (item) => item.key === 'magicDamage' && item.value === '+12'
    )
  );
  assert.ok(
    diff.numericSummary.some(
      (item) => item.key === 'spellDamageLevel' && item.value === '+8'
    )
  );
  assert.ok(
    diff.numericSummary.some(
      (item) => item.key === 'magicCritRate' && item.value === '+6.00%'
    )
  );
  assert.ok(
    diff.spiritEquivalentSummary.some(
      (item) => item.key === 'spiritEquivalentTotal' && item.value === '+30'
    )
  );
  assert.ok(
    diff.effectSummary.some(
      (item) =>
        item.key === 'specialEffect' &&
        item.tone === 'changed' &&
        item.value.includes('罗汉金钟') &&
        item.value.includes('晶清诀')
    )
  );
});
