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
    '符石套装 招云',
    '套装 动物套',
    '开孔 5/5',
    '修理失败 2',
    '宝石 10锻舍利子',
    '五行 水',
  ]);
});
