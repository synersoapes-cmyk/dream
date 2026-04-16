import type { PendingEquipment } from '@/features/simulator/store/gameTypes';

import type { SimulatorEquipmentLibraryItem } from '@/shared/lib/simulator-equipment-library';

export type SimulatorInventoryLifecycleStatus = 'active' | 'sold' | 'discarded';
export type SimulatorInventoryBadgeTone = 'emerald' | 'amber' | 'violet';

export type SimulatorCandidateBackedInventoryRef = NonNullable<
  PendingEquipment['inventoryRefs']
>[number];

export type SimulatorInventoryStatusUpdateDraft = {
  items: SimulatorEquipmentLibraryItem[];
  primaryItem: SimulatorEquipmentLibraryItem;
  nextStatus: SimulatorInventoryLifecycleStatus;
  entryIds: string[];
};

export type SimulatorInventoryRefSummary = {
  active: number;
  sold: number;
  discarded: number;
  candidateActive: number;
  candidateSold: number;
  candidateDiscarded: number;
};

export type SimulatorInventoryStatusLabel = {
  label: string;
  tone: SimulatorInventoryBadgeTone;
};

export type SimulatorInventoryEmptyStateCopy = {
  title: string;
  description: string;
};

const SIMULATOR_INVENTORY_LIFECYCLE_COPY: Record<
  SimulatorInventoryLifecycleStatus,
  {
    label: string;
    formalLabel: string;
    tone: SimulatorInventoryBadgeTone;
    updateToastTitle: string;
  }
> = {
  active: {
    label: '库存待用',
    formalLabel: '正式库存待用',
    tone: 'emerald',
    updateToastTitle: '已恢复待用',
  },
  sold: {
    label: '已售出',
    formalLabel: '正式库存已售出',
    tone: 'amber',
    updateToastTitle: '已标记为售出',
  },
  discarded: {
    label: '已作废',
    formalLabel: '正式库存已作废',
    tone: 'violet',
    updateToastTitle: '已标记为作废',
  },
};

export function getCandidateBackedInventoryRefs(
  item: Pick<PendingEquipment, 'inventoryRefs'>,
  allowedStatuses: SimulatorInventoryLifecycleStatus[] = ['active']
): SimulatorCandidateBackedInventoryRef[] {
  return (item.inventoryRefs ?? []).filter(
    (ref): ref is SimulatorCandidateBackedInventoryRef =>
      ref.sourceKind === 'candidate_library' &&
      allowedStatuses.includes(ref.status as SimulatorInventoryLifecycleStatus)
  );
}

export function summarizeSimulatorInventoryRefs(
  item: Pick<PendingEquipment, 'inventoryRefs'>
): SimulatorInventoryRefSummary {
  const summary: SimulatorInventoryRefSummary = {
    active: 0,
    sold: 0,
    discarded: 0,
    candidateActive: 0,
    candidateSold: 0,
    candidateDiscarded: 0,
  };

  (item.inventoryRefs ?? []).forEach((ref) => {
    const status = ref.status as SimulatorInventoryLifecycleStatus;
    if (status === 'active' || status === 'sold' || status === 'discarded') {
      summary[status] += 1;

      if (ref.sourceKind === 'candidate_library') {
        if (status === 'active') {
          summary.candidateActive += 1;
        } else if (status === 'sold') {
          summary.candidateSold += 1;
        } else {
          summary.candidateDiscarded += 1;
        }
      }
    }
  });

  return summary;
}

export function buildSimulatorInventoryStatusUpdateDraft(params: {
  items: SimulatorEquipmentLibraryItem[];
  nextStatus: SimulatorInventoryLifecycleStatus;
}): SimulatorInventoryStatusUpdateDraft | null {
  const allowedStatuses =
    params.nextStatus === 'active' ? (['sold', 'discarded'] as const) : (['active'] as const);
  const entryIds = Array.from(
    new Set(
      params.items.flatMap((item) =>
        getCandidateBackedInventoryRefs(item, [...allowedStatuses]).map(
          (ref) => ref.entryId
        )
      )
    )
  );

  if (params.items.length === 0 || entryIds.length === 0) {
    return null;
  }

  return {
    items: params.items,
    primaryItem: params.items[0],
    nextStatus: params.nextStatus,
    entryIds,
  };
}

