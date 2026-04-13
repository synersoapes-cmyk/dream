import assert from 'node:assert/strict';
import test from 'node:test';

import type { Equipment } from '@/features/simulator/store/gameTypes';

import {
  formatEquipmentExtraAttributeSummary,
  sumEquipmentExtraAttributeTotals,
} from '@/shared/lib/simulator-extra-attribute-summary';

function createEquipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: 'eq_1',
    name: '测试装备',
    type: 'weapon',
    mainStat: '法伤 +100',
    baseStats: { magicDamage: 100 },
    stats: { magicDamage: 100 },
    ...overrides,
  };
}

test('sumEquipmentExtraAttributeTotals aggregates six-piece 魔耐 totals from extra texts', () => {
  const totals = sumEquipmentExtraAttributeTotals([
    createEquipment({ id: 'eq_1', extraStat: '魔力 +12 耐力 +6' }),
    createEquipment({ id: 'eq_2', extraStat: '魔力 +8' }),
    createEquipment({ id: 'eq_3', extraStat: '耐力 +10' }),
    createEquipment({ id: 'eq_4', refinementEffect: '+5魔力 +2耐力' }),
    createEquipment({ id: 'eq_5', refinementEffect: '+3耐力' }),
    createEquipment({ id: 'eq_6', extraStat: '敏捷 +4 魔力 -1' }),
  ]);

  assert.equal(totals.magic, 24);
  assert.equal(totals.endurance, 21);
  assert.equal(totals.agility, 4);
});

test('formatEquipmentExtraAttributeSummary outputs compact labels for display', () => {
  const summary = formatEquipmentExtraAttributeSummary({
    magic: 24,
    endurance: 21,
  });

  assert.deepEqual(summary, ['魔力 +24', '耐力 +21']);
});
