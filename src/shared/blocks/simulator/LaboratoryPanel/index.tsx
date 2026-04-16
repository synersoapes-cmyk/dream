'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '@/features/simulator/store/gameStore';
import type {
  Dungeon,
  Equipment,
  PendingEquipment,
} from '@/features/simulator/store/gameTypes';
import { validateImageFile } from '@/features/simulator/utils/fileValidation';
import { applySimulatorBundleToStore } from '@/features/simulator/utils/simulatorBundle';
import {
  applySimulatorCandidateEquipmentToStore,
  buildSimulatorCandidateEquipmentPayload,
  mapSimulatorCandidateEquipmentItemToPendingEquipment,
} from '@/features/simulator/utils/simulatorCandidateEquipment';
import {
  getVisibleCompareExperimentSeats,
  getVisibleExperimentSeats,
  LABORATORY_MAX_COMPARE_SEATS,
} from '@/features/simulator/utils/simulatorExperimentSeats';
import { applySimulatorLabSessionToStore } from '@/features/simulator/utils/simulatorLabSession';
import { buildDungeonDatabaseFromTemplates } from '@/features/simulator/utils/targetTemplates';
import {
  Package,
  Plus,
  RefreshCcw,
  Save,
  Sword,
  Target,
  Trash2,
  Upload,
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

import { OcrEquipmentReviewDialog } from '@/shared/blocks/simulator/OcrEquipmentReviewDialog';
import { formatDateTimeValue } from '@/shared/lib/date';
import {
  filterCandidateEquipmentItems,
  sortCandidateEquipmentItems,
  type SimulatorCandidateEquipmentSortKey,
} from '@/shared/lib/simulator-candidate-equipment-view';
import type {
  SimulatorEquipmentLibraryItem,
  SimulatorEquipmentLibrarySourceKind,
} from '@/shared/lib/simulator-equipment-library';
import { getSimulatorEquipmentDisplayImageUrl } from '@/shared/lib/simulator-equipment-artwork';
import { mapSimulatorInventoryLibraryItemToPendingEquipment } from '@/shared/lib/simulator-inventory-library';
import {
  buildSimulatorInventoryEmptyStateCopy,
  buildSimulatorInventoryStatusLabels,
  buildSimulatorInventoryStatusUpdateDraft,
  getCandidateBackedInventoryRefs,
  getSimulatorInventoryLifecycleLabel,
  getSimulatorInventoryUpdateToastTitle,
  summarizeSimulatorInventoryRefs,
} from '@/shared/lib/simulator-inventory-status';
import {
  SIMULATOR_EQUIPMENT_OCR_IMAGE_HINT_OPTIONS,
  type SimulatorEquipmentOcrImageHint,
} from '@/shared/lib/simulator-ocr-image-hint';
import {
  clearSimulatorPendingReviewRequest,
  readSimulatorPendingReviewRequest,
  SIMULATOR_OPEN_LAB_EVENT,
} from '@/shared/lib/simulator-pending-review-request';
import { parseRegularSetRulesConfig } from '@/shared/lib/simulator-regular-set';
import { buildLaboratoryRuneGuardSummary } from '@/shared/lib/simulator-rune-guard';
import {
  getSkillTargetCountOptions,
  resolveLaboratorySkillLevels,
} from '@/shared/lib/simulator-rune-skill';
import {
  buildEquipmentSlotKey,
  buildEquipmentPlanUsageSummary,
  resolveLaboratoryCompareSeatCardState,
} from '@/shared/lib/simulator-equipment-plan-assignment';
import {
  getSimulatorSlotDefinitions,
  getSimulatorSlotLabel,
  matchesSimulatorSlotDefinition,
  SIMULATOR_CATEGORY_CONFIG,
} from '@/shared/lib/simulator-slot-config';
import { getSimulatorStatLabel } from '@/shared/lib/simulator-stat-labels';
import type { LabValuationSeatResult } from '@/shared/services/lab-valuation';

import { useEquipmentExtensionConfigs } from '../use-equipment-extension-configs';
import {
  AVAILABLE_GEMSTONES,
  AVAILABLE_RUNE_SETS,
  AVAILABLE_RUNES,
  AVAILABLE_STAR_ALIGNMENTS,
  AVAILABLE_STAR_POSITIONS,
  buildLaboratoryLibrarySourceItems,
  calculateEquipmentTotalStats,
  getSeatDisplayName,
  resolveLaboratorySeatEquipment,
} from './laboratory-utils';
import { LaboratoryComparisonTable } from './LaboratoryComparisonTable';
import {
  LaboratoryBulkDeleteDialog,
  LaboratoryOverwriteConfirmDialog,
} from './LaboratoryDialogs';
import { LaboratoryEquipmentDetailModal } from './LaboratoryEquipmentDetailModal';
import { LaboratorySeatCard } from './LaboratorySeatCard';
import { LaboratorySlotSelectorModal } from './LaboratorySlotSelectorModal';
import { LaboratoryTargetSelectorModal } from './LaboratoryTargetSelectorModal';
import { LibraryEquipmentCard } from './LibraryEquipmentCard';
import { PendingEquipmentDetailModal } from './PendingEquipmentDetailModal';

type EquipmentRollbackSnapshot = {
  id: string;
  name: string;
  source: string;
  notes: string;
  createdAt: number | string | null;
};

type LaboratoryInventoryActionSummary = {
  id: string;
  title: string;
  description: string;
  tone: 'cyan' | 'amber' | 'violet';
  affectedSlotLabels: string[];
  affectedSlotKeys: string[];
  targetLabel: string;
  viewHint: string;
  targetView: {
    sourceFilter: 'all' | SimulatorEquipmentLibrarySourceKind;
    inventoryLifecycleFilter: 'all' | 'active' | 'sold' | 'discarded';
  };
};

const PENDING_EQUIPMENT_WARNING_THRESHOLD = 50;

function isEquipmentRollbackSnapshot(
  value: unknown
): value is EquipmentRollbackSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const snapshot = value as Record<string, unknown>;

  return (
    typeof snapshot.id === 'string' &&
    typeof snapshot.name === 'string' &&
    typeof snapshot.source === 'string' &&
    typeof snapshot.notes === 'string'
  );
}

