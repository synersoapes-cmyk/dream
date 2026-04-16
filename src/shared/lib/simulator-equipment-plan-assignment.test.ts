import assert from 'node:assert/strict';
import test from 'node:test';

import type { Equipment, EquipmentSet } from '@/features/simulator/store/gameTypes';

import {
  buildBatchPlanAssignmentSummary,
  buildBatchPlanWritableEquipmentList,
  buildInventoryBulkActionProgress,
  buildInventoryBulkActionStage,
  buildInventoryQuickViewSuggestion,
  getBatchPlanWritableCountByMode,
  matchesInventoryQuickView,
  buildEquipmentSetDifferenceSummary,
  buildEquipmentPlanAssignmentOptions,
  buildEquipmentPlanUsageSummary,
  pickFirstEquipmentPerSlot,
  resolveLaboratoryCompareSeatCardState,
  resolveInventoryQuickViewKey,
} from '@/shared/lib/simulator-equipment-plan-assignment';

function createEquipment(
  id: string,
  type: Equipment['type'],
  value: number,
  slot?: number
): Equipment {
  return {
    id,
    name: id,
    type,
    slot,
    mainStat: `属性 +${value}`,
    baseStats: { magicDamage: value },
    stats: { magicDamage: value },
  };
}

function createEquipmentSet(
  id: string,
  name: string,
  items: Equipment[],
  isActive = false
): EquipmentSet {
  return {
    id,
    name,
    items,
    isActive,
  };
}

test('buildEquipmentPlanAssignmentOptions returns same replace and empty states', () => {
  const targetEquipment = createEquipment('weapon_target', 'weapon', 320);
  const options = buildEquipmentPlanAssignmentOptions({
    activeSetIndex: 0,
    equipment: targetEquipment,
    equipmentSets: [
      createEquipmentSet('set_1', '当前方案', [targetEquipment], true),
      createEquipmentSet('set_2', '高速方案', [
        createEquipment('weapon_other', 'weapon', 260),
      ]),
      createEquipmentSet('set_3', '爆发方案', [
        createEquipment('helmet_other', 'helmet', 80),
      ]),
    ],
  });

  assert.equal(options[0]?.state, 'same');
  assert.equal(options[1]?.state, 'replace');
  assert.equal(options[1]?.existingEquipment?.name, 'weapon_other');
  assert.equal(options[2]?.state, 'empty');
  assert.equal(options[2]?.existingEquipment, null);
});

test('buildEquipmentPlanUsageSummary summarizes plan occupancy labels', () => {
  assert.equal(
    buildEquipmentPlanUsageSummary(['当前方案', '高速方案', '候选装备库']),
    '方案占用：当前方案 / 高速方案'
  );

  assert.equal(
    buildEquipmentPlanUsageSummary([
      '当前方案',
      '高速方案',
      '爆发方案',
      '候选装备库',
    ]),
    '方案占用：当前方案 / 高速方案 等 3 套'
  );

  assert.equal(
    buildEquipmentPlanUsageSummary(['候选装备库']),
    '当前未写入任何装备方案'
  );

  assert.equal(
    buildEquipmentPlanUsageSummary(['正式库存', '候选装备库']),
    '当前未写入任何装备方案'
  );
});

test('resolveLaboratoryCompareSeatCardState distinguishes sample inheritance and explicit compare matches', () => {
  const sampleBelt = createEquipment('belt_sample', 'belt', 65);
  const compareBelt = createEquipment('belt_compare', 'belt', 88);
  const unrelatedWeapon = createEquipment('weapon_idle', 'weapon', 320);

  assert.deepEqual(
    resolveLaboratoryCompareSeatCardState({
      equipment: sampleBelt,
      sampleEquipment: [sampleBelt],
      compareEquipment: [sampleBelt],
      compareSeatLabel: '对比席位1',
    }),
    {
      compareSeatLabel: '对比席位1',
      isExplicitCompareMatch: false,
      isInheritedFromSample: true,
    }
  );

  assert.deepEqual(
    resolveLaboratoryCompareSeatCardState({
      equipment: compareBelt,
      sampleEquipment: [sampleBelt],
      compareEquipment: [compareBelt],
      compareSeatLabel: '对比席位1',
    }),
    {
      compareSeatLabel: '对比席位1',
      isExplicitCompareMatch: true,
      isInheritedFromSample: false,
    }
  );

  assert.deepEqual(
    resolveLaboratoryCompareSeatCardState({
      equipment: unrelatedWeapon,
      sampleEquipment: [sampleBelt],
      compareEquipment: [compareBelt],
      compareSeatLabel: '对比席位1',
    }),
    {
      compareSeatLabel: '对比席位1',
      isExplicitCompareMatch: false,
      isInheritedFromSample: false,
    }
  );
});

