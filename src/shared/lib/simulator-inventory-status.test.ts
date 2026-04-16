import test from 'node:test';
import assert from 'node:assert/strict';

import type { SimulatorEquipmentLibraryItem } from '@/shared/lib/simulator-equipment-library';

import {
  buildSimulatorInventoryEmptyStateCopy,
  buildSimulatorInventorySelectorStatusLabels,
  buildSimulatorInventoryStatusLabels,
  buildSimulatorInventoryStatusUpdateDraft,
  getCandidateBackedInventoryRefs,
  getSimulatorInventoryLifecycleLabel,
  getSimulatorInventoryUpdateToastTitle,
  summarizeSimulatorInventoryRefs,
} from './simulator-inventory-status';

function createLibraryItem(
  overrides?: Partial<SimulatorEquipmentLibraryItem>
): SimulatorEquipmentLibraryItem {
  return {
    id: 'item-1',
    timestamp: 1,
    status: 'confirmed',
    selectable: false,
    sourceKinds: ['inventory_asset'],
    sourceLabels: ['正式库存'],
    equipment: {
      id: 'weapon-1',
      name: '测试法杖',
      type: 'weapon',
      mainStat: '法伤 +200',
      baseStats: {},
      stats: {},
    },
    ...overrides,
  };
}

test('getCandidateBackedInventoryRefs only keeps active candidate-backed refs', () => {
  const item = createLibraryItem({
    inventoryRefs: [
      {
        entryId: 'entry-active',
        assetId: 'asset-1',
        status: 'active',
        sourceKind: 'candidate_library',
        sourceLabel: '候选装备库',
        folderKey: 'inventory',
        price: 100,
      },
      {
        entryId: 'entry-sold',
        assetId: 'asset-2',
        status: 'sold',
        sourceKind: 'candidate_library',
        sourceLabel: '候选装备库',
        folderKey: 'inventory',
        price: 100,
      },
      {
        entryId: 'entry-mirror',
        assetId: 'asset-3',
        status: 'active',
        sourceKind: 'current_plan',
        sourceLabel: '当前方案',
        folderKey: 'current_plan',
        price: 100,
      },
    ],
  });

  assert.deepEqual(
    getCandidateBackedInventoryRefs(item).map((ref) => ref.entryId),
    ['entry-active']
  );
  assert.deepEqual(
    getCandidateBackedInventoryRefs(item, ['sold']).map((ref) => ref.entryId),
    ['entry-sold']
  );
});

test('summarizeSimulatorInventoryRefs counts lifecycle and candidate-backed refs separately', () => {
  const item = createLibraryItem({
    inventoryRefs: [
      {
        entryId: 'entry-active',
        assetId: 'asset-1',
        status: 'active',
        sourceKind: 'candidate_library',
        sourceLabel: '候选装备库',
        folderKey: 'inventory',
        price: 100,
      },
      {
        entryId: 'entry-sold',
        assetId: 'asset-2',
        status: 'sold',
        sourceKind: 'candidate_library',
        sourceLabel: '候选装备库',
        folderKey: 'inventory',
        price: 100,
      },
      {
        entryId: 'entry-discarded',
        assetId: 'asset-3',
        status: 'discarded',
        sourceKind: 'inventory_asset',
        sourceLabel: '正式库存',
        folderKey: 'inventory',
        price: 100,
      },
    ],
  });

  assert.deepEqual(summarizeSimulatorInventoryRefs(item), {
    active: 1,
    sold: 1,
    discarded: 1,
    candidateActive: 1,
    candidateSold: 1,
    candidateDiscarded: 0,
  });
});

test('buildSimulatorInventoryStatusUpdateDraft deduplicates entry ids across items', () => {
  const first = createLibraryItem({
    id: 'item-a',
    inventoryRefs: [
      {
        entryId: 'entry-a',
        assetId: 'asset-a',
        status: 'active',
        sourceKind: 'candidate_library',
        sourceLabel: '候选装备库',
        folderKey: 'inventory',
        price: 100,
      },
      {
        entryId: 'entry-shared',
        assetId: 'asset-shared',
        status: 'active',
        sourceKind: 'candidate_library',
        sourceLabel: '候选装备库',
        folderKey: 'inventory',
        price: 100,
      },
    ],
  });
  const second = createLibraryItem({
    id: 'item-b',
    equipment: {
      id: 'weapon-2',
      name: '测试宝冠',
      type: 'helmet',
      mainStat: '防御 +80',
      baseStats: {},
      stats: {},
    },
    inventoryRefs: [
      {
        entryId: 'entry-shared',
        assetId: 'asset-shared',
        status: 'active',
        sourceKind: 'candidate_library',
        sourceLabel: '候选装备库',
        folderKey: 'inventory',
        price: 200,
      },
      {
        entryId: 'entry-b',
        assetId: 'asset-b',
        status: 'active',
        sourceKind: 'candidate_library',
        sourceLabel: '候选装备库',
        folderKey: 'inventory',
        price: 200,
      },
    ],
  });

  const draft = buildSimulatorInventoryStatusUpdateDraft({
    items: [first, second],
    nextStatus: 'sold',
  });

  assert.ok(draft);
  assert.equal(draft.primaryItem.id, 'item-a');
  assert.equal(draft.items.length, 2);
  assert.deepEqual(draft.entryIds, ['entry-a', 'entry-shared', 'entry-b']);
  assert.equal(draft.nextStatus, 'sold');
});

