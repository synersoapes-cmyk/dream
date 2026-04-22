import test from 'node:test';
import assert from 'node:assert/strict';

import type { Equipment } from '@/features/simulator/store/gameTypes';

import { getEquipmentSpotlightTags } from './simulator-equipment-spotlight';

function createEquipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: 'eq_1',
    name: '沧海灵杖',
    type: 'weapon',
    mainStat: '法伤 +220',
    baseStats: {},
    stats: {},
    ...overrides,
  };
}

test('getEquipmentSpotlightTags merges important display tags and deduplicates', () => {
  const tags = getEquipmentSpotlightTags(
    createEquipment({
      highlights: ['简易', '特效 晶清诀'],
      specialEffect: '晶清诀',
      runeSetEffect: '招云',
      setName: '动物套',
      luckyHoles: '5/5',
      repairFailCount: 2,
      gemstone: '10锻舍利子',
      element: '水',
    })
  );

  assert.deepEqual(tags, [
    '简易',
    '特效 晶清诀',
    '法伤 +220',
    '符石套装 招云',
    '套装 动物套',
    '宝石 10锻舍利子',
    '开孔 5/5',
    '修理失败 2',
    '五行 水',
  ]);
});

test('getEquipmentSpotlightTags prioritizes CBG-like key value tags', () => {
  const tags = getEquipmentSpotlightTags(
    createEquipment({
      mainStat: '伤害 +423\n命中 +638',
      extraStat: '魔力 +28 耐力 +20',
      stats: {
        damage: 423,
        hit: 638,
        speed: 72,
      },
      refinementEffect: '+5敏捷 +8耐力',
      luckyHoles: '5/5',
      repairFailCount: 0,
    })
  );

  assert.deepEqual(tags.slice(0, 5), [
    '双加 魔力+28 耐力+20',
    '伤害 +423',
    '速度 +72',
    '命中 +638',
    '双加 耐力+8 敏捷+5',
  ]);
  assert.ok(tags.includes('修理失败 0'));
  assert.ok(tags.includes('开孔 5/5'));
});
