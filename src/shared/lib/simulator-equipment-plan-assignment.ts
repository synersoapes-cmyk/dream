import type { Equipment, EquipmentSet } from '@/features/simulator/store/gameTypes';

export type SimulatorEquipmentPlanAssignmentState =
  | 'same'
  | 'replace'
  | 'empty';

export type SimulatorEquipmentInventoryQuickViewKey =
  | 'diff_idle'
  | 'current_only_idle'
  | 'replaced_idle';

export type SimulatorEquipmentQuickActionKey =
  | 'primary'
  | 'secondary'
  | 'tertiary';

export type SimulatorEquipmentPlanAssignmentOption = {
  index: number;
  name: string;
  isActive: boolean;
  state: SimulatorEquipmentPlanAssignmentState;
  existingEquipment: Equipment | null;
};

export type SimulatorEquipmentQuickViewSuggestion = {
  label: string;
  description: string;
  recommendedAction: SimulatorEquipmentQuickActionKey | null;
};

export type SimulatorEquipmentBatchPlanAssignmentSummary = {
  totalCount: number;
  sameCount: number;
  replaceCount: number;
  emptyCount: number;
  writableCount: number;
};

export type SimulatorEquipmentBatchPlanWriteMode =
  | 'all_writable'
  | 'empty_only'
  | 'replace_only';

export type SimulatorLaboratoryCompareSeatCardState = {
  compareSeatLabel: string;
  isExplicitCompareMatch: boolean;
  isInheritedFromSample: boolean;
};

export type SimulatorEquipmentInventoryBulkActionFollowUpKey =
  | 'send_lab'
  | 'remove_lab'
  | 'write_plan';

export type SimulatorEquipmentInventoryBulkActionProgress = {
  totalSlotCount: number;
  visibleSlotCount: number;
  equippedSlotCount: number;
  idleSlotCount: number;
  inLabSlotCount: number;
  sendableLabSlotCount: number;
  removableLabSlotCount: number;
  planWritableSlotCount: number;
  actionableSlotCount: number;
  completedSlotCount: number;
  hasFollowUpActions: boolean;
};

export type SimulatorEquipmentInventoryBulkActionStageTone =
  | 'emerald'
  | 'violet'
  | 'cyan'
  | 'amber'
  | 'slate';

export type SimulatorEquipmentInventoryBulkActionStage = {
  key:
    | 'complete'
    | 'remove_lab'
    | 'send_lab'
    | 'write_plan'
    | 'continue';
  label: string;
  description: string;
  tone: SimulatorEquipmentInventoryBulkActionStageTone;
  recommendedActionKey: SimulatorEquipmentInventoryBulkActionFollowUpKey | null;
  isComplete: boolean;
};

export function buildEquipmentSlotKey(equipment: Equipment) {
  return `${equipment.type}:${equipment.slot ?? 'main'}`;
}

export function pickFirstEquipmentPerSlot<T extends { equipment: Equipment }>(
  items: T[]
) {
  const seenSlotKeys = new Set<string>();

  return items.filter((item) => {
    const slotKey = buildEquipmentSlotKey(item.equipment);
    if (seenSlotKeys.has(slotKey)) {
      return false;
    }

    seenSlotKeys.add(slotKey);
    return true;
  });
}

export function findEquipmentSlotOccupant(
  equipmentList: Equipment[],
  equipment: Equipment
) {
  return (
    equipmentList.find(
      (item) =>
        item.type === equipment.type &&
        (equipment.slot === undefined || item.slot === equipment.slot)
    ) ?? null
  );
}

export function isSameEquipmentForPlan(left: Equipment, right: Equipment) {
  return (
    left.id === right.id &&
    left.type === right.type &&
    left.slot === right.slot
  );
}