test('buildBatchPlanAssignmentSummary splits same replace and empty counts', () => {
  const targetEquipmentList = [
    createEquipment('weapon_same', 'weapon', 320),
    createEquipment('helmet_old', 'helmet', 80),
  ];
  const equipmentList = [
    createEquipment('weapon_same', 'weapon', 320),
    createEquipment('helmet_new', 'helmet', 96),
    createEquipment('amulet_new', 'necklace', 120),
  ];

  assert.deepEqual(
    buildBatchPlanAssignmentSummary({
      equipmentList,
      targetEquipmentList,
    }),
    {
      totalCount: 3,
      sameCount: 1,
      replaceCount: 1,
      emptyCount: 1,
      writableCount: 2,
    }
  );
});

test('getBatchPlanWritableCountByMode supports all batch write modes', () => {
  const summary = {
    totalCount: 3,
    sameCount: 1,
    replaceCount: 1,
    emptyCount: 1,
    writableCount: 2,
  };

  assert.equal(
    getBatchPlanWritableCountByMode({
      summary,
      mode: 'all_writable',
    }),
    2
  );

  assert.equal(
    getBatchPlanWritableCountByMode({
      summary,
      mode: 'empty_only',
    }),
    1
  );

  assert.equal(
    getBatchPlanWritableCountByMode({
      summary,
      mode: 'replace_only',
    }),
    1
  );
});

test('buildBatchPlanWritableEquipmentList can restrict writes by batch mode', () => {
  const targetEquipmentList = [
    createEquipment('weapon_same', 'weapon', 320),
    createEquipment('helmet_old', 'helmet', 80),
  ];
  const equipmentList = [
    createEquipment('weapon_same', 'weapon', 320),
    createEquipment('helmet_new', 'helmet', 96),
    createEquipment('amulet_new', 'necklace', 120),
  ];

  assert.deepEqual(
    buildBatchPlanWritableEquipmentList({
      equipmentList,
      targetEquipmentList,
      mode: 'all_writable',
    }).map((equipment) => equipment.id),
    ['helmet_new', 'amulet_new']
  );

  assert.deepEqual(
    buildBatchPlanWritableEquipmentList({
      equipmentList,
      targetEquipmentList,
      mode: 'empty_only',
    }).map((equipment) => equipment.id),
    ['amulet_new']
  );

  assert.deepEqual(
    buildBatchPlanWritableEquipmentList({
      equipmentList,
      targetEquipmentList,
      mode: 'replace_only',
    }).map((equipment) => equipment.id),
    ['helmet_new']
  );
});

test('buildInventoryBulkActionProgress deduplicates slot counts across follow-up buckets', () => {
  const progress = buildInventoryBulkActionProgress({
    affectedSlotKeys: ['weapon:main', 'weapon:main', 'helmet:main', 'necklace:main'],
    scopedSlotKeys: ['weapon:main', 'helmet:main'],
    equippedSlotKeys: ['weapon:main'],
    idleSlotKeys: ['helmet:main'],
    inLabSlotKeys: [],
    sendableLabSlotKeys: ['weapon:main', 'helmet:main'],
    removableLabSlotKeys: ['weapon:main'],
    planWritableSlotKeys: ['helmet:main', 'necklace:main'],
  });

  assert.deepEqual(progress, {
    totalSlotCount: 3,
    visibleSlotCount: 2,
    equippedSlotCount: 1,
    idleSlotCount: 1,
    inLabSlotCount: 0,
    sendableLabSlotCount: 2,
    removableLabSlotCount: 1,
    planWritableSlotCount: 2,
    actionableSlotCount: 3,
    completedSlotCount: 0,
    hasFollowUpActions: true,
  });
});