export function LaboratoryPanel() {
  const [libTab, setLibTab] = useState<'pending' | 'library'>('pending');
  const [selectedLibEquip, setSelectedLibEquip] =
    useState<SimulatorEquipmentLibraryItem | null>(null);
  const [showTargetSelector, setShowTargetSelector] = useState(false);
  const [selectedPendingItem, setSelectedPendingItem] =
    useState<PendingEquipment | null>(null);
  const [pendingOcrReviewItem, setPendingOcrReviewItem] =
    useState<PendingEquipment | null>(null);

  // 席位栏位选择器状态
  const [selectedSlot, setSelectedSlot] = useState<{
    seatId: string;
    slotType: Equipment['type'];
    slotSlot?: number;
    slotLabel: string;
    baseEquip?: Equipment;
    currentEquip?: Equipment;
    inheritGemstones?: boolean;
    inheritRuneStones?: boolean;
  } | null>(null);

  // 新装备库分类状态
  const [librarySourceFilter, setLibrarySourceFilter] = useState<
    'all' | SimulatorEquipmentLibrarySourceKind
  >('all');
  const [inventoryLifecycleFilter, setInventoryLifecycleFilter] = useState<
    'all' | 'active' | 'sold' | 'discarded'
  >('active');
  const [primaryCategory, setPrimaryCategory] = useState<
    'equipment' | 'trinket' | 'jade'
  >('equipment');
  const [secondaryCategory, setSecondaryCategory] = useState<string>('all');
  const [candidateSort, setCandidateSort] =
    useState<SimulatorCandidateEquipmentSortKey>('newest');

  // 批量选择和删除状态
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLibraryCandidateRemovalConfirm, setShowLibraryCandidateRemovalConfirm] =
    useState(false);
  const [libraryCandidateRemovalIds, setLibraryCandidateRemovalIds] = useState<
    string[]
  >([]);
  const [inventoryStatusUpdate, setInventoryStatusUpdate] = useState<{
    items: SimulatorEquipmentLibraryItem[];
    primaryItem: SimulatorEquipmentLibraryItem;
    nextStatus: 'active' | 'sold' | 'discarded';
    entryIds: string[];
  } | null>(null);
  const [libraryActionSummary, setLibraryActionSummary] =
    useState<LaboratoryInventoryActionSummary | null>(null);
  const [libraryActionFocusOnly, setLibraryActionFocusOnly] = useState(false);
  const [isSavingLab, setIsSavingLab] = useState(false);
  const [isLoadingLab, setIsLoadingLab] = useState(false);
  const [isSavingCurrentEquipment, setIsSavingCurrentEquipment] =
    useState(false);
  const [isRollingBackCurrentEquipment, setIsRollingBackCurrentEquipment] =
    useState(false);
  const [isSavingCandidateEquipment, setIsSavingCandidateEquipment] =
    useState(false);
  const [isLoadingCandidateEquipment, setIsLoadingCandidateEquipment] =
    useState(false);
  const [managedInventoryItems, setManagedInventoryItems] = useState<
    ReturnType<typeof mapSimulatorInventoryLibraryItemToPendingEquipment>[]
  >([]);
  const activeManagedInventoryItems = useMemo(
    () =>
      managedInventoryItems.filter((item) =>
        (item.inventoryRefs ?? []).some((ref) => ref.status === 'active')
      ),
    [managedInventoryItems]
  );
  const [updatingInventoryEntryIds, setUpdatingInventoryEntryIds] = useState<
    string[]
  >([]);
  const [latestRollbackSnapshot, setLatestRollbackSnapshot] =
    useState<EquipmentRollbackSnapshot | null>(null);
  const [isLoadingRollbackSnapshot, setIsLoadingRollbackSnapshot] =
    useState(false);

  const currentCharacter = useGameStore((state) => state.currentCharacter);
  const pendingEquipments = useGameStore((state) => state.pendingEquipments);
  const experimentSeats = useGameStore((state) => state.experimentSeats);
  const currentEquipment = useGameStore((state) => state.equipment);
  const equipmentSets = useGameStore((state) => state.equipmentSets);
  const activeSetIndex = useGameStore((state) => state.activeSetIndex);
  const selectedSampleSetIndex = useGameStore(
    (state) => state.laboratorySampleSetIndex
  );
  const setSelectedSampleSetIndex = useGameStore(
    (state) => state.setLaboratorySampleSetIndex
  );
  const addExperimentSeat = useGameStore((state) => state.addExperimentSeat);
  const removeExperimentSeat = useGameStore(
    (state) => state.removeExperimentSeat
  );
  const confirmPendingEquipment = useGameStore(
    (state) => state.confirmPendingEquipment
  );
  const removePendingEquipment = useGameStore(
    (state) => state.removePendingEquipment
  );
  const updatePendingEquipment = useGameStore(
    (state) => state.updatePendingEquipment
  );
  const updateExperimentSeatEquipment = useGameStore(
    (state) => state.updateExperimentSeatEquipment
  );
  const removeExperimentSeatEquipment = useGameStore(
    (state) => state.removeExperimentSeatEquipment
  );
  const combatTarget = useGameStore((state) => state.combatTarget);
  const combatStats = useGameStore((state) => state.combatStats);
  const playerSetup = useGameStore((state) => state.playerSetup);
  const syncedCloudState = useGameStore((state) => state.syncedCloudState);
  const selectedDungeonIds = useGameStore((state) => state.selectedDungeonIds);
  const updateCombatTarget = useGameStore((state) => state.updateCombatTarget);
  const manualTargets = useGameStore((state) => state.manualTargets);
  const skills = useGameStore((state) => state.skills);

  // 战队目标选择器中的技能和秒几选项
  const [selectedSkillName, setSelectedSkillName] = useState<string>('');
  const [selectedTargetCount, setSelectedTargetCount] = useState<number>(1);
  const [targetDungeons, setTargetDungeons] = useState<Dungeon[]>([]);

  // 确认弹窗状态 - 用于覆盖当前装备
  const [confirmOverwriteDialog, setConfirmOverwriteDialog] = useState<{
    seatId: string;
    seatName: string;
    equipmentSetName: string;
    guardSummary: ReturnType<typeof buildLaboratoryRuneGuardSummary> | null;
  } | null>(null);

  // 初始化技能选择
  useEffect(() => {
    const overflowSeats = experimentSeats
      .filter((seat) => !seat.isSample)
      .slice(LABORATORY_MAX_COMPARE_SEATS);

    if (overflowSeats.length === 0) {
      return;
    }

    overflowSeats.forEach((seat) => {
      removeExperimentSeat(seat.id);
    });
  }, [experimentSeats, removeExperimentSeat]);

  useEffect(() => {
    if (skills && skills.length > 0 && !selectedSkillName) {
      setSelectedSkillName(
        skills.find((skill) => skill.name === '龙卷雨击')?.name ||
          skills[0].name
      );
    }
  }, [skills, selectedSkillName]);

  useEffect(() => {
    let cancelled = false;

    const loadTemplates = async () => {
      try {
        const response = await fetch(
          '/api/simulator/target-templates?scene=dungeon',
          {
            method: 'GET',
            cache: 'no-store',
          }
        );
        const payload = await response.json();
        if (
          !response.ok ||
          payload?.code !== 0 ||
          !Array.isArray(payload?.data)
        ) {
          return;
        }

        if (!cancelled) {
          setTargetDungeons(buildDungeonDatabaseFromTemplates(payload.data));
        }
      } catch {}
    };

    void loadTemplates();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (equipmentSets.length === 0) {
      setSelectedSampleSetIndex(0);
      return;
    }

    const nextIndex = Math.min(
      Math.max(activeSetIndex, 0),
      equipmentSets.length - 1
    );

    if (selectedSampleSetIndex !== nextIndex) {
      setSelectedSampleSetIndex(nextIndex);
    }
  }, [
    activeSetIndex,
    equipmentSets.length,
    selectedSampleSetIndex,
    setSelectedSampleSetIndex,
  ]);

  useEffect(() => {
    if (!currentCharacter?.id) {
      return;
    }

    void handleLoadManagedInventory(true);
  }, [currentCharacter?.id, libTab, syncedCloudState?.equipment?.length]);

  const pendingList = pendingEquipments.filter((e) => e.status === 'pending');
  const confirmedCandidateList = pendingEquipments.filter(
    (e) => e.status === 'confirmed'
  );
  const libraryList = useMemo(
    () =>
      buildLaboratoryLibrarySourceItems({
        currentEquipment,
        equipmentSets,
        activeSetIndex,
        inventoryLibraryItems: managedInventoryItems,
        candidateLibraryItems: confirmedCandidateList,
      }),
    [
      activeSetIndex,
      confirmedCandidateList,
      currentEquipment,
      equipmentSets,
      managedInventoryItems,
    ]
  );
  const slotSelectorLibraryList = useMemo(
    () =>
      buildLaboratoryLibrarySourceItems({
        currentEquipment,
        equipmentSets,
        activeSetIndex,
        inventoryLibraryItems: activeManagedInventoryItems,
        candidateLibraryItems: confirmedCandidateList,
      }),
    [
      activeManagedInventoryItems,
      activeSetIndex,
      confirmedCandidateList,
      currentEquipment,
      equipmentSets,
    ]
  );
  const activeCandidateSourceList =
    libTab === 'pending' ? pendingList : libraryList;
  const secondaryCategories = useMemo(
    () => getSimulatorSlotDefinitions(primaryCategory),
    [primaryCategory]
  );
  const selectedSecondaryDefinition = useMemo(
    () =>
      secondaryCategory === 'all'
        ? null
        : (secondaryCategories.find(
            (category) => category.id === secondaryCategory
          ) ?? null),
    [secondaryCategories, secondaryCategory]
  );
  const filteredPendingList = useMemo(
    () =>
      sortCandidateEquipmentItems(
        filterCandidateEquipmentItems(pendingList, {
          category: primaryCategory,
          slotDefinition: selectedSecondaryDefinition,
        }),
        candidateSort
      ),
    [candidateSort, pendingList, primaryCategory, selectedSecondaryDefinition]
  );
  const categoryFilteredLibraryList = useMemo(
    () =>
      filterCandidateEquipmentItems(
        librarySourceFilter === 'all'
          ? libraryList
          : libraryList.filter((item) =>
              item.sourceKinds.includes(librarySourceFilter)
            ),
        {
          category: primaryCategory,
          slotDefinition: selectedSecondaryDefinition,
        }
      ),
    [
      libraryList,
      librarySourceFilter,
      primaryCategory,
      selectedSecondaryDefinition,
    ]
  );
  const inventoryLifecycleSummaryItems = useMemo(() => {
    const counts = {
      all: categoryFilteredLibraryList.filter((item) =>
        item.sourceKinds.includes('inventory_asset')
      ).length,
      active: 0,
      sold: 0,
      discarded: 0,
    };

    categoryFilteredLibraryList.forEach((item) => {
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
      { key: 'all' as const, label: '全部状态', count: counts.all },
      { key: 'active' as const, label: '库存待用', count: counts.active },
      { key: 'sold' as const, label: '已售出', count: counts.sold },
      { key: 'discarded' as const, label: '已作废', count: counts.discarded },
    ];
  }, [categoryFilteredLibraryList]);
  const scopedInventoryLibraryItems = useMemo(
    () =>
      categoryFilteredLibraryList.filter((item) =>
        item.sourceKinds.includes('inventory_asset')
      ),
    [categoryFilteredLibraryList]
  );
  const lifecycleMatchedInventoryLibraryItems = useMemo(() => {
    if (inventoryLifecycleFilter === 'all') {
      return scopedInventoryLibraryItems;
    }

    return scopedInventoryLibraryItems.filter(
      (item) =>
        summarizeSimulatorInventoryRefs(item)[inventoryLifecycleFilter] > 0
    );
  }, [inventoryLifecycleFilter, scopedInventoryLibraryItems]);
  const lifecycleFilteredLibraryList = useMemo(
    () =>
      sortCandidateEquipmentItems(
        librarySourceFilter === 'inventory_asset' &&
          inventoryLifecycleFilter !== 'all'
          ? categoryFilteredLibraryList.filter(
              (item) =>
                summarizeSimulatorInventoryRefs(item)[inventoryLifecycleFilter] >
                0
            )
          : categoryFilteredLibraryList,
        candidateSort
      ),
    [
      candidateSort,
      categoryFilteredLibraryList,
      inventoryLifecycleFilter,
      librarySourceFilter,
    ]
  );
  const filteredLibraryList = useMemo(() => {
    if (!libraryActionSummary || !libraryActionFocusOnly) {
      return lifecycleFilteredLibraryList;
    }

    return lifecycleFilteredLibraryList.filter((item) =>
      libraryActionSummary.affectedSlotKeys.includes(
        buildEquipmentSlotKey(item.equipment)
      )
    );
  }, [
    libraryActionFocusOnly,
    libraryActionSummary,
    lifecycleFilteredLibraryList,
  ]);
  const activeVisibleCandidateList =
    libTab === 'pending' ? filteredPendingList : filteredLibraryList;
  const getLibraryEquipmentSlotLabel = (equipment: Equipment) => {
    const slotCategory =
      equipment.type === 'trinket'
        ? 'trinket'
        : equipment.type === 'jade'
          ? 'jade'
          : 'equipment';
    const slotDefinition = getSimulatorSlotDefinitions(slotCategory).find(
      (slot) => slot.type === equipment.type && slot.slot === equipment.slot
    );

    return slotDefinition
      ? getSimulatorSlotLabel(slotDefinition, 'laboratory')
      : equipment.type;
  };
  const removableLibraryCandidateItems = useMemo(
    () =>
      filteredLibraryList.filter(
        (item) => item.selectable && item.sourceKinds.includes('candidate_library')
      ),
    [filteredLibraryList]
  );
  const manageableLibraryInventoryItems = useMemo(
    () =>
      librarySourceFilter === 'inventory_asset'
        ? filteredLibraryList.filter(
            (item) => getCandidateBackedInventoryRefs(item).length > 0
          )
        : [],
    [filteredLibraryList, librarySourceFilter]
  );
  const restorableLibraryInventoryItems = useMemo(
    () =>
      librarySourceFilter === 'inventory_asset'
        ? filteredLibraryList.filter(
            (item) =>
              getCandidateBackedInventoryRefs(item, ['sold', 'discarded'])
                .length > 0
          )
        : [],
    [filteredLibraryList, librarySourceFilter]
  );
  const selectedPendingIndex = selectedPendingItem
    ? filteredPendingList.findIndex(
        (item) => item.id === selectedPendingItem.id
      )
    : -1;
  const visibleExperimentSeats = useMemo(
    () => getVisibleExperimentSeats(experimentSeats),
    [experimentSeats]
  );
  const visibleCompareSeats = useMemo(
    () => getVisibleCompareExperimentSeats(experimentSeats),
    [experimentSeats]
  );
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
  const handleSendLibraryEquipmentToCompareSeat = (
    item: SimulatorEquipmentLibraryItem
  ) => {
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

    toast.success('已挂到实验室对比席位', {
      description: `${item.equipment.name} 已挂载到 ${compareSeat.name}`,
    });
  };
  const handleRemoveLibraryEquipmentFromCompareSeat = (
    item: SimulatorEquipmentLibraryItem
  ) => {
    const compareSeat = visibleCompareSeats[0] ?? null;

    if (!compareSeat) {
      return;
    }

    removeExperimentSeatEquipment(
      compareSeat.id,
      item.equipment.type,
      item.equipment.slot
    );

    toast.success('已从实验室对比席位移出', {
      description: `${item.equipment.name} 已从 ${compareSeat.name} 移出`,
    });
  };

  const { baseAttributes, cultivation, meridian, treasure } = useGameStore();
  const [labValuationBySeatId, setLabValuationBySeatId] = useState<
    Record<string, LabValuationSeatResult>
  >({});
  const [isLoadingLabValuation, setIsLoadingLabValuation] = useState(false);
  const [labValuationError, setLabValuationError] = useState<string | null>(
    null
  );
  const { configs: equipmentExtensionConfigs } = useEquipmentExtensionConfigs([
    'regular_set_rules',
  ]);
  const regularSetRules = useMemo(
    () =>
      parseRegularSetRulesConfig(
        equipmentExtensionConfigs.find(
          (item) => item.configKey === 'regular_set_rules'
        )?.value
      ),
    [equipmentExtensionConfigs]
  );

  const formatRollbackTime = (timestamp: number | string | null | undefined) =>
    formatDateTimeValue(timestamp, {
      locale: 'zh',
      timeZone: 'Asia/Shanghai',
      empty: '时间未知',
      dateStyle: 'short',
      timeStyle: 'short',
    });

  // 格式化金额：默认不显示小数，有小数时最多显示2位
  const formatPrice = (price: number | undefined) => {
    if (price === undefined) return '-';
    const hasDecimal = price % 1 !== 0;
    return hasDecimal ? price.toFixed(2) : price.toString();
  };

  const laboratorySourceFilterOptions: Array<{
    key: 'all' | SimulatorEquipmentLibrarySourceKind;
    label: string;
    count: number;
  }> = useMemo(
    () => [
      { key: 'all', label: '全部来源', count: libraryList.length },
      {
        key: 'inventory_asset',
        label: '正式库存',
        count: libraryList.filter((item) =>
          item.sourceKinds.includes('inventory_asset')
        ).length,
      },
      {
        key: 'current_plan',
        label: '当前方案',
        count: libraryList.filter((item) =>
          item.sourceKinds.includes('current_plan')
        ).length,
      },
      {
        key: 'equipment_plan',
        label: '其他方案',
        count: libraryList.filter((item) =>
          item.sourceKinds.includes('equipment_plan')
        ).length,
      },
      {
        key: 'candidate_library',
        label: '候选装备库',
        count: libraryList.filter((item) =>
          item.sourceKinds.includes('candidate_library')
        ).length,
      },
    ],
    [libraryList]
  );

  const handleLoadLabSession = async (silent = false) => {
    try {
      setIsLoadingLab(true);
      const response = await fetch('/api/simulator/current/lab-session', {
        method: 'GET',
        cache: 'no-store',
      });

      const payload = await response.json();
      if (!response.ok || payload?.code !== 0) {
        throw new Error(payload?.message || '读取实验室失败');
      }

      if (payload?.data?.session) {
        applySimulatorLabSessionToStore(payload.data);
        if (!silent) {
          toast.success('已从云端读取实验室配置');
        }
      } else if (!silent) {
        toast.info('云端还没有保存过实验室配置');
      }
    } catch (error) {
      console.error('Failed to load simulator lab session:', error);
      if (!silent) {
        toast.error('读取实验室配置失败');
      }
    } finally {
      setIsLoadingLab(false);
    }
  };

  const loadLatestRollbackSnapshot = async (silent = false) => {
    try {
      setIsLoadingRollbackSnapshot(true);
      const response = await fetch(
        '/api/simulator/current/equipment/rollback',
        {
          method: 'GET',
          cache: 'no-store',
        }
      );
      const payload = await response.json();

      if (!response.ok || payload?.code !== 0) {
        throw new Error(payload?.message || '读取回滚快照失败');
      }

      setLatestRollbackSnapshot(
        isEquipmentRollbackSnapshot(payload?.data) ? payload.data : null
      );
    } catch (error) {
      console.error(
        'Failed to load latest simulator rollback snapshot:',
        error
      );
      if (!silent) {
        toast.error('读取回滚快照失败');
      }
    } finally {
      setIsLoadingRollbackSnapshot(false);
    }
  };

  const buildCandidateEquipmentPayload = () =>
    buildSimulatorCandidateEquipmentPayload(
      useGameStore.getState().pendingEquipments
    );

  const removeCandidateEquipmentItems = (ids: string[]) => {
    useGameStore.setState((state) => ({
      ...state,
      pendingEquipments: state.pendingEquipments.filter(
        (item) => !ids.includes(item.id)
      ),
      selectedPendingIds: state.selectedPendingIds.filter(
        (id) => !ids.includes(id)
      ),
    }));
  };

  const removeLibraryCandidateSourceItems = async (ids: string[]) => {
    if (ids.length === 0) {
      toast.error('当前筛选下没有可移出的候选装备');
      return;
    }

    const removableIds = new Set(
      removableLibraryCandidateItems
        .filter((item) => ids.includes(item.id))
        .map((item) => item.id)
    );

    if (removableIds.size === 0) {
      toast.error('选中的装备里没有候选来源可移出');
      return;
    }

    removeCandidateEquipmentItems(Array.from(removableIds));
    const saved = await handleSaveCandidateEquipment(true);

    if (!saved) {
      return;
    }

    setSelectedLibEquip((current) =>
      current && removableIds.has(current.id) ? null : current
    );

    toast.success(
      removableIds.size === 1
        ? '已从实验室总库移出候选来源'
        : `已从实验室总库移出 ${removableIds.size} 件候选装备`
    );
  };

  const confirmCandidateEquipmentItems = (ids: string[]) => {
    useGameStore.setState((state) => ({
      ...state,
      pendingEquipments: state.pendingEquipments.map((item) =>
        ids.includes(item.id) ? { ...item, status: 'confirmed' } : item
      ),
    }));
  };

  const resolveEquipmentCategory = (equipment: Equipment) => {
    if (equipment.type === 'trinket') {
      return 'trinket' as const;
    }

    if (equipment.type === 'jade') {
      return 'jade' as const;
    }

    return 'equipment' as const;
  };

  const handlePendingReviewRequest = () => {
    const requestedId = readSimulatorPendingReviewRequest();
    if (!requestedId) {
      return;
    }

    const requestedItem = pendingEquipments.find(
      (item) => item.id === requestedId && item.status === 'pending'
    );

    if (!requestedItem) {
      const stillExists = pendingEquipments.some(
        (item) => item.id === requestedId
      );
      if (!stillExists) {
        clearSimulatorPendingReviewRequest();
      }
      return;
    }

    setLibTab('pending');
    setPrimaryCategory(resolveEquipmentCategory(requestedItem.equipment));
    setSecondaryCategory('all');
    setSelectedPendingItem(requestedItem);
    setSelectedLibEquip(null);
    setPendingOcrReviewItem(null);
    clearSimulatorPendingReviewRequest();
  };

  const handleLoadCandidateEquipment = async (silent = false) => {
    try {
      setIsLoadingCandidateEquipment(true);
      const response = await fetch(
        '/api/simulator/current/candidate-equipment',
        {
          method: 'GET',
          cache: 'no-store',
        }
      );

      const payload = await response.json();
      if (!response.ok || payload?.code !== 0) {
        throw new Error(payload?.message || '读取候选装备失败');
      }

      if (Array.isArray(payload?.data)) {
        applySimulatorCandidateEquipmentToStore(payload.data);
        if (!silent) {
          toast.success('已从云端读取候选装备库');
        }
      }
    } catch (error) {
      console.error('Failed to load simulator candidate equipment:', error);
      if (!silent) {
        toast.error('读取候选装备库失败');
      }
    } finally {
      setIsLoadingCandidateEquipment(false);
    }
  };

  const handleLoadManagedInventory = async (silent = false) => {
    try {
      const response = await fetch('/api/simulator/current/inventory?status=all', {
        method: 'GET',
        cache: 'no-store',
      });

      const payload = await response.json();
      if (!response.ok || payload?.code !== 0 || !Array.isArray(payload?.data)) {
        throw new Error(payload?.message || '读取正式库存失败');
      }

      setManagedInventoryItems(
        payload.data.map(mapSimulatorInventoryLibraryItemToPendingEquipment)
      );

      if (!silent) {
        toast.success('已从云端读取正式库存');
      }
    } catch (error) {
      console.error('Failed to load simulator managed inventory:', error);
      if (!silent) {
        toast.error('读取正式库存失败');
      }
    }
  };

  const handleSaveCandidateEquipment = async (silent = false) => {
    try {
      setIsSavingCandidateEquipment(true);
      const response = await fetch(
        '/api/simulator/current/candidate-equipment',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: buildCandidateEquipmentPayload(),
          }),
        }
      );

      const payload = await response.json();
      if (!response.ok || payload?.code !== 0) {
        throw new Error(payload?.message || '保存候选装备失败');
      }

      if (Array.isArray(payload?.data)) {
        applySimulatorCandidateEquipmentToStore(payload.data);
      }

      if (!silent) {
        toast.success('候选装备库已保存到云端');
      }
      return true;
    } catch (error) {
      console.error('Failed to save simulator candidate equipment:', error);
      if (!silent) {
        toast.error('保存候选装备库失败');
      }
      return false;
    } finally {
      setIsSavingCandidateEquipment(false);
    }
  };

  const handleSaveLabSession = async () => {
    try {
      setIsSavingLab(true);
      const response = await fetch('/api/simulator/current/lab-session', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: '当前实验室',
          seats: experimentSeats.map((seat, index) => ({
            id: seat.id,
            name:
              seat.name || (seat.isSample ? '样本席位' : `对比席位${index}`),
            isSample: seat.isSample,
            inheritGemstones: seat.inheritGemstones,
            inheritRuneStones: seat.inheritRuneStones,
            equipment: resolveLaboratorySeatEquipment(seat, sampleEquipment),
          })),
        }),
      });

      const payload = await response.json();
      if (!response.ok || payload?.code !== 0) {
        throw new Error(payload?.message || '保存实验室失败');
      }

      if (payload?.data?.session) {
        applySimulatorLabSessionToStore(payload.data);
      }

      toast.success('实验室配置已保存到云端');
      return true;
    } catch (error) {
      console.error('Failed to save simulator lab session:', error);
      toast.error('保存实验室配置失败');
      return false;
    } finally {
      setIsSavingLab(false);
    }
  };

  const handleApplyToSeat = (
    seatId: string,
    equipment: Equipment,
    options?: {
      inheritGemstones?: boolean;
      inheritRuneStones?: boolean;
    }
  ) => {
    updateExperimentSeatEquipment(seatId, equipment, options);
  };

  const handleSavePendingItemEdit = async (
    id: string,
    equipment: Equipment
  ) => {
    updatePendingEquipment(id, equipment);
    setSelectedPendingItem((current) =>
      current && current.id === id ? { ...current, equipment } : current
    );
    await handleSaveCandidateEquipment(true);
    toast.success('识别结果已更新');
  };

  const openPendingItemByIndex = (index: number) => {
    const nextItem = filteredPendingList[index];
    if (!nextItem) {
      return;
    }

    setSelectedPendingItem(nextItem);
    setSelectedLibEquip(null);
  };

  const handleConfirmPendingItem = async (
    item: PendingEquipment,
    options?: {
      moveToNext?: boolean;
    }
  ) => {
    const currentIndex = filteredPendingList.findIndex(
      (candidate) => candidate.id === item.id
    );

    confirmPendingEquipment(item.id);
    await handleSaveCandidateEquipment(true);

    if (options?.moveToNext) {
      const fallbackNextItem =
        filteredPendingList[currentIndex + 1] ??
        filteredPendingList[currentIndex - 1] ??
        null;

      setSelectedPendingItem(fallbackNextItem);
      if (fallbackNextItem) {
        toast.success(
          `已确认 ${item.equipment.name}，继续查看 ${fallbackNextItem.equipment.name}`
        );
      } else {
        toast.success('已确认入库，当前筛选下没有更多待确认装备');
      }
      return;
    }

    setSelectedPendingItem(null);
    toast.success('已确认入库');
  };

  const buildNextCurrentEquipment = (equipment: Equipment) => {
    const existingIndex = currentEquipment.findIndex(
      (item) =>
        item.type === equipment.type &&
        (equipment.slot === undefined || item.slot === equipment.slot)
    );

    if (existingIndex === -1) {
      return [...currentEquipment, equipment];
    }

    return currentEquipment.map((item, index) =>
      index === existingIndex ? equipment : item
    );
  };

  const saveCurrentEquipment = async (
    nextEquipment: Equipment[],
    successMessage: string,
    options?: {
      createHistorySnapshot?: boolean;
      historySnapshotName?: string;
      historySnapshotNotes?: string;
    }
  ) => {
    try {
      setIsSavingCurrentEquipment(true);
      const response = await fetch('/api/simulator/current/equipment', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          equipment: nextEquipment,
          equipmentSets,
          activeSetIndex,
          createHistorySnapshot: options?.createHistorySnapshot === true,
          historySnapshotName: options?.historySnapshotName,
          historySnapshotNotes: options?.historySnapshotNotes,
        }),
      });

      const payload = await response.json();
      if (!response.ok || payload?.code !== 0 || !payload?.data) {
        throw new Error(payload?.message || '保存当前装备失败');
      }

      applySimulatorBundleToStore(payload.data, {
        preserveWorkbenchState: true,
      });
      if (options?.createHistorySnapshot) {
        await loadLatestRollbackSnapshot(true);
      }
      toast.success(successMessage);
      return true;
    } catch (error) {
      console.error(
        'Failed to save simulator equipment from laboratory:',
        error
      );
      toast.error('保存当前装备失败');
      return false;
    } finally {
      setIsSavingCurrentEquipment(false);
    }
  };

  const handleReplaceCurrent = async (equipment: Equipment) => {
    const nextEquipment = buildNextCurrentEquipment(equipment);
    await saveCurrentEquipment(
      nextEquipment,
      `已将 ${equipment.name} 同步到当前装备`,
      {
        createHistorySnapshot: true,
        historySnapshotName: `单件替换前快照 · ${equipment.name}`,
        historySnapshotNotes: `实验室单件替换前自动保存：${equipment.name}`,
      }
    );
  };

  // 处理覆盖当前装备的确认
  const handleConfirmOverwrite = async () => {
    if (!confirmOverwriteDialog) return;

    const seat = experimentSeats.find(
      (s) => s.id === confirmOverwriteDialog.seatId
    );
    if (!seat || seat.isSample) return;

    const didSave = await saveCurrentEquipment(
      seat.equipment,
      `已成功应用 ${confirmOverwriteDialog.equipmentSetName} 到当前装备`,
      {
        createHistorySnapshot: true,
        historySnapshotName: `整套应用前快照 · ${confirmOverwriteDialog.equipmentSetName}`,
        historySnapshotNotes: `实验室整套应用前自动保存：${confirmOverwriteDialog.equipmentSetName}`,
      }
    );

    if (didSave) {
      setConfirmOverwriteDialog(null);
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
          const response = await fetch(
            `/api/simulator/current/inventory/${entryId}`,
            {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                status: inventoryStatusUpdate.nextStatus,
              }),
            }
          );
          const payload = await response.json();

          if (!response.ok || payload?.code !== 0) {
            throw new Error(payload?.message || '更新正式库存失败');
          }
        })
      );

      await Promise.all([
        handleLoadManagedInventory(true),
        handleLoadCandidateEquipment(true),
      ]);

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
            : `已将 ${inventoryStatusUpdate.items.length} 件实验室总库正式库存装备批量更新为${nextStatusLabel}`,
      });

      setLibraryActionSummary({
        id: `laboratory-inventory-status-${Date.now()}`,
        title: nextToastTitle,
        description: `已处理 ${inventoryStatusUpdate.items.length} 件正式库存装备，目标状态为“${nextStatusLabel}”。`,
        tone: inventoryStatusUpdate.nextStatus === 'active' ? 'cyan' : 'amber',
        affectedSlotLabels: inventoryStatusUpdate.items.map((item) =>
          getLibraryEquipmentSlotLabel(item.equipment)
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
            ? '已推荐回到正式库存“库存待用”视图，恢复后的装备会重新进入换装与实验室席位选择。'
            : '已推荐回到对应正式库存状态视图，方便继续恢复或核对本次部位。',
        targetView: {
          sourceFilter: 'inventory_asset',
          inventoryLifecycleFilter: inventoryStatusUpdate.nextStatus,
        },
      });
      setLibraryActionFocusOnly(true);

      if (
        selectedLibEquip &&
        inventoryStatusUpdate.items.some((item) => item.id === selectedLibEquip.id)
      ) {
        setSelectedLibEquip(null);
      }

      setInventoryStatusUpdate(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新正式库存失败');
    } finally {
      setUpdatingInventoryEntryIds([]);
    }
  };
  const applyLibraryActionTargetView = () => {
    if (!libraryActionSummary) {
      return;
    }

    setLibTab('library');
    setLibrarySourceFilter(libraryActionSummary.targetView.sourceFilter);
    setInventoryLifecycleFilter(
      libraryActionSummary.targetView.inventoryLifecycleFilter
    );
  };
  const handleContinueLibraryActionSummary = () => {
    if (!libraryActionSummary) {
      return;
    }

    applyLibraryActionTargetView();
    setLibraryActionFocusOnly(true);
  };
  const handleCompleteLibraryActionSummary = () => {
    setLibraryActionSummary(null);
    setLibraryActionFocusOnly(false);
  };

  const sampleEquipment = useMemo(
    () => equipmentSets[selectedSampleSetIndex]?.items || currentEquipment,
    [equipmentSets, selectedSampleSetIndex, currentEquipment]
  );
  const getLaboratoryCompareSeatState = (equipment: Equipment) => {
    const compareSeat = visibleCompareSeats[0] ?? null;
    const compareSeatLabel = compareSeat
      ? getSeatDisplayName(compareSeat, visibleExperimentSeats)
      : '对比席位';
    const state = resolveLaboratoryCompareSeatCardState({
      equipment,
      sampleEquipment,
      compareEquipment: compareSeat?.equipment,
      compareSeatLabel,
    });

    return {
      compareSeat,
      compareSeatLabel: state.compareSeatLabel,
      isExplicitCompareMatch: state.isExplicitCompareMatch,
      isInheritedFromSample: state.isInheritedFromSample,
    };
  };
  const compareSeatCount = useMemo(
    () => visibleCompareSeats.length,
    [visibleCompareSeats]
  );
  const selectedLibEquipInventoryRefs = useMemo(
    () => (selectedLibEquip ? getCandidateBackedInventoryRefs(selectedLibEquip) : []),
    [selectedLibEquip]
  );
  const selectedLibEquipRestorableInventoryRefs = useMemo(
    () =>
      selectedLibEquip
        ? getCandidateBackedInventoryRefs(selectedLibEquip, ['sold', 'discarded'])
        : [],
    [selectedLibEquip]
  );
  const laboratorySkills = useMemo(
    () =>
      resolveLaboratorySkillLevels(skills, sampleEquipment, {
        baselineEquipment: syncedCloudState?.equipment ?? [],
      }),
    [skills, sampleEquipment, syncedCloudState]
  );
  const targetCountOptions = useMemo(
    () => getSkillTargetCountOptions(laboratorySkills, selectedSkillName),
    [laboratorySkills, selectedSkillName]
  );
  // 基础样本数据
  const baseSampleStats = useMemo(
    () => calculateEquipmentTotalStats(sampleEquipment),
    [sampleEquipment]
  );

  const labValuationPayload = useMemo(() => {
    const preferredSkillName =
      laboratorySkills?.find((skill) => skill.name === '龙卷雨击')?.name ||
      laboratorySkills?.[0]?.name;
    const skillName = selectedSkillName || preferredSkillName;
    if (!skillName || visibleExperimentSeats.length === 0) {
      return null;
    }

    return {
      baseAttributes,
      combatStats,
      treasure,
      battleContext: {
        selfFormation: playerSetup.formation,
        selfElement: playerSetup.element,
        transformCardFactor:
          syncedCloudState?.battleContext?.transformCardFactor ?? 1,
        shenmuValue: syncedCloudState?.battleContext?.shenmuValue ?? 0,
        magicResult: syncedCloudState?.battleContext?.magicResult ?? 0,
        targetMagicDefenseCultivation:
          syncedCloudState?.battleContext?.targetMagicDefenseCultivation ?? 0,
      },
      skillName,
      targetCount: selectedTargetCount,
      target: {
        name: combatTarget.name,
        magicDefense: combatTarget.magicDefense || 0,
        speed: combatTarget.speed || 0,
        element: combatTarget.element || '火',
        formation: combatTarget.formation || '普通阵',
      },
      seats: visibleExperimentSeats.map((seat) => {
        const seatEquip = resolveLaboratorySeatEquipment(seat, sampleEquipment);
        const { totalPrice } = calculateEquipmentTotalStats(seatEquip);

        return {
          seatId: seat.id,
          seatName: getSeatDisplayName(seat, visibleExperimentSeats),
          isSample: seat.isSample,
          totalPrice,
          equipment: seatEquip,
        };
      }),
    };
  }, [
    baseAttributes,
    combatStats,
    treasure,
    playerSetup,
    syncedCloudState,
    selectedSkillName,
    laboratorySkills,
    selectedTargetCount,
    combatTarget,
    visibleExperimentSeats,
    sampleEquipment,
  ]);

  useEffect(() => {
    const maxTargetCount =
      targetCountOptions[targetCountOptions.length - 1] ?? 1;

    setSelectedTargetCount((current) =>
      current > maxTargetCount ? maxTargetCount : current
    );
  }, [targetCountOptions]);

  useEffect(() => {
    if (!labValuationPayload) {
      setIsLoadingLabValuation(false);
      setLabValuationBySeatId({});
      setLabValuationError(null);
      return;
    }

    const controller = new AbortController();
    setIsLoadingLabValuation(true);
    setLabValuationError(null);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/simulator/current/lab-valuation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(labValuationPayload),
          signal: controller.signal,
        });
        const payload = await response.json();

        if (
          !response.ok ||
          payload?.code !== 0 ||
          !Array.isArray(payload?.data?.seats)
        ) {
          throw new Error(payload?.message || '实验室服务端试算失败');
        }

        setLabValuationBySeatId(
          Object.fromEntries(
            payload.data.seats.map((seat: LabValuationSeatResult) => [
              seat.seatId,
              seat,
            ])
          )
        );
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') {
          return;
        }

        console.error('failed to calculate laboratory valuation:', error);
        setLabValuationBySeatId({});
        setLabValuationError(
          error instanceof Error ? error.message : '实验室服务端试算失败'
        );
      } finally {
        setIsLoadingLabValuation(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [labValuationPayload]);

  // 固定上传区域逻辑
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadQueueProgress, setUploadQueueProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [equipmentImageHint, setEquipmentImageHint] =
    useState<SimulatorEquipmentOcrImageHint>('auto');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingWarningCountRef = useRef<number | null>(null);

  const processFile = async (file: File) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error || '文件验证失败');
      return false;
    }

    try {
      const configResponse = await fetch('/api/simulator/current/ocr/config', {
        method: 'GET',
        cache: 'no-store',
      });
      const configPayload = await configResponse.json();
      if (
        !configResponse.ok ||
        configPayload?.code !== 0 ||
        !configPayload?.data?.ready
      ) {
        const missing = Array.isArray(configPayload?.data?.missing)
          ? configPayload.data.missing.join(', ')
          : configPayload?.message || 'OCR 配置未完成';
        throw new Error(`OCR 配置未完成：${missing}`);
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('imageHint', equipmentImageHint);

      const response = await fetch(
        '/api/simulator/current/candidate-equipment/ocr',
        {
          method: 'POST',
          body: formData,
        }
      );

      const payload = await response.json();
      if (
        !response.ok ||
        payload?.code !== 0 ||
        !Array.isArray(payload?.data?.items)
      ) {
        throw new Error(payload?.message || '识别失败');
      }

      applySimulatorCandidateEquipmentToStore(payload.data.items);

      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      const recognizedName = payload?.data?.item?.equipment?.name || '新装备';
      if (payload?.data?.item) {
        setPendingOcrReviewItem(
          mapSimulatorCandidateEquipmentItemToPendingEquipment(
            payload.data.item
          )
        );
      }

      // 如果需要记录到全局日志，可以在这里添加，不过不再在当前组件内展示
      useGameStore.getState().addOcrLog({
        type: 'success',
        message: `${timeStr}，识别到新物品${recognizedName}`,
      });
      return true;
    } catch (error) {
      const description =
        error instanceof Error ? error.message : '请重试或更换清晰图片';
      toast.error('识别失败', { description });
      useGameStore.getState().addOcrLog({
        type: 'error',
        message: '图片识别失败',
        details: description,
      });
      return false;
    }
  };

  const processFileQueue = async (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    setIsProcessing(true);
    setUploadQueueProgress({ current: 0, total: files.length });

    try {
      let successCount = 0;

      for (const [index, file] of files.entries()) {
        setUploadQueueProgress({ current: index + 1, total: files.length });
        const success = await processFile(file);
        if (success) {
          successCount += 1;
        }
      }

      if (files.length > 1) {
        toast.success(`批量上传完成`, {
          description: `共 ${files.length} 张，成功 ${successCount} 张。`,
        });
      }
    } finally {
      setIsProcessing(false);
      setUploadQueueProgress(null);
    }
  };

  const handleFileUpload = (files: FileList | null) => {
    if (files && files.length > 0) {
      void processFileQueue(Array.from(files));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void processFileQueue(Array.from(e.dataTransfer.files));
    }
  };

  // 全局粘贴支持（仅当处于 pending tab 时可用）
  useEffect(() => {
    if (libTab !== 'pending') return;

    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const file = new File([blob], 'pasted-image.png', {
              type: blob.type,
            });
            void processFileQueue([file]);
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [libTab]);

  // 切换到"新装备库"时，默认选中"装备"分类
  useEffect(() => {
    if (libTab === 'library') {
      setPrimaryCategory('equipment');
      setSecondaryCategory('all');
    }
  }, [libTab]);

  useEffect(() => {
    const previousCount = pendingWarningCountRef.current;

    if (
      previousCount !== null &&
      previousCount < PENDING_EQUIPMENT_WARNING_THRESHOLD &&
      pendingList.length >= PENDING_EQUIPMENT_WARNING_THRESHOLD
    ) {
      toast.error('待确认装备已达到 50 件', {
        description: '请先确认入库或删除一部分，再继续上传。',
      });
    }

    pendingWarningCountRef.current = pendingList.length;
  }, [pendingList.length]);

  // 切换一级分类时，自动选中第一个二级分类
  useEffect(() => {
    setSecondaryCategory('all');
  }, [primaryCategory]);

  useEffect(() => {
    setIsSelectionMode(false);
    setSelectedItemIds([]);
  }, [libTab, primaryCategory, secondaryCategory]);

  useEffect(() => {
    handlePendingReviewRequest();
  }, [pendingEquipments]);

  useEffect(() => {
    const handleOpenLab = () => {
      handlePendingReviewRequest();
    };

    window.addEventListener(SIMULATOR_OPEN_LAB_EVENT, handleOpenLab);
    return () => {
      window.removeEventListener(SIMULATOR_OPEN_LAB_EVENT, handleOpenLab);
    };
  }, [pendingEquipments]);

  useEffect(() => {
    void handleLoadLabSession(true);
    void handleLoadCandidateEquipment(true);
    void loadLatestRollbackSnapshot(true);
  }, []);

  const handleRollbackLatestApplication = async () => {
    try {
      setIsRollingBackCurrentEquipment(true);
      const response = await fetch(
        '/api/simulator/current/equipment/rollback',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      const payload = await response.json();

      if (!response.ok || payload?.code !== 0 || !payload?.data) {
        throw new Error(payload?.message || '回滚当前装备失败');
      }

      applySimulatorBundleToStore(payload.data, {
        preserveWorkbenchState: true,
      });
      await loadLatestRollbackSnapshot(true);
      toast.success('已回滚到最近一次应用前快照');
    } catch (error) {
      console.error('Failed to rollback simulator equipment:', error);
      toast.error('回滚当前装备失败');
    } finally {
      setIsRollingBackCurrentEquipment(false);
    }
  };

  return (
    <div className="flex min-h-0 w-full flex-1 gap-6 overflow-hidden">
      {/* 左侧：装备库 - 25% */}
      <div className="flex h-full w-[25%] flex-col overflow-hidden rounded-2xl border border-yellow-800/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl">
        <div className="border-b border-yellow-700/60 bg-gradient-to-r from-yellow-900/50 to-yellow-800/30 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-600">
                <Package className="h-5 w-5 text-slate-900" />
              </div>
              <div>
                <h2 className="text-base font-bold text-yellow-100">装备库</h2>
                <p className="text-xs text-yellow-400/80">Equipment Library</p>
              </div>
            </div>

            {libTab === 'library' && libraryActionSummary ? (
              <div
                className={`rounded-lg border px-3 py-3 text-xs ${
                  libraryActionSummary.tone === 'cyan'
                    ? 'border-cyan-900/40 bg-cyan-950/10 text-cyan-100'
                    : libraryActionSummary.tone === 'violet'
                      ? 'border-violet-900/40 bg-violet-950/10 text-violet-100'
                      : 'border-amber-900/40 bg-amber-950/10 text-amber-100'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white/95">
                      {libraryActionSummary.title}
                    </div>
                    <div className="mt-1 text-slate-300">
                      {libraryActionSummary.description}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      目标去向：{libraryActionSummary.targetLabel}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      {libraryActionSummary.viewHint}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setLibraryActionFocusOnly((current) => !current)
                      }
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                        libraryActionFocusOnly
                          ? 'border-white/25 bg-white/10 text-white'
                          : 'border-slate-700/70 bg-slate-900/70 text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {libraryActionFocusOnly ? '显示全部结果' : '只看本次部位'}
                    </button>
                    <button
                      type="button"
                      onClick={applyLibraryActionTargetView}
                      className="rounded-full border border-slate-700/70 bg-slate-900/70 px-2.5 py-1 text-[11px] text-slate-200 transition-colors hover:bg-slate-800"
                    >
                      回到目标视图
                    </button>
                    <button
                      type="button"
                      onClick={handleContinueLibraryActionSummary}
                      className="rounded-full border border-slate-700/70 bg-slate-900/70 px-2.5 py-1 text-[11px] text-slate-200 transition-colors hover:bg-slate-800"
                    >
                      继续处理本次部位
                    </button>
                    <button
                      type="button"
                      onClick={handleCompleteLibraryActionSummary}
                      className="rounded-full border border-emerald-400/50 bg-emerald-500/15 px-2.5 py-1 text-[11px] text-emerald-50 transition-colors hover:bg-emerald-500/25"
                    >
                      完成本轮
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {libraryActionSummary.affectedSlotLabels.slice(0, 6).map((label) => (
                    <span
                      key={`${libraryActionSummary.id}-${label}`}
                      className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/85"
                    >
                      {label}
                    </span>
                  ))}
                  {libraryActionSummary.affectedSlotLabels.length > 6 ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/70">
                      +{libraryActionSummary.affectedSlotLabels.length - 6}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center gap-1 rounded-lg border border-yellow-700/40 bg-slate-900/60 px-2.5 py-1.5 text-xs text-yellow-100 transition hover:border-yellow-500/70 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoadingLab || isLoadingCandidateEquipment}
                onClick={async () => {
                  await handleLoadLabSession();
                  await handleLoadManagedInventory(true);
                  await handleLoadCandidateEquipment(true);
                }}
              >
                <RefreshCcw
                  className={`h-3.5 w-3.5 ${isLoadingLab || isLoadingCandidateEquipment ? 'animate-spin' : ''}`}
                />
                读取
              </button>
              <button
                className="inline-flex items-center gap-1 rounded-lg bg-yellow-600 px-2.5 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSavingLab || isSavingCandidateEquipment}
                onClick={async () => {
                  const labOk = await handleSaveLabSession();
                  if (labOk !== false) {
                    await handleSaveCandidateEquipment(true);
                  }
                }}
              >
                <Save className="h-3.5 w-3.5" />
                保存
              </button>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            当前实验室席位和候选装备库都会保存到 Cloudflare D1
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-yellow-800/30 bg-slate-950/50 px-3 py-2">
            <div className="min-w-0">
              <div className="text-xs font-medium text-yellow-200">
                覆盖当前装备时会自动保存应用前快照
              </div>
              <div className="truncate text-[11px] text-slate-400">
                {latestRollbackSnapshot
                  ? `${latestRollbackSnapshot.name} · ${formatRollbackTime(
                      latestRollbackSnapshot.createdAt
                    )}`
                  : isLoadingRollbackSnapshot
                    ? '正在读取最近一次回滚快照...'
                    : '还没有可回滚的应用记录'}
              </div>
            </div>
            <button
              className="shrink-0 rounded-lg border border-yellow-700/50 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-yellow-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={
                isRollingBackCurrentEquipment ||
                isLoadingRollbackSnapshot ||
                !latestRollbackSnapshot
              }
              onClick={handleRollbackLatestApplication}
            >
              {isRollingBackCurrentEquipment ? '回滚中...' : '回滚最近一次应用'}
            </button>
          </div>
          <div className="mt-3 flex rounded-lg border border-yellow-800/40 bg-slate-900/80 p-1">
            <button
              className={`flex-1 rounded-md py-1.5 text-xs transition-colors ${libTab === 'pending' ? 'bg-yellow-600 font-bold text-slate-900' : 'text-yellow-100/60 hover:text-yellow-100'}`}
              onClick={() => setLibTab('pending')}
            >
              待确认新品 ({pendingList.length})
            </button>
            <button
              className={`flex-1 rounded-md py-1.5 text-xs transition-colors ${libTab === 'library' ? 'bg-yellow-600 font-bold text-slate-900' : 'text-yellow-100/60 hover:text-yellow-100'}`}
              onClick={() => setLibTab('library')}
            >
              装备总库 ({libraryList.length})
            </button>
          </div>
          {libTab === 'library' && (
            <div className="mt-3 flex flex-wrap gap-2">
              {laboratorySourceFilterOptions.map((option) => (
                <button
                  key={option.key}
                  onClick={() => setLibrarySourceFilter(option.key)}
                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                    librarySourceFilter === option.key
                      ? 'border-sky-500/60 bg-sky-900/30 font-bold text-sky-100'
                      : 'border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                  }`}
                >
                  {option.label} ({option.count})
                </button>
              ))}
            </div>
          )}
          {libTab === 'library' && librarySourceFilter === 'inventory_asset' && (
            <div className="mt-3 flex flex-wrap gap-2 rounded-lg border border-sky-900/30 bg-sky-950/10 p-2">
              <span className="self-center px-1 text-xs font-medium text-sky-100">
                正式库存状态
              </span>
              {inventoryLifecycleSummaryItems.map((option) => (
                <button
                  key={option.key}
                  onClick={() => setInventoryLifecycleFilter(option.key)}
                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                    inventoryLifecycleFilter === option.key
                      ? 'border-sky-400/60 bg-sky-500/20 font-bold text-sky-50'
                      : 'border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                  }`}
                >
                  {option.label} ({option.count})
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-3 space-y-3">
            <div className="flex rounded-lg border border-yellow-800/30 bg-slate-900/60 p-1">
              {SIMULATOR_CATEGORY_CONFIG.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setPrimaryCategory(cat.key)}
                  className={`flex-1 rounded-md py-1.5 text-xs transition-colors ${
                    primaryCategory === cat.key
                      ? 'bg-yellow-600 font-bold text-slate-900'
                      : 'text-yellow-100/60 hover:text-yellow-100'
                  }`}
                >
                  {cat.name} (
                  {
                    filterCandidateEquipmentItems(activeCandidateSourceList, {
                      category: cat.key,
                      slotDefinition: null,
                    }).length
                  }
                  )
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSecondaryCategory('all')}
                className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                  secondaryCategory === 'all'
                    ? 'border-yellow-600/60 bg-yellow-600/20 font-bold text-yellow-400'
                    : 'border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                全部 (
                {
                  filterCandidateEquipmentItems(activeCandidateSourceList, {
                    category: primaryCategory,
                    slotDefinition: null,
                  }).length
                }
                )
              </button>
              {secondaryCategories.map((cat) => {
                const count = activeCandidateSourceList.filter((item) =>
                  matchesSimulatorSlotDefinition(cat, item.equipment)
                ).length;

                return (
                  <button
                    key={cat.id}
                    onClick={() => setSecondaryCategory(cat.id)}
                    className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                      secondaryCategory === cat.id
                        ? 'border-yellow-600/60 bg-yellow-600/20 font-bold text-yellow-400'
                        : 'border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                    }`}
                  >
                    {getSimulatorSlotLabel(cat, 'laboratory')} ({count})
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-yellow-800/30 bg-slate-950/40 px-3 py-2">
              <div className="text-xs text-slate-300">
                当前按
                <span className="mx-1 font-semibold text-yellow-300">
                  {SIMULATOR_CATEGORY_CONFIG.find(
                    (cat) => cat.key === primaryCategory
                  )?.name || '装备'}
                </span>
                /
                <span className="mx-1 font-semibold text-yellow-300">
                  {selectedSecondaryDefinition
                    ? getSimulatorSlotLabel(
                        selectedSecondaryDefinition,
                        'laboratory'
                      )
                    : '全部'}
                </span>
                显示，共 {activeVisibleCandidateList.length} 件
                {libTab === 'library' && (
                  <>
                    {' '}
                    · 来源
                    <span className="mx-1 font-semibold text-sky-300">
                      {laboratorySourceFilterOptions.find(
                        (option) => option.key === librarySourceFilter
                      )?.label || '全部来源'}
                    </span>
                    {librarySourceFilter === 'inventory_asset' ? (
                      <>
                        {' '}
                        · 状态
                        <span className="mx-1 font-semibold text-cyan-300">
                          {inventoryLifecycleSummaryItems.find(
                            (option) => option.key === inventoryLifecycleFilter
                          )?.label || '库存待用'}
                        </span>
                      </>
                    ) : null}
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={candidateSort}
                  onChange={(event) =>
                    setCandidateSort(
                      event.target.value as SimulatorCandidateEquipmentSortKey
                    )
                  }
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 transition-colors outline-none hover:border-slate-600"
                >
                  <option value="newest">最新上传</option>
                  <option value="oldest">最早上传</option>
                  <option value="totalPriceDesc">总价最高</option>
                  <option value="totalPriceAsc">总价最低</option>
                </select>

                {libTab === 'pending' && !isSelectionMode ? (
                  <button
                    onClick={() => setIsSelectionMode(true)}
                    className="rounded-lg border border-blue-600/40 bg-blue-600/20 px-3 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-600/30"
                  >
                    选择
                  </button>
                ) : libTab === 'pending' ? (
                  <>
                    <button
                      onClick={() => {
                        setIsSelectionMode(false);
                        setSelectedItemIds([]);
                      }}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700"
                    >
                      取消
                    </button>
                    {libTab === 'pending' && (
                      <button
                        onClick={async () => {
                          if (selectedItemIds.length === 0) {
                            toast.error('请先选择要确认的装备');
                            return;
                          }

                          confirmCandidateEquipmentItems(selectedItemIds);
                          await handleSaveCandidateEquipment(true);
                          toast.success(
                            `已确认 ${selectedItemIds.length} 件装备入库`
                          );
                          setSelectedItemIds([]);
                          setIsSelectionMode(false);
                        }}
                        disabled={selectedItemIds.length === 0}
                        className="rounded-lg border border-emerald-600/40 bg-emerald-600/20 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-600/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        批量确认
                        {selectedItemIds.length > 0 &&
                          ` (${selectedItemIds.length})`}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (selectedItemIds.length > 0) {
                          setShowDeleteConfirm(true);
                        } else {
                          toast.error('请先选择要删除的装备');
                        }
                      }}
                      disabled={selectedItemIds.length === 0}
                      className="flex items-center gap-1 rounded-lg border border-red-600/40 bg-red-600/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-600/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" />
                      删除
                      {selectedItemIds.length > 0 &&
                        ` (${selectedItemIds.length})`}
                    </button>
                  </>
                ) : manageableLibraryInventoryItems.length > 0 ? (
                  <>
                    <button
                      onClick={() => {
                        const draft = buildSimulatorInventoryStatusUpdateDraft({
                          items: manageableLibraryInventoryItems,
                          nextStatus: 'sold',
                        });
                        if (draft) {
                          setInventoryStatusUpdate(draft);
                        }
                      }}
                      disabled={updatingInventoryEntryIds.length > 0}
                      className="rounded-lg border border-emerald-600/40 bg-emerald-600/20 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-600/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      批量标记已售出 ({manageableLibraryInventoryItems.length})
                    </button>
                    <button
                      onClick={() => {
                        const draft = buildSimulatorInventoryStatusUpdateDraft({
                          items: manageableLibraryInventoryItems,
                          nextStatus: 'discarded',
                        });
                        if (draft) {
                          setInventoryStatusUpdate(draft);
                        }
                      }}
                      disabled={updatingInventoryEntryIds.length > 0}
                      className="rounded-lg border border-red-600/40 bg-red-600/20 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-600/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      批量标记作废 ({manageableLibraryInventoryItems.length})
                    </button>
                    <div className="text-[11px] text-slate-400">
                      只会处理候选入库生成的正式库存记录，不会删除方案或实验席位引用
                    </div>
                  </>
                ) : restorableLibraryInventoryItems.length > 0 ? (
                  <>
                    <button
                      onClick={() => {
                        const draft = buildSimulatorInventoryStatusUpdateDraft({
                          items: restorableLibraryInventoryItems,
                          nextStatus: 'active',
                        });
                        if (draft) {
                          setInventoryStatusUpdate(draft);
                        }
                      }}
                      disabled={updatingInventoryEntryIds.length > 0}
                      className="rounded-lg border border-sky-600/40 bg-sky-600/20 px-3 py-1.5 text-xs font-medium text-sky-200 transition-colors hover:bg-sky-600/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      批量恢复待用 ({restorableLibraryInventoryItems.length})
                    </button>
                    <div className="text-[11px] text-slate-400">
                      会把已售出或作废的正式库存恢复为库存待用，恢复后才重新进入换装弹窗与实验室席位选择器
                    </div>
                  </>
                ) : removableLibraryCandidateItems.length > 0 ? (
                  <>
                    <button
                      onClick={() => {
                        setLibraryCandidateRemovalIds(
                          removableLibraryCandidateItems.map((item) => item.id)
                        );
                        setShowLibraryCandidateRemovalConfirm(true);
                      }}
                      className="flex items-center gap-1 rounded-lg border border-red-600/40 bg-red-600/20 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-600/30"
                    >
                      <Trash2 className="h-3 w-3" />
                      批量移出候选库 ({removableLibraryCandidateItems.length})
                    </button>
                    <div className="text-[11px] text-slate-400">
                      总库已合并当前方案、其他方案与已确认候选装备
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-slate-400">
                    总库已合并当前方案、其他方案与已确认候选装备
                  </div>
                )}
              </div>
            </div>
          </div>

          {libTab === 'pending' ? (
            <div className="relative flex h-full flex-col">
              <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto pr-2 pb-[72px]">
                {pendingList.length >= PENDING_EQUIPMENT_WARNING_THRESHOLD && (
                  <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                    待确认装备已堆积到 {pendingList.length}{' '}
                    件，请先确认入库或删除一部分，再继续上传。
                  </div>
                )}
                {filteredPendingList.map((item) => {
                  const isSelected = selectedItemIds.includes(item.id);

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (isSelectionMode) {
                          setSelectedItemIds((current) =>
                            current.includes(item.id)
                              ? current.filter((id) => id !== item.id)
                              : [...current, item.id]
                          );
                          return;
                        }

                        setSelectedPendingItem(item);
                        setSelectedLibEquip(null);
                      }}
                      className={`cursor-pointer rounded-xl border p-2.5 transition-all ${
                        isSelected
                          ? 'border-yellow-600 bg-yellow-900/20'
                          : 'border-yellow-800/40 bg-slate-900/60 hover:border-yellow-600/60 hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="flex gap-3">
                        {isSelectionMode && (
                          <div
                            className={`mt-4 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all ${
                              isSelected
                                ? 'border-yellow-600 bg-yellow-600'
                                : 'border-slate-600 bg-slate-800/50'
                            }`}
                          >
                            {isSelected && (
                              <svg
                                className="h-3 w-3 text-slate-900"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </div>
                        )}
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-yellow-800/30 bg-slate-950/50">
                          <img
                            src={getSimulatorEquipmentDisplayImageUrl(
                              item.equipment
                            )}
                            alt={item.equipment.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        {/* 左列：装备信息 */}
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <div className="text-sm font-bold text-yellow-100">
                              {item.equipment.name}
                            </div>
                            <span className="rounded border border-orange-600/50 bg-orange-900/20 px-1.5 py-0.5 text-[10px] font-medium text-orange-400">
                              待确认
                            </span>
                          </div>

                          <div className="line-clamp-1 text-xs leading-snug break-all whitespace-pre-line text-slate-300">
                            {item.equipment.mainStat}
                          </div>

                          {item.equipment.extraStat && (
                            <div className="line-clamp-1 text-xs leading-snug break-all whitespace-pre-line text-red-400">
                              {item.equipment.extraStat}
                            </div>
                          )}

                          {item.equipment.highlights &&
                            item.equipment.highlights.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {item.equipment.highlights.map((hl, idx) => (
                                  <span
                                    key={idx}
                                    className="rounded border border-red-500/50 px-1 py-0.5 text-[10px] text-red-400"
                                  >
                                    {hl}
                                  </span>
                                ))}
                              </div>
                            )}
                        </div>

                        {/* 右列：价格信息 - 固定宽度容纳8位数 */}
                        <div className="flex w-28 shrink-0 flex-col gap-1.5 border-l border-slate-700/50 pl-3">
                          <div className="text-right">
                            <div className="mb-0.5 text-[9px] text-slate-500">
                              售价
                            </div>
                            <div className="text-sm font-bold whitespace-nowrap text-[#fff064]">
                              ¥ {formatPrice(item.equipment.price)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="mb-0.5 text-[9px] text-slate-500">
                              跨服
                            </div>
                            <div className="text-sm font-bold whitespace-nowrap text-[#fff064]">
                              ¥ {formatPrice(item.equipment.crossServerFee)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredPendingList.length === 0 && (
                  <div className="py-10 text-center text-sm text-slate-500">
                    当前筛选下暂无待确认装备
                  </div>
                )}
              </div>

              {/* 吸底上传区域 */}
              <div className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pt-3 pb-1">
                <div className="mb-2 flex flex-wrap gap-1.5 px-1">
                  {SIMULATOR_EQUIPMENT_OCR_IMAGE_HINT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setEquipmentImageHint(option.value);
                      }}
                      className={`rounded-full border px-2 py-1 text-[10px] transition-colors ${
                        equipmentImageHint === option.value
                          ? 'border-sky-500/60 bg-sky-900/30 text-sky-100'
                          : 'border-slate-700/70 bg-slate-900/80 text-slate-400 hover:border-sky-700/50 hover:text-sky-100'
                      }`}
                      title={option.description}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onClick={() => fileInputRef.current?.click()}
                  className={`group relative flex w-full cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border-2 border-dashed py-2 shadow-xl shadow-slate-950/50 transition-all ${
                    isDragging
                      ? 'border-yellow-500 bg-yellow-900/20'
                      : 'border-yellow-700/60 bg-slate-900 hover:border-yellow-600 hover:bg-slate-800'
                  }`}
                >
                  <input
                    id="candidate-equipment-upload"
                    name="candidate-equipment-upload"
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleFileUpload(e.target.files)}
                    className="hidden"
                  />
                  <div className="absolute inset-0 bg-yellow-600/10 opacity-0 transition-opacity group-hover:opacity-100"></div>

                  {isProcessing ? (
                    <div className="z-10 flex items-center gap-2 py-1">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: 'linear',
                        }}
                        className="h-4 w-4 rounded-full border-2 border-yellow-600/30 border-t-yellow-600"
                      />
                      <span className="text-sm font-bold text-yellow-400">
                        {uploadQueueProgress
                          ? `正在识别 ${uploadQueueProgress.current}/${uploadQueueProgress.total}...`
                          : '正在识别...'}
                      </span>
                    </div>
                  ) : (
                    <div className="z-10 flex flex-col items-center">
                      <div className="flex items-center gap-2 text-yellow-400">
                        <Upload
                          className={`h-4 w-4 ${isDragging ? 'text-yellow-400' : 'text-yellow-600/80'}`}
                        />
                        <span className="text-sm font-bold">上传装备截图</span>
                      </div>
                      <span className="mt-0.5 text-[10px] text-slate-400">
                        点击/拖拽批量上传，支持直接粘贴
                      </span>
                      <span className="mt-0.5 text-[10px] text-sky-300/80">
                        当前按“
                        {
                          SIMULATOR_EQUIPMENT_OCR_IMAGE_HINT_OPTIONS.find(
                            (item) => item.value === equipmentImageHint
                          )?.label
                        }
                        ”优化识别
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              {/* 装备列表 */}
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  {filteredLibraryList.map((item) => {
                    const compareSeatState = getLaboratoryCompareSeatState(
                      item.equipment
                    );
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
                      librarySourceFilter === 'inventory_asset' &&
                      candidateBackedInventoryRefs.length > 0;
                    const canRestoreInventory =
                      librarySourceFilter === 'inventory_asset' &&
                      restorableInventoryRefs.length > 0;
                    const inventoryLifecycleStatusLabels =
                      buildSimulatorInventoryStatusLabels(inventorySummary, {
                        formal: true,
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
                        statusLabels={
                          [
                            ...(compareSeatState.isExplicitCompareMatch
                              ? [
                                  {
                                    label: `实验室:${compareSeatState.compareSeatLabel}`,
                                    tone: 'violet' as const,
                                  },
                                ]
                              : []),
                            ...inventoryLifecycleStatusLabels,
                          ]
                        }
                        onClick={() => {
                          setSelectedLibEquip(item);
                          setSelectedPendingItem(null);
                        }}
                        actionLabel={
                          inventoryOnlyInactive
                            ? '库存已失效'
                            : compareSeatState.isExplicitCompareMatch
                            ? `已在${compareSeatState.compareSeatLabel}`
                            : compareSeatState.isInheritedFromSample
                              ? '样本已继承'
                              : `挂到${compareSeatState.compareSeatLabel}`
                        }
                        actionDisabled={
                          inventoryOnlyInactive ||
                          compareSeatState.isExplicitCompareMatch ||
                          compareSeatState.isInheritedFromSample
                        }
                        onActionClick={() => {
                          if (
                            compareSeatState.isExplicitCompareMatch ||
                            compareSeatState.isInheritedFromSample ||
                            inventoryOnlyInactive
                          ) {
                            return;
                          }

                          handleSendLibraryEquipmentToCompareSeat(item);
                        }}
                        secondaryActionLabel={
                          compareSeatState.isExplicitCompareMatch
                            ? '移出对比位'
                            : '查看详情'
                        }
                        onSecondaryActionClick={() => {
                          if (compareSeatState.isExplicitCompareMatch) {
                            handleRemoveLibraryEquipmentFromCompareSeat(item);
                            return;
                          }

                          setSelectedLibEquip(item);
                          setSelectedPendingItem(null);
                        }}
                        tertiaryActionLabel={
                          canRestoreInventory
                            ? '恢复待用'
                            : canManageInventory
                              ? '标记已售出'
                              : undefined
                        }
                        tertiaryActionDisabled={
                          canRestoreInventory
                            ? restorableInventoryRefs.some((ref) =>
                                updatingInventoryEntryIds.includes(ref.entryId)
                              )
                            : candidateBackedInventoryRefs.some((ref) =>
                                updatingInventoryEntryIds.includes(ref.entryId)
                              )
                        }
                        onTertiaryActionClick={
                          canRestoreInventory
                            ? () => {
                                const draft = buildSimulatorInventoryStatusUpdateDraft(
                                  {
                                    items: [item],
                                    nextStatus: 'active',
                                  }
                                );
                                if (draft) {
                                  setInventoryStatusUpdate(draft);
                                }
                              }
                            : canManageInventory
                            ? () => {
                                const draft = buildSimulatorInventoryStatusUpdateDraft(
                                  {
                                    items: [item],
                                    nextStatus: 'sold',
                                  }
                                );
                                if (draft) {
                                  setInventoryStatusUpdate(draft);
                                }
                              }
                            : undefined
                        }
                        dangerActionLabel={
                          canManageInventory
                            ? '标记作废'
                            : item.selectable &&
                                item.sourceKinds.includes('candidate_library')
                              ? '移出候选库'
                              : undefined
                        }
                        dangerActionDisabled={candidateBackedInventoryRefs.some(
                          (ref) => updatingInventoryEntryIds.includes(ref.entryId)
                        )}
                        onDangerActionClick={
                          canManageInventory
                            ? () => {
                                const draft = buildSimulatorInventoryStatusUpdateDraft(
                                  {
                                    items: [item],
                                    nextStatus: 'discarded',
                                  }
                                );
                                if (draft) {
                                  setInventoryStatusUpdate(draft);
                                }
                              }
                            : item.selectable &&
                                item.sourceKinds.includes('candidate_library')
                              ? () => {
                                  setLibraryCandidateRemovalIds([item.id]);
                                  setShowLibraryCandidateRemovalConfirm(true);
                                }
                              : undefined
                        }
                      />
                    );
                  })}
                  {filteredLibraryList.length === 0 && (
                    <div className="col-span-2 flex flex-col items-center gap-2 py-10 text-center">
                      {(() => {
                        const emptyStateCopy =
                          librarySourceFilter === 'inventory_asset'
                            ? buildSimulatorInventoryEmptyStateCopy({
                                lifecycleFilter: inventoryLifecycleFilter,
                                hasScopedInventoryItems:
                                  scopedInventoryLibraryItems.length > 0,
                                hasLifecycleMatches:
                                  lifecycleMatchedInventoryLibraryItems.length > 0,
                                hasAdditionalFilters:
                                  lifecycleFilteredLibraryList.length > 0,
                                fallbackTitle:
                                  lifecycleFilteredLibraryList.length === 0
                                    ? '当前来源 / 主类 / 部位筛选下还没有装备'
                                    : '当前筛选下暂无可用装备',
                                fallbackDescription:
                                  lifecycleFilteredLibraryList.length === 0
                                    ? '可以切换来源、分类或部位继续查看总库'
                                    : '可以清除本次部位聚焦或调整顶部筛选后继续处理',
                              })
                            : {
                                title:
                                  lifecycleFilteredLibraryList.length === 0
                                    ? '当前来源 / 主类 / 部位筛选下还没有装备'
                                    : '当前筛选下暂无可用装备',
                                description:
                                  lifecycleFilteredLibraryList.length === 0
                                    ? '可以切换来源、分类或部位继续查看总库'
                                    : '可以清除本次部位聚焦或调整顶部筛选后继续处理',
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
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 中间：实验席位 - 35% */}
      <div className="relative flex h-full flex-1 flex-col overflow-hidden rounded-2xl border border-yellow-800/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-yellow-700/60 bg-gradient-to-r from-yellow-900/50 to-yellow-800/30 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-600">
              <Sword className="h-5 w-5 text-slate-900" />
            </div>
            <div>
              <h2 className="text-base font-bold text-yellow-100">实验席位</h2>
              <p className="text-xs text-yellow-400/80">
                Experiment Seats · 目标:{' '}
                {combatTarget.dungeonName
                  ? `${combatTarget.dungeonName} - `
                  : ''}
                {combatTarget.name || '手动目标'} · 正式支持{' '}
                {LABORATORY_MAX_COMPARE_SEATS} 个对比席位
              </p>
            </div>
            <button
              onClick={() => setShowTargetSelector(true)}
              className="ml-4 flex items-center gap-1 rounded-lg border border-yellow-800/40 bg-slate-800 px-3 py-1.5 text-sm font-medium text-yellow-100 transition-colors hover:bg-slate-700"
            >
              <Target className="h-4 w-4" />
              攻击目标：
              {combatTarget.dungeonName
                ? `${combatTarget.dungeonName} - ${combatTarget.name}`
                : combatTarget.name || '选择目标'}
            </button>
            {compareSeatCount < LABORATORY_MAX_COMPARE_SEATS && (
              <button
                onClick={() => addExperimentSeat()}
                className="flex items-center gap-1 rounded-lg border border-yellow-600/40 bg-yellow-600/20 px-3 py-1.5 text-sm font-medium text-yellow-100 transition-colors hover:bg-yellow-600/30"
              >
                <Plus className="h-4 w-4" />
                新增对比席位
              </button>
            )}
          </div>
        </div>
        {labValuationError && (
          <div className="border-t border-yellow-800/20 px-5 py-2 text-xs text-amber-300">
            服务端试算不可用：{labValuationError}
          </div>
        )}

        <div className="flex flex-1 gap-4 overflow-hidden p-4">
          {visibleExperimentSeats.map((seat) => (
            <LaboratorySeatCard
              key={seat.id}
              seat={seat}
              experimentSeats={visibleExperimentSeats}
              sampleEquipment={sampleEquipment}
              equipmentSets={equipmentSets}
              selectedSampleSetIndex={selectedSampleSetIndex}
              onSelectedSampleSetIndexChange={setSelectedSampleSetIndex}
              onApplySeat={(targetSeat) => {
                const equipmentSetName =
                  equipmentSets[selectedSampleSetIndex]?.name ||
                  `装备组合 ${selectedSampleSetIndex + 1}`;
                setConfirmOverwriteDialog({
                  seatId: targetSeat.id,
                  seatName: getSeatDisplayName(
                    targetSeat,
                    visibleExperimentSeats
                  ),
                  equipmentSetName,
                  guardSummary: buildLaboratoryRuneGuardSummary(
                    sampleEquipment,
                    targetSeat.equipment
                  ),
                });
              }}
              onRemoveSeat={(targetSeat) => {
                removeExperimentSeat(targetSeat.id);
              }}
              onSelectSlot={setSelectedSlot}
              onClearDetailSelection={() => {
                setSelectedLibEquip(null);
                setSelectedPendingItem(null);
              }}
              baseAttributes={baseAttributes}
              bodyStrength={cultivation.bodyStrength || 0}
              meridian={meridian}
              treasure={treasure}
              baseSampleStats={baseSampleStats}
              seatLabValuation={labValuationBySeatId[seat.id]}
              labValuationError={labValuationError}
              isLoadingLabValuation={isLoadingLabValuation}
              regularSetRules={regularSetRules}
              syncedCloudState={syncedCloudState}
            />
          ))}

          <LaboratoryComparisonTable
            experimentSeats={visibleExperimentSeats}
            sampleEquipment={sampleEquipment}
            baseAttributes={baseAttributes}
            bodyStrength={cultivation.bodyStrength || 0}
            meridian={meridian}
            treasure={treasure}
            labValuationBySeatId={labValuationBySeatId}
            labValuationError={labValuationError}
            isLoadingLabValuation={isLoadingLabValuation}
            regularSetRules={regularSetRules}
            syncedCloudState={syncedCloudState}
          />
        </div>

        {selectedLibEquip && (
          <LaboratoryEquipmentDetailModal
            equipment={selectedLibEquip.equipment}
            experimentSeats={visibleExperimentSeats}
            formatPrice={formatPrice}
            sourceLabels={selectedLibEquip.sourceLabels}
            sourceKinds={selectedLibEquip.sourceKinds}
            onRemoveCandidateSource={
              selectedLibEquip.sourceKinds.includes('candidate_library')
                ? () => {
                    setLibraryCandidateRemovalIds([selectedLibEquip.id]);
                    setShowLibraryCandidateRemovalConfirm(true);
                  }
                : null
            }
            inventoryStatusActions={
              selectedLibEquipInventoryRefs.length > 0 ||
              selectedLibEquipRestorableInventoryRefs.length > 0
                ? {
                    activeCount: selectedLibEquipInventoryRefs.length,
                    inactiveCount: selectedLibEquipRestorableInventoryRefs.length,
                    isUpdating: selectedLibEquipInventoryRefs.some((ref) =>
                      updatingInventoryEntryIds.includes(ref.entryId)
                    ) ||
                    selectedLibEquipRestorableInventoryRefs.some((ref) =>
                      updatingInventoryEntryIds.includes(ref.entryId)
                    ),
                    onMarkSold: () => {
                      const draft = buildSimulatorInventoryStatusUpdateDraft({
                        items: [selectedLibEquip],
                        nextStatus: 'sold',
                      });
                      if (draft) {
                        setInventoryStatusUpdate(draft);
                      }
                    },
                    onRestoreActive: () => {
                      const draft = buildSimulatorInventoryStatusUpdateDraft({
                        items: [selectedLibEquip],
                        nextStatus: 'active',
                      });
                      if (draft) {
                        setInventoryStatusUpdate(draft);
                      }
                    },
                    onMarkDiscarded: () => {
                      const draft = buildSimulatorInventoryStatusUpdateDraft({
                        items: [selectedLibEquip],
                        nextStatus: 'discarded',
                      });
                      if (draft) {
                        setInventoryStatusUpdate(draft);
                      }
                    },
                  }
                : null
            }
            onClose={() => setSelectedLibEquip(null)}
            onReplaceCurrent={handleReplaceCurrent}
            onApplyToSeat={handleApplyToSeat}
          />
        )}

        {selectedPendingItem && (
          <PendingEquipmentDetailModal
            item={selectedPendingItem}
            onClose={() => setSelectedPendingItem(null)}
            onSave={(equipment) =>
              handleSavePendingItemEdit(selectedPendingItem.id, equipment)
            }
            reviewProgressLabel={
              selectedPendingIndex >= 0
                ? `当前筛选结果第 ${selectedPendingIndex + 1} / ${filteredPendingList.length} 件`
                : undefined
            }
            canViewPrevious={selectedPendingIndex > 0}
            canViewNext={
              selectedPendingIndex >= 0 &&
              selectedPendingIndex < filteredPendingList.length - 1
            }
            onViewPrevious={() =>
              openPendingItemByIndex(selectedPendingIndex - 1)
            }
            onViewNext={() => openPendingItemByIndex(selectedPendingIndex + 1)}
            onDelete={() => {
              removePendingEquipment(selectedPendingItem.id);
              void handleSaveCandidateEquipment(true);
              const nextItem =
                filteredPendingList[selectedPendingIndex + 1] ??
                filteredPendingList[selectedPendingIndex - 1] ??
                null;
              setSelectedPendingItem(nextItem);
              if (nextItem) {
                toast.success(
                  `已删除 ${selectedPendingItem.equipment.name}，继续查看 ${nextItem.equipment.name}`
                );
              } else {
                toast.success('已删除装备');
              }
            }}
            onConfirm={() => {
              void handleConfirmPendingItem(selectedPendingItem);
            }}
            onConfirmAndNext={() => {
              void handleConfirmPendingItem(selectedPendingItem, {
                moveToNext: true,
              });
            }}
            onReplaceToCurrentState={async () => {
              await handleReplaceCurrent(selectedPendingItem.equipment);
              await handleConfirmPendingItem(selectedPendingItem, {
                moveToNext: true,
              });
            }}
          />
        )}

        <OcrEquipmentReviewDialog
          open={Boolean(pendingOcrReviewItem)}
          item={pendingOcrReviewItem}
          title="确认装备 OCR 结果"
          description="这次识别出的字段已经写入候选装备待确认区，下面只展示本次 OCR 真正识别到的有效字段。"
          destinationTitle="写入位置：实验室待确认新品"
          destinationDescription={`装备已经进入当前角色的候选装备队列。当前待确认共有 ${pendingList.length} 件，你可以直接进入待确认详情并继续连审。`}
          primaryActionLabel="打开并继续审核"
          secondaryActionLabel="稍后再看"
          onClose={() => setPendingOcrReviewItem(null)}
          onPrimaryAction={() => {
            if (pendingOcrReviewItem) {
              setSelectedPendingItem(pendingOcrReviewItem);
            }
            setPendingOcrReviewItem(null);
          }}
        />

        {showTargetSelector && (
          <LaboratoryTargetSelectorModal
            combatTarget={combatTarget}
            manualTargets={manualTargets}
            skills={laboratorySkills}
            selectedSkillName={selectedSkillName}
            selectedTargetCount={selectedTargetCount}
            targetCountOptions={targetCountOptions}
            targetDungeons={targetDungeons}
            onClose={() => setShowTargetSelector(false)}
            onSelectedSkillNameChange={setSelectedSkillName}
            onSelectedTargetCountChange={setSelectedTargetCount}
            onCombatTargetChange={updateCombatTarget}
          />
        )}

        {selectedSlot && (
          <LaboratorySlotSelectorModal
            libraryItems={slotSelectorLibraryList}
            selectedSlot={selectedSlot}
            formatPrice={formatPrice}
            onClose={() => setSelectedSlot(null)}
            onClearEquipment={removeExperimentSeatEquipment}
            onSelectEquipment={handleApplyToSeat}
          />
        )}
      </div>

      <LaboratoryBulkDeleteDialog
        open={showDeleteConfirm}
        selectedCount={selectedItemIds.length}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          removeCandidateEquipmentItems(selectedItemIds);
          void handleSaveCandidateEquipment(true);
          toast.success(`已删除 ${selectedItemIds.length} 件装备`);
          setSelectedItemIds([]);
          setIsSelectionMode(false);
          setShowDeleteConfirm(false);
        }}
      />

      <LaboratoryBulkDeleteDialog
        open={showLibraryCandidateRemovalConfirm}
        selectedCount={libraryCandidateRemovalIds.length}
        title="确认移出候选来源"
        description={
          <>
            确定要把当前选中的{' '}
            <span className="font-bold text-red-400">
              {libraryCandidateRemovalIds.length}
            </span>{' '}
            件装备从实验室总库里的“候选装备库”来源移出吗？
            <br />
            <span className="text-xs text-slate-400">
              若这件装备同时属于当前方案或其他方案，只会移除候选来源，不会影响方案里的装备。
            </span>
          </>
        }
        confirmLabel="确认移出候选库"
        onClose={() => {
          setShowLibraryCandidateRemovalConfirm(false);
          setLibraryCandidateRemovalIds([]);
        }}
        onConfirm={() => {
          void removeLibraryCandidateSourceItems(libraryCandidateRemovalIds);
          setShowLibraryCandidateRemovalConfirm(false);
          setLibraryCandidateRemovalIds([]);
        }}
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
                  确定要将当前实验室总库筛选结果里的
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
              该操作会同步更新关联候选装备的状态，不会删除当前方案、其他方案或实验席位里的引用。
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

      {confirmOverwriteDialog && (
        <LaboratoryOverwriteConfirmDialog
          equipmentSetName={confirmOverwriteDialog.equipmentSetName}
          guardSummary={confirmOverwriteDialog.guardSummary}
          onClose={() => setConfirmOverwriteDialog(null)}
          onConfirm={handleConfirmOverwrite}
        />
      )}
    </div>
  );
}