export function buildEquipmentPlanAssignmentOptions(params: {
  equipmentSets: EquipmentSet[];
  activeSetIndex: number;
  equipment: Equipment;
}): SimulatorEquipmentPlanAssignmentOption[] {
  return params.equipmentSets.map((set, index) => {
    const existingEquipment = findEquipmentSlotOccupant(set.items, params.equipment);
    const state: SimulatorEquipmentPlanAssignmentState = !existingEquipment
      ? 'empty'
      : isSameEquipmentForPlan(existingEquipment, params.equipment)
        ? 'same'
        : 'replace';

    return {
      index,
      name: set.name || `配置${index + 1}`,
      isActive: index === params.activeSetIndex,
      state,
      existingEquipment,
    };
  });
}

export function buildEquipmentPlanUsageSummary(sourceLabels: string[]) {
  const planLabels = sourceLabels.filter(
    (label) => label !== '候选装备库' && label !== '正式库存'
  );

  if (planLabels.length === 0) {
    return '当前未写入任何装备方案';
  }

  const visibleLabels = planLabels.slice(0, 2);
  const extraCount = Math.max(0, planLabels.length - visibleLabels.length);

  return `方案占用：${visibleLabels.join(' / ')}${extraCount > 0 ? ` 等 ${planLabels.length} 套` : ''}`;
}

export function resolveLaboratoryCompareSeatCardState(params: {
  equipment: Equipment;
  sampleEquipment: Equipment[];
  compareEquipment?: Equipment[] | null;
  compareSeatLabel?: string;
}): SimulatorLaboratoryCompareSeatCardState {
  const compareOccupant = params.compareEquipment
    ? findEquipmentSlotOccupant(params.compareEquipment, params.equipment)
    : null;
  const sampleOccupant = findEquipmentSlotOccupant(
    params.sampleEquipment,
    params.equipment
  );
  const sameInCompareSeat = compareOccupant
    ? isSameEquipmentForPlan(compareOccupant, params.equipment)
    : false;
  const sameInSampleSeat = sampleOccupant
    ? isSameEquipmentForPlan(sampleOccupant, params.equipment)
    : false;

  return {
    compareSeatLabel: params.compareSeatLabel || '对比席位',
    isExplicitCompareMatch: Boolean(sameInCompareSeat && !sameInSampleSeat),
    isInheritedFromSample: sameInSampleSeat,
  };
}

export function buildBatchPlanAssignmentSummary(params: {
  equipmentList: Equipment[];
  targetEquipmentList: Equipment[];
}): SimulatorEquipmentBatchPlanAssignmentSummary {
  return params.equipmentList.reduce<SimulatorEquipmentBatchPlanAssignmentSummary>(
    (summary, equipment) => {
      const existingEquipment = findEquipmentSlotOccupant(
        params.targetEquipmentList,
        equipment
      );

      if (!existingEquipment) {
        summary.emptyCount += 1;
        summary.writableCount += 1;
        summary.totalCount += 1;
        return summary;
      }

      if (isSameEquipmentForPlan(existingEquipment, equipment)) {
        summary.sameCount += 1;
        summary.totalCount += 1;
        return summary;
      }

      summary.replaceCount += 1;
      summary.writableCount += 1;
      summary.totalCount += 1;
      return summary;
    },
    {
      totalCount: 0,
      sameCount: 0,
      replaceCount: 0,
      emptyCount: 0,
      writableCount: 0,
    }
  );
}

export function getBatchPlanWritableCountByMode(params: {
  summary: SimulatorEquipmentBatchPlanAssignmentSummary;
  mode: SimulatorEquipmentBatchPlanWriteMode;
}) {
  if (params.mode === 'empty_only') {
    return params.summary.emptyCount;
  }

  if (params.mode === 'replace_only') {
    return params.summary.replaceCount;
  }

  return params.summary.writableCount;
}

export function buildBatchPlanWritableEquipmentList(params: {
  equipmentList: Equipment[];
  targetEquipmentList: Equipment[];
  mode: SimulatorEquipmentBatchPlanWriteMode;
}) {
  return params.equipmentList.filter((equipment) => {
    const existingEquipment = findEquipmentSlotOccupant(
      params.targetEquipmentList,
      equipment
    );

    if (!existingEquipment) {
      return params.mode !== 'replace_only';
    }

    if (params.mode === 'empty_only') {
      return false;
    }

    return !isSameEquipmentForPlan(existingEquipment, equipment);
  });
}