test('buildInventoryBulkActionStage prefers remove lab, then send lab, then write plan', () => {
  assert.deepEqual(
    buildInventoryBulkActionStage({
      totalSlotCount: 3,
      visibleSlotCount: 3,
      equippedSlotCount: 0,
      idleSlotCount: 0,
      inLabSlotCount: 2,
      sendableLabSlotCount: 1,
      removableLabSlotCount: 2,
      planWritableSlotCount: 3,
      actionableSlotCount: 3,
      completedSlotCount: 0,
      hasFollowUpActions: true,
    }),
    {
      key: 'remove_lab',
      label: '实验室处理中',
      description: '这批部位里还有装备在实验室，可继续对比或撤回。',
      tone: 'violet',
      recommendedActionKey: 'remove_lab',
      isComplete: false,
    }
  );

  assert.deepEqual(
    buildInventoryBulkActionStage({
      totalSlotCount: 2,
      visibleSlotCount: 2,
      equippedSlotCount: 0,
      idleSlotCount: 2,
      inLabSlotCount: 0,
      sendableLabSlotCount: 2,
      removableLabSlotCount: 0,
      planWritableSlotCount: 2,
      actionableSlotCount: 2,
      completedSlotCount: 0,
      hasFollowUpActions: true,
    }),
    {
      key: 'send_lab',
      label: '待送实验室',
      description: '这批部位里还有装备尚未进实验室，适合继续送测。',
      tone: 'cyan',
      recommendedActionKey: 'send_lab',
      isComplete: false,
    }
  );

  assert.deepEqual(
    buildInventoryBulkActionStage({
      totalSlotCount: 2,
      visibleSlotCount: 2,
      equippedSlotCount: 0,
      idleSlotCount: 2,
      inLabSlotCount: 0,
      sendableLabSlotCount: 0,
      removableLabSlotCount: 0,
      planWritableSlotCount: 2,
      actionableSlotCount: 2,
      completedSlotCount: 0,
      hasFollowUpActions: true,
    }),
    {
      key: 'write_plan',
      label: '待写入方案',
      description: '这批部位仍可继续批量写入装备方案。',
      tone: 'amber',
      recommendedActionKey: 'write_plan',
      isComplete: false,
    }
  );
});

test('buildInventoryBulkActionStage returns complete state when no actions remain', () => {
  assert.deepEqual(
    buildInventoryBulkActionStage({
      totalSlotCount: 4,
      visibleSlotCount: 4,
      equippedSlotCount: 1,
      idleSlotCount: 3,
      inLabSlotCount: 0,
      sendableLabSlotCount: 0,
      removableLabSlotCount: 0,
      planWritableSlotCount: 0,
      actionableSlotCount: 0,
      completedSlotCount: 4,
      hasFollowUpActions: false,
    }),
    {
      key: 'complete',
      label: '已收尾',
      description: '当前这批部位在总库视图里已经没有下一步批量动作。',
      tone: 'emerald',
      recommendedActionKey: null,
      isComplete: true,
    }
  );
});

test('buildEquipmentSetDifferenceSummary returns differing slot keys between current and sample plans', () => {
  const currentEquipment = [
    createEquipment('weapon_current', 'weapon', 300),
    createEquipment('helmet_same', 'helmet', 80),
    createEquipment('ring_current', 'trinket', 50, 1),
  ];
  const sampleEquipment = [
    createEquipment('weapon_sample', 'weapon', 260),
    createEquipment('helmet_same', 'helmet', 80),
    createEquipment('jade_sample', 'jade', 35, 1),
  ];

  const summary = buildEquipmentSetDifferenceSummary({
    currentEquipment,
    sampleEquipment,
  });

  assert.equal(summary.differenceCount, 3);
  assert.deepEqual(summary.differentSlotKeys.sort(), [
    'jade:1',
    'trinket:1',
    'weapon:main',
  ]);
  assert.deepEqual(summary.currentOnlySlotKeys, ['trinket:1']);
  assert.deepEqual(summary.sampleOnlySlotKeys, ['jade:1']);
  assert.deepEqual(summary.replacedSlotKeys, ['weapon:main']);
});

test('pickFirstEquipmentPerSlot keeps current order and removes later duplicates in same slot', () => {
  const items = [
    { equipment: createEquipment('weapon_a', 'weapon', 320) },
    { equipment: createEquipment('weapon_b', 'weapon', 300) },
    { equipment: createEquipment('ring_a', 'trinket', 50, 1) },
    { equipment: createEquipment('ring_b', 'trinket', 55, 1) },
    { equipment: createEquipment('amulet', 'necklace', 120) },
  ];

  assert.deepEqual(
    pickFirstEquipmentPerSlot(items).map((item) => item.equipment.id),
    ['weapon_a', 'ring_a', 'amulet']
  );
});

