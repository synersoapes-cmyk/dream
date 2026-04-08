import assert from 'node:assert/strict';
import test from 'node:test';

import type { Equipment } from '@/features/simulator/store/gameTypes';
import {
  applySimulatorRuneSetSelection,
  ensureSimulatorEquipmentRuneEditingState,
  getSimulatorActiveRuneSetIndex,
  getSimulatorRuneSetOptions,
} from '@/shared/lib/simulator-rune-editor';

function createEquipment(
  overrides: Partial<Equipment> = {}
): Equipment {
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

test('ensureSimulatorEquipmentRuneEditingState bootstraps empty primary equipment', () => {
  const equipment = ensureSimulatorEquipmentRuneEditingState(createEquipment());

  assert.equal(equipment.activeRuneStoneSet, 0);
  assert.equal(equipment.luckyHoles, '1');
  assert.deepEqual(equipment.runeStoneSetsNames, ['未配置']);
  assert.equal(equipment.runeStoneSets?.[0]?.[0]?.type, 'empty');
});

test('applySimulatorRuneSetSelection seeds 招云 weapon color and keeps slot editable', () => {
  const equipment = applySimulatorRuneSetSelection(createEquipment(), '招云');

  assert.equal(getSimulatorActiveRuneSetIndex(equipment), 0);
  assert.equal(equipment.runeStoneSetsNames?.[0], '招云');
  assert.equal(equipment.runeStoneSets?.[0]?.[0]?.type, 'yellow');
  assert.equal(equipment.luckyHoles, '1');
});

test('applySimulatorRuneSetSelection seeds 腾蛟 weapon color from empty state', () => {
  const equipment = applySimulatorRuneSetSelection(createEquipment(), '腾蛟');

  assert.equal(equipment.runeStoneSets?.[0]?.[0]?.type, 'red');
  assert.equal(equipment.runeStoneSetsNames?.[0], '腾蛟');
});

test('getSimulatorRuneSetOptions includes cloud combo names', () => {
  const options = getSimulatorRuneSetOptions(
    createEquipment({ runeStoneSetsNames: ['心印'] })
  );

  assert.ok(options.includes('招云'));
  assert.ok(options.includes('腾蛟'));
  assert.ok(options.includes('心印'));
});
