'use client';

import { useMemo, useState } from 'react';
import { useGameStore } from '@/features/simulator/store/gameStore';
import {
  Package,
  X,
  Layers3,
  Shield,
  Sparkles,
  Gem,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';

import { EquipmentDetailModal } from '@/shared/blocks/simulator/EquipmentPanel/EquipmentDetailModal';
import { LaboratoryBulkDeleteDialog } from '@/shared/blocks/simulator/LaboratoryPanel/LaboratoryDialogs';
import { LibraryEquipmentCard } from '@/shared/blocks/simulator/LaboratoryPanel/LibraryEquipmentCard';
import {
  filterCandidateEquipmentItems,
  sortCandidateEquipmentItems,
  type SimulatorCandidateEquipmentSortKey,
} from '@/shared/lib/simulator-candidate-equipment-view';
import {
  buildBatchPlanAssignmentSummary,
  buildInventoryBulkActionProgress,
  buildInventoryBulkActionStage,
  buildBatchPlanWritableEquipmentList,
  buildInventoryQuickViewSuggestion,
  buildEquipmentPlanAssignmentOptions,
  buildEquipmentSetDifferenceSummary,
  buildEquipmentSlotKey,
  buildEquipmentPlanUsageSummary,
  findEquipmentSlotOccupant,
  getBatchPlanWritableCountByMode,
  isSameEquipmentForPlan,
  matchesInventoryQuickView,
  pickFirstEquipmentPerSlot,
  type SimulatorEquipmentBatchPlanWriteMode,
  type SimulatorEquipmentInventoryBulkActionStageTone,
  type SimulatorEquipmentInventoryQuickViewKey,
} from '@/shared/lib/simulator-equipment-plan-assignment';
import type {
  SimulatorEquipmentLibraryItem,
  SimulatorEquipmentLibrarySourceKind,
} from '@/shared/lib/simulator-equipment-library';
import {
  buildSimulatorInventoryEmptyStateCopy,
  buildSimulatorInventoryStatusLabels,
  buildSimulatorInventoryStatusUpdateDraft,
  getCandidateBackedInventoryRefs,
  getSimulatorInventoryLifecycleLabel,
  getSimulatorInventoryUpdateToastTitle,
  summarizeSimulatorInventoryRefs,
} from '@/shared/lib/simulator-inventory-status';
import { SIMULATOR_OPEN_LAB_EVENT } from '@/shared/lib/simulator-pending-review-request';
import {
  findSimulatorSlotDefinition,
  getSimulatorSlotDefinitions,
  getSimulatorSlotLabel,
  type SimulatorEquipmentCategoryKey,
} from '@/shared/lib/simulator-slot-config';

type Props = {
  items: SimulatorEquipmentLibraryItem[];
  formatPrice: (price: number | undefined) => string;
  onRemoveCandidateItems?: (
    items: SimulatorEquipmentLibraryItem[]
  ) => Promise<void> | void;
  onRemoveCandidateItem?: (
    item: SimulatorEquipmentLibraryItem
  ) => Promise<void> | void;
  onRefreshInventoryLibrarySources?: () => Promise<void> | void;
  onClose: () => void;
};

type InventoryStatusFilterKey = 'all' | 'equipped' | 'lab' | 'idle';
type InventoryLifecycleFilterKey = 'all' | 'active' | 'sold' | 'discarded';
type InventoryPlanFilterKey = 'all' | 'unassigned' | string;
type InventoryDifferenceFilterKey =
  | 'all'
  | 'different'
  | 'current_only'
  | 'sample_only'
  | 'replaced';

type InventoryBulkActionSummary = {
  id: string;
  title: string;
  description: string;
  tone: 'cyan' | 'violet' | 'amber';
  affectedSlotLabels: string[];
  affectedSlotKeys: string[];
  targetLabel: string;
  viewHint: string;
  targetView: {
    sourceFilter: 'all' | SimulatorEquipmentLibrarySourceKind;
    inventoryLifecycleFilter: InventoryLifecycleFilterKey;
    statusFilter: InventoryStatusFilterKey;
    planFilter: InventoryPlanFilterKey;
    differenceFilter: InventoryDifferenceFilterKey;
    quickViewFilter: SimulatorEquipmentInventoryQuickViewKey | 'all';
  };
};

const SOURCE_FILTERS: Array<{
  key: 'all' | SimulatorEquipmentLibrarySourceKind;
  label: string;
}> = [
  { key: 'all', label: '全部来源' },
  { key: 'inventory_asset', label: '正式库存' },
  { key: 'current_plan', label: '当前方案' },
  { key: 'equipment_plan', label: '其他方案' },
  { key: 'candidate_library', label: '候选装备库' },
];

const CATEGORY_OPTIONS: Array<{
  key: SimulatorEquipmentCategoryKey;
  label: string;
  icon: typeof Shield;
}> = [
  { key: 'equipment', label: '装备', icon: Shield },
  { key: 'trinket', label: '灵饰', icon: Sparkles },
  { key: 'jade', label: '玉魄', icon: Gem },
];

const BULK_ACTION_STAGE_TONE_CLASS: Record<
  SimulatorEquipmentInventoryBulkActionStageTone,
  string
> = {
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
  violet: 'border-violet-500/30 bg-violet-500/10 text-violet-100',
  cyan: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  slate: 'border-slate-500/30 bg-slate-500/10 text-slate-100',
};

export function EquipmentInventoryModal({
  items,
  formatPrice,
  onRemoveCandidateItems,
  onRemoveCandidateItem,
  onRefreshInventoryLibrarySources,
  onClose,
}: Props) {
  const currentEquipment = useGameStore((state) => state.equipment);
  const equipmentSets = useGameStore((state) => state.equipmentSets);
  const activeSetIndex = useGameStore((state) => state.activeSetIndex);
  const laboratorySampleSetIndex = useGameStore(
    (state) => state.laboratorySampleSetIndex
  );
  const updateEquipment = useGameStore((state) => state.updateEquipment);
  const updateEquipmentInSet = useGameStore(
    (state) => state.updateEquipmentInSet
  );
  const updateEquipmentListInSet = useGameStore(
    (state) => state.updateEquipmentListInSet
  );
  const removeEquipmentInSet = useGameStore((state) => state.removeEquipmentInSet);
  const removeEquipmentListInSet = useGameStore(
    (state) => state.removeEquipmentListInSet
  );
  const experimentSeats = useGameStore((state) => state.experimentSeats);
  const addExperimentSeat = useGameStore((state) => state.addExperimentSeat);
  const updateExperimentSeatEquipment = useGameStore(
    (state) => state.updateExperimentSeatEquipment
  );
  const removeExperimentSeatEquipment = useGameStore(
    (state) => state.removeExperimentSeatEquipment
  );
  const [sourceFilter, setSourceFilter] = useState<
    'all' | SimulatorEquipmentLibrarySourceKind
  >('all');
  const [inventoryLifecycleFilter, setInventoryLifecycleFilter] =
    useState<InventoryLifecycleFilterKey>('active');
  const [category, setCategory] =
    useState<SimulatorEquipmentCategoryKey>('equipment');
  const [secondaryCategory, setSecondaryCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] =
    useState<InventoryStatusFilterKey>('all');
  const [planFilter, setPlanFilter] = useState<InventoryPlanFilterKey>('all');
  const [differenceFilter, setDifferenceFilter] =
    useState<InventoryDifferenceFilterKey>('all');
  const [quickViewFilter, setQuickViewFilter] = useState<
    SimulatorEquipmentInventoryQuickViewKey | 'all'
  >('all');
  const [sortKey, setSortKey] =
    useState<SimulatorCandidateEquipmentSortKey>('newest');
  const [selectedItem, setSelectedItem] =
    useState<SimulatorEquipmentLibraryItem | null>(null);
  const [planPickerItem, setPlanPickerItem] =
    useState<SimulatorEquipmentLibraryItem | null>(null);
  const [isBatchPlanPickerOpen, setIsBatchPlanPickerOpen] = useState(false);
  const [batchPlanWriteMode, setBatchPlanWriteMode] =
    useState<SimulatorEquipmentBatchPlanWriteMode>('all_writable');
  const [bulkActionSummary, setBulkActionSummary] =
    useState<InventoryBulkActionSummary | null>(null);
  const [bulkActionFocusOnly, setBulkActionFocusOnly] = useState(false);
  const [candidateRemovalItem, setCandidateRemovalItem] =
    useState<SimulatorEquipmentLibraryItem | null>(null);
  const [candidateRemovalItems, setCandidateRemovalItems] = useState<
    SimulatorEquipmentLibraryItem[]
  >([]);
  const [inventoryStatusUpdate, setInventoryStatusUpdate] = useState<{
    items: SimulatorEquipmentLibraryItem[];
    primaryItem: SimulatorEquipmentLibraryItem;
    nextStatus: 'active' | 'sold' | 'discarded';
    entryIds: string[];
  } | null>(null);
  const [planRemovalItem, setPlanRemovalItem] =
    useState<SimulatorEquipmentLibraryItem | null>(null);
  const [planRemovalItems, setPlanRemovalItems] = useState<
    SimulatorEquipmentLibraryItem[]
  >([]);
  const [removingCandidateItemIds, setRemovingCandidateItemIds] = useState<
    string[]
  >([]);
  const [updatingInventoryEntryIds, setUpdatingInventoryEntryIds] = useState<
    string[]
  >([]);
  const [removingPlanItemIds, setRemovingPlanItemIds] = useState<string[]>([]);

  const getPlanLabel = (index: number) =>
    equipmentSets[index]?.name || `配置${index + 1}`;
  const normalizedLaboratorySampleSetIndex = Math.min(
    Math.max(laboratorySampleSetIndex, 0),
    Math.max(0, equipmentSets.length - 1)
  );
  const currentPlanLabel = getPlanLabel(activeSetIndex);
  const laboratorySamplePlanLabel = getPlanLabel(
    normalizedLaboratorySampleSetIndex
  );
  const selectedPlanIndex = useMemo(() => {
    if (planFilter === 'all' || planFilter === 'unassigned') {
      return -1;
    }

    return equipmentSets.findIndex((set) => set.id === planFilter);
  }, [equipmentSets, planFilter]);
  const selectedPlanLabel =
    selectedPlanIndex >= 0 ? getPlanLabel(selectedPlanIndex) : null;
  const activePlanEquipment = equipmentSets[activeSetIndex]?.items ?? currentEquipment;
  const laboratorySampleEquipment =
    equipmentSets[normalizedLaboratorySampleSetIndex]?.items ?? currentEquipment;

  const secondaryDefinitions = useMemo(
    () => getSimulatorSlotDefinitions(category),
    [category]
  );
  const selectedSecondaryDefinition = useMemo(
    () =>
      secondaryCategory === 'all'
        ? null
        : secondaryDefinitions.find((item) => item.id === secondaryCategory) ??
          null,
    [secondaryCategory, secondaryDefinitions]
  );

  const categoryFilteredItems = useMemo(() => {
    const sourceMatched =
      sourceFilter === 'all'
        ? items
        : items.filter((item) => item.sourceKinds.includes(sourceFilter));

    return filterCandidateEquipmentItems(sourceMatched, {
      category,
      slotDefinition: selectedSecondaryDefinition,
    });
  }, [category, items, selectedSecondaryDefinition, sourceFilter]);
  const inventoryLifecycleSummaryItems = useMemo(() => {
    const counts = {
      all: categoryFilteredItems.filter((item) =>
        item.sourceKinds.includes('inventory_asset')
      ).length,
      active: 0,
      sold: 0,
      discarded: 0,
    };

    categoryFilteredItems.forEach((item) => {
      if (!item.sourceKinds.includes('inventory_asset')) {
        return;
      }

      const summary = summarizeSimulatorInventoryRefs(item);
      if (summary.active > 0) {
        counts.active += 1;
      }
      if (summary.sold > 0) {
        counts.sold += 1;
      }
      if (summary.discarded > 0) {
        counts.discarded += 1;
      }
    });

    return [
      { key: 'all' as const, label: '全部状态', value: counts.all },
      { key: 'active' as const, label: '库存待用', value: counts.active },
      { key: 'sold' as const, label: '已售出', value: counts.sold },
      { key: 'discarded' as const, label: '已作废', value: counts.discarded },
    ];
  }, [categoryFilteredItems]);
  const sourceFilteredItems = useMemo(() => {
    if (sourceFilter !== 'inventory_asset' || inventoryLifecycleFilter === 'all') {
      return categoryFilteredItems;
    }

    return categoryFilteredItems.filter(
      (item) =>
        summarizeSimulatorInventoryRefs(item)[inventoryLifecycleFilter] > 0
    );
  }, [categoryFilteredItems, inventoryLifecycleFilter, sourceFilter]);
  const scopedInventoryItems = useMemo(
    () =>
      categoryFilteredItems.filter((item) =>
        item.sourceKinds.includes('inventory_asset')
      ),
    [categoryFilteredItems]
  );
  const lifecycleMatchedInventoryItems = useMemo(() => {
    if (inventoryLifecycleFilter === 'all') {
      return scopedInventoryItems;
    }

    return scopedInventoryItems.filter(
      (item) =>
        summarizeSimulatorInventoryRefs(item)[inventoryLifecycleFilter] > 0
    );
  }, [inventoryLifecycleFilter, scopedInventoryItems]);

  const getEquipmentSlotLabel = (equipment: SimulatorEquipmentLibraryItem['equipment']) => {
    const definition = findSimulatorSlotDefinition(equipment.type, equipment.slot);
    if (definition) {
      return getSimulatorSlotLabel(definition, 'equipmentPanel');
    }

    return equipment.type;
  };

  const canQuickEquip = (item: SimulatorEquipmentLibraryItem) => {
    if (item.equipment.type === 'trinket' || item.equipment.type === 'jade') {
      return item.equipment.slot !== undefined;
    }

    return true;
  };

  const canAssignToPlan = (item: SimulatorEquipmentLibraryItem) =>
    canQuickEquip(item);

  const canRemoveFromCandidateLibrary = (item: SimulatorEquipmentLibraryItem) =>
    Boolean(
      (onRemoveCandidateItem || onRemoveCandidateItems) &&
        item.selectable &&
        item.sourceKinds.includes('candidate_library')
    );
  const canRemoveFromSelectedPlan = (item: SimulatorEquipmentLibraryItem) => {
    if (selectedPlanIndex < 0) {
      return false;
    }

    const targetPlan = equipmentSets[selectedPlanIndex];
    if (!targetPlan) {
      return false;
    }

    const occupant = findEquipmentSlotOccupant(targetPlan.items, item.equipment);

    return occupant ? isSameEquipmentForPlan(occupant, item.equipment) : false;
  };

  const isCurrentlyEquipped = (item: SimulatorEquipmentLibraryItem) => {
    return currentEquipment.some(
      (equipment) =>
        equipment.id === item.equipment.id &&
        equipment.type === item.equipment.type &&
        equipment.slot === item.equipment.slot
    );
  };

  const getCompareSeatMatch = (item: SimulatorEquipmentLibraryItem) => {
    return (
      experimentSeats.find(
        (seat) =>
          !seat.isSample &&
          seat.equipment.some(
            (equipment) =>
              equipment.id === item.equipment.id &&
              equipment.type === item.equipment.type &&
              equipment.slot === item.equipment.slot
          )
      ) ?? null
    );
  };

  const getItemStatus = (item: SimulatorEquipmentLibraryItem) => {
    const currentEquipped = isCurrentlyEquipped(item);
    const compareSeatMatch = getCompareSeatMatch(item);

    return {
      currentEquipped,
      compareSeatMatch,
      matchesStatus:
        statusFilter === 'all'
          ? true
          : statusFilter === 'equipped'
            ? currentEquipped
            : statusFilter === 'lab'
              ? compareSeatMatch !== null
              : !currentEquipped && compareSeatMatch === null,
    };
  };

  const matchesPlanFilter = (item: SimulatorEquipmentLibraryItem) => {
    if (planFilter === 'all') {
      return true;
    }

    const planLabels = item.sourceLabels.filter((label) => label !== '候选装备库');
    if (planFilter === 'unassigned') {
      return planLabels.length === 0;
    }

    const targetPlanIndex = equipmentSets.findIndex((set) => set.id === planFilter);
    const targetPlan =
      targetPlanIndex >= 0 ? equipmentSets[targetPlanIndex] : null;
    if (!targetPlan) {
      return true;
    }

    return planLabels.includes(getPlanLabel(targetPlanIndex));
  };

  const differenceSummary = useMemo(
    () =>
      buildEquipmentSetDifferenceSummary({
        currentEquipment: activePlanEquipment,
        sampleEquipment: laboratorySampleEquipment,
      }),
    [activePlanEquipment, laboratorySampleEquipment]
  );

  const matchesDifferenceFilter = (item: SimulatorEquipmentLibraryItem) => {
    if (differenceFilter === 'all') {
      return true;
    }

    const slotKey = buildEquipmentSlotKey(item.equipment);

    if (differenceFilter === 'different') {
      return differenceSummary.differentSlotKeys.includes(slotKey);
    }

    if (differenceFilter === 'current_only') {
      return differenceSummary.currentOnlySlotKeys.includes(slotKey);
    }

    if (differenceFilter === 'sample_only') {
      return differenceSummary.sampleOnlySlotKeys.includes(slotKey);
    }

    return differenceSummary.replacedSlotKeys.includes(slotKey);
  };

  const matchesActiveFiltersBase = (item: SimulatorEquipmentLibraryItem) => {
    const itemStatus = getItemStatus(item);

    return (
      itemStatus.matchesStatus &&
      matchesPlanFilter(item) &&
      matchesDifferenceFilter(item) &&
      matchesInventoryQuickView({
        quickViewKey: quickViewFilter === 'all' ? null : quickViewFilter,
        slotKey: buildEquipmentSlotKey(item.equipment),
        currentEquipped: itemStatus.currentEquipped,
        inLab: itemStatus.compareSeatMatch !== null,
        differentSlotKeys: differenceSummary.differentSlotKeys,
        currentOnlySlotKeys: differenceSummary.currentOnlySlotKeys,
        replacedSlotKeys: differenceSummary.replacedSlotKeys,
      })
    );
  };

  const matchesBulkActionFocus = (item: SimulatorEquipmentLibraryItem) => {
    if (!bulkActionSummary || !bulkActionFocusOnly) {
      return true;
    }

    return bulkActionSummary.affectedSlotKeys.includes(
      buildEquipmentSlotKey(item.equipment)
    );
  };

  const filteredItems = useMemo(() => {
    return sortCandidateEquipmentItems(
      sourceFilteredItems.filter(
        (item) => matchesActiveFiltersBase(item) && matchesBulkActionFocus(item)
      ),
      sortKey
    );
  }, [
    activeSetIndex,
    differenceFilter,
    differenceSummary.currentOnlySlotKeys,
    differenceSummary.differentSlotKeys,
    differenceSummary.replacedSlotKeys,
    equipmentSets,
    bulkActionFocusOnly,
    bulkActionSummary,
    planFilter,
    quickViewFilter,
    sortKey,
    sourceFilteredItems,
    statusFilter,
  ]);

  const bulkActionScopedItems = useMemo(() => {
    if (!bulkActionSummary) {
      return [];
    }

    return sortCandidateEquipmentItems(
      sourceFilteredItems.filter(
        (item) =>
          matchesActiveFiltersBase(item) &&
          bulkActionSummary.affectedSlotKeys.includes(
            buildEquipmentSlotKey(item.equipment)
          )
      ),
      sortKey
    );
  }, [bulkActionSummary, sortKey, sourceFilteredItems, filteredItems]);

  const planAssignmentOptions = useMemo(() => {
    if (!planPickerItem) {
      return [];
    }

    return buildEquipmentPlanAssignmentOptions({
      equipmentSets,
      activeSetIndex,
      equipment: planPickerItem.equipment,
    });
  }, [activeSetIndex, equipmentSets, planPickerItem]);

  const ensureCompareSeat = () => {
    let compareSeat = experimentSeats.find((seat) => !seat.isSample) ?? null;

    if (!compareSeat) {
      addExperimentSeat();
      compareSeat =
        useGameStore
          .getState()
          .experimentSeats.find((seat) => !seat.isSample) ?? null;
    }

    return compareSeat;
  };

  const handleSendToLab = (item: SimulatorEquipmentLibraryItem) => {
    const compareSeat = ensureCompareSeat();

    if (!compareSeat) {
      toast.error('实验室席位创建失败');
      return;
    }

    updateExperimentSeatEquipment(
      compareSeat.id,
      {
        ...item.equipment,
      },
      {
        inheritGemstones: false,
        inheritRuneStones: false,
      }
    );

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SIMULATOR_OPEN_LAB_EVENT));
    }

    toast.success('已送入实验室对比席位', {
      description: `${item.equipment.name} 已挂载到 ${compareSeat.name}`,
    });
  };

  const handleRemoveFromLab = (item: SimulatorEquipmentLibraryItem) => {
    const compareSeat = getCompareSeatMatch(item);
    if (!compareSeat) {
      return;
    }

    removeExperimentSeatEquipment(
      compareSeat.id,
      item.equipment.type,
      item.equipment.slot
    );

    toast.success('已从实验室移除', {
      description: `${item.equipment.name} 已从 ${compareSeat.name} 移出`,
    });
  };

  const quickViewLabCandidates = useMemo(() => {
    if (
      quickViewFilter !== 'diff_idle' &&
      quickViewFilter !== 'current_only_idle'
    ) {
      return [];
    }

    return pickFirstEquipmentPerSlot(
      filteredItems.filter(
        (item) => getItemStatus(item).compareSeatMatch === null
      )
    );
  }, [currentEquipment, experimentSeats, filteredItems, quickViewFilter]);

  const visibleLabItems = useMemo(
    () =>
      pickFirstEquipmentPerSlot(
        filteredItems.filter((item) => getItemStatus(item).compareSeatMatch !== null)
      ),
    [currentEquipment, experimentSeats, filteredItems]
  );

  const rawVisiblePlanAssignableCount = useMemo(
    () => filteredItems.filter((item) => canAssignToPlan(item)).length,
    [filteredItems]
  );

  const visiblePlanWriteCandidates = useMemo(
    () =>
      pickFirstEquipmentPerSlot(
        filteredItems.filter((item) => canAssignToPlan(item))
      ),
    [filteredItems]
  );

  const batchPlanAssignmentOptions = useMemo(() => {
    if (visiblePlanWriteCandidates.length === 0) {
      return [];
    }

    const equipmentList = visiblePlanWriteCandidates.map((item) => item.equipment);

    return equipmentSets.map((set, index) => ({
      index,
      name: getPlanLabel(index),
      isActive: index === activeSetIndex,
      summary: buildBatchPlanAssignmentSummary({
        equipmentList,
        targetEquipmentList: set.items,
      }),
    }));
  }, [activeSetIndex, equipmentSets, visiblePlanWriteCandidates]);

  const bulkActionScopedSendableLabItems = useMemo(
    () =>
      pickFirstEquipmentPerSlot(
        bulkActionScopedItems.filter(
          (item) => getItemStatus(item).compareSeatMatch === null
        )
      ),
    [bulkActionScopedItems, currentEquipment, experimentSeats]
  );

  const bulkActionScopedLabItems = useMemo(
    () =>
      pickFirstEquipmentPerSlot(
        bulkActionScopedItems.filter(
          (item) => getItemStatus(item).compareSeatMatch !== null
        )
      ),
    [bulkActionScopedItems, currentEquipment, experimentSeats]
  );

  const bulkActionScopedPlanWriteCandidates = useMemo(
    () =>
      pickFirstEquipmentPerSlot(
        bulkActionScopedItems.filter((item) => canAssignToPlan(item))
      ),
    [bulkActionScopedItems]
  );
  const removableCandidateItems = useMemo(
    () => filteredItems.filter((item) => canRemoveFromCandidateLibrary(item)),
    [filteredItems, onRemoveCandidateItem, onRemoveCandidateItems]
  );
  const manageableInventoryItems = useMemo(
    () =>
      sourceFilter === 'inventory_asset'
        ? filteredItems.filter(
            (item) => getCandidateBackedInventoryRefs(item).length > 0
          )
        : [],
    [filteredItems, sourceFilter]
  );
  const restorableInventoryItems = useMemo(
    () =>
      sourceFilter === 'inventory_asset'
        ? filteredItems.filter(
            (item) =>
              getCandidateBackedInventoryRefs(item, ['sold', 'discarded']).length >
              0
          )
        : [],
    [filteredItems, sourceFilter]
  );
  const removablePlanItems = useMemo(
    () => filteredItems.filter((item) => canRemoveFromSelectedPlan(item)),
    [filteredItems, selectedPlanIndex, equipmentSets]
  );
  const shouldShowBatchInventoryStatusUpdate =
    sourceFilter === 'inventory_asset' && manageableInventoryItems.length > 0;
  const shouldShowBatchInventoryRestore =
    sourceFilter === 'inventory_asset' && restorableInventoryItems.length > 0;
  const shouldShowBatchCandidateRemoval =
    sourceFilter === 'candidate_library' && removableCandidateItems.length > 0;
  const shouldShowBatchPlanRemoval =
    sourceFilter !== 'candidate_library' &&
    selectedPlanIndex >= 0 &&
    removablePlanItems.length > 0;
  const bulkActionProgress = useMemo(() => {
    if (!bulkActionSummary) {
      return null;
    }

    return buildInventoryBulkActionProgress({
      affectedSlotKeys: bulkActionSummary.affectedSlotKeys,
      scopedSlotKeys: bulkActionScopedItems.map((item) =>
        buildEquipmentSlotKey(item.equipment)
      ),
      equippedSlotKeys: bulkActionScopedItems
        .filter((item) => getItemStatus(item).currentEquipped)
        .map((item) => buildEquipmentSlotKey(item.equipment)),
      idleSlotKeys: bulkActionScopedItems
        .filter((item) => {
          const status = getItemStatus(item);
          return !status.currentEquipped && status.compareSeatMatch === null;
        })
        .map((item) => buildEquipmentSlotKey(item.equipment)),
      inLabSlotKeys: bulkActionScopedItems
        .filter((item) => getItemStatus(item).compareSeatMatch !== null)
        .map((item) => buildEquipmentSlotKey(item.equipment)),
      sendableLabSlotKeys: bulkActionScopedSendableLabItems.map((item) =>
        buildEquipmentSlotKey(item.equipment)
      ),
      removableLabSlotKeys: bulkActionScopedLabItems.map((item) =>
        buildEquipmentSlotKey(item.equipment)
      ),
      planWritableSlotKeys: bulkActionScopedPlanWriteCandidates.map((item) =>
        buildEquipmentSlotKey(item.equipment)
      ),
    });
  }, [
    bulkActionScopedItems,
    bulkActionScopedLabItems,
    bulkActionScopedPlanWriteCandidates,
    bulkActionScopedSendableLabItems,
    bulkActionSummary,
    currentEquipment,
    experimentSeats,
  ]);
  const bulkActionStage = useMemo(
    () => buildInventoryBulkActionStage(bulkActionProgress),
    [bulkActionProgress]
  );

  const handleBatchSendQuickViewToLab = () => {
    if (quickViewLabCandidates.length === 0) {
      toast.message('当前快捷视角没有可送入实验室的装备');
      return;
    }

    const compareSeat = ensureCompareSeat();
    if (!compareSeat) {
      toast.error('实验室席位创建失败');
      return;
    }

    quickViewLabCandidates.forEach((item) => {
      updateExperimentSeatEquipment(
        compareSeat.id,
        {
          ...item.equipment,
        },
        {
          inheritGemstones: false,
          inheritRuneStones: false,
        }
      );
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SIMULATOR_OPEN_LAB_EVENT));
    }

    const dedupedCount = quickViewLabCandidates.length;
    const rawVisibleCount = filteredItems.filter(
      (item) => getItemStatus(item).compareSeatMatch === null
    ).length;
    const skippedDuplicateCount = Math.max(0, rawVisibleCount - dedupedCount);

    setQuickViewFilter('all');
    setStatusFilter('lab');
    setDifferenceFilter('all');
    setPlanFilter('all');
    setBulkActionFocusOnly(false);
    setBulkActionSummary({
      id: `lab-send-${Date.now()}`,
      title: '已批量送入实验室',
      description:
        skippedDuplicateCount > 0
          ? `已按当前排序写入 ${dedupedCount} 个部位，${skippedDuplicateCount} 件同部位候选已自动跳过。`
          : `已将 ${dedupedCount} 件装备挂载到 ${compareSeat.name}。`,
      tone: 'cyan',
      affectedSlotLabels: quickViewLabCandidates.map((item) =>
        getEquipmentSlotLabel(item.equipment)
      ),
      affectedSlotKeys: quickViewLabCandidates.map((item) =>
        buildEquipmentSlotKey(item.equipment)
      ),
      targetLabel: compareSeat.name,
      viewHint: '已自动切到“实验室对比中”视图，方便继续核对本轮送测结果。',
      targetView: {
        sourceFilter: 'all',
        inventoryLifecycleFilter: 'all',
        statusFilter: 'lab',
        planFilter: 'all',
        differenceFilter: 'all',
        quickViewFilter: 'all',
      },
    });

    toast.success('已批量送入实验室', {
      description:
        skippedDuplicateCount > 0
          ? `已按当前排序写入 ${dedupedCount} 个部位，${skippedDuplicateCount} 件同部位候选已自动跳过`
          : `已将 ${dedupedCount} 件装备挂载到 ${compareSeat.name}`,
    });
  };

  const handleBatchSendScopedItemsToLab = () => {
    if (bulkActionScopedSendableLabItems.length === 0) {
      toast.message('本次部位里没有可送入实验室的装备');
      return;
    }

    const compareSeat = ensureCompareSeat();
    if (!compareSeat) {
      toast.error('实验室席位创建失败');
      return;
    }

    bulkActionScopedSendableLabItems.forEach((item) => {
      updateExperimentSeatEquipment(
        compareSeat.id,
        {
          ...item.equipment,
        },
        {
          inheritGemstones: false,
          inheritRuneStones: false,
        }
      );
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SIMULATOR_OPEN_LAB_EVENT));
    }

    setBulkActionFocusOnly(true);
    setStatusFilter('lab');
    setQuickViewFilter('all');
    setDifferenceFilter('all');
    setPlanFilter('all');
    setBulkActionSummary({
      id: `summary-lab-send-${Date.now()}`,
      title: '已继续送入实验室',
      description: `已基于本次部位，将 ${bulkActionScopedSendableLabItems.length} 件装备送入 ${compareSeat.name}。`,
      tone: 'cyan',
      affectedSlotLabels: bulkActionScopedSendableLabItems.map((item) =>
        getEquipmentSlotLabel(item.equipment)
      ),
      affectedSlotKeys: bulkActionScopedSendableLabItems.map((item) =>
        buildEquipmentSlotKey(item.equipment)
      ),
      targetLabel: compareSeat.name,
      viewHint: '已继续聚焦本次部位，并切到“实验室对比中”视图。',
      targetView: {
        sourceFilter: 'all',
        inventoryLifecycleFilter: 'all',
        statusFilter: 'lab',
        planFilter: 'all',
        differenceFilter: 'all',
        quickViewFilter: 'all',
      },
    });

    toast.success('已继续送入实验室', {
      description: `已将 ${bulkActionScopedSendableLabItems.length} 件本次部位装备挂载到 ${compareSeat.name}`,
    });
  };

  const handleBatchRemoveVisibleFromLab = () => {
    if (visibleLabItems.length === 0) {
      toast.message('当前结果里没有可移出的实验室装备');
      return;
    }

    let removedCount = 0;

    visibleLabItems.forEach((item) => {
      const compareSeat = getItemStatus(item).compareSeatMatch;
      if (!compareSeat) {
        return;
      }

      removeExperimentSeatEquipment(
        compareSeat.id,
        item.equipment.type,
        item.equipment.slot
      );
      removedCount += 1;
    });

    setStatusFilter('idle');
    setQuickViewFilter('all');
    setPlanFilter('all');
    setDifferenceFilter('all');
    setBulkActionFocusOnly(false);
    setBulkActionSummary({
      id: `lab-remove-${Date.now()}`,
      title: '已批量移出实验室',
      description: `已从实验室撤回 ${removedCount} 件当前筛选结果。`,
      tone: 'violet',
      affectedSlotLabels: visibleLabItems.map((item) =>
        getEquipmentSlotLabel(item.equipment)
      ),
      affectedSlotKeys: visibleLabItems.map((item) =>
        buildEquipmentSlotKey(item.equipment)
      ),
      targetLabel: '库存待用',
      viewHint: '已自动切到“库存待用”视图，方便继续处理撤回后的装备。',
      targetView: {
        sourceFilter: 'all',
        inventoryLifecycleFilter: 'all',
        statusFilter: 'idle',
        planFilter: 'all',
        differenceFilter: 'all',
        quickViewFilter: 'all',
      },
    });

    toast.success('已批量移出实验室', {
      description: `已从实验室撤回 ${removedCount} 件当前筛选结果`,
    });
  };

  const handleBatchRemoveScopedItemsFromLab = () => {
    if (bulkActionScopedLabItems.length === 0) {
      toast.message('本次部位里没有仍在实验室的装备');
      return;
    }

    let removedCount = 0;

    bulkActionScopedLabItems.forEach((item) => {
      const compareSeat = getItemStatus(item).compareSeatMatch;
      if (!compareSeat) {
        return;
      }

      removeExperimentSeatEquipment(
        compareSeat.id,
        item.equipment.type,
        item.equipment.slot
      );
      removedCount += 1;
    });

    setBulkActionFocusOnly(true);
    setStatusFilter('idle');
    setQuickViewFilter('all');
    setDifferenceFilter('all');
    setPlanFilter('all');
    setBulkActionSummary({
      id: `summary-lab-remove-${Date.now()}`,
      title: '已继续移出实验室',
      description: `已基于本次部位，从实验室撤回 ${removedCount} 件装备。`,
      tone: 'violet',
      affectedSlotLabels: bulkActionScopedLabItems.map((item) =>
        getEquipmentSlotLabel(item.equipment)
      ),
      affectedSlotKeys: bulkActionScopedLabItems.map((item) =>
        buildEquipmentSlotKey(item.equipment)
      ),
      targetLabel: '库存待用',
      viewHint: '已继续聚焦本次部位，并切到“库存待用”视图。',
      targetView: {
        sourceFilter: 'all',
        inventoryLifecycleFilter: 'all',
        statusFilter: 'idle',
        planFilter: 'all',
        differenceFilter: 'all',
        quickViewFilter: 'all',
      },
    });

    toast.success('已继续移出实验室', {
      description: `已从实验室撤回 ${removedCount} 件本次部位装备`,
    });
  };

  const handleBatchAssignVisibleToPlan = (planIndex: number) => {
    const targetPlan = equipmentSets[planIndex];
    if (!targetPlan) {
      toast.error('目标方案不存在');
      return;
    }

    const equipmentList = visiblePlanWriteCandidates.map((item) => item.equipment);
    const writableEquipmentList = buildBatchPlanWritableEquipmentList({
      equipmentList,
      targetEquipmentList: targetPlan.items,
      mode: batchPlanWriteMode,
    });

    const summary =
      batchPlanAssignmentOptions.find((option) => option.index === planIndex)
        ?.summary ??
      buildBatchPlanAssignmentSummary({
        equipmentList,
        targetEquipmentList: targetPlan.items,
      });

    if (writableEquipmentList.length === 0) {
      toast.message('这批装备与目标方案已一致');
      setIsBatchPlanPickerOpen(false);
      return;
    }

    const skippedDuplicateCount = Math.max(
      0,
      rawVisiblePlanAssignableCount - visiblePlanWriteCandidates.length
    );
    const targetWriteCount = getBatchPlanWritableCountByMode({
      summary,
      mode: batchPlanWriteMode,
    });

    updateEquipmentListInSet(planIndex, writableEquipmentList);
    setIsBatchPlanPickerOpen(false);
    setQuickViewFilter('all');
    setDifferenceFilter('all');
    setPlanFilter(targetPlan.id);
    setStatusFilter('all');
    setBulkActionFocusOnly(false);
    setBulkActionSummary({
      id: `plan-write-${Date.now()}`,
      title: '已批量写入装备方案',
      description: `${targetPlan.name} 已按${
        batchPlanWriteMode === 'empty_only'
          ? '仅补空栏位'
          : batchPlanWriteMode === 'replace_only'
            ? '仅替换已有栏位'
            : '全部可变动项'
      }模式写入 ${targetWriteCount} 件装备。`,
      tone: 'amber',
      affectedSlotLabels: writableEquipmentList.map((equipment) =>
        getEquipmentSlotLabel(equipment)
      ),
      affectedSlotKeys: writableEquipmentList.map((equipment) =>
        buildEquipmentSlotKey(equipment)
      ),
      targetLabel: targetPlan.name,
      viewHint: `已自动筛到“${targetPlan.name}”，方便继续核对这次批量写入的结果。`,
      targetView: {
        sourceFilter: 'all',
        inventoryLifecycleFilter: 'all',
        statusFilter: 'all',
        planFilter: targetPlan.id,
        differenceFilter: 'all',
        quickViewFilter: 'all',
      },
    });

    toast.success('已批量写入装备方案', {
      description: `${targetPlan.name} 已按${
        batchPlanWriteMode === 'empty_only'
          ? '仅补空栏位'
          : batchPlanWriteMode === 'replace_only'
            ? '仅替换已有栏位'
            : '全部可变动项'
      }模式写入 ${targetWriteCount} 件装备${
        (batchPlanWriteMode === 'all_writable' ||
          batchPlanWriteMode === 'replace_only') &&
        summary.replaceCount > 0
          ? `，其中 ${summary.replaceCount} 件为同部位替换`
          : ''
      }${
        summary.sameCount > 0 ? `，${summary.sameCount} 件原本已一致` : ''
      }${
        skippedDuplicateCount > 0
          ? `，另有 ${skippedDuplicateCount} 件同部位候选已按排序跳过`
          : ''
      }`,
    });
  };

  const handleAssignToPlan = (
    item: SimulatorEquipmentLibraryItem,
    planIndex: number
  ) => {
    const targetPlan = equipmentSets[planIndex];
    if (!targetPlan) {
      toast.error('目标方案不存在');
      return;
    }

    updateEquipmentInSet(planIndex, {
      ...item.equipment,
    });

    setPlanPickerItem(null);

    toast.success('已挂入指定方案', {
      description:
        planIndex === activeSetIndex
          ? `${item.equipment.name} 已替换到当前方案`
          : `${item.equipment.name} 已写入 ${targetPlan.name}`,
    });
  };

  const handleOpenScopedBatchPlanWriter = () => {
    if (bulkActionScopedPlanWriteCandidates.length === 0) {
      toast.message('本次部位里没有可写入方案的装备');
      return;
    }

    setBulkActionFocusOnly(true);
    setIsBatchPlanPickerOpen(true);
  };

  const summaryItems = useMemo(() => {
    const total = sourceFilteredItems.length;
    let equipped = 0;
    let inLab = 0;
    let idle = 0;

    sourceFilteredItems.forEach((item) => {
      const { currentEquipped, compareSeatMatch } = getItemStatus(item);

      if (currentEquipped) {
        equipped += 1;
      }

      if (compareSeatMatch) {
        inLab += 1;
      }

      if (!currentEquipped && !compareSeatMatch) {
        idle += 1;
      }
    });

    return [
      {
        key: 'all' as const,
        label: '当前结果',
        value: total,
        tone: 'border-slate-600/50 bg-slate-900/60 text-slate-100',
        activeTone: 'border-slate-300/70 bg-slate-200/10 text-white',
      },
      {
        key: 'equipped' as const,
        label: '当前穿戴',
        value: equipped,
        tone: 'border-emerald-500/30 bg-emerald-950/30 text-emerald-100',
        activeTone:
          'border-emerald-300/70 bg-emerald-500/20 text-emerald-50 shadow-[0_0_0_1px_rgba(110,231,183,0.25)]',
      },
      {
        key: 'lab' as const,
        label: '实验室对比中',
        value: inLab,
        tone: 'border-violet-500/30 bg-violet-950/30 text-violet-100',
        activeTone:
          'border-violet-300/70 bg-violet-500/20 text-violet-50 shadow-[0_0_0_1px_rgba(196,181,253,0.25)]',
      },
      {
        key: 'idle' as const,
        label: '库存待用',
        value: idle,
        tone: 'border-amber-500/30 bg-amber-950/30 text-amber-100',
        activeTone:
          'border-amber-300/70 bg-amber-500/20 text-amber-50 shadow-[0_0_0_1px_rgba(252,211,77,0.25)]',
      },
    ];
  }, [currentEquipment, experimentSeats, sourceFilteredItems, statusFilter]);

  const planSummaryItems = useMemo(() => {
    const baseItems = sourceFilteredItems.filter(
      (item) => getItemStatus(item).matchesStatus
    );

    const assignedCounts = equipmentSets.map((set, index) => ({
      key: set.id,
      label: getPlanLabel(index),
      value: baseItems.filter((item) =>
        item.sourceLabels.includes(getPlanLabel(index))
      ).length,
      isActive: set.id === equipmentSets[activeSetIndex]?.id,
      isLabSample: index === normalizedLaboratorySampleSetIndex,
    }));
    const unassignedCount = baseItems.filter(
      (item) =>
        item.sourceLabels.filter((label) => label !== '候选装备库').length === 0
    ).length;

    return [
      {
        key: 'all' as const,
        label: '全部方案',
        value: baseItems.length,
        isActive: false,
      },
      ...assignedCounts,
      {
        key: 'unassigned' as const,
        label: '未写入方案',
        value: unassignedCount,
        isActive: false,
      },
    ];
  }, [
    activeSetIndex,
    equipmentSets,
    normalizedLaboratorySampleSetIndex,
    sourceFilteredItems,
    statusFilter,
  ]);

  const actionableQuickFilters = useMemo(() => {
    const baseItems = sourceFilteredItems.filter((item) =>
      matchesPlanFilter(item)
    );

    const getSlotKey = (item: SimulatorEquipmentLibraryItem) =>
      buildEquipmentSlotKey(item.equipment);

    return [
      {
        key: 'diff_idle',
        label: '待送实验室差异',
        description: '差异部位里当前还没送进实验室',
        count: baseItems.filter((item) => {
          const status = getItemStatus(item);
          return (
            !status.currentEquipped &&
            status.compareSeatMatch === null &&
            differenceSummary.differentSlotKeys.includes(getSlotKey(item))
          );
        }).length,
        apply: () => {
          setQuickViewFilter((current) =>
            current === 'diff_idle' ? 'all' : 'diff_idle'
          );
          setStatusFilter('all');
          setDifferenceFilter('all');
        },
        active: quickViewFilter === 'diff_idle',
      },
      {
        key: 'current_only_idle',
        label: '当前方案独有且未进实验室',
        description: '先看当前方案新增、实验室还没覆盖到的部位',
        count: baseItems.filter((item) => {
          const status = getItemStatus(item);
          return (
            !status.currentEquipped &&
            status.compareSeatMatch === null &&
            differenceSummary.currentOnlySlotKeys.includes(getSlotKey(item))
          );
        }).length,
        apply: () => {
          setQuickViewFilter((current) =>
            current === 'current_only_idle' ? 'all' : 'current_only_idle'
          );
          setStatusFilter('all');
          setDifferenceFilter('all');
        },
        active: quickViewFilter === 'current_only_idle',
      },
      {
        key: 'replaced_idle',
        label: '同部位替换候选',
        description: '优先看可直接做替换决策的差异装备',
        count: baseItems.filter((item) => {
          const status = getItemStatus(item);
          return (
            !status.currentEquipped &&
            status.compareSeatMatch === null &&
            differenceSummary.replacedSlotKeys.includes(getSlotKey(item))
          );
        }).length,
        apply: () => {
          setQuickViewFilter((current) =>
            current === 'replaced_idle' ? 'all' : 'replaced_idle'
          );
          setStatusFilter('all');
          setDifferenceFilter('all');
        },
        active: quickViewFilter === 'replaced_idle',
      },
    ].filter((item) => item.count > 0);
  }, [
    differenceSummary.currentOnlySlotKeys,
    differenceSummary.differentSlotKeys,
    differenceSummary.replacedSlotKeys,
    planFilter,
    quickViewFilter,
    sourceFilteredItems,
  ]);
  const activeQuickViewKey =
    quickViewFilter === 'all' ? null : quickViewFilter;
  const rawQuickViewSendableCount = useMemo(
    () =>
      filteredItems.filter((item) => getItemStatus(item).compareSeatMatch === null)
        .length,
    [currentEquipment, experimentSeats, filteredItems]
  );
  const applyBulkActionTargetView = () => {
    if (!bulkActionSummary) {
      return;
    }

    setSourceFilter(bulkActionSummary.targetView.sourceFilter);
    setInventoryLifecycleFilter(
      bulkActionSummary.targetView.inventoryLifecycleFilter
    );
    setStatusFilter(bulkActionSummary.targetView.statusFilter);
    setPlanFilter(bulkActionSummary.targetView.planFilter);
    setDifferenceFilter(bulkActionSummary.targetView.differenceFilter);
    setQuickViewFilter(bulkActionSummary.targetView.quickViewFilter);
  };
  const bulkActionRecommendedActionKey =
    bulkActionStage?.recommendedActionKey ?? null;
  const bulkActionFollowUpActions = [
    bulkActionScopedSendableLabItems.length > 0
      ? {
          key: 'send_lab' as const,
          label: `将本次部位送实验室 (${bulkActionScopedSendableLabItems.length})`,
          onClick: handleBatchSendScopedItemsToLab,
          toneClass:
            'border-cyan-500/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20',
          recommendedToneClass:
            'border-cyan-300/70 bg-cyan-500/20 text-cyan-50 shadow-[0_0_0_1px_rgba(125,211,252,0.28)] hover:bg-cyan-500/25',
        }
      : null,
    bulkActionScopedLabItems.length > 0
      ? {
          key: 'remove_lab' as const,
          label: `将本次部位移出实验室 (${bulkActionScopedLabItems.length})`,
          onClick: handleBatchRemoveScopedItemsFromLab,
          toneClass:
            'border-violet-500/30 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20',
          recommendedToneClass:
            'border-violet-300/70 bg-violet-500/20 text-violet-50 shadow-[0_0_0_1px_rgba(196,181,253,0.28)] hover:bg-violet-500/25',
        }
      : null,
    bulkActionScopedPlanWriteCandidates.length > 0
      ? {
          key: 'write_plan' as const,
          label: `将本次部位写入方案 (${bulkActionScopedPlanWriteCandidates.length})`,
          onClick: handleOpenScopedBatchPlanWriter,
          toneClass:
            'border-amber-500/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20',
          recommendedToneClass:
            'border-amber-300/70 bg-amber-500/20 text-amber-50 shadow-[0_0_0_1px_rgba(252,211,77,0.28)] hover:bg-amber-500/25',
        }
      : null,
  ]
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => {
      if (left.key === bulkActionRecommendedActionKey) {
        return -1;
      }
      if (right.key === bulkActionRecommendedActionKey) {
        return 1;
      }
      return 0;
    });
  const bulkActionRecommendedActionLabel =
    bulkActionFollowUpActions.find(
      (action) => action.key === bulkActionRecommendedActionKey
    )?.label ?? null;
  const isBulkActionComplete = bulkActionStage?.isComplete ?? false;
  const handleCompleteBulkActionSummary = () => {
    setBulkActionSummary(null);
    setBulkActionFocusOnly(false);
  };
  const handleContinueBulkActionSummary = () => {
    if (!bulkActionSummary) {
      return;
    }

    applyBulkActionTargetView();
    setBulkActionFocusOnly(true);
  };
  const handleStartNextBulkActionRound = () => {
    setBulkActionSummary(null);
    setBulkActionFocusOnly(false);
    setQuickViewFilter('all');
    setDifferenceFilter('all');
  };
  const handleConfirmCandidateRemoval = async () => {
    if (!candidateRemovalItem || !onRemoveCandidateItem) {
      return;
    }

    try {
      setRemovingCandidateItemIds([candidateRemovalItem.id]);
      await onRemoveCandidateItem(candidateRemovalItem);

      if (selectedItem?.id === candidateRemovalItem.id) {
        setSelectedItem(null);
      }

      toast.success('已从候选装备库移除', {
        description: `${candidateRemovalItem.equipment.name} 已不再占用当前角色的候选库存`,
      });
      setCandidateRemovalItem(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '移出候选装备库失败'
      );
    } finally {
      setRemovingCandidateItemIds([]);
    }
  };
  const handleConfirmBatchCandidateRemoval = async () => {
    if (candidateRemovalItems.length === 0 || !onRemoveCandidateItems) {
      return;
    }

    try {
      setRemovingCandidateItemIds(candidateRemovalItems.map((item) => item.id));
      await onRemoveCandidateItems(candidateRemovalItems);

      const removedIds = new Set(candidateRemovalItems.map((item) => item.id));
      if (selectedItem && removedIds.has(selectedItem.id)) {
        setSelectedItem(null);
      }

      toast.success('已批量从候选装备库移除', {
        description: `已移出 ${candidateRemovalItems.length} 件当前候选结果，不再占用当前角色的候选库存`,
      });
      setCandidateRemovalItems([]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '批量移出候选装备库失败'
      );
    } finally {
      setRemovingCandidateItemIds([]);
    }
  };
  const handleConfirmPlanRemoval = () => {
    if (!planRemovalItem || selectedPlanIndex < 0 || !selectedPlanLabel) {
      return;
    }

    try {
      setRemovingPlanItemIds([planRemovalItem.id]);
      removeEquipmentInSet(selectedPlanIndex, planRemovalItem.equipment);

      toast.success('已从装备方案移出', {
        description:
          selectedPlanIndex === activeSetIndex
            ? `${planRemovalItem.equipment.name} 已从当前方案移出，并同步取消当前穿戴`
            : `${planRemovalItem.equipment.name} 已从 ${selectedPlanLabel} 移出`,
      });
      setPlanRemovalItem(null);
      setBulkActionSummary({
        id: `plan-remove-${Date.now()}`,
        title: '已从装备方案移出',
        description:
          selectedPlanIndex === activeSetIndex
            ? `${planRemovalItem.equipment.name} 已从当前方案移出，并同步从当前穿戴卸下。`
            : `${planRemovalItem.equipment.name} 已从 ${selectedPlanLabel} 移出。`,
        tone: 'amber',
        affectedSlotLabels: [getEquipmentSlotLabel(planRemovalItem.equipment)],
        affectedSlotKeys: [buildEquipmentSlotKey(planRemovalItem.equipment)],
        targetLabel: selectedPlanLabel,
        viewHint: `当前仍保持“${selectedPlanLabel}”筛选，方便继续清理该方案中的其他装备。`,
        targetView: {
          sourceFilter: 'all',
          inventoryLifecycleFilter: 'all',
          statusFilter: 'all',
          planFilter: equipmentSets[selectedPlanIndex]?.id ?? 'all',
          differenceFilter: 'all',
          quickViewFilter: 'all',
        },
      });
    } finally {
      setRemovingPlanItemIds([]);
    }
  };
  const handleConfirmBatchPlanRemoval = () => {
    if (planRemovalItems.length === 0 || selectedPlanIndex < 0 || !selectedPlanLabel) {
      return;
    }

    try {
      setRemovingPlanItemIds(planRemovalItems.map((item) => item.id));
      removeEquipmentListInSet(
        selectedPlanIndex,
        planRemovalItems.map((item) => item.equipment)
      );

      toast.success('已批量移出装备方案', {
        description:
          selectedPlanIndex === activeSetIndex
            ? `已从当前方案批量移出 ${planRemovalItems.length} 件装备，并同步更新当前穿戴`
            : `已从 ${selectedPlanLabel} 批量移出 ${planRemovalItems.length} 件装备`,
      });
      setBulkActionSummary({
        id: `plan-remove-batch-${Date.now()}`,
        title: '已批量移出装备方案',
        description:
          selectedPlanIndex === activeSetIndex
            ? `已从当前方案移出 ${planRemovalItems.length} 件当前筛选结果，并同步更新当前穿戴。`
            : `已从 ${selectedPlanLabel} 移出 ${planRemovalItems.length} 件当前筛选结果。`,
        tone: 'amber',
        affectedSlotLabels: planRemovalItems.map((item) =>
          getEquipmentSlotLabel(item.equipment)
        ),
        affectedSlotKeys: planRemovalItems.map((item) =>
          buildEquipmentSlotKey(item.equipment)
        ),
        targetLabel: selectedPlanLabel,
        viewHint: `当前仍保持“${selectedPlanLabel}”筛选，方便继续核对该方案剩余装备。`,
        targetView: {
          sourceFilter: 'all',
          inventoryLifecycleFilter: 'all',
          statusFilter: 'all',
          planFilter: equipmentSets[selectedPlanIndex]?.id ?? 'all',
          differenceFilter: 'all',
          quickViewFilter: 'all',
        },
      });
      setPlanRemovalItems([]);
    } finally {
      setRemovingPlanItemIds([]);
    }
  };
  const handleConfirmInventoryStatusUpdate = async () => {
    if (!inventoryStatusUpdate) {
      return;
    }

    try {
      setUpdatingInventoryEntryIds(inventoryStatusUpdate.entryIds);
      await Promise.all(
        inventoryStatusUpdate.entryIds.map(async (entryId) => {
          const response = await fetch(`/api/simulator/current/inventory/${entryId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              status: inventoryStatusUpdate.nextStatus,
            }),
          });
          const payload = await response.json();

          if (!response.ok || payload?.code !== 0) {
            throw new Error(payload?.message || '更新正式库存失败');
          }
        })
      );

      await onRefreshInventoryLibrarySources?.();

      const nextStatusLabel = getSimulatorInventoryLifecycleLabel(
        inventoryStatusUpdate.nextStatus
      );
      const nextToastTitle = getSimulatorInventoryUpdateToastTitle(
        inventoryStatusUpdate.nextStatus
      );

      toast.success(nextToastTitle, {
        description:
          inventoryStatusUpdate.items.length === 1
            ? `${inventoryStatusUpdate.primaryItem.equipment.name} 已从正式库存转为${nextStatusLabel}`
            : `已将 ${inventoryStatusUpdate.items.length} 件正式库存装备批量更新为${nextStatusLabel}`,
      });

      setBulkActionSummary({
        id: `inventory-status-${Date.now()}`,
        title: nextToastTitle,
        description: `已处理 ${inventoryStatusUpdate.items.length} 件正式库存装备，目标状态为“${nextStatusLabel}”。`,
        tone: inventoryStatusUpdate.nextStatus === 'active' ? 'cyan' : 'amber',
        affectedSlotLabels: inventoryStatusUpdate.items.map((item) =>
          getEquipmentSlotLabel(item.equipment)
        ),
        affectedSlotKeys: inventoryStatusUpdate.items.map((item) =>
          buildEquipmentSlotKey(item.equipment)
        ),
        targetLabel:
          inventoryStatusUpdate.nextStatus === 'active'
            ? '正式库存 · 库存待用'
            : `正式库存 · ${nextStatusLabel}`,
        viewHint:
          inventoryStatusUpdate.nextStatus === 'active'
            ? '已推荐回到正式库存“库存待用”视图，恢复后的装备会重新进入换装与实验室选择链路。'
            : '已推荐回到对应正式库存状态视图，方便继续恢复或核对本次部位。',
        targetView: {
          sourceFilter: 'inventory_asset',
          inventoryLifecycleFilter: inventoryStatusUpdate.nextStatus,
          statusFilter: 'all',
          planFilter: 'all',
          differenceFilter: 'all',
          quickViewFilter: 'all',
        },
      });
      setBulkActionFocusOnly(true);

      if (
        selectedItem &&
        inventoryStatusUpdate.items.some((item) => item.id === selectedItem.id)
      ) {
        setSelectedItem(null);
      }

      setInventoryStatusUpdate(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新正式库存失败');
    } finally {
      setUpdatingInventoryEntryIds([]);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 24 }}
          className="relative flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-yellow-700/50 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-yellow-700/40 bg-gradient-to-r from-yellow-900/40 to-yellow-800/20 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-600">
                <Package className="h-5 w-5 text-slate-900" />
              </div>
              <div>
                <div className="text-lg font-bold text-yellow-100">
                  装备总库
                </div>
                <div className="text-xs text-yellow-300/75">
                  当前方案、其他方案和候选装备库的统一视图
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/60 transition-colors hover:bg-slate-700/80"
            >
              <X className="h-4 w-4 text-slate-300" />
            </button>
          </div>

          <div className="flex flex-col gap-4 border-b border-yellow-800/30 px-6 py-4">
            {bulkActionSummary ? (
              <div
                className={`rounded-xl border px-3 py-3 text-xs ${
                  bulkActionSummary.tone === 'cyan'
                    ? 'border-cyan-900/40 bg-cyan-950/10 text-cyan-100'
                    : bulkActionSummary.tone === 'violet'
                      ? 'border-violet-900/40 bg-violet-950/10 text-violet-100'
                      : 'border-amber-900/40 bg-amber-950/10 text-amber-100'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white/95">
                      {bulkActionSummary.title}
                    </div>
                    <div className="mt-1 text-slate-300">
                      {bulkActionSummary.description}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      目标去向：{bulkActionSummary.targetLabel}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      {bulkActionSummary.viewHint}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isBulkActionComplete ? (
                      <button
                        type="button"
                        onClick={handleCompleteBulkActionSummary}
                        className="rounded-full border border-emerald-400/50 bg-emerald-500/15 px-2.5 py-1 text-[11px] text-emerald-50 transition-colors hover:bg-emerald-500/25"
                      >
                        完成本轮
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        setBulkActionFocusOnly((current) => !current)
                      }
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                        bulkActionFocusOnly
                          ? 'border-white/25 bg-white/10 text-white'
                          : 'border-slate-700/70 bg-slate-900/70 text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {bulkActionFocusOnly ? '显示全部结果' : '只看本次部位'}
                    </button>
                    <button
                      type="button"
                      onClick={applyBulkActionTargetView}
                      className="rounded-full border border-slate-700/70 bg-slate-900/70 px-2.5 py-1 text-[11px] text-slate-200 transition-colors hover:bg-slate-800"
                    >
                      回到目标视图
                    </button>
                    {!isBulkActionComplete ? (
                      <button
                        type="button"
                        onClick={handleContinueBulkActionSummary}
                        className="rounded-full border border-slate-700/70 bg-slate-900/70 px-2.5 py-1 text-[11px] text-slate-200 transition-colors hover:bg-slate-800"
                      >
                        继续处理本次部位
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {bulkActionSummary.affectedSlotLabels.slice(0, 6).map((label) => (
                    <span
                      key={`${bulkActionSummary.id}-${label}`}
                      className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/85"
                    >
                      {label}
                    </span>
                  ))}
                  {bulkActionSummary.affectedSlotLabels.length > 6 ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/70">
                      +{bulkActionSummary.affectedSlotLabels.length - 6}
                    </span>
                  ) : null}
                </div>
                {bulkActionProgress ? (
                  <div className="mt-3 rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-medium text-white/90">
                        本次部位处理进度
                      </span>
                      {bulkActionStage ? (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] ${
                            BULK_ACTION_STAGE_TONE_CLASS[bulkActionStage.tone]
                          }`}
                        >
                          阶段：{bulkActionStage.label}
                        </span>
                      ) : null}
                      {bulkActionRecommendedActionLabel ? (
                        <span className="rounded-full border border-yellow-400/40 bg-yellow-500/10 px-2 py-0.5 text-[11px] text-yellow-100">
                          推荐下一步：{bulkActionRecommendedActionLabel}
                        </span>
                      ) : null}
                      <span className="text-[11px] text-slate-300">
                        {bulkActionStage?.description ??
                          (bulkActionProgress.hasFollowUpActions
                            ? '当前还能继续往下处理。'
                            : '当前视图下已没有下一步批量动作。')}
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="h-2 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-emerald-400/80 transition-all"
                          style={{
                            width: `${
                              bulkActionProgress.totalSlotCount === 0
                                ? 0
                                : Math.round(
                                    (bulkActionProgress.completedSlotCount /
                                      bulkActionProgress.totalSlotCount) *
                                      100
                                  )
                            }%`,
                          }}
                        />
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        已收尾 {bulkActionProgress.completedSlotCount} /{' '}
                        {bulkActionProgress.totalSlotCount} 个部位，仍待处理{' '}
                        {bulkActionProgress.actionableSlotCount} 个部位
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[
                        `本次部位 ${bulkActionProgress.totalSlotCount}`,
                        `当前命中 ${bulkActionProgress.visibleSlotCount}`,
                        `当前穿戴 ${bulkActionProgress.equippedSlotCount}`,
                        `库存待用 ${bulkActionProgress.idleSlotCount}`,
                        `实验室中 ${bulkActionProgress.inLabSlotCount}`,
                        `可送实验室 ${bulkActionProgress.sendableLabSlotCount}`,
                        `可移出实验室 ${bulkActionProgress.removableLabSlotCount}`,
                        `可写方案 ${bulkActionProgress.planWritableSlotCount}`,
                      ].map((label) => (
                        <span
                          key={`${bulkActionSummary.id}-${label}`}
                          className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/80"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                    {isBulkActionComplete ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                        <span className="text-[11px] text-emerald-100">
                          本轮已收尾，这批部位当前已没有后续批量动作。
                        </span>
                        <button
                          type="button"
                          onClick={handleStartNextBulkActionRound}
                          className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white/85 transition-colors hover:bg-white/10"
                        >
                          开始下一批
                        </button>
                        <button
                          type="button"
                          onClick={handleCompleteBulkActionSummary}
                          className="rounded-full border border-emerald-400/50 bg-emerald-500/15 px-2.5 py-1 text-[11px] text-emerald-50 transition-colors hover:bg-emerald-500/25"
                        >
                          完成本轮
                        </button>
                        {bulkActionFocusOnly ? (
                          <button
                            type="button"
                            onClick={() => setBulkActionFocusOnly(false)}
                            className="rounded-full border border-slate-700/70 bg-slate-900/70 px-2.5 py-1 text-[11px] text-slate-200 transition-colors hover:bg-slate-800"
                          >
                            回看全部结果
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {!isBulkActionComplete ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {bulkActionFollowUpActions.map((action) => (
                      <button
                        key={`${bulkActionSummary.id}-${action.key}`}
                        type="button"
                        onClick={action.onClick}
                        className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${
                          action.key === bulkActionRecommendedActionKey
                            ? action.recommendedToneClass
                            : action.toneClass
                        }`}
                      >
                        {action.key === bulkActionRecommendedActionKey
                          ? '推荐：'
                          : ''}
                        {action.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {SOURCE_FILTERS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setSourceFilter(option.key)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    sourceFilter === option.key
                      ? 'border-sky-400/60 bg-sky-500/20 text-sky-100'
                      : 'border-slate-700/70 bg-slate-900/70 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {sourceFilter === 'inventory_asset' ? (
              <div className="flex flex-wrap gap-2 rounded-xl border border-emerald-900/30 bg-emerald-950/10 px-3 py-2">
                <span className="self-center text-xs font-medium text-emerald-100">
                  正式库存状态
                </span>
                {inventoryLifecycleSummaryItems.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setInventoryLifecycleFilter(option.key)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      inventoryLifecycleFilter === option.key
                        ? 'border-emerald-300/70 bg-emerald-500/20 text-emerald-50'
                        : 'border-slate-700/70 bg-slate-900/70 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {option.label} ({option.value})
                  </button>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {planSummaryItems.map((planItem) => (
                <button
                  key={planItem.key}
                  type="button"
                  onClick={() => setPlanFilter(planItem.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                    planFilter === planItem.key
                      ? 'border-violet-400/60 bg-violet-500/20 text-violet-100'
                      : 'border-slate-700/70 bg-slate-900/70 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>{planItem.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      planFilter === planItem.key
                        ? 'bg-violet-200/15 text-violet-50'
                        : 'isLabSample' in planItem && planItem.isLabSample
                          ? 'bg-cyan-500/20 text-cyan-100'
                          : planItem.isActive
                          ? 'bg-amber-500/20 text-amber-100'
                          : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {planItem.value}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-100">
                当前方案：{currentPlanLabel}
              </span>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-cyan-100">
                实验室样本：{laboratorySamplePlanLabel}
              </span>
              {activeSetIndex !== normalizedLaboratorySampleSetIndex ? (
                <span className="text-slate-400">
                  当前页与实验室对照基线不是同一套方案，差异部位
                  {differenceSummary.differenceCount} 个。
                </span>
              ) : (
                <span className="text-slate-400">
                  当前页与实验室样本方案已保持一致。
                </span>
              )}
              <div className="ml-auto flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPlanFilter(equipmentSets[activeSetIndex]?.id ?? 'all')
                  }
                  className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-100 transition-colors hover:bg-amber-500/20"
                >
                  筛到当前方案
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPlanFilter(
                      equipmentSets[normalizedLaboratorySampleSetIndex]?.id ??
                        'all'
                    )
                  }
                  className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-cyan-100 transition-colors hover:bg-cyan-500/20"
                >
                  筛到实验室样本
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDifferenceFilter((current) =>
                      current === 'different' ? 'all' : 'different'
                    )
                  }
                  disabled={differenceSummary.differenceCount === 0}
                  className={`rounded-full border px-2.5 py-1 transition-colors ${
                    differenceSummary.differenceCount === 0
                      ? 'cursor-not-allowed border-slate-800 bg-slate-900/60 text-slate-500'
                      : differenceFilter === 'different'
                        ? 'border-rose-500/40 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25'
                        : 'border-rose-500/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20'
                  }`}
                >
                  只看差异部位
                  {differenceSummary.differenceCount > 0
                    ? ` (${differenceSummary.differenceCount})`
                    : ''}
                </button>
              </div>
            </div>

            {differenceSummary.differenceCount > 0 ? (
              <div className="flex flex-wrap gap-2">
                {[
                  {
                    key: 'current_only' as const,
                    label: '当前方案独有',
                    count: differenceSummary.currentOnlySlotKeys.length,
                    tone: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
                  },
                  {
                    key: 'sample_only' as const,
                    label: '实验室样本独有',
                    count: differenceSummary.sampleOnlySlotKeys.length,
                    tone: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100',
                  },
                  {
                    key: 'replaced' as const,
                    label: '同部位不同装备',
                    count: differenceSummary.replacedSlotKeys.length,
                    tone: 'border-rose-500/30 bg-rose-500/10 text-rose-100',
                  },
                ]
                  .filter((item) => item.count > 0)
                  .map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() =>
                        setDifferenceFilter((current) =>
                          current === item.key ? 'all' : item.key
                        )
                      }
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        differenceFilter === item.key
                          ? item.tone
                          : 'border-slate-700/70 bg-slate-900/70 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {item.label} ({item.count})
                    </button>
                  ))}
              </div>
            ) : null}

            {actionableQuickFilters.length > 0 ? (
              <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/10 px-3 py-3">
                <div className="mb-2 text-xs font-medium text-emerald-200">
                  快捷处理视角
                </div>
                <div className="flex flex-wrap gap-2">
                  {actionableQuickFilters.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={item.apply}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        item.active
                          ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-50'
                          : 'border-emerald-700/40 bg-emerald-950/20 text-emerald-100 hover:bg-emerald-900/30'
                      }`}
                      title={item.description}
                    >
                      {item.label} ({item.count})
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {activeQuickViewKey === 'diff_idle' ||
            activeQuickViewKey === 'current_only_idle' ? (
              <div className="rounded-xl border border-cyan-900/40 bg-cyan-950/10 px-3 py-3 text-xs text-cyan-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-cyan-50">
                    推荐批量动作
                  </span>
                  <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px]">
                    当前可送实验室部位 {quickViewLabCandidates.length}
                  </span>
                  {rawQuickViewSendableCount > quickViewLabCandidates.length ? (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-100">
                      同部位重复候选 {rawQuickViewSendableCount - quickViewLabCandidates.length} 件
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 text-slate-300">
                  会按当前排序对部位去重，每个部位只取最靠前的一件送入实验室，避免同部位候选互相覆盖。
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleBatchSendQuickViewToLab}
                    disabled={quickViewLabCandidates.length === 0}
                    className={`rounded-full border px-3 py-1.5 transition-colors ${
                      quickViewLabCandidates.length === 0
                        ? 'cursor-not-allowed border-slate-800 bg-slate-900/60 text-slate-500'
                        : 'border-cyan-400/60 bg-cyan-500/20 text-cyan-50 hover:bg-cyan-500/25'
                    }`}
                  >
                    批量送去实验室
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickViewFilter('all')}
                    className="rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1.5 text-slate-200 transition-colors hover:bg-slate-800"
                  >
                    先退出这个视角
                  </button>
                </div>
              </div>
            ) : activeQuickViewKey === 'replaced_idle' ? (
              <div className="rounded-xl border border-amber-900/40 bg-amber-950/10 px-3 py-3 text-xs text-amber-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-amber-50">方案批量操作</span>
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px]">
                    当前可写方案部位 {visiblePlanWriteCandidates.length}
                  </span>
                  {rawVisiblePlanAssignableCount > visiblePlanWriteCandidates.length ? (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px]">
                      同部位重复候选 {rawVisiblePlanAssignableCount - visiblePlanWriteCandidates.length} 件
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 text-slate-300">
                  这个视角适合把一批替换候选批量写入某套装备方案。系统会按当前排序对部位去重，再由你选择写入哪一套方案。
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBatchPlanPickerOpen(true)}
                    disabled={visiblePlanWriteCandidates.length === 0}
                    className={`rounded-full border px-3 py-1.5 transition-colors ${
                      visiblePlanWriteCandidates.length === 0
                        ? 'cursor-not-allowed border-slate-800 bg-slate-900/60 text-slate-500'
                        : 'border-amber-400/60 bg-amber-500/20 text-amber-50 hover:bg-amber-500/25'
                    }`}
                  >
                    批量写入方案
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickViewFilter('all')}
                    className="rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1.5 text-slate-200 transition-colors hover:bg-slate-800"
                  >
                    先退出这个视角
                  </button>
                </div>
                <div className="mt-2 text-[11px] text-slate-400">
                  当前不会直接批量覆盖“当前穿戴”，而是先让你选目标方案，减少误操作风险。
                </div>
              </div>
            ) : null}

            {statusFilter === 'lab' && visibleLabItems.length > 0 ? (
              <div className="rounded-xl border border-violet-900/40 bg-violet-950/10 px-3 py-3 text-xs text-violet-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-violet-50">
                    实验室批量操作
                  </span>
                  <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[11px]">
                    当前可撤回 {visibleLabItems.length} 件
                  </span>
                </div>
                <div className="mt-2 text-slate-300">
                  会按当前结果逐件从实验室对比席位撤回，方便你在总库里直接清理本轮已比完的装备。
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleBatchRemoveVisibleFromLab}
                    className="rounded-full border border-violet-400/60 bg-violet-500/20 px-3 py-1.5 text-violet-50 transition-colors hover:bg-violet-500/25"
                  >
                    批量移出实验室
                  </button>
                </div>
              </div>
            ) : null}

            {shouldShowBatchInventoryStatusUpdate ? (
              <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/10 px-3 py-3 text-xs text-emerald-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-emerald-50">
                    正式库存批量状态
                  </span>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px]">
                    当前可操作 {manageableInventoryItems.length} 件
                  </span>
                </div>
                <div className="mt-2 text-slate-300">
                  只会批量处理由候选入库生成、且当前仍处于有效状态的正式库存记录。
                  若某件装备同时还被当前方案、其他方案或实验室引用，这些引用不会被删除。
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const draft = buildSimulatorInventoryStatusUpdateDraft({
                        items: manageableInventoryItems,
                        nextStatus: 'sold',
                      });

                      if (draft) {
                        setInventoryStatusUpdate(draft);
                      }
                    }}
                    disabled={
                      manageableInventoryItems.length === 0 ||
                      updatingInventoryEntryIds.length > 0
                    }
                    className={`rounded-full border px-3 py-1.5 transition-colors ${
                      manageableInventoryItems.length === 0 ||
                      updatingInventoryEntryIds.length > 0
                        ? 'cursor-not-allowed border-slate-800 bg-slate-900/60 text-slate-500'
                        : 'border-emerald-400/60 bg-emerald-500/20 text-emerald-50 hover:bg-emerald-500/25'
                    }`}
                  >
                    批量标记已售出
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const draft = buildSimulatorInventoryStatusUpdateDraft({
                        items: manageableInventoryItems,
                        nextStatus: 'discarded',
                      });

                      if (draft) {
                        setInventoryStatusUpdate(draft);
                      }
                    }}
                    disabled={
                      manageableInventoryItems.length === 0 ||
                      updatingInventoryEntryIds.length > 0
                    }
                    className={`rounded-full border px-3 py-1.5 transition-colors ${
                      manageableInventoryItems.length === 0 ||
                      updatingInventoryEntryIds.length > 0
                        ? 'cursor-not-allowed border-slate-800 bg-slate-900/60 text-slate-500'
                        : 'border-red-400/60 bg-red-500/20 text-red-50 hover:bg-red-500/25'
                    }`}
                  >
                    批量标记作废
                  </button>
                </div>
              </div>
            ) : null}

            {shouldShowBatchInventoryRestore ? (
              <div className="rounded-xl border border-sky-900/40 bg-sky-950/10 px-3 py-3 text-xs text-sky-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sky-50">正式库存恢复</span>
                  <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px]">
                    当前可恢复 {restorableInventoryItems.length} 件
                  </span>
                </div>
                <div className="mt-2 text-slate-300">
                  会把已售出或已作废的候选入库正式库存恢复为“库存待用”，恢复后才会重新进入换装和实验室选择链路。
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const draft = buildSimulatorInventoryStatusUpdateDraft({
                        items: restorableInventoryItems,
                        nextStatus: 'active',
                      });

                      if (draft) {
                        setInventoryStatusUpdate(draft);
                      }
                    }}
                    disabled={
                      restorableInventoryItems.length === 0 ||
                      updatingInventoryEntryIds.length > 0
                    }
                    className={`rounded-full border px-3 py-1.5 transition-colors ${
                      restorableInventoryItems.length === 0 ||
                      updatingInventoryEntryIds.length > 0
                        ? 'cursor-not-allowed border-slate-800 bg-slate-900/60 text-slate-500'
                        : 'border-sky-400/60 bg-sky-500/20 text-sky-50 hover:bg-sky-500/25'
                    }`}
                  >
                    批量恢复待用
                  </button>
                </div>
              </div>
            ) : null}

            {shouldShowBatchCandidateRemoval ? (
              <div className="rounded-xl border border-red-900/40 bg-red-950/10 px-3 py-3 text-xs text-red-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-red-50">候选库批量清理</span>
                  <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px]">
                    当前可移出 {removableCandidateItems.length} 件
                  </span>
                </div>
                <div className="mt-2 text-slate-300">
                  会按当前筛选结果，一次性移出这些候选装备的“候选库来源”。
                  如果其中某件装备同时属于当前方案或其他方案，卡片仍会保留，只是不再占用候选库存。
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCandidateRemovalItems(removableCandidateItems)
                    }
                    disabled={
                      removableCandidateItems.length === 0 ||
                      removingCandidateItemIds.length > 0
                    }
                    className={`rounded-full border px-3 py-1.5 transition-colors ${
                      removableCandidateItems.length === 0 ||
                      removingCandidateItemIds.length > 0
                        ? 'cursor-not-allowed border-slate-800 bg-slate-900/60 text-slate-500'
                        : 'border-red-400/60 bg-red-500/20 text-red-50 hover:bg-red-500/25'
                    }`}
                  >
                    批量移出候选库
                  </button>
                </div>
              </div>
            ) : null}

            {shouldShowBatchPlanRemoval && selectedPlanLabel ? (
              <div className="rounded-xl border border-amber-900/40 bg-amber-950/10 px-3 py-3 text-xs text-amber-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-amber-50">方案批量清理</span>
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px]">
                    当前可从「{selectedPlanLabel}」移出 {removablePlanItems.length} 件
                  </span>
                </div>
                <div className="mt-2 text-slate-300">
                  会把当前筛选结果里已写入该方案的装备批量移出。
                  {selectedPlanIndex === activeSetIndex
                    ? '由于这是当前方案，移出后会同步更新当前穿戴。'
                    : '如果装备同时还属于候选库或其他方案，卡片仍会保留在总库中。'}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPlanRemovalItems(removablePlanItems)}
                    disabled={
                      removablePlanItems.length === 0 ||
                      removingPlanItemIds.length > 0
                    }
                    className={`rounded-full border px-3 py-1.5 transition-colors ${
                      removablePlanItems.length === 0 ||
                      removingPlanItemIds.length > 0
                        ? 'cursor-not-allowed border-slate-800 bg-slate-900/60 text-slate-500'
                        : 'border-amber-400/60 bg-amber-500/20 text-amber-50 hover:bg-amber-500/25'
                    }`}
                  >
                    批量移出方案
                  </button>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((option) => {
                  const Icon = option.icon;

                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => {
                        setCategory(option.key);
                        setSecondaryCategory('all');
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                        category === option.key
                          ? 'border-yellow-500/60 bg-yellow-500/15 text-yellow-100'
                          : 'border-slate-700/70 bg-slate-900/70 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSecondaryCategory('all')}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    secondaryCategory === 'all'
                      ? 'border-amber-500/60 bg-amber-500/15 text-amber-100'
                      : 'border-slate-700/70 bg-slate-900/70 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  全部部位
                </button>
                {secondaryDefinitions.map((definition) => (
                  <button
                    key={definition.id}
                    type="button"
                    onClick={() => setSecondaryCategory(definition.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                      secondaryCategory === definition.id
                        ? 'border-amber-500/60 bg-amber-500/15 text-amber-100'
                        : 'border-slate-700/70 bg-slate-900/70 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {getSimulatorSlotLabel(definition, 'equipmentPanel')}
                  </button>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-slate-400" />
                <select
                  value={sortKey}
                  onChange={(event) =>
                    setSortKey(
                      event.target.value as SimulatorCandidateEquipmentSortKey
                    )
                  }
                  className="rounded-lg border border-slate-700/70 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-200 outline-none"
                >
                  <option value="newest">最新优先</option>
                  <option value="oldest">最早优先</option>
                  <option value="totalPriceDesc">总价最高</option>
                  <option value="totalPriceAsc">总价最低</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
              {summaryItems.map((summaryItem) => (
                <button
                  key={summaryItem.label}
                  type="button"
                  onClick={() => setStatusFilter(summaryItem.key)}
                  className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                    statusFilter === summaryItem.key
                      ? summaryItem.activeTone
                      : `${summaryItem.tone} hover:border-slate-500/60`
                  }`}
                >
                  <div className="text-[11px] opacity-80">{summaryItem.label}</div>
                  <div className="mt-1 text-lg font-bold">
                    {summaryItem.value}
                  </div>
                </button>
              ))}
            </div>

            {quickViewFilter !== 'all' ||
            bulkActionFocusOnly ||
            statusFilter !== 'all' ||
            planFilter !== 'all' ||
            differenceFilter !== 'all' ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                {bulkActionFocusOnly && bulkActionSummary ? (
                  <span className="rounded-full border border-cyan-700/60 bg-cyan-950/30 px-3 py-1 text-cyan-100">
                    结果聚焦：仅看本次影响部位
                  </span>
                ) : null}
                {quickViewFilter !== 'all' ? (
                  <span className="rounded-full border border-emerald-700/60 bg-emerald-950/30 px-3 py-1 text-emerald-100">
                    快捷视角：
                    {
                      actionableQuickFilters.find(
                        (item) => item.key === quickViewFilter
                      )?.label
                    }
                  </span>
                ) : null}
                {statusFilter !== 'all' ? (
                  <span className="rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1">
                    当前状态筛选：
                    {summaryItems.find((item) => item.key === statusFilter)?.label}
                  </span>
                ) : null}
                {planFilter !== 'all' ? (
                  <span className="rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1">
                    当前方案筛选：
                    {planSummaryItems.find((item) => item.key === planFilter)?.label}
                  </span>
                ) : null}
                {differenceFilter !== 'all' ? (
                  <span className="rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1">
                    当前差异筛选：
                    {differenceFilter === 'different'
                      ? '仅看当前方案与实验室样本差异部位'
                      : differenceFilter === 'current_only'
                        ? '仅看当前方案独有部位'
                        : differenceFilter === 'sample_only'
                          ? '仅看实验室样本独有部位'
                          : '仅看同部位不同装备'}
                  </span>
                ) : null}
                {bulkActionFocusOnly ? (
                  <button
                    type="button"
                    onClick={() => setBulkActionFocusOnly(false)}
                    className="rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1 transition-colors hover:bg-slate-800"
                  >
                    清除结果聚焦
                  </button>
                ) : null}
                {quickViewFilter !== 'all' ? (
                  <button
                    type="button"
                    onClick={() => setQuickViewFilter('all')}
                    className="rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1 transition-colors hover:bg-slate-800"
                  >
                    清除快捷视角
                  </button>
                ) : null}
                {statusFilter !== 'all' ? (
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className="rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1 transition-colors hover:bg-slate-800"
                  >
                    清除状态筛选
                  </button>
                ) : null}
                {planFilter !== 'all' ? (
                  <button
                    type="button"
                    onClick={() => setPlanFilter('all')}
                    className="rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1 transition-colors hover:bg-slate-800"
                  >
                    清除方案筛选
                  </button>
                ) : null}
                {differenceFilter !== 'all' ? (
                  <button
                    type="button"
                    onClick={() => setDifferenceFilter('all')}
                    className="rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1 transition-colors hover:bg-slate-800"
                  >
                    清除差异筛选
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {filteredItems.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <Package className="h-16 w-16 text-slate-600" />
                {(() => {
                  const emptyStateCopy =
                    sourceFilter === 'inventory_asset'
                      ? buildSimulatorInventoryEmptyStateCopy({
                          lifecycleFilter: inventoryLifecycleFilter,
                          hasScopedInventoryItems: scopedInventoryItems.length > 0,
                          hasLifecycleMatches:
                            lifecycleMatchedInventoryItems.length > 0,
                          hasAdditionalFilters: sourceFilteredItems.length > 0,
                          fallbackTitle:
                            sourceFilteredItems.length === 0
                              ? '当前来源 / 主类 / 部位筛选下还没有装备'
                              : '当前筛选下还没有装备',
                          fallbackDescription:
                            sourceFilteredItems.length === 0
                              ? '可以切换来源、分类或部位查看其他库存'
                              : '可以清除快捷视角、状态、方案或差异筛选后继续查看',
                        })
                      : {
                          title:
                            sourceFilteredItems.length === 0
                              ? '当前来源 / 主类 / 部位筛选下还没有装备'
                              : '当前筛选下还没有装备',
                          description:
                            sourceFilteredItems.length === 0
                              ? '可以切换来源、分类或部位查看其他库存'
                              : '可以清除快捷视角、状态、方案或差异筛选后继续查看',
                        };

                  return (
                    <>
                      <div className="text-sm text-slate-300">
                        {emptyStateCopy.title}
                      </div>
                      <div className="text-xs text-slate-500">
                        {emptyStateCopy.description}
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                {filteredItems.map((item) => {
                  const { currentEquipped, compareSeatMatch } =
                    getItemStatus(item);
                  const inventorySummary =
                    summarizeSimulatorInventoryRefs(item);
                  const candidateBackedInventoryRefs =
                    getCandidateBackedInventoryRefs(item);
                  const restorableInventoryRefs = getCandidateBackedInventoryRefs(
                    item,
                    ['sold', 'discarded']
                  );
                  const inventoryOnlyInactive =
                    item.sourceKinds.includes('inventory_asset') &&
                    inventorySummary.active === 0 &&
                    (inventorySummary.sold > 0 ||
                      inventorySummary.discarded > 0) &&
                    item.sourceKinds.every(
                      (sourceKind) => sourceKind === 'inventory_asset'
                    );
                  const canManageInventory =
                    sourceFilter === 'inventory_asset' &&
                    candidateBackedInventoryRefs.length > 0;
                  const canRestoreInventory =
                    sourceFilter === 'inventory_asset' &&
                    restorableInventoryRefs.length > 0;
                  const canRemoveCandidate = canRemoveFromCandidateLibrary(item);
                  const canRemovePlan = canRemoveFromSelectedPlan(item);
                  const dangerActionLabel =
                    canManageInventory
                      ? '标记作废'
                      : sourceFilter === 'candidate_library'
                      ? canRemoveCandidate
                        ? '移出候选库'
                        : undefined
                      : canRemovePlan
                        ? '移出该方案'
                        : undefined;
                  const dangerActionDisabled =
                    canManageInventory
                      ? candidateBackedInventoryRefs.some((ref) =>
                          updatingInventoryEntryIds.includes(ref.entryId)
                        )
                      : sourceFilter === 'candidate_library'
                      ? removingCandidateItemIds.includes(item.id)
                      : removingPlanItemIds.includes(item.id);
                  const handleDangerAction = () => {
                    if (canManageInventory) {
                      const draft = buildSimulatorInventoryStatusUpdateDraft({
                        items: [item],
                        nextStatus: 'discarded',
                      });
                      if (draft) {
                        setInventoryStatusUpdate(draft);
                      }
                      return;
                    }

                    if (sourceFilter === 'candidate_library') {
                      if (canRemoveCandidate) {
                        setCandidateRemovalItem(item);
                      }
                      return;
                    }

                    if (canRemovePlan) {
                      setPlanRemovalItem(item);
                    }
                  };
                  const inventoryLifecycleStatusLabels =
                    buildSimulatorInventoryStatusLabels(inventorySummary, {
                      formal: true,
                    });
                  const quickViewSuggestion = buildInventoryQuickViewSuggestion({
                    quickViewKey: activeQuickViewKey,
                    canQuickEquip: !inventoryOnlyInactive && canQuickEquip(item),
                    canAssignToPlan:
                      !inventoryOnlyInactive && canAssignToPlan(item),
                  });

                  return (
                    <LibraryEquipmentCard
                      key={item.id}
                      equipment={item.equipment}
                      formatPrice={formatPrice}
                      selectable={false}
                      sourceLabels={item.sourceLabels}
                      helperText={buildEquipmentPlanUsageSummary(
                        item.sourceLabels
                      )}
                      recommendationLabel={quickViewSuggestion?.label}
                      recommendationDescription={
                        quickViewSuggestion?.description
                      }
                      recommendedAction={
                        quickViewSuggestion?.recommendedAction
                      }
                      statusLabels={[
                        ...(currentEquipped
                          ? [{ label: '当前穿戴', tone: 'emerald' as const }]
                          : []),
                        ...(compareSeatMatch
                          ? [
                              {
                                label: `实验室:${compareSeatMatch.name}`,
                                tone: 'violet' as const,
                              },
                            ]
                          : []),
                        ...inventoryLifecycleStatusLabels,
                        ...(!currentEquipped &&
                        !compareSeatMatch &&
                        inventoryLifecycleStatusLabels.length === 0 &&
                        !inventoryOnlyInactive
                          ? [{ label: '库存待用', tone: 'amber' as const }]
                          : []),
                      ]}
                      onClick={() => setSelectedItem(item)}
                      actionLabel={
                        inventoryOnlyInactive
                          ? '查看详情'
                          : currentEquipped
                          ? '已穿戴'
                          : canQuickEquip(item)
                            ? '挂到当前'
                            : '查看详情'
                      }
                      actionDisabled={!inventoryOnlyInactive && currentEquipped}
                      onActionClick={() => {
                        if (inventoryOnlyInactive || !canQuickEquip(item)) {
                          setSelectedItem(item);
                          return;
                        }

                        updateEquipment({
                          ...item.equipment,
                        });
                      }}
                      secondaryActionLabel={
                        inventoryOnlyInactive
                          ? undefined
                          : compareSeatMatch
                            ? '移出实验室'
                            : '送去实验室'
                      }
                      onSecondaryActionClick={
                        inventoryOnlyInactive
                          ? undefined
                          : () =>
                              compareSeatMatch
                                ? handleRemoveFromLab(item)
                                : handleSendToLab(item)
                      }
                      tertiaryActionLabel={
                        canRestoreInventory
                          ? '恢复待用'
                          : canManageInventory
                          ? '标记已售出'
                          : !inventoryOnlyInactive && canAssignToPlan(item)
                            ? '挂到方案'
                            : undefined
                      }
                      tertiaryActionDisabled={
                        canRestoreInventory
                          ? restorableInventoryRefs.some((ref) =>
                              updatingInventoryEntryIds.includes(ref.entryId)
                            )
                          : canManageInventory
                          ? candidateBackedInventoryRefs.some((ref) =>
                              updatingInventoryEntryIds.includes(ref.entryId)
                            )
                          : false
                      }
                      onTertiaryActionClick={() => {
                        if (canRestoreInventory) {
                          const draft = buildSimulatorInventoryStatusUpdateDraft(
                            {
                              items: [item],
                              nextStatus: 'active',
                            }
                          );
                          if (draft) {
                            setInventoryStatusUpdate(draft);
                          }
                          return;
                        }

                        if (canManageInventory) {
                          const draft = buildSimulatorInventoryStatusUpdateDraft(
                            {
                              items: [item],
                              nextStatus: 'sold',
                            }
                          );
                          if (draft) {
                            setInventoryStatusUpdate(draft);
                          }
                          return;
                        }

                        if (!inventoryOnlyInactive) {
                          setPlanPickerItem(item);
                        }
                      }}
                      dangerActionLabel={dangerActionLabel}
                      dangerActionDisabled={dangerActionDisabled}
                      onDangerActionClick={handleDangerAction}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>

        {selectedItem ? (
          <EquipmentDetailModal
            equipment={selectedItem.equipment}
            onClose={() => setSelectedItem(null)}
          />
        ) : null}

        {planPickerItem ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/65 backdrop-blur-sm"
              onClick={() => setPlanPickerItem(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="relative z-10 w-full max-w-lg rounded-2xl border border-amber-500/30 bg-slate-950/95 p-5 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-semibold text-amber-100">
                    挂到指定方案
                  </div>
                  <div className="mt-1 text-sm text-slate-300">
                    选择要写入的装备方案：
                    <span className="text-amber-200">
                      {planPickerItem.equipment.name}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPlanPickerItem(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/60 transition-colors hover:bg-slate-700/80"
                >
                  <X className="h-4 w-4 text-slate-300" />
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {planAssignmentOptions.some(
                  (option) => option.state === 'replace'
                ) ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-xs text-amber-100">
                    部分方案已有同部位装备，挂入后会覆盖原装备。
                  </div>
                ) : null}

                {planAssignmentOptions.map((option) => (
                  <button
                    key={option.index}
                    type="button"
                    disabled={option.state === 'same'}
                    onClick={() =>
                      handleAssignToPlan(planPickerItem, option.index)
                    }
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                      option.state === 'same'
                        ? 'cursor-not-allowed border-slate-800 bg-slate-900/50 opacity-70'
                        : option.state === 'replace'
                          ? 'border-amber-500/35 bg-amber-950/15 hover:border-amber-400/60 hover:bg-amber-950/25'
                          : 'border-slate-700/70 bg-slate-900/75 hover:border-amber-500/50 hover:bg-slate-900'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-100">
                        {option.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {option.state === 'same'
                          ? '这个方案已经是同一件装备'
                          : option.state === 'replace'
                            ? `将替换 ${option.existingEquipment?.name || '当前同部位装备'}`
                            : '该栏位当前为空，可直接写入'}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {option.isActive
                          ? '当前正在查看的方案'
                          : '写入后不会自动切换当前方案'}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        option.state === 'same'
                          ? 'bg-slate-800 text-slate-300'
                          : option.state === 'replace'
                            ? 'bg-amber-500/20 text-amber-100'
                            : 'bg-emerald-500/20 text-emerald-100'
                      }`}
                    >
                      {option.state === 'same'
                        ? '已存在'
                        : option.state === 'replace'
                          ? '覆盖替换'
                          : '直接写入'}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        ) : null}

        {isBatchPlanPickerOpen ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/65 backdrop-blur-sm"
              onClick={() => setIsBatchPlanPickerOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="relative z-10 w-full max-w-xl rounded-2xl border border-amber-500/30 bg-slate-950/95 p-5 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-semibold text-amber-100">
                    批量写入装备方案
                  </div>
                  <div className="mt-1 text-sm text-slate-300">
                    当前视角共有
                    <span className="text-amber-200">
                      {visiblePlanWriteCandidates.length}
                    </span>
                    个可写入部位。选择目标方案后，系统会按当前排序去重写入。
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBatchPlanPickerOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/60 transition-colors hover:bg-slate-700/80"
                >
                  <X className="h-4 w-4 text-slate-300" />
                </button>
              </div>

              <div className="mt-4 space-y-2">
                <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
                  <div className="text-xs font-medium text-slate-200">
                    批量写入模式
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      {
                        key: 'all_writable' as const,
                        label: '全部可变动项',
                        description: '空栏位直接写入，已有栏位允许覆盖替换。',
                      },
                      {
                        key: 'empty_only' as const,
                        label: '仅补空栏位',
                        description: '只写目标方案当前为空的部位，不覆盖已有装备。',
                      },
                      {
                        key: 'replace_only' as const,
                        label: '仅替换已有栏位',
                        description:
                          '只处理目标方案里已有装备的部位，不往空栏位新增装备。',
                      },
                    ].map((mode) => (
                      <button
                        key={mode.key}
                        type="button"
                        onClick={() => setBatchPlanWriteMode(mode.key)}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                          batchPlanWriteMode === mode.key
                            ? 'border-amber-400/60 bg-amber-500/20 text-amber-50'
                            : 'border-slate-700/70 bg-slate-900/70 text-slate-300 hover:bg-slate-800'
                        }`}
                        title={mode.description}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400">
                    {batchPlanWriteMode === 'empty_only'
                      ? '当前模式只会补目标方案里还没放装备的栏位。'
                      : batchPlanWriteMode === 'replace_only'
                        ? '当前模式只会替换目标方案里已有装备的部位，不会往空栏位新增装备。'
                        : '当前模式会写入所有可变动项，但仍会跳过“原本已一致”的同一件装备。'}
                  </div>
                </div>

                {batchPlanAssignmentOptions.map((option) => (
                  <button
                    key={option.index}
                    type="button"
                    onClick={() => handleBatchAssignVisibleToPlan(option.index)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                      getBatchPlanWritableCountByMode({
                        summary: option.summary,
                        mode: batchPlanWriteMode,
                      }) > 0
                        ? (batchPlanWriteMode === 'all_writable' ||
                            batchPlanWriteMode === 'replace_only') &&
                          option.summary.replaceCount > 0
                          ? 'border-amber-500/35 bg-amber-950/15 hover:border-amber-400/60 hover:bg-amber-950/25'
                          : 'border-emerald-500/25 bg-emerald-950/10 hover:border-emerald-400/50 hover:bg-emerald-950/20'
                        : 'border-slate-700/70 bg-slate-900/75 hover:border-slate-500/70 hover:bg-slate-900'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-100">
                        {option.name}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                        {(batchPlanWriteMode === 'all_writable' ||
                          batchPlanWriteMode === 'replace_only') &&
                        option.summary.replaceCount > 0 ? (
                          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-100">
                            覆盖替换 {option.summary.replaceCount}
                          </span>
                        ) : null}
                        {option.summary.emptyCount > 0 ? (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-100">
                            直接写入 {option.summary.emptyCount}
                          </span>
                        ) : null}
                        {option.summary.sameCount > 0 ? (
                          <span className="rounded-full border border-slate-600/70 bg-slate-800/70 px-2 py-0.5 text-slate-300">
                            已一致 {option.summary.sameCount}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {option.isActive
                          ? '当前正在查看的方案，写入后会同步影响当前穿戴'
                          : '写入后不会自动切换当前方案'}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        getBatchPlanWritableCountByMode({
                          summary: option.summary,
                          mode: batchPlanWriteMode,
                        }) > 0
                          ? 'bg-amber-500/20 text-amber-100'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {getBatchPlanWritableCountByMode({
                        summary: option.summary,
                        mode: batchPlanWriteMode,
                      }) > 0
                        ? `可写入 ${getBatchPlanWritableCountByMode({
                            summary: option.summary,
                            mode: batchPlanWriteMode,
                          })}`
                        : '已完全一致'}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        ) : null}

        <LaboratoryBulkDeleteDialog
          open={Boolean(candidateRemovalItem)}
          selectedCount={1}
          onClose={() => {
            if (removingCandidateItemIds.length === 0) {
              setCandidateRemovalItem(null);
            }
          }}
          onConfirm={() => {
            void handleConfirmCandidateRemoval();
          }}
        />
        <LaboratoryBulkDeleteDialog
          open={candidateRemovalItems.length > 0}
          selectedCount={candidateRemovalItems.length}
          onClose={() => {
            if (removingCandidateItemIds.length === 0) {
              setCandidateRemovalItems([]);
            }
          }}
          onConfirm={() => {
            void handleConfirmBatchCandidateRemoval();
          }}
        />
        <LaboratoryBulkDeleteDialog
          open={Boolean(planRemovalItem)}
          selectedCount={1}
          title="确认移出装备方案"
          description={
            selectedPlanLabel && planRemovalItem ? (
              <>
                确定要将
                <span className="font-bold text-red-400">
                  {' '}
                  {planRemovalItem.equipment.name}{' '}
                </span>
                从
                <span className="font-bold text-red-400">
                  {selectedPlanLabel}
                </span>
                移出吗？
                {selectedPlanIndex === activeSetIndex
                  ? '当前方案会同步更新当前穿戴。'
                  : '该操作不会删除候选库或其他方案中的来源。'}
              </>
            ) : undefined
          }
          confirmLabel="确认移出"
          onClose={() => {
            if (removingPlanItemIds.length === 0) {
              setPlanRemovalItem(null);
            }
          }}
          onConfirm={handleConfirmPlanRemoval}
        />
        <LaboratoryBulkDeleteDialog
          open={planRemovalItems.length > 0}
          selectedCount={planRemovalItems.length}
          title="确认批量移出装备方案"
          description={
            selectedPlanLabel ? (
              <>
                确定要将当前选中的{' '}
                <span className="font-bold text-red-400">
                  {planRemovalItems.length}
                </span>{' '}
                件装备从
                <span className="font-bold text-red-400">
                  {selectedPlanLabel}
                </span>
                移出吗？
                {selectedPlanIndex === activeSetIndex
                  ? '当前方案会同步更新当前穿戴。'
                  : '该操作不会影响候选库或其他方案中的归属。'}
              </>
            ) : undefined
          }
          confirmLabel="确认批量移出"
          onClose={() => {
            if (removingPlanItemIds.length === 0) {
              setPlanRemovalItems([]);
            }
          }}
          onConfirm={handleConfirmBatchPlanRemoval}
        />
        <LaboratoryBulkDeleteDialog
          open={Boolean(inventoryStatusUpdate)}
          selectedCount={inventoryStatusUpdate?.entryIds.length ?? 0}
          title={
            inventoryStatusUpdate?.nextStatus === 'sold'
              ? '确认标记为已售出'
              : inventoryStatusUpdate?.nextStatus === 'discarded'
                ? '确认标记为作废'
                : '确认恢复为库存待用'
          }
          description={
            inventoryStatusUpdate ? (
              <>
                {inventoryStatusUpdate.items.length === 1 ? (
                  <>
                    确定要将
                    <span className="font-bold text-red-400">
                      {' '}
                      {inventoryStatusUpdate.primaryItem.equipment.name}{' '}
                    </span>
                    的正式库存状态更新为
                    <span className="font-bold text-red-400">
                      {inventoryStatusUpdate.nextStatus === 'sold'
                        ? '已售出'
                        : inventoryStatusUpdate.nextStatus === 'discarded'
                          ? '已作废'
                          : '库存待用'}
                    </span>
                    吗？
                  </>
                ) : (
                  <>
                    确定要将当前筛选下的
                    <span className="font-bold text-red-400">
                      {' '}
                      {inventoryStatusUpdate.items.length}{' '}
                    </span>
                    件正式库存装备批量更新为
                    <span className="font-bold text-red-400">
                      {inventoryStatusUpdate.nextStatus === 'sold'
                        ? '已售出'
                        : inventoryStatusUpdate.nextStatus === 'discarded'
                          ? '已作废'
                          : '库存待用'}
                    </span>
                    吗？
                  </>
                )}
                该操作会同步更新关联候选装备的状态，不会删除当前方案或实验室里的其他来源。
              </>
            ) : undefined
          }
          confirmLabel={
            inventoryStatusUpdate?.nextStatus === 'sold'
              ? '确认标记售出'
              : inventoryStatusUpdate?.nextStatus === 'discarded'
                ? '确认标记作废'
                : '确认恢复待用'
          }
          onClose={() => {
            if (updatingInventoryEntryIds.length === 0) {
              setInventoryStatusUpdate(null);
            }
          }}
          onConfirm={() => {
            void handleConfirmInventoryStatusUpdate();
          }}
        />
      </div>
    </AnimatePresence>
  );
}
