import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLaboratoryOutcomeSummary,
  buildLaboratoryMagicDamageCostLabel,
  buildLaboratoryMarginalWarning,
  formatLaboratoryDamageDelta,
  getLaboratoryOutcomeTone,
} from './laboratory-outcome-summary';

test('formatLaboratoryDamageDelta uses explicit 伤害提升文案 for positive deltas', () => {
  assert.equal(formatLaboratoryDamageDelta(125.4), '伤害提升：+125点');
});

test('formatLaboratoryDamageDelta switches to 伤害下降 when the result is negative', () => {
  assert.equal(formatLaboratoryDamageDelta(-17.2), '伤害下降：-17点');
});

test('getLaboratoryOutcomeTone follows the sign of total damage diff', () => {
  assert.equal(getLaboratoryOutcomeTone(8), 'positive');
  assert.equal(getLaboratoryOutcomeTone(-1), 'negative');
  assert.equal(getLaboratoryOutcomeTone(0), 'neutral');
});

test('buildLaboratoryOutcomeSummary summarizes gain and cost together', () => {
  assert.equal(
    buildLaboratoryOutcomeSummary({ totalDamageDiff: 25, diffPrice: 500 }),
    '可关注提升'
  );
  assert.equal(
    buildLaboratoryOutcomeSummary({ totalDamageDiff: 25, diffPrice: 0 }),
    '白赚提升'
  );
  assert.equal(
    buildLaboratoryOutcomeSummary({ totalDamageDiff: 0, diffPrice: -120 }),
    '纯省钱'
  );
  assert.equal(
    buildLaboratoryOutcomeSummary({ totalDamageDiff: -10, diffPrice: 200 }),
    '纯亏'
  );
});

test('buildLaboratoryMagicDamageCostLabel uses price divided by magic damage gain', () => {
  assert.equal(
    buildLaboratoryMagicDamageCostLabel({
      diffPrice: 5000,
      magicDamageDiff: 2,
    }),
    '¥ 2500.0 / 点法伤'
  );
  assert.equal(
    buildLaboratoryMagicDamageCostLabel({
      diffPrice: 5000,
      magicDamageDiff: 0,
    }),
    '只花钱不提法伤'
  );
  assert.equal(
    buildLaboratoryMagicDamageCostLabel({
      diffPrice: -2000,
      magicDamageDiff: -4,
    }),
    '省 ¥ 500.0 / 点法伤'
  );
});

test('buildLaboratoryMarginalWarning flags low value upgrades', () => {
  assert.equal(
    buildLaboratoryMarginalWarning({
      diffPrice: 5000,
      magicDamageDiff: 2,
    }),
    '低性比：多花 ¥ 5000 仅提升 2 点法伤'
  );
  assert.equal(
    buildLaboratoryMarginalWarning({
      diffPrice: 4800,
      magicDamageDiff: 2,
    }),
    null
  );
});
