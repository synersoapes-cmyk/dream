import type {
  Equipment,
  EquipmentSet,
  PendingEquipment,
} from '@/features/simulator/store/gameTypes';

import { buildEquipmentPlanUsageSummary } from '@/shared/lib/simulator-equipment-plan-assignment';

export type SimulatorEquipmentLibrarySourceKind =
  | 'candidate_library'
  | 'inventory_asset'
  | 'current_plan'
  | 'equipment_plan';

export type SimulatorEquipmentLibraryItem = PendingEquipment & {
  sourceKinds: SimulatorEquipmentLibrarySourceKind[];
  sourceLabels: string[];
  primarySourceLabels?: string[];
  planSourceLabels?: string[];
  currentPlanLabel?: string;
  selectable: boolean;
};

function mergeInventoryRefs(
  currentRefs: PendingEquipment['inventoryRefs'],
  nextRefs: PendingEquipment['inventoryRefs']
) {
  const merged = [...(currentRefs ?? [])];

  (nextRefs ?? []).forEach((nextRef) => {
    if (merged.some((currentRef) => currentRef.entryId === nextRef.entryId)) {
      return;
    }

    merged.push({ ...nextRef });
  });

  return merged.length > 0 ? merged : undefined;
}

function serializeEquipmentStats(stats: Equipment['stats']) {
  return Object.entries(stats ?? {})
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey, 'en'))
    .map(([key, value]) => `${key}:${String(value ?? '')}`)
    .join('|');
}

function getEquipmentLibraryMergeKey(equipment: Equipment) {
  return [
    equipment.type,
    equipment.slot ?? '',
    equipment.name,
    equipment.level ?? '',
    equipment.mainStat,
    equipment.extraStat ?? '',
    equipment.specialEffect ?? '',
    serializeEquipmentStats(equipment.stats),
  ].join('::');
}

function buildSyntheticLibraryItem(params: {
  equipment: Equipment;
  sourceLabel: string;
  sourceKind: Exclude<SimulatorEquipmentLibrarySourceKind, 'candidate_library'>;
  timestamp: number;
}): SimulatorEquipmentLibraryItem {
  return {
    id: `library_${params.sourceKind}_${params.equipment.id}`,
    equipment: params.equipment,
    timestamp: params.timestamp,
    status: 'confirmed',
    sourceKinds: [params.sourceKind],
    sourceLabels: [params.sourceLabel],
    primarySourceLabels: [],
    planSourceLabels: [params.sourceLabel],
    currentPlanLabel:
      params.sourceKind === 'current_plan' ? params.sourceLabel : undefined,
    selectable: false,
  };
}

