import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildActiveRegularSetSummaries,
  formatActiveRegularSetSummary,
  parseRegularSetRulesConfig,
  resolveRegularSetAttributeBonuses,
} from '@/shared/lib/simulator-regular-set';

test('buildActiveRegularSetSummaries activates a three-piece regular set', () => {
  const activeSets = buildActiveRegularSetSummaries([
    { slot: 'weapon', setName: '炎魔神套' },
    { slot: 'helmet', setName: '炎魔神套' },
    { slot: 'armor', setName: '炎魔神套' },
  ]);

  assert.equal(activeSets.length, 1);
  assert.equal(activeSets[0]?.setName, '炎魔神套');
  assert.equal(activeSets[0]?.tier, 3);
  assert.equal(activeSets[0]?.effects[0]?.value, 10);
});

test('resolveRegularSetAttributeBonuses upgrades to five-piece tier', () => {
  const result = resolveRegularSetAttributeBonuses([
    { slot: 'weapon', setName: '炎魔神套' },
    { slot: 'helmet', setName: '炎魔神套' },
    { slot: 'necklace', setName: '炎魔神套' },
    { slot: 'armor', setName: '炎魔神套' },
    { slot: 'belt', setName: '炎魔神套' },
  ]);

  assert.equal(result.activeSets.length, 1);
  assert.equal(result.activeSets[0]?.tier, 5);
  assert.equal(result.attributeSourceBonuses.magic, 20);
  assert.equal(
    formatActiveRegularSetSummary(result.activeSets[0]!),
    '炎魔神套（5件）魔力 +20'
  );
});

test('parseRegularSetRulesConfig supports wildcard rule overrides', () => {
  const rules = parseRegularSetRulesConfig([
    {
      setName: '*',
      tiers: [
        {
          tier: 5,
          minCount: 5,
          effects: [{ targetKey: 'magic', value: 24 }],
        },
        {
          tier: 3,
          minCount: 3,
          effects: [{ targetKey: 'magic', value: 12 }],
        },
      ],
    },
  ]);

  const result = resolveRegularSetAttributeBonuses(
    [
      { slot: 'weapon', setName: '炎魔神套' },
      { slot: 'helmet', setName: '炎魔神套' },
      { slot: 'armor', setName: '炎魔神套' },
    ],
    rules
  );

  assert.equal(result.activeSets.length, 1);
  assert.equal(result.activeSets[0]?.tier, 3);
  assert.equal(result.attributeSourceBonuses.magic, 12);
});
