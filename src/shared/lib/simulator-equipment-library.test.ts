import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSimulatorEquipmentLibraryItems } from './simulator-equipment-library';

function sortLabels(values: string[]) {
  return [...values].sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'));
}

test('buildSimulatorEquipmentLibraryItems merges current plan, other plans and candidate library labels', () => {
  const weapon = {
    id: 'weapon-1',
    name: '沧海灵杖',
    type: 'weapon' as const,
    mainStat: '伤害 +423',
    baseStats: {
      damage: 423,
      hit: 638,
    },
    level: 160,
    price: 8880000,
    stats: {
      magicDamage: 281,
    },
  };

  const items = buildSimulatorEquipmentLibraryItems({
    currentEquipment: [weapon],
    equipmentSets: [
      {
        id: 'plan-current',
        name: '任务套',
        items: [weapon],
      },
      {
        id: 'plan-speed',
        name: '高速方案',
        items: [weapon],
      },
    ],
    activeSetIndex: 0,
    candidateLibraryItems: [
      {
        id: 'candidate-1',
        timestamp: 1,
        status: 'confirmed',
        equipment: {
          ...weapon,
        },
      },
    ],
  });

  assert.equal(items.length, 1);
  assert.deepEqual(items[0]?.sourceKinds.sort(), [
    'candidate_library',
    'current_plan',
    'equipment_plan',
  ]);
  assert.deepEqual(sortLabels(items[0]?.sourceLabels ?? []), sortLabels([
    '候选装备库',
    '任务套',
    '高速方案',
  ]));
  assert.equal(items[0]?.selectable, true);
  assert.equal(items[0]?.id, 'candidate-1');
});

test('buildSimulatorEquipmentLibraryItems merges managed inventory source without overriding candidate item identity', () => {
  const weapon = {
    id: 'weapon-1',
    name: '沧海灵杖',
    type: 'weapon' as const,
    mainStat: '伤害 +423',
    baseStats: {
      damage: 423,
      hit: 638,
    },
    level: 160,
    price: 8880000,
    stats: {
      magicDamage: 281,
    },
  };

  const items = buildSimulatorEquipmentLibraryItems({
    currentEquipment: [weapon],
    equipmentSets: [
      {
        id: 'plan-current',
        name: '任务套',
        items: [weapon],
      },
    ],
    activeSetIndex: 0,
    inventoryLibraryItems: [
      {
        id: 'inventory-1',
        timestamp: 2,
        status: 'confirmed',
        inventoryRefs: [
          {
            entryId: 'inventory-1',
            assetId: 'asset-1',
            status: 'active',
            sourceKind: 'candidate_library',
            sourceLabel: '候选装备库',
            folderKey: 'weapon',
            price: 8880000,
          },
        ],
        equipment: {
          ...weapon,
        },
      },
    ],
    candidateLibraryItems: [
      {
        id: 'candidate-1',
        timestamp: 3,
        status: 'confirmed',
        equipment: {
          ...weapon,
        },
      },
    ],
  });

  assert.equal(items.length, 1);
  assert.deepEqual(sortLabels(items[0]?.sourceLabels ?? []), sortLabels([
    '任务套',
    '正式库存',
    '候选装备库',
  ]));
  assert.deepEqual(sortLabels(items[0]?.sourceKinds ?? []), sortLabels([
    'current_plan',
    'inventory_asset',
    'candidate_library',
  ]));
  assert.equal(items[0]?.selectable, true);
  assert.equal(items[0]?.id, 'candidate-1');
  assert.deepEqual(
    items[0]?.inventoryRefs?.map((item) => item.entryId),
    ['inventory-1']
  );
});

test('buildSimulatorEquipmentLibraryItems follows latest equipmentSets input after plan removal', () => {
  const weapon = {
    id: 'weapon-1',
    name: '沧海灵杖',
    type: 'weapon' as const,
    mainStat: '伤害 +423',
    baseStats: {
      damage: 423,
      hit: 638,
    },
    level: 160,
    price: 8880000,
    stats: {
      magicDamage: 281,
    },
  };

  const beforeRemoval = buildSimulatorEquipmentLibraryItems({
    currentEquipment: [weapon],
    equipmentSets: [
      {
        id: 'plan-current',
        name: '任务套',
        items: [weapon],
      },
      {
        id: 'plan-speed',
        name: '高速方案',
        items: [weapon],
      },
    ],
    activeSetIndex: 0,
    candidateLibraryItems: [],
  });

  assert.deepEqual(
    sortLabels(beforeRemoval[0]?.sourceLabels ?? []),
    sortLabels(['任务套', '高速方案'])
  );

  const afterRemoval = buildSimulatorEquipmentLibraryItems({
    currentEquipment: [weapon],
    equipmentSets: [
      {
        id: 'plan-current',
        name: '任务套',
        items: [weapon],
      },
      {
        id: 'plan-speed',
        name: '高速方案',
        items: [],
      },
    ],
    activeSetIndex: 0,
    candidateLibraryItems: [],
  });

  assert.equal(afterRemoval.length, 1);
  assert.deepEqual(afterRemoval[0]?.sourceKinds, ['current_plan']);
  assert.deepEqual(afterRemoval[0]?.sourceLabels, ['任务套']);
});
