'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '@/features/simulator/store/gameStore';
import type {
  Dungeon,
  Equipment,
  PendingEquipment,
} from '@/features/simulator/store/gameTypes';
import { getEquipmentDefaultImage } from '@/features/simulator/utils/equipmentImage';
import { validateImageFile } from '@/features/simulator/utils/fileValidation';
import { applySimulatorBundleToStore } from '@/features/simulator/utils/simulatorBundle';
import { applySimulatorCandidateEquipmentToStore } from '@/features/simulator/utils/simulatorCandidateEquipment';
import { applySimulatorLabSessionToStore } from '@/features/simulator/utils/simulatorLabSession';
import { buildDungeonDatabaseFromTemplates } from '@/features/simulator/utils/targetTemplates';
import {
  ChevronRight,
  Minus,
  Package,
  Plus,
  RefreshCcw,
  Save,
  Sword,
  Target,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';

import { UploadPopover } from '@/shared/blocks/simulator/CharacterPanel/UploadPopover';
import { EquipmentImage } from '@/shared/blocks/simulator/EquipmentPanel/EquipmentImage';
import { formatDateTimeValue } from '@/shared/lib/date';
import {
  getDefaultSimulatorSecondaryCategory,
  getSimulatorSlotDefinitions,
  getSimulatorSlotLabel,
  matchesSimulatorSlotDefinition,
  SIMULATOR_CATEGORY_CONFIG,
} from '@/shared/lib/simulator-slot-config';
import { getSimulatorStatLabel } from '@/shared/lib/simulator-stat-labels';
import type { LabValuationSeatResult } from '@/shared/services/lab-valuation';

import {
  AVAILABLE_GEMSTONES,
  AVAILABLE_RUNE_SETS,
  AVAILABLE_RUNES,
  AVAILABLE_STAR_ALIGNMENTS,
  AVAILABLE_STAR_POSITIONS,
  calculateEquipmentTotalStats,
  getSeatDisplayName,
} from './laboratory-utils';
import { LaboratoryComparisonTable } from './LaboratoryComparisonTable';
import { LaboratoryEquipmentDetailModal } from './LaboratoryEquipmentDetailModal';
import { LaboratorySeatCard } from './LaboratorySeatCard';
import { LibraryEquipmentCard } from './LibraryEquipmentCard';
import { PendingEquipmentCard } from './PendingEquipmentCard';
import { PendingEquipmentDetailModal } from './PendingEquipmentDetailModal';

type EquipmentRollbackSnapshot = {
  id: string;
  name: string;
  source: string;
  notes: string;
  createdAt: number | string | null;
};

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
  const [selectedLibEquip, setSelectedLibEquip] = useState<Equipment | null>(
    null
  );
  const [deletingSeatId, setDeletingSeatId] = useState<string | null>(null);
  const [showTargetSelector, setShowTargetSelector] = useState(false);
  const [selectedPendingItem, setSelectedPendingItem] =
    useState<PendingEquipment | null>(null);

  // 席位栏位选择器状态
  const [selectedSlot, setSelectedSlot] = useState<{
    seatId: string;
    slotType: Equipment['type'];
    slotSlot?: number;
    slotLabel: string;
    currentEquip?: Equipment;
  } | null>(null);

  // 新装备库分类状态
  const [primaryCategory, setPrimaryCategory] = useState<
    'equipment' | 'trinket' | 'jade'
  >('equipment');
  const [secondaryCategory, setSecondaryCategory] = useState<string>('weapon');

  // 批量选择和删除状态
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
  const [latestRollbackSnapshot, setLatestRollbackSnapshot] =
    useState<EquipmentRollbackSnapshot | null>(null);
  const [isLoadingRollbackSnapshot, setIsLoadingRollbackSnapshot] =
    useState(false);

  const pendingEquipments = useGameStore((state) => state.pendingEquipments);
  const experimentSeats = useGameStore((state) => state.experimentSeats);
  const currentEquipment = useGameStore((state) => state.equipment);
  const equipmentSets = useGameStore((state) => state.equipmentSets);
  const activeSetIndex = useGameStore((state) => state.activeSetIndex);
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
  const selectedDungeonIds = useGameStore((state) => state.selectedDungeonIds);
  const updateCombatTarget = useGameStore((state) => state.updateCombatTarget);
  const manualTargets = useGameStore((state) => state.manualTargets);
  const skills = useGameStore((state) => state.skills);

  // 样本席位装备组合选择
  const [selectedSampleSetIndex, setSelectedSampleSetIndex] = useState(0);

  // 战队目标选择器中的技能和秒几选项
  const [selectedSkillName, setSelectedSkillName] = useState<string>('');
  const [selectedTargetCount, setSelectedTargetCount] = useState<number>(1);
  const [targetDungeons, setTargetDungeons] = useState<Dungeon[]>([]);

  // 确认弹窗状态 - 用于覆盖当前装备
  const [confirmOverwriteDialog, setConfirmOverwriteDialog] = useState<{
    seatId: string;
    seatName: string;
    equipmentSetName: string;
  } | null>(null);

  // 初始化技能选择
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
        const response = await fetch('/api/simulator/target-templates?scene=dungeon', {
          method: 'GET',
          cache: 'no-store',
        });
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

  const pendingList = pendingEquipments.filter((e) => e.status === 'pending');
  const libraryList = pendingEquipments.filter((e) => e.status === 'confirmed');
  const libraryEquipments = libraryList.map((item) => item.equipment);

  const { baseAttributes, treasure } = useGameStore();
  const [labValuationBySeatId, setLabValuationBySeatId] = useState<
    Record<string, LabValuationSeatResult>
  >({});
  const [isLoadingLabValuation, setIsLoadingLabValuation] = useState(false);
  const [labValuationError, setLabValuationError] = useState<string | null>(
    null
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
    pendingEquipments.map((item) => ({
      id: item.id,
      equipment: item.equipment,
      imagePreview: item.imagePreview,
      rawText: item.rawText,
      targetSetId: item.targetSetId,
      targetEquipmentId: item.targetEquipmentId,
      targetRuneStoneSetIndex: item.targetRuneStoneSetIndex,
      status: item.status,
    }));

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
            equipment: seat.equipment,
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

  const handleApplyToSeat = (seatId: string, equipment: Equipment) => {
    updateExperimentSeatEquipment(seatId, equipment);
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

  const sampleEquipment = useMemo(
    () => equipmentSets[selectedSampleSetIndex]?.items || currentEquipment,
    [equipmentSets, selectedSampleSetIndex, currentEquipment]
  );
  const compareSeatCount = useMemo(
    () => experimentSeats.filter((seat) => !seat.isSample).length,
    [experimentSeats]
  );
  // 基础样本数据
  const baseSampleStats = useMemo(
    () => calculateEquipmentTotalStats(sampleEquipment),
    [sampleEquipment]
  );

  const labValuationPayload = useMemo(() => {
    const preferredSkillName =
      skills?.find((skill) => skill.name === '龙卷雨击')?.name ||
      skills?.[0]?.name;
    const skillName = selectedSkillName || preferredSkillName;
    if (!skillName || experimentSeats.length === 0) {
      return null;
    }

    return {
      baseAttributes,
      combatStats,
      treasure,
      skillName,
      targetCount: selectedTargetCount,
      target: {
        name: combatTarget.name,
        magicDefense: combatTarget.magicDefense || 0,
        speed: combatTarget.speed || 0,
      },
      seats: experimentSeats.slice(0, 2).map((seat) => {
        const seatEquip = seat.isSample ? sampleEquipment : seat.equipment;
        const { totalPrice } = calculateEquipmentTotalStats(seatEquip);

        return {
          seatId: seat.id,
          seatName: getSeatDisplayName(seat, experimentSeats),
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
    selectedSkillName,
    skills,
    selectedTargetCount,
    combatTarget,
    experimentSeats,
    sampleEquipment,
  ]);

  useEffect(() => {
    if (!labValuationPayload) {
      setLabValuationBySeatId({});
      setLabValuationError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setIsLoadingLabValuation(true);
        setLabValuationError(null);
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
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error || '文件验证失败');
      return;
    }

    setIsProcessing(true);
    toast.info('正在识别...', {
      description: '图片会先上传到 R2，再交给 Gemini 解析',
    });

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
      toast.success(`${timeStr} 识别到新物品：${recognizedName}`);

      // 如果需要记录到全局日志，可以在这里添加，不过不再在当前组件内展示
      useGameStore.getState().addOcrLog({
        type: 'success',
        message: `${timeStr}，识别到新物品${recognizedName}`,
      });
    } catch (error) {
      const description =
        error instanceof Error ? error.message : '请重试或更换清晰图片';
      toast.error('识别失败', { description });
      useGameStore.getState().addOcrLog({
        type: 'error',
        message: '图片识别失败',
        details: description,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (files: FileList | null) => {
    if (files && files.length > 0) {
      processFile(files[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
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
            processFile(file);
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
      setSecondaryCategory(getDefaultSimulatorSecondaryCategory('equipment'));
    }
  }, [libTab]);

  // 切换一级分类时，自动选中第一个二级分类
  useEffect(() => {
    const firstSecondary =
      getDefaultSimulatorSecondaryCategory(primaryCategory);
    setSecondaryCategory(firstSecondary);
  }, [primaryCategory]);

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
            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center gap-1 rounded-lg border border-yellow-700/40 bg-slate-900/60 px-2.5 py-1.5 text-xs text-yellow-100 transition hover:border-yellow-500/70 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoadingLab || isLoadingCandidateEquipment}
                onClick={async () => {
                  await handleLoadLabSession();
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
              新品装备库 ({libraryEquipments.length})
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {libTab === 'pending' ? (
            <div className="relative flex h-full flex-col">
              <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto pr-2 pb-[72px]">
                {pendingList.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedPendingItem(item);
                      // 关闭新装备库弹窗
                      setSelectedLibEquip(null);
                    }}
                    className="cursor-pointer rounded-xl border border-yellow-800/40 bg-slate-900/60 p-2.5 transition-all hover:border-yellow-600/60 hover:bg-slate-900/80"
                  >
                    <div className="flex gap-3">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-yellow-800/30 bg-slate-950/50">
                        <img
                          src={
                            item.equipment.imageUrl ||
                            getEquipmentDefaultImage(item.equipment.type)
                          }
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
                ))}
                {pendingList.length === 0 && (
                  <div className="py-10 text-center text-sm text-slate-500">
                    暂无待确认装备
                  </div>
                )}
              </div>

              {/* 吸底上传区域 */}
              <div className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pt-3 pb-1">
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
                        正在识别...
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
                        点击/拖拽上传，支持直接粘贴
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              {/* 一��分类页签 */}
              <div className="mb-3 flex rounded-lg border border-yellow-800/30 bg-slate-900/60 p-1">
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
                      libraryEquipments.filter((equipment) =>
                        getSimulatorSlotDefinitions(cat.key).some((slot) =>
                          matchesSimulatorSlotDefinition(slot, equipment)
                        )
                      ).length
                    }
                    )
                  </button>
                ))}
              </div>

              {/* 二级分类页签 */}
              <div className="mb-3 flex flex-wrap gap-1.5">
                {(() => {
                  const secondaryCategories =
                    getSimulatorSlotDefinitions(primaryCategory);

                  return secondaryCategories.map((cat) => {
                    const count = libraryEquipments.filter((eq) =>
                      matchesSimulatorSlotDefinition(cat, eq)
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
                  });
                })()}
              </div>

              {/* 选择和删除按钮 */}
              <div className="mb-3 flex gap-2">
                {!isSelectionMode ? (
                  <button
                    onClick={() => setIsSelectionMode(true)}
                    className="rounded-lg border border-blue-600/40 bg-blue-600/20 px-3 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-600/30"
                  >
                    选择
                  </button>
                ) : (
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
                      删除{' '}
                      {selectedItemIds.length > 0 &&
                        `(${selectedItemIds.length})`}
                    </button>
                  </>
                )}
              </div>

              {/* 装备列表 */}
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  {(() => {
                    const currentSecondary = getSimulatorSlotDefinitions(
                      primaryCategory
                    ).find((category) => category.id === secondaryCategory);

                    if (!currentSecondary) return null;

                    const filtered = libraryEquipments.filter((eq) =>
                      matchesSimulatorSlotDefinition(currentSecondary, eq)
                    );

                    return filtered.map((item) => {
                      const totalPrice =
                        (item.price || 0) + (item.crossServerFee || 0);
                      const isSelected = selectedItemIds.includes(item.id);

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (isSelectionMode) {
                              // 选择模式：切换选中状态
                              setSelectedItemIds((prev) =>
                                prev.includes(item.id)
                                  ? prev.filter((id) => id !== item.id)
                                  : [...prev, item.id]
                              );
                            } else {
                              // 正常模式：显��详情
                              setSelectedLibEquip(item);
                              setSelectedPendingItem(null);
                            }
                          }}
                          className={`group relative flex cursor-pointer flex-col gap-1.5 overflow-hidden rounded-xl border bg-slate-900/60 p-3 shadow-sm transition-colors ${
                            isSelected
                              ? 'border-yellow-600 bg-yellow-900/20'
                              : 'border-yellow-800/40 hover:border-yellow-600/60'
                          }`}
                        >
                          {/* 选中状态指示器 */}
                          {isSelectionMode && (
                            <div
                              className={`absolute top-2 left-2 flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${
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

                          {/* 右上角总价标签 */}
                          <div className="absolute top-0 right-0 rounded-bl-lg border-b border-l border-yellow-700/50 bg-yellow-900/60 px-2 py-0.5">
                            <div className="mb-0.5 text-[10px] leading-none font-medium text-yellow-500/80">
                              总价
                            </div>
                            <div className="text-xs font-bold text-[#fff064]">
                              ¥ {formatPrice(totalPrice)}
                            </div>
                          </div>

                          <div
                            className={`${isSelectionMode ? 'ml-7' : ''} mb-2`}
                          >
                            <div className="h-14 w-14 overflow-hidden rounded-lg border border-yellow-800/30 bg-slate-950/50">
                              <img
                                src={
                                  item.imageUrl ||
                                  getEquipmentDefaultImage(item.type)
                                }
                                alt={item.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          </div>

                          <div
                            className={`truncate text-sm font-bold text-yellow-100 ${isSelectionMode ? 'pl-7' : ''} pr-16`}
                          >
                            {item.name}
                          </div>
                          <div
                            className={`mt-1 truncate text-xs text-slate-300 ${isSelectionMode ? 'pl-7' : ''}`}
                          >
                            {item.mainStat.split('\n')[0]}
                          </div>
                          {item.extraStat && (
                            <div
                              className={`truncate text-xs text-red-400 ${isSelectionMode ? 'pl-7' : ''}`}
                            >
                              {item.extraStat.split('\n')[0]}
                            </div>
                          )}
                          {item.highlights && item.highlights.length > 0 && (
                            <div
                              className={`mt-auto flex flex-wrap gap-1 ${isSelectionMode ? 'pl-7' : ''}`}
                            >
                              {item.highlights.slice(0, 2).map((hl, idx) => (
                                <span
                                  key={idx}
                                  className="rounded border border-red-500/50 px-1 text-[10px] text-red-400"
                                >
                                  {hl}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
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
                {combatTarget.name || '手动目标'}
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
            {compareSeatCount === 0 && (
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
          {experimentSeats.slice(0, 2).map((seat) => (
            <LaboratorySeatCard
              key={seat.id}
              seat={seat}
              experimentSeats={experimentSeats}
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
                  seatName: getSeatDisplayName(targetSeat, experimentSeats),
                  equipmentSetName,
                });
              }}
              onSelectSlot={setSelectedSlot}
              onClearDetailSelection={() => {
                setSelectedLibEquip(null);
                setSelectedPendingItem(null);
              }}
              baseAttributes={baseAttributes}
              treasure={treasure}
              baseSampleStats={baseSampleStats}
              seatLabValuation={labValuationBySeatId[seat.id]}
              labValuationError={labValuationError}
              isLoadingLabValuation={isLoadingLabValuation}
            />
          ))}

          <LaboratoryComparisonTable
            experimentSeats={experimentSeats}
            sampleEquipment={sampleEquipment}
            baseAttributes={baseAttributes}
            treasure={treasure}
            labValuationBySeatId={labValuationBySeatId}
            labValuationError={labValuationError}
            isLoadingLabValuation={isLoadingLabValuation}
          />
        </div>

        {selectedLibEquip && (
          <LaboratoryEquipmentDetailModal
            equipment={selectedLibEquip}
            experimentSeats={experimentSeats}
            formatPrice={formatPrice}
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
            onDelete={() => {
              removePendingEquipment(selectedPendingItem.id);
              void handleSaveCandidateEquipment(true);
              setSelectedPendingItem(null);
              toast.success('已删除装备');
            }}
            onConfirm={() => {
              confirmPendingEquipment(selectedPendingItem.id);
              void handleSaveCandidateEquipment(true);
              setSelectedPendingItem(null);
              toast.success('已确认入库');
            }}
            onReplaceToCurrentState={async () => {
              await handleReplaceCurrent(selectedPendingItem.equipment);
              confirmPendingEquipment(selectedPendingItem.id);
              void handleSaveCandidateEquipment(true);
              setSelectedPendingItem(null);
            }}
          />
        )}

        {/* 切换战队目标弹窗 */}
        {showTargetSelector && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="flex max-h-[80%] w-full max-w-md flex-col rounded-xl border border-yellow-800/60 bg-slate-900 shadow-2xl">
              <div className="flex items-center justify-between border-b border-yellow-800/30 p-4">
                <h3 className="flex items-center gap-2 font-bold text-yellow-100">
                  <Target className="h-4 w-4 text-yellow-500" /> 选择战队目标
                </h3>
                <button
                  onClick={() => setShowTargetSelector(false)}
                  className="text-slate-400 hover:text-slate-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* 技能和秒几选择器 */}
              <div className="space-y-3 border-b border-yellow-800/30 bg-slate-800/30 p-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-yellow-600">
                    技能选择
                  </label>
                  <select
                    id="target-skill-select"
                    name="target-skill-select"
                    value={selectedSkillName}
                    onChange={(e) => setSelectedSkillName(e.target.value)}
                    className="w-full rounded-lg border border-yellow-800/40 bg-slate-800 px-3 py-2 text-sm text-yellow-100 focus:border-yellow-600 focus:outline-none"
                  >
                    {skills.map((skill) => (
                      <option key={skill.name} value={skill.name}>
                        {skill.name} (Lv.{skill.level})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-yellow-600">
                    秒几
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        onClick={() => setSelectedTargetCount(num)}
                        className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                          selectedTargetCount === num
                            ? 'border border-yellow-500 bg-yellow-600 text-slate-900'
                            : 'border border-yellow-800/40 bg-slate-800 text-yellow-100 hover:border-yellow-600/60'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
                {/* 手动目标列表 */}
                {manualTargets.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-bold text-yellow-600">
                      手动目标
                    </div>
                    <div className="space-y-2">
                      {manualTargets.map((target) => (
                        <div
                          key={target.id}
                          onClick={() => {
                            updateCombatTarget({
                              templateId: undefined,
                              name: target.name,
                              defense: target.defense,
                              magicDefense: target.magicDefense,
                              speed: target.speed,
                              hp: target.hp,
                              level: 175,
                              dungeonName: undefined,
                            });
                            setShowTargetSelector(false);
                          }}
                          className={`cursor-pointer rounded-lg border bg-slate-800/80 p-3 transition-colors hover:bg-slate-700/80 ${
                            combatTarget.name === target.name &&
                            !combatTarget.dungeonName
                              ? 'border-yellow-600 bg-yellow-900/10'
                              : 'border-slate-700'
                          }`}
                        >
                          <div className="text-sm font-bold text-yellow-100">
                            {target.name}
                          </div>
                          <div className="mt-1.5 flex gap-4 text-xs text-slate-400">
                            <span>物防: {target.defense}</span>
                            <span>法防: {target.magicDefense}</span>
                            <span>气血: {target.hp}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 副本列表 */}
                <div>
                  <div className="mb-2 text-xs font-bold text-yellow-600">
                    副本
                  </div>
                  <div className="space-y-2">
                    {targetDungeons.map((dungeon) => (
                      <div key={dungeon.id} className="space-y-1">
                        <div className="rounded bg-slate-800/40 px-2 py-1 text-xs font-medium text-slate-400">
                          {dungeon.name} - {dungeon.description}
                        </div>
                        {dungeon.targets.map((target) => (
                          <div
                            key={target.id}
                            onClick={() => {
                              updateCombatTarget({
                                templateId: target.templateId || target.id,
                                name: target.name,
                                defense: target.defense,
                                magicDefense: target.magicDefense,
                                speed: target.speed || 0,
                                hp: target.hp,
                                level: target.level,
                                element: target.element,
                                formation: target.formation,
                                dungeonName: dungeon.name,
                              });
                              setShowTargetSelector(false);
                            }}
                            className={`ml-2 cursor-pointer rounded-lg border bg-slate-800/80 p-3 transition-colors hover:bg-slate-700/80 ${
                              combatTarget.name === target.name &&
                              combatTarget.dungeonName === dungeon.name
                                ? 'border-yellow-600 bg-yellow-900/10'
                                : 'border-slate-700'
                            }`}
                          >
                            <div className="flex justify-between text-sm font-bold text-yellow-100">
                              <span>{target.name}</span>
                              <span className="text-xs text-slate-500">
                                Lv.{target.level}
                              </span>
                            </div>
                            <div className="mt-1.5 flex gap-4 text-xs text-slate-400">
                              <span>物防: {target.defense}</span>
                              <span>法防: {target.magicDefense}</span>
                              <span>气血: {target.hp}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 删除确认弹窗 */}
        {deletingSeatId && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="w-72 rounded-xl border border-red-800/60 bg-slate-900 p-5 shadow-2xl">
              <h3 className="mb-2 text-center text-lg font-bold text-red-400">
                确认删除
              </h3>
              <p className="mb-6 text-center text-sm text-slate-300">
                您确定要删除这个对比席位吗？该操作无法撤。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingSeatId(null)}
                  className="flex-1 rounded-lg bg-slate-800 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    removeExperimentSeat(deletingSeatId);
                    setDeletingSeatId(null);
                  }}
                  className="flex-1 rounded-lg border border-red-600/50 bg-red-600/20 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-600/40"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 栏位选择器弹窗 */}
        {selectedSlot &&
          (() => {
            // 获取装备库中匹配的装备
            const availableEquipments = libraryEquipments.filter((eq) => {
              if (eq.type !== selectedSlot.slotType) return false;
              if (
                selectedSlot.slotSlot !== undefined &&
                eq.slot !== selectedSlot.slotSlot
              )
                return false;
              return true;
            });

            return (
              <div className="absolute inset-0 z-20 flex flex-col bg-slate-950/95 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-bold text-yellow-100">
                    选择装备 - {selectedSlot.slotLabel}
                  </h3>
                  <button
                    onClick={() => setSelectedSlot(null)}
                    className="text-sm text-yellow-400 hover:text-yellow-300"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="custom-scrollbar mb-4 flex-1 overflow-y-auto">
                  {/* 删除选项（如果当前有装备） */}
                  {selectedSlot.currentEquip && (
                    <div
                      onClick={() => {
                        removeExperimentSeatEquipment(
                          selectedSlot.seatId,
                          selectedSlot.slotType,
                          selectedSlot.slotSlot
                        );
                        setSelectedSlot(null);
                      }}
                      className="mb-2 cursor-pointer rounded-lg border border-red-600/40 bg-red-900/20 p-3 transition-all hover:border-red-600/60 hover:bg-red-900/30"
                    >
                      <div className="flex items-center gap-2">
                        <Trash2 className="h-4 w-4 text-red-400" />
                        <span className="text-sm font-medium text-red-400">
                          删除装备（恢复到"当前装备"）
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 装备列表 - 网格布局 */}
                  {availableEquipments.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {availableEquipments.map((equip) => {
                        const totalPrice =
                          (equip.price || 0) + (equip.crossServerFee || 0);
                        const isCurrentlyEquipped =
                          selectedSlot.currentEquip?.id === equip.id;

                        return (
                          <div
                            key={equip.id}
                            onClick={() => {
                              if (!isCurrentlyEquipped) {
                                updateExperimentSeatEquipment(
                                  selectedSlot.seatId,
                                  equip
                                );
                              }
                              setSelectedSlot(null);
                            }}
                            className={`rounded-lg border bg-slate-900/60 p-3 transition-all ${
                              isCurrentlyEquipped
                                ? 'border-green-600/60 bg-green-900/20'
                                : 'cursor-pointer border-yellow-800/40 hover:border-yellow-600/60 hover:bg-slate-900/80'
                            }`}
                          >
                            <div className="flex gap-3">
                              <EquipmentImage equipment={equip} size="md" />
                              <div className="min-w-0 flex-1">
                                <div className="mb-1 flex items-center gap-2">
                                  <span className="text-sm font-bold text-yellow-100">
                                    {equip.name}
                                  </span>
                                  {isCurrentlyEquipped && (
                                    <span className="rounded border border-green-600/50 bg-green-900/20 px-1.5 py-0.5 text-[10px] font-medium text-green-400">
                                      当前装备
                                    </span>
                                  )}
                                </div>

                                {equip.mainStat && (
                                  <div className="text-xs leading-snug text-slate-300">
                                    {equip.mainStat}
                                  </div>
                                )}

                                {equip.extraStat && (
                                  <div className="mt-0.5 text-xs leading-snug text-red-400">
                                    {equip.extraStat}
                                  </div>
                                )}

                                {equip.highlights &&
                                  equip.highlights.length > 0 && (
                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                      {equip.highlights.map((hl, j) => (
                                        <span
                                          key={j}
                                          className="rounded border border-red-500/50 px-1 py-0.5 text-[10px] text-red-400"
                                        >
                                          {hl}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                              </div>

                              <div className="shrink-0 text-right">
                                <div className="mb-0.5 text-[10px] text-slate-500">
                                  总价
                                </div>
                                <div className="text-sm font-bold text-[#fff064]">
                                  ¥ {formatPrice(totalPrice)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-500">
                      装备库中没有可用的{selectedSlot.slotLabel}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
      </div>

      {/* 批量删除确认对话框 */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="mx-4 w-full max-w-md rounded-xl border-2 border-red-600/60 bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-red-600/20">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="mb-1 text-lg font-bold text-red-400">
                  确认删除
                </h3>
                <p className="text-sm text-slate-300">
                  确定要删除选中的{' '}
                  <span className="font-bold text-red-400">
                    {selectedItemIds.length}
                  </span>{' '}
                  件装备吗？此操作无法撤销。
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 font-medium text-slate-300 transition-colors hover:bg-slate-700"
              >
                取消
              </button>
              <button
                onClick={() => {
                  selectedItemIds.forEach((id) => removePendingEquipment(id));
                  void handleSaveCandidateEquipment(true);
                  toast.success(`已删除 ${selectedItemIds.length} 件装备`);
                  setSelectedItemIds([]);
                  setIsSelectionMode(false);
                  setShowDeleteConfirm(false);
                }}
                className="flex-1 rounded-lg border border-red-500 bg-red-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-red-500"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 覆盖当前装备确认弹窗 */}
      <AnimatePresence>
        {confirmOverwriteDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setConfirmOverwriteDialog(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="mx-4 w-full max-w-md rounded-2xl border-2 border-yellow-600/60 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-yellow-600/20">
                  <Upload className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-1 text-lg font-bold text-yellow-100">
                    确认覆盖当前装备
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-300">
                    确认将{' '}
                    <span className="font-bold text-yellow-400">
                      {confirmOverwriteDialog.equipmentSetName}
                    </span>{' '}
                    的所有装备覆盖到【当前装备】吗？
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    此操作会将当前装备替换为对比席位中的装备配置
                  </p>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setConfirmOverwriteDialog(null)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 font-medium text-slate-300 transition-colors hover:bg-slate-700"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmOverwrite}
                  className="flex-1 rounded-lg border border-yellow-500 bg-yellow-600 px-4 py-2.5 font-medium text-slate-900 transition-colors hover:bg-yellow-500"
                >
                  确认覆盖
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