export function getSimulatorInventoryLifecycleLabel(
  status: SimulatorInventoryLifecycleStatus,
  options?: { formal?: boolean }
) {
  const copy = SIMULATOR_INVENTORY_LIFECYCLE_COPY[status];
  return options?.formal ? copy.formalLabel : copy.label;
}

export function getSimulatorInventoryLifecycleTone(
  status: SimulatorInventoryLifecycleStatus
) {
  return SIMULATOR_INVENTORY_LIFECYCLE_COPY[status].tone;
}

export function getSimulatorInventoryUpdateToastTitle(
  status: SimulatorInventoryLifecycleStatus
) {
  return SIMULATOR_INVENTORY_LIFECYCLE_COPY[status].updateToastTitle;
}

export function buildSimulatorInventoryStatusLabels(
  summary: SimulatorInventoryRefSummary,
  options?: { formal?: boolean }
): SimulatorInventoryStatusLabel[] {
  const statuses: SimulatorInventoryLifecycleStatus[] = [
    'active',
    'sold',
    'discarded',
  ];

  return statuses
    .filter((status) => summary[status] > 0)
    .map((status) => ({
      label: getSimulatorInventoryLifecycleLabel(status, options),
      tone: getSimulatorInventoryLifecycleTone(status),
    }));
}

export function buildSimulatorInventorySelectorStatusLabels(
  item: Pick<SimulatorEquipmentLibraryItem, 'sourceKinds' | 'inventoryRefs'>
): SimulatorInventoryStatusLabel[] {
  if (!item.sourceKinds.includes('inventory_asset')) {
    return [];
  }

  const summary = summarizeSimulatorInventoryRefs(item);

  if (summary.active <= 0) {
    return [];
  }

  return [
    {
      label: getSimulatorInventoryLifecycleLabel('active'),
      tone: getSimulatorInventoryLifecycleTone('active'),
    },
  ];
}

export function buildSimulatorInventoryEmptyStateCopy(params: {
  lifecycleFilter: 'all' | SimulatorInventoryLifecycleStatus;
  hasScopedInventoryItems: boolean;
  hasLifecycleMatches: boolean;
  hasAdditionalFilters: boolean;
  fallbackTitle: string;
  fallbackDescription: string;
}): SimulatorInventoryEmptyStateCopy {
  if (!params.hasScopedInventoryItems) {
    return {
      title: params.fallbackTitle,
      description: params.fallbackDescription,
    };
  }

  if (params.lifecycleFilter === 'active' && !params.hasLifecycleMatches) {
    return {
      title: '当前没有可参与换装的正式库存',
      description:
        '可以先确认候选装备入库，或把已售出 / 已作废的正式库存恢复为“库存待用”。',
    };
  }

  if (
    (params.lifecycleFilter === 'sold' ||
      params.lifecycleFilter === 'discarded') &&
    !params.hasLifecycleMatches
  ) {
    return {
      title: '当前没有可恢复待用的正式库存',
      description:
        '当前正式库存里没有这个生命周期的记录；如需重新参与换装，请先在总库里完成标记后再恢复。',
    };
  }

  if (params.lifecycleFilter !== 'all' && params.hasAdditionalFilters) {
    return {
      title: '当前状态有记录，但未命中本次筛选条件',
      description:
        '可以清除当前部位 / 快捷视角 / 差异等附加筛选，或切换到其他状态继续处理。',
    };
  }

  return {
    title: params.fallbackTitle,
    description: params.fallbackDescription,
  };
}