function countUniqueSlotKeys(slotKeys: string[]) {
  return new Set(slotKeys).size;
}

export function buildInventoryBulkActionProgress(params: {
  affectedSlotKeys: string[];
  scopedSlotKeys: string[];
  equippedSlotKeys: string[];
  idleSlotKeys: string[];
  inLabSlotKeys: string[];
  sendableLabSlotKeys: string[];
  removableLabSlotKeys: string[];
  planWritableSlotKeys: string[];
}): SimulatorEquipmentInventoryBulkActionProgress {
  const totalSlotCount = countUniqueSlotKeys(params.affectedSlotKeys);
  const visibleSlotCount = countUniqueSlotKeys(params.scopedSlotKeys);
  const equippedSlotCount = countUniqueSlotKeys(params.equippedSlotKeys);
  const idleSlotCount = countUniqueSlotKeys(params.idleSlotKeys);
  const inLabSlotCount = countUniqueSlotKeys(params.inLabSlotKeys);
  const sendableLabSlotCount = countUniqueSlotKeys(params.sendableLabSlotKeys);
  const removableLabSlotCount = countUniqueSlotKeys(
    params.removableLabSlotKeys
  );
  const planWritableSlotCount = countUniqueSlotKeys(params.planWritableSlotKeys);
  const actionableSlotCount = countUniqueSlotKeys([
    ...params.sendableLabSlotKeys,
    ...params.removableLabSlotKeys,
    ...params.planWritableSlotKeys,
  ]);
  const completedSlotCount = Math.max(0, totalSlotCount - actionableSlotCount);

  return {
    totalSlotCount,
    visibleSlotCount,
    equippedSlotCount,
    idleSlotCount,
    inLabSlotCount,
    sendableLabSlotCount,
    removableLabSlotCount,
    planWritableSlotCount,
    actionableSlotCount,
    completedSlotCount,
    hasFollowUpActions: actionableSlotCount > 0,
  };
}

export function buildInventoryBulkActionStage(
  progress: SimulatorEquipmentInventoryBulkActionProgress | null
): SimulatorEquipmentInventoryBulkActionStage | null {
  if (!progress) {
    return null;
  }

  if (progress.actionableSlotCount === 0) {
    return {
      key: 'complete',
      label: '已收尾',
      description: '当前这批部位在总库视图里已经没有下一步批量动作。',
      tone: 'emerald',
      recommendedActionKey: null,
      isComplete: true,
    };
  }

  if (progress.removableLabSlotCount > 0) {
    return {
      key: 'remove_lab',
      label: '实验室处理中',
      description: '这批部位里还有装备在实验室，可继续对比或撤回。',
      tone: 'violet',
      recommendedActionKey: 'remove_lab',
      isComplete: false,
    };
  }

  if (progress.sendableLabSlotCount > 0) {
    return {
      key: 'send_lab',
      label: '待送实验室',
      description: '这批部位里还有装备尚未进实验室，适合继续送测。',
      tone: 'cyan',
      recommendedActionKey: 'send_lab',
      isComplete: false,
    };
  }

  if (progress.planWritableSlotCount > 0) {
    return {
      key: 'write_plan',
      label: '待写入方案',
      description: '这批部位仍可继续批量写入装备方案。',
      tone: 'amber',
      recommendedActionKey: 'write_plan',
      isComplete: false,
    };
  }

  return {
    key: 'continue',
    label: '继续处理中',
    description: '这批部位还有可继续推进的动作。',
    tone: 'slate',
    recommendedActionKey: null,
    isComplete: false,
  };
}