export function buildSimulatorEquipmentLibraryItems(params: {
  currentEquipment: Equipment[];
  equipmentSets: EquipmentSet[];
  activeSetIndex: number;
  candidateLibraryItems: PendingEquipment[];
  inventoryLibraryItems?: PendingEquipment[];
  includePlanOnlyItems?: boolean;
}) {
  const mergedByKey = new Map<string, SimulatorEquipmentLibraryItem>();
  const includePlanOnlyItems = params.includePlanOnlyItems ?? true;

  const appendItem = (item: SimulatorEquipmentLibraryItem) => {
    const key = getEquipmentLibraryMergeKey(item.equipment);
    const existing = mergedByKey.get(key);

    if (!existing) {
      mergedByKey.set(key, {
        ...item,
        sourceKinds: [...item.sourceKinds],
        sourceLabels: [...item.sourceLabels],
        primarySourceLabels: [...(item.primarySourceLabels ?? [])],
        planSourceLabels: [...(item.planSourceLabels ?? [])],
        currentPlanLabel: item.currentPlanLabel,
        inventoryRefs: mergeInventoryRefs(undefined, item.inventoryRefs),
      });
      return;
    }

    existing.timestamp = Math.max(existing.timestamp, item.timestamp);
    existing.selectable = existing.selectable || item.selectable;

    item.sourceKinds.forEach((sourceKind) => {
      if (!existing.sourceKinds.includes(sourceKind)) {
        existing.sourceKinds.push(sourceKind);
      }
    });
    item.sourceLabels.forEach((sourceLabel) => {
      if (!existing.sourceLabels.includes(sourceLabel)) {
        existing.sourceLabels.push(sourceLabel);
      }
    });
    (item.primarySourceLabels ?? []).forEach((sourceLabel) => {
      if (!(existing.primarySourceLabels ?? []).includes(sourceLabel)) {
        existing.primarySourceLabels = [
          ...(existing.primarySourceLabels ?? []),
          sourceLabel,
        ];
      }
    });
    (item.planSourceLabels ?? []).forEach((sourceLabel) => {
      if (!(existing.planSourceLabels ?? []).includes(sourceLabel)) {
        existing.planSourceLabels = [
          ...(existing.planSourceLabels ?? []),
          sourceLabel,
        ];
      }
    });
    existing.currentPlanLabel =
      existing.currentPlanLabel ?? item.currentPlanLabel;
    existing.inventoryRefs = mergeInventoryRefs(
      existing.inventoryRefs,
      item.inventoryRefs
    );

    if (item.selectable) {
      existing.id = item.id;
      existing.imagePreview = item.imagePreview ?? existing.imagePreview;
      existing.rawText = item.rawText ?? existing.rawText;
      existing.targetSetId = item.targetSetId ?? existing.targetSetId;
      existing.targetEquipmentId =
        item.targetEquipmentId ?? existing.targetEquipmentId;
      existing.targetRuneStoneSetIndex =
        item.targetRuneStoneSetIndex ?? existing.targetRuneStoneSetIndex;
      existing.status = item.status;
      existing.equipment = item.equipment;
    }
  };

  const appendPlanRef = (params: {
    equipment: Equipment;
    sourceLabel: string;
    sourceKind: Exclude<
      SimulatorEquipmentLibrarySourceKind,
      'candidate_library'
    >;
    timestamp: number;
  }) => {
    const key = getEquipmentLibraryMergeKey(params.equipment);
    if (!includePlanOnlyItems && !mergedByKey.has(key)) {
      return;
    }

    appendItem(buildSyntheticLibraryItem(params));
  };

  (params.inventoryLibraryItems ?? []).forEach((item) => {
    appendItem({
      ...item,
      sourceKinds: ['inventory_asset'],
      sourceLabels: ['正式库存'],
      primarySourceLabels: ['正式库存'],
      planSourceLabels: [],
      currentPlanLabel: undefined,
      selectable: false,
    });
  });

  params.candidateLibraryItems.forEach((item) => {
    appendItem({
      ...item,
      sourceKinds: ['candidate_library'],
      sourceLabels: ['候选装备库'],
      primarySourceLabels: ['候选装备库'],
      planSourceLabels: [],
      currentPlanLabel: undefined,
      selectable: true,
    });
  });

  const activeSetName =
    params.equipmentSets[Math.max(0, params.activeSetIndex)]?.name ||
    '当前方案';

  params.currentEquipment.forEach((equipment, index) => {
    appendPlanRef({
      equipment,
      sourceLabel: activeSetName,
      sourceKind: 'current_plan',
      timestamp: 10_000 + index,
    });
  });

  params.equipmentSets.forEach((set, setIndex) => {
    if (setIndex === params.activeSetIndex) {
      return;
    }

    set.items.forEach((equipment, equipmentIndex) => {
      appendPlanRef({
        equipment,
        sourceLabel: set.name,
        sourceKind: 'equipment_plan',
        timestamp: 1_000 + setIndex * 100 + equipmentIndex,
      });
    });
  });

  return Array.from(mergedByKey.values());
}

export function buildSimulatorEquipmentSelectorHelperText(
  item: Pick<
    SimulatorEquipmentLibraryItem,
    'planSourceLabels' | 'currentPlanLabel'
  >
) {
  const planSourceLabels = item.planSourceLabels ?? [];
  const otherPlanLabels = planSourceLabels.filter(
    (label) => label !== item.currentPlanLabel
  );

  if (item.currentPlanLabel && otherPlanLabels.length > 0) {
    return `当前方案已使用 · ${buildEquipmentPlanUsageSummary(otherPlanLabels)}`;
  }

  if (item.currentPlanLabel) {
    return '当前方案已使用';
  }

  if (otherPlanLabels.length > 0) {
    return buildEquipmentPlanUsageSummary(otherPlanLabels);
  }

  return undefined;
}

export function sortSimulatorEquipmentSelectorItems(
  items: SimulatorEquipmentLibraryItem[]
) {
  return [...items].sort((left, right) => {
    const leftHasInventory =
      left.primarySourceLabels?.includes('正式库存') ?? false;
    const rightHasInventory =
      right.primarySourceLabels?.includes('正式库存') ?? false;
    if (leftHasInventory !== rightHasInventory) {
      return leftHasInventory ? -1 : 1;
    }

    const leftInCurrentPlan = Boolean(left.currentPlanLabel);
    const rightInCurrentPlan = Boolean(right.currentPlanLabel);
    if (leftInCurrentPlan !== rightInCurrentPlan) {
      return leftInCurrentPlan ? -1 : 1;
    }

    const timeDiff = (right.timestamp ?? 0) - (left.timestamp ?? 0);
    if (timeDiff !== 0) {
      return timeDiff;
    }

    return left.equipment.name.localeCompare(
      right.equipment.name,
      'zh-Hans-CN'
    );
  });
}