test('buildSimulatorInventoryStatusUpdateDraft restores sold and discarded refs back to active', () => {
  const item = createLibraryItem({
    inventoryRefs: [
      {
        entryId: 'entry-sold',
        assetId: 'asset-sold',
        status: 'sold',
        sourceKind: 'candidate_library',
        sourceLabel: '候选装备库',
        folderKey: 'inventory',
        price: 100,
      },
      {
        entryId: 'entry-discarded',
        assetId: 'asset-discarded',
        status: 'discarded',
        sourceKind: 'candidate_library',
        sourceLabel: '候选装备库',
        folderKey: 'inventory',
        price: 100,
      },
      {
        entryId: 'entry-active',
        assetId: 'asset-active',
        status: 'active',
        sourceKind: 'candidate_library',
        sourceLabel: '候选装备库',
        folderKey: 'inventory',
        price: 100,
      },
    ],
  });

  const draft = buildSimulatorInventoryStatusUpdateDraft({
    items: [item],
    nextStatus: 'active',
  });

  assert.ok(draft);
  assert.equal(draft.nextStatus, 'active');
  assert.deepEqual(draft.entryIds, ['entry-sold', 'entry-discarded']);
});

test('inventory lifecycle helpers expose unified labels, tones and toast copy', () => {
  assert.equal(getSimulatorInventoryLifecycleLabel('active'), '库存待用');
  assert.equal(
    getSimulatorInventoryLifecycleLabel('sold', { formal: true }),
    '正式库存已售出'
  );
  assert.equal(getSimulatorInventoryUpdateToastTitle('discarded'), '已标记为作废');

  assert.deepEqual(
    buildSimulatorInventoryStatusLabels({
      active: 1,
      sold: 1,
      discarded: 0,
      candidateActive: 1,
      candidateSold: 1,
      candidateDiscarded: 0,
    }),
    [
      { label: '库存待用', tone: 'emerald' },
      { label: '已售出', tone: 'amber' },
    ]
  );

  assert.deepEqual(
    buildSimulatorInventorySelectorStatusLabels(
      createLibraryItem({
        sourceKinds: ['inventory_asset'],
        inventoryRefs: [
          {
            entryId: 'entry-active',
            assetId: 'asset-active',
            status: 'active',
            sourceKind: 'candidate_library',
            sourceLabel: '候选装备库',
            folderKey: 'inventory',
            price: 100,
          },
        ],
      })
    ),
    [{ label: '库存待用', tone: 'emerald' }]
  );

  assert.deepEqual(
    buildSimulatorInventorySelectorStatusLabels(
      createLibraryItem({
        sourceKinds: ['current_plan'],
        inventoryRefs: [],
      })
    ),
    []
  );
});

test('inventory empty state helper distinguishes no records from filtered-out records', () => {
  assert.deepEqual(
    buildSimulatorInventoryEmptyStateCopy({
      lifecycleFilter: 'active',
      hasScopedInventoryItems: true,
      hasLifecycleMatches: false,
      hasAdditionalFilters: false,
      fallbackTitle: 'fallback',
      fallbackDescription: 'fallback-desc',
    }),
    {
      title: '当前没有可参与换装的正式库存',
      description:
        '可以先确认候选装备入库，或把已售出 / 已作废的正式库存恢复为“库存待用”。',
    }
  );

  assert.deepEqual(
    buildSimulatorInventoryEmptyStateCopy({
      lifecycleFilter: 'sold',
      hasScopedInventoryItems: true,
      hasLifecycleMatches: true,
      hasAdditionalFilters: true,
      fallbackTitle: 'fallback',
      fallbackDescription: 'fallback-desc',
    }),
    {
      title: '当前状态有记录，但未命中本次筛选条件',
      description:
        '可以清除当前部位 / 快捷视角 / 差异等附加筛选，或切换到其他状态继续处理。',
    }
  );
});