export function buildEquipmentSetDifferenceSummary(params: {
  currentEquipment: Equipment[];
  sampleEquipment: Equipment[];
}) {
  const currentBySlot = new Map(
    params.currentEquipment.map((equipment) => [
      buildEquipmentSlotKey(equipment),
      equipment,
    ])
  );
  const sampleBySlot = new Map(
    params.sampleEquipment.map((equipment) => [
      buildEquipmentSlotKey(equipment),
      equipment,
    ])
  );

  const slotKeys = new Set([
    ...Array.from(currentBySlot.keys()),
    ...Array.from(sampleBySlot.keys()),
  ]);

  const currentOnlySlotKeys: string[] = [];
  const sampleOnlySlotKeys: string[] = [];
  const replacedSlotKeys: string[] = [];

  const differentSlotKeys = Array.from(slotKeys).filter((slotKey) => {
    const currentEquipment = currentBySlot.get(slotKey);
    const sampleEquipment = sampleBySlot.get(slotKey);

    if (!currentEquipment || !sampleEquipment) {
      if (currentEquipment && !sampleEquipment) {
        currentOnlySlotKeys.push(slotKey);
      }
      if (!currentEquipment && sampleEquipment) {
        sampleOnlySlotKeys.push(slotKey);
      }
      return true;
    }

    const different = !isSameEquipmentForPlan(currentEquipment, sampleEquipment);
    if (different) {
      replacedSlotKeys.push(slotKey);
    }
    return different;
  });

  return {
    differentSlotKeys,
    differenceCount: differentSlotKeys.length,
    currentOnlySlotKeys,
    sampleOnlySlotKeys,
    replacedSlotKeys,
  };
}

export function resolveInventoryQuickViewKey(params: {
  statusFilter: 'all' | 'equipped' | 'lab' | 'idle';
  differenceFilter:
    | 'all'
    | 'different'
    | 'current_only'
    | 'sample_only'
    | 'replaced';
}): SimulatorEquipmentInventoryQuickViewKey | null {
  if (params.statusFilter !== 'idle') {
    return null;
  }

  if (params.differenceFilter === 'different') {
    return 'diff_idle';
  }

  if (params.differenceFilter === 'current_only') {
    return 'current_only_idle';
  }

  if (params.differenceFilter === 'replaced') {
    return 'replaced_idle';
  }

  return null;
}

export function buildInventoryQuickViewSuggestion(params: {
  quickViewKey: SimulatorEquipmentInventoryQuickViewKey | null;
  canQuickEquip: boolean;
  canAssignToPlan: boolean;
}): SimulatorEquipmentQuickViewSuggestion | null {
  if (!params.quickViewKey) {
    return null;
  }

  if (params.quickViewKey === 'diff_idle') {
    return {
      label: '建议送实验室',
      description: '先把这件差异装备送去实验室，再决定是否替换当前方案。',
      recommendedAction: 'secondary',
    };
  }

  if (params.quickViewKey === 'current_only_idle') {
    return {
      label: '建议补实验室样本',
      description: '当前方案独有但实验室还没覆盖到，先补进实验室样本链路更稳。',
      recommendedAction: 'secondary',
    };
  }

  if (params.canQuickEquip) {
    return {
      label: '建议直接挂到当前',
      description: '这是同部位替换候选，优先直接挂到当前方案看面板变化。',
      recommendedAction: 'primary',
    };
  }

  if (params.canAssignToPlan) {
    return {
      label: '建议先写入方案',
      description: '当前无法一键挂到当前栏位，先写入装备方案再继续比对更稳。',
      recommendedAction: 'tertiary',
    };
  }

  return {
    label: '建议先看详情',
    description: '这个部位当前不适合直接替换，先确认详情再决定下一步。',
    recommendedAction: null,
  };
}

export function matchesInventoryQuickView(params: {
  quickViewKey: SimulatorEquipmentInventoryQuickViewKey | null;
  slotKey: string;
  currentEquipped: boolean;
  inLab: boolean;
  differentSlotKeys: string[];
  currentOnlySlotKeys: string[];
  replacedSlotKeys: string[];
}) {
  if (!params.quickViewKey) {
    return true;
  }

  if (params.quickViewKey === 'diff_idle') {
    return (
      !params.inLab && params.differentSlotKeys.includes(params.slotKey)
    );
  }

  if (params.quickViewKey === 'current_only_idle') {
    return (
      !params.inLab && params.currentOnlySlotKeys.includes(params.slotKey)
    );
  }

  return (
    !params.currentEquipped &&
    !params.inLab &&
    params.replacedSlotKeys.includes(params.slotKey)
  );
}