test('resolveInventoryQuickViewKey maps status and difference filters to active quick views', () => {
  assert.equal(
    resolveInventoryQuickViewKey({
      statusFilter: 'idle',
      differenceFilter: 'different',
    }),
    'diff_idle'
  );

  assert.equal(
    resolveInventoryQuickViewKey({
      statusFilter: 'idle',
      differenceFilter: 'current_only',
    }),
    'current_only_idle'
  );

  assert.equal(
    resolveInventoryQuickViewKey({
      statusFilter: 'idle',
      differenceFilter: 'replaced',
    }),
    'replaced_idle'
  );

  assert.equal(
    resolveInventoryQuickViewKey({
      statusFilter: 'lab',
      differenceFilter: 'different',
    }),
    null
  );
});

test('buildInventoryQuickViewSuggestion returns recommended actions for each quick view', () => {
  assert.deepEqual(
    buildInventoryQuickViewSuggestion({
      quickViewKey: 'diff_idle',
      canQuickEquip: true,
      canAssignToPlan: true,
    }),
    {
      label: '建议送实验室',
      description: '先把这件差异装备送去实验室，再决定是否替换当前方案。',
      recommendedAction: 'secondary',
    }
  );

  assert.deepEqual(
    buildInventoryQuickViewSuggestion({
      quickViewKey: 'current_only_idle',
      canQuickEquip: true,
      canAssignToPlan: true,
    }),
    {
      label: '建议补实验室样本',
      description:
        '当前方案独有但实验室还没覆盖到，先补进实验室样本链路更稳。',
      recommendedAction: 'secondary',
    }
  );

  assert.deepEqual(
    buildInventoryQuickViewSuggestion({
      quickViewKey: 'replaced_idle',
      canQuickEquip: true,
      canAssignToPlan: true,
    }),
    {
      label: '建议直接挂到当前',
      description:
        '这是同部位替换候选，优先直接挂到当前方案看面板变化。',
      recommendedAction: 'primary',
    }
  );

  assert.deepEqual(
    buildInventoryQuickViewSuggestion({
      quickViewKey: 'replaced_idle',
      canQuickEquip: false,
      canAssignToPlan: true,
    }),
    {
      label: '建议先写入方案',
      description:
        '当前无法一键挂到当前栏位，先写入装备方案再继续比对更稳。',
      recommendedAction: 'tertiary',
    }
  );

  assert.deepEqual(
    buildInventoryQuickViewSuggestion({
      quickViewKey: 'replaced_idle',
      canQuickEquip: false,
      canAssignToPlan: false,
    }),
    {
      label: '建议先看详情',
      description: '这个部位当前不适合直接替换，先确认详情再决定下一步。',
      recommendedAction: null,
    }
  );
});

test('matchesInventoryQuickView keeps equipped differences visible for lab-oriented quick views', () => {
  assert.equal(
    matchesInventoryQuickView({
      quickViewKey: 'diff_idle',
      slotKey: 'weapon:main',
      currentEquipped: true,
      inLab: false,
      differentSlotKeys: ['weapon:main'],
      currentOnlySlotKeys: [],
      replacedSlotKeys: ['weapon:main'],
    }),
    true
  );

  assert.equal(
    matchesInventoryQuickView({
      quickViewKey: 'current_only_idle',
      slotKey: 'weapon:main',
      currentEquipped: true,
      inLab: false,
      differentSlotKeys: ['weapon:main'],
      currentOnlySlotKeys: ['weapon:main'],
      replacedSlotKeys: [],
    }),
    true
  );

  assert.equal(
    matchesInventoryQuickView({
      quickViewKey: 'replaced_idle',
      slotKey: 'weapon:main',
      currentEquipped: true,
      inLab: false,
      differentSlotKeys: ['weapon:main'],
      currentOnlySlotKeys: [],
      replacedSlotKeys: ['weapon:main'],
    }),
    false
  );

  assert.equal(
    matchesInventoryQuickView({
      quickViewKey: 'diff_idle',
      slotKey: 'weapon:main',
      currentEquipped: false,
      inLab: true,
      differentSlotKeys: ['weapon:main'],
      currentOnlySlotKeys: [],
      replacedSlotKeys: ['weapon:main'],
    }),
    false
  );
});
