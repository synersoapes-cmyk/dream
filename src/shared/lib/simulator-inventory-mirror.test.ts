import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSimulatorInventoryMirrorDescriptors,
  buildSimulatorInventoryMirrorPayload,
  readSimulatorInventoryMirrorMeta,
} from './simulator-inventory-mirror';

test('buildSimulatorInventoryMirrorDescriptors mirrors current plan and other plans with deterministic source labels', () => {
  const descriptors = buildSimulatorInventoryMirrorDescriptors({
    characterId: 'character-1',
    currentEquipment: [
      {
        name: '沧海灵杖',
        type: 'weapon',
        level: 160,
        price: 8880000,
      },
    ],
    equipmentPlan: {
      activeSetIndex: 0,
      equipmentSets: [
        {
          id: 'plan-current',
          name: '任务套',
          items: [
            {
              name: '沧海灵杖',
              type: 'weapon',
              level: 160,
            },
          ],
        },
        {
          id: 'plan-speed',
          name: '高速套',
          items: [
            {
              name: '疾风鞋',
              type: 'shoes',
              level: 160,
              price: 6660000,
            },
          ],
        },
      ],
    },
  });

  assert.equal(descriptors.length, 2);

  const currentDescriptor = descriptors.find(
    (item) => item.sourceKind === 'current_plan'
  );
  const compareDescriptor = descriptors.find(
    (item) => item.sourceKind === 'equipment_plan'
  );

  assert.ok(currentDescriptor);
  assert.ok(compareDescriptor);
  assert.equal(currentDescriptor?.sourceLabel, '任务套');
  assert.equal(compareDescriptor?.sourceLabel, '高速套');
  assert.equal(currentDescriptor?.folderKey, 'current_plan:weapon');
  assert.equal(
    compareDescriptor?.folderKey,
    'equipment_plan:plan-speed:shoes'
  );
  assert.match(currentDescriptor?.assetId ?? '', /^inv_mirror_asset_/);
  assert.match(compareDescriptor?.entryId ?? '', /^inv_mirror_entry_/);
});

test('readSimulatorInventoryMirrorMeta reads mirror metadata from payload json', () => {
  const payload = JSON.parse(
    buildSimulatorInventoryMirrorPayload({
      equipment: {
        name: '沧海灵杖',
        type: 'weapon',
      },
      meta: {
        mirrorManaged: true,
        sourceKind: 'current_plan',
        sourceLabel: '任务套',
        planId: 'plan-current',
        isActivePlan: true,
      },
    })
  );

  assert.deepEqual(readSimulatorInventoryMirrorMeta(payload), {
    mirrorManaged: true,
    sourceKind: 'current_plan',
    sourceLabel: '任务套',
    planId: 'plan-current',
    isActivePlan: true,
  });
});
