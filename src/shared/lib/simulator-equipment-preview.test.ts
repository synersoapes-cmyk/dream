import assert from 'node:assert/strict';
import test from 'node:test';

import type { Equipment } from '@/features/simulator/store/gameTypes';

import {
  getEquipmentPrimaryPreviewLine,
  getEquipmentSecondaryPreviewLine,
} from '@/shared/lib/simulator-equipment-preview';

function createEquipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: overrides.id ?? 'eq_preview',
    name: overrides.name ?? '测试装备',
    type: overrides.type ?? 'belt',
    mainStat: overrides.mainStat ?? '速度 +65 防御 +48',
    extraStat: overrides.extraStat,
    baseStats: overrides.baseStats ?? { speed: 65, defense: 48 },
    stats: overrides.stats ?? overrides.baseStats ?? { speed: 65, defense: 48 },
    ...overrides,
  };
}

test('getEquipmentPrimaryPreviewLine prefers the first non-empty mainStat line', () => {
  const equipment = createEquipment({
    mainStat: '\n速度 +72 躲避 +35\n第二行说明',
  });

  assert.equal(getEquipmentPrimaryPreviewLine(equipment), '速度 +72 躲避 +35');
});

test('getEquipmentPrimaryPreviewLine falls back to stats when mainStat is missing', () => {
  const equipment = createEquipment({
    mainStat: '' as Equipment['mainStat'],
    stats: {
      magicDamage: 220,
      hit: 120,
    },
    baseStats: {},
  });

  assert.equal(
    getEquipmentPrimaryPreviewLine(equipment),
    '法伤 +220 命中 +120'
  );
});

test('getEquipmentPrimaryPreviewLine returns placeholder when no preview data exists', () => {
  const equipment = createEquipment({
    mainStat: '' as Equipment['mainStat'],
    stats: {},
    baseStats: {},
  });

  assert.equal(getEquipmentPrimaryPreviewLine(equipment), '待补充属性');
});

test('getEquipmentSecondaryPreviewLine trims extraStat to the first non-empty line', () => {
  const equipment = createEquipment({
    extraStat: '\n特效：愤怒\n第二行说明',
  });

  assert.equal(getEquipmentSecondaryPreviewLine(equipment), '特效：愤怒');
});
