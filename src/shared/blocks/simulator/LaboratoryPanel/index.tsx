// @ts-nocheck
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DUNGEON_DATABASE } from '@/features/simulator/store/gameData';
import { computeDerivedStats } from '@/features/simulator/store/gameLogic';
import { useGameStore } from '@/features/simulator/store/gameStore';
import type {
  Equipment,
  PendingEquipment,
} from '@/features/simulator/store/gameTypes';
import { validateImageFile } from '@/features/simulator/utils/fileValidation';
import { getEquipmentDefaultImage } from '@/features/simulator/utils/equipmentImage';
import { applySimulatorBundleToStore } from '@/features/simulator/utils/simulatorBundle';
import { applySimulatorCandidateEquipmentToStore } from '@/features/simulator/utils/simulatorCandidateEquipment';
import { applySimulatorLabSessionToStore } from '@/features/simulator/utils/simulatorLabSession';
import { buildDungeonDatabaseFromTemplates } from '@/features/simulator/utils/targetTemplates';
import {
  ChevronRight,
  Edit2,
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
import { usePopper } from 'react-popper';
import { toast } from 'sonner';

import { UploadPopover } from '@/shared/blocks/simulator/CharacterPanel/UploadPopover';
import { EquipmentImage } from '@/shared/blocks/simulator/EquipmentPanel/EquipmentImage';
import { getEquipmentRuneStoneSetInfo } from '@/shared/blocks/simulator/EquipmentPanel/RuneStoneHelper';

import { LibraryEquipmentCard } from './LibraryEquipmentCard';
import { PendingEquipmentCard } from './PendingEquipmentCard';
import { PendingEquipmentDetailModal } from './PendingEquipmentDetailModal';

// 简化的属性中文映射
const statNames: Record<string, string> = {
  hp: '气血',
  magic: '魔法',
  hit: '命中',
  damage: '伤害',
  magicDamage: '法伤',
  defense: '防御',
  magicDefense: '法防',
  speed: '速度',
  dodge: '躲避',
  physique: '体质',
  magicPower: '魔力',
  strength: '力量',
  endurance: '耐力',
  agility: '敏捷',
};

function toDisplayText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function getUniqueDisplayTexts(values: Array<unknown>) {
  return Array.from(
    new Set(values.map(toDisplayText).filter(Boolean))
  ) as string[];
}

function getEquipmentEffectTexts(
  equipments: Equipment[],
  options: {
    predicate?: (equipment: Equipment) => boolean;
    includeRuneSetName?: boolean;
    includeRuneSetEffect?: boolean;
    includeSetName?: boolean;
    includeSpecialEffect?: boolean;
    includeRefinementEffect?: boolean;
    includeExtraStat?: boolean;
    includeHighlights?: boolean;
  }
) {
  return getUniqueDisplayTexts(
    equipments.flatMap((equipment) => {
      if (options.predicate && !options.predicate(equipment)) {
        return [];
      }

      const values: Array<unknown> = [];

      if (options.includeRuneSetName) {
        values.push(...getEquipmentRuneStoneSetInfo([equipment]));
      }
      if (options.includeRuneSetEffect) {
        values.push(equipment.runeSetEffect);
      }
      if (options.includeSetName) {
        values.push(equipment.setName);
      }
      if (options.includeSpecialEffect) {
        values.push(equipment.specialEffect);
      }
      if (options.includeRefinementEffect) {
        values.push(equipment.refinementEffect);
      }
      if (options.includeExtraStat) {
        values.push(equipment.extraStat);
      }
      if (options.includeHighlights) {
        values.push(...(equipment.highlights ?? []));
      }

      return values;
    })
  );
}

function summarizeEquipmentEffects(
  equipments: Equipment[],
  options: Parameters<typeof getEquipmentEffectTexts>[1]
) {
  return getEquipmentEffectTexts(equipments, options).join(' / ');
}

const cloneRuneStoneSets = (equipment: Equipment): Equipment['runeStoneSets'] =>
  equipment.runeStoneSets?.map((set) =>
    set.map((runeStone) => ({
      ...runeStone,
      stats: { ...runeStone.stats },
    }))
  );

function cloneEquipmentForEditor(equipment: Equipment): Equipment {
  return {
    ...equipment,
    highlights: equipment.highlights ? [...equipment.highlights] : undefined,
    baseStats: { ...equipment.baseStats },
    stats: { ...equipment.stats },
    runeStoneSets: cloneRuneStoneSets(equipment),
    runeStoneSetsNames: equipment.runeStoneSetsNames
      ? [...equipment.runeStoneSetsNames]
      : undefined,
  };
}

const AVAILABLE_RUNES = [
  { id: '1', name: '红符石', type: 'red', stats: { damage: 1.5 } },
  { id: '1-2', name: '红符石(精)', type: 'red', stats: { damage: 2 } },
  { id: '2', name: '蓝符石', type: 'blue', stats: { speed: 1.5 } },
  { id: '2-2', name: '蓝符石(精)', type: 'blue', stats: { speed: 2 } },
  { id: '3', name: '绿符石', type: 'green', stats: { defense: 1.5 } },
  { id: '3-2', name: '绿符石(精)', type: 'green', stats: { defense: 2 } },
  { id: '4', name: '黄符石', type: 'yellow', stats: { hit: 2 } },
  { id: '4-2', name: '黄符石(精)', type: 'yellow', stats: { hit: 3 } },
  { id: '5', name: '白符石', type: 'white', stats: { magic: 2 } },
  { id: '6', name: '黑符石', type: 'black', stats: { magicDamage: 1.5 } },
  { id: '7', name: '紫符石', type: 'purple', stats: { dodge: 2 } },
];

const AVAILABLE_STAR_POSITIONS = [
  '无',
  '伤害 +2.5',
  '气血 +10',
  '速度 +1.5',
  '防御 +2',
  '法伤 +2.5',
  '躲避 +2',
];
const AVAILABLE_STAR_ALIGNMENTS = [
  '无',
  '体质 +2',
  '魔力 +2',
  '力量 +2',
  '耐力 +2',
  '敏捷 +2',
];

// 可选的符石组合名称
const AVAILABLE_RUNE_SETS = [
  '全能',
  '法门',
  '逐兽',
  '聚焦',
  '仙骨',
  '药香',
  '心印',
  '招云',
  '腾蛟',
];

const AVAILABLE_GEMSTONES = [
  '红玛瑙',
  '太阳石',
  '月亮石',
  '黑宝石',
  '舍利子',
  '光芒石',
  '翡翠石',
  '神秘石',
];

const CATEGORIES = [
  {
    name: '装备',
    slots: [
      { id: 'weapon', label: '武器', type: 'weapon' },
      { id: 'helmet', label: '头盔', type: 'helmet' },
      { id: 'necklace', label: '项链', type: 'necklace' },
      { id: 'armor', label: '衣服', type: 'armor' },
      { id: 'belt', label: '腰带', type: 'belt' },
      { id: 'shoes', label: '鞋子', type: 'shoes' },
    ],
  },
  {
    name: '灵饰',
    slots: [
      { id: 'trinket1', label: '戒指', type: 'trinket', slot: 1 },
      { id: 'trinket2', label: '耳饰', type: 'trinket', slot: 2 },
      { id: 'trinket3', label: '手镯', type: 'trinket', slot: 3 },
      { id: 'trinket4', label: '佩饰', type: 'trinket', slot: 4 },
    ],
  },
  {
    name: '玉魄',
    slots: [
      { id: 'jade1', label: '阳玉', type: 'jade', slot: 1 },
      { id: 'jade2', label: '阴玉', type: 'jade', slot: 2 },
    ],
  },
];

function calculateEquipmentTotalStats(equipments: Equipment[]) {
  const totals: Record<string, number> = {};
  let totalPrice = 0;

  equipments.forEach((eq) => {
    if (eq.price) totalPrice += eq.price;

    // 基础属性
    Object.entries(eq.stats || {}).forEach(([key, val]) => {
      if (typeof val === 'number') {
        totals[key] = (totals[key] || 0) + val;
      }
    });

    // 叠加激活的符石属性
    if (eq.runeStoneSets && eq.activeRuneStoneSet !== undefined) {
      const activeSet = eq.runeStoneSets[eq.activeRuneStoneSet];
      if (activeSet) {
        activeSet.forEach((rs) => {
          Object.entries(rs.stats || {}).forEach(([key, val]) => {
            if (typeof val === 'number') {
              totals[key] = (totals[key] || 0) + val;
            }
          });
        });
      }
    }
  });

  return { totals, totalPrice };
}

// 计算席位的显示名称
function getSeatDisplayName(seat: any, allSeats: any[]) {
  if (seat.isSample) {
    return seat.name;
  }
  const comparisonSeats = allSeats.filter((s) => !s.isSample);
  const index = comparisonSeats.findIndex((s) => s.id === seat.id);
  return `对比席位${index + 1}`;
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
    slotType: string;
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
  const [isSavingCandidateEquipment, setIsSavingCandidateEquipment] =
    useState(false);
  const [isLoadingCandidateEquipment, setIsLoadingCandidateEquipment] =
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
  const selectedDungeonIds = useGameStore((state) => state.selectedDungeonIds);
  const updateCombatTarget = useGameStore((state) => state.updateCombatTarget);
  const manualTargets = useGameStore((state) => state.manualTargets);
  const skills = useGameStore((state) => state.skills);

  // 样本席位装备组合选择
  const [selectedSampleSetIndex, setSelectedSampleSetIndex] = useState(0);

  // 战队目标选择器中的技能和秒几选项
  const [selectedSkillName, setSelectedSkillName] = useState<string>('');
  const [selectedTargetCount, setSelectedTargetCount] = useState<number>(1);
  const [targetDungeons, setTargetDungeons] = useState(DUNGEON_DATABASE);

  // 确认弹窗状态 - 用于覆盖当前装备
  const [confirmOverwriteDialog, setConfirmOverwriteDialog] = useState<{
    seatId: string;
    seatName: string;
    equipmentSetName: string;
  } | null>(null);

  // 初始化技能选择
  useEffect(() => {
    if (skills && skills.length > 0 && !selectedSkillName) {
      setSelectedSkillName(skills[0].name);
    }
  }, [skills, selectedSkillName]);

  useEffect(() => {
    let cancelled = false;

    const loadTemplates = async () => {
      try {
        const response = await fetch('/api/simulator/target-templates', {
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
      } catch {
        // Keep local fallback data when remote templates are unavailable.
      }
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
    successMessage: string
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
        }),
      });

      const payload = await response.json();
      if (!response.ok || payload?.code !== 0 || !payload?.data) {
        throw new Error(payload?.message || '保存当前装备失败');
      }

      applySimulatorBundleToStore(payload.data, {
        preserveWorkbenchState: true,
      });
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
      `已将 ${equipment.name} 同步到当前装备`
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
      `已成功应用 ${confirmOverwriteDialog.equipmentSetName} 到当前装备`
    );

    if (didSave) {
      setConfirmOverwriteDialog(null);
    }
  };

  // 基础样本数据
  const baseSampleStats = useMemo(
    () => calculateEquipmentTotalStats(currentEquipment),
    [currentEquipment]
  );

  const [simulatedLibEquip, setSimulatedLibEquip] = useState<any>(null);

  // 符石和星石编辑相关状态
  const [runePopover, setRunePopover] = useState<{
    type:
      | 'rune'
      | 'starPosition'
      | 'starAlignment'
      | 'luckyHoles'
      | 'runeSet'
      | 'gemstone';
    index?: number;
  } | null>(null);

  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(
    null
  );
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null);
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: 'bottom-start',
    strategy: 'fixed',
    modifiers: [
      { name: 'preventOverflow', options: { padding: 8 } },
      {
        name: 'flip',
        options: {
          fallbackPlacements: ['top-start', 'right-start', 'left-start'],
        },
      },
      { name: 'offset', options: { offset: [0, 4] } },
    ],
  });

  useEffect(() => {
    if (!selectedLibEquip) {
      setSimulatedLibEquip(null);
      return;
    }

    setSimulatedLibEquip(cloneEquipmentForEditor(selectedLibEquip));
  }, [selectedLibEquip]);

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
      const configResponse = await fetch(
        '/api/simulator/current/ocr/config',
        {
          method: 'GET',
          cache: 'no-store',
        }
      );
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
      setSecondaryCategory('weapon');
    }
  }, [libTab]);

  // 切换一级分类时，自动选中第一个二级分类
  useEffect(() => {
    const firstSecondary = (() => {
      if (primaryCategory === 'equipment') return 'weapon';
      if (primaryCategory === 'trinket') return 'ring';
      if (primaryCategory === 'jade') return 'jade1';
      return 'weapon';
    })();
    setSecondaryCategory(firstSecondary);
  }, [primaryCategory]);

  useEffect(() => {
    void handleLoadLabSession(true);
    void handleLoadCandidateEquipment(true);
  }, []);

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
                {[
                  {
                    key: 'equipment' as const,
                    name: '装备',
                    count: libraryEquipments.filter((e) =>
                      [
                        'weapon',
                        'helmet',
                        'necklace',
                        'armor',
                        'belt',
                        'shoes',
                      ].includes(e.type)
                    ).length,
                  },
                  {
                    key: 'trinket' as const,
                    name: '灵饰',
                    count: libraryEquipments.filter((e) => e.type === 'trinket')
                      .length,
                  },
                  {
                    key: 'jade' as const,
                    name: '玉魄',
                    count: libraryEquipments.filter((e) => e.type === 'jade')
                      .length,
                  },
                ].map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => setPrimaryCategory(cat.key)}
                    className={`flex-1 rounded-md py-1.5 text-xs transition-colors ${
                      primaryCategory === cat.key
                        ? 'bg-yellow-600 font-bold text-slate-900'
                        : 'text-yellow-100/60 hover:text-yellow-100'
                    }`}
                  >
                    {cat.name} ({cat.count})
                  </button>
                ))}
              </div>

              {/* 二级分类页签 */}
              <div className="mb-3 flex flex-wrap gap-1.5">
                {(() => {
                  const secondaryCategories =
                    primaryCategory === 'equipment'
                      ? [
                          { id: 'weapon', name: '武器', type: 'weapon' },
                          { id: 'helmet', name: '头盔', type: 'helmet' },
                          { id: 'necklace', name: '项链', type: 'necklace' },
                          { id: 'armor', name: '衣服', type: 'armor' },
                          { id: 'belt', name: '腰带', type: 'belt' },
                          { id: 'shoes', name: '鞋子', type: 'shoes' },
                        ]
                      : primaryCategory === 'trinket'
                        ? [
                            {
                              id: 'ring',
                              name: '戒指',
                              type: 'trinket',
                              slot: 1,
                            },
                            {
                              id: 'earring',
                              name: '耳饰',
                              type: 'trinket',
                              slot: 2,
                            },
                            {
                              id: 'bracelet',
                              name: '手镯',
                              type: 'trinket',
                              slot: 3,
                            },
                            {
                              id: 'pendant',
                              name: '佩饰',
                              type: 'trinket',
                              slot: 4,
                            },
                          ]
                        : [
                            {
                              id: 'jade1',
                              name: '阳玉',
                              type: 'jade',
                              slot: 1,
                            },
                            {
                              id: 'jade2',
                              name: '阴玉',
                              type: 'jade',
                              slot: 2,
                            },
                          ];

                  return secondaryCategories.map((cat) => {
                    const count = libraryEquipments.filter((eq) => {
                      if (eq.type !== cat.type) return false;
                      if (
                        'slot' in cat &&
                        cat.slot !== undefined &&
                        eq.slot !== cat.slot
                      )
                        return false;
                      return true;
                    }).length;

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
                        {cat.name} ({count})
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
                    const currentSecondary = (() => {
                      if (primaryCategory === 'equipment') {
                        return [
                          { id: 'weapon', type: 'weapon' },
                          { id: 'helmet', type: 'helmet' },
                          { id: 'necklace', type: 'necklace' },
                          { id: 'armor', type: 'armor' },
                          { id: 'belt', type: 'belt' },
                          { id: 'shoes', type: 'shoes' },
                        ].find((c) => c.id === secondaryCategory);
                      } else if (primaryCategory === 'trinket') {
                        return [
                          { id: 'ring', type: 'trinket', slot: 1 },
                          { id: 'earring', type: 'trinket', slot: 2 },
                          { id: 'bracelet', type: 'trinket', slot: 3 },
                          { id: 'pendant', type: 'trinket', slot: 4 },
                        ].find((c) => c.id === secondaryCategory);
                      } else {
                        return [
                          { id: 'jade1', type: 'jade', slot: 1 },
                          { id: 'jade2', type: 'jade', slot: 2 },
                        ].find((c) => c.id === secondaryCategory);
                      }
                    })();

                    if (!currentSecondary) return null;

                    const filtered = libraryEquipments.filter((eq) => {
                      if (eq.type !== currentSecondary.type) return false;
                      if (
                        'slot' in currentSecondary &&
                        currentSecondary.slot !== undefined &&
                        eq.slot !== currentSecondary.slot
                      )
                        return false;
                      return true;
                    });

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
          </div>
        </div>

        <div className="flex flex-1 gap-4 overflow-hidden p-4">
          {/* 三个模块并排展示 */}
          {experimentSeats.slice(0, 2).map((seat) => {
            // 样本席位使用选中的装备组合，对比席位使用自己的装备
            const sampleEquipment =
              equipmentSets[selectedSampleSetIndex]?.items || currentEquipment;
            const seatEquip = seat.isSample ? sampleEquipment : seat.equipment;
            const { totals, totalPrice } =
              calculateEquipmentTotalStats(seatEquip);
            const seatCombatStats = computeDerivedStats(
              baseAttributes,
              seatEquip,
              treasure
            );
            const baseCombatStats = computeDerivedStats(
              baseAttributes,
              sampleEquipment,
              treasure
            );

            const seatRuneSets = getEquipmentRuneStoneSetInfo(seatEquip);
            const baseRuneSets = getEquipmentRuneStoneSetInfo(sampleEquipment);

            // 找出变化的符石套装（假设只关注第一个变化的）
            const addedSets = seatRuneSets.filter(
              (s) => !baseRuneSets.includes(s)
            );
            const removedSets = baseRuneSets.filter(
              (s) => !seatRuneSets.includes(s)
            );

            let seatRuneStoneInfo = seatRuneSets[0] || '';
            if (!seat.isSample && addedSets.length > 0) {
              seatRuneStoneInfo = addedSets[0];
            }

            let runeStoneChange = '';
            if (!seat.isSample) {
              if (addedSets.length > 0 && removedSets.length > 0) {
                runeStoneChange = `${removedSets[0]} → ${addedSets[0]}`;
              } else if (addedSets.length > 0) {
                runeStoneChange = `新增: ${addedSets[0]}`;
              } else if (removedSets.length > 0) {
                runeStoneChange = `移除: ${removedSets[0]}`;
              }
            }

            // 计算 Diff
            const diffs: Record<string, number> = {};
            const combatDiffs: Record<string, number> = {};
            let totalDamageDiff = 0;
            let diffPrice = 0;

            if (!seat.isSample) {
              // 基础装备属性差异（展示用）
              Object.keys(totals).forEach((k) => {
                const diff = totals[k] - (baseSampleStats.totals[k] || 0);
                if (Math.abs(diff) > 0.01) diffs[k] = diff;
              });
              Object.keys(baseSampleStats.totals).forEach((k) => {
                if (!(k in totals)) {
                  diffs[k] = -(baseSampleStats.totals[k] || 0);
                }
              });

              // 实际战斗属性差异
              Object.keys(seatCombatStats).forEach((k) => {
                const key = k as keyof typeof seatCombatStats;
                const diff = seatCombatStats[key] - baseCombatStats[key];
                if (Math.abs(diff) > 0.01) combatDiffs[key] = diff;
              });

              // 伤害提升计算：根据门派决定主属性
              const isMagicFaction = ['龙宫', '魔王寨', '神木林'].includes(
                baseAttributes.faction
              );
              totalDamageDiff = isMagicFaction
                ? combatDiffs.magicDamage || 0
                : combatDiffs.damage || 0;

              diffPrice = totalPrice - baseSampleStats.totalPrice;
            }

            const displayDiffs = { ...combatDiffs };
            // 额外展示基础属性变化
            Object.keys(diffs).forEach((k) => {
              if (!(k in combatDiffs)) {
                displayDiffs[k] = diffs[k];
              }
            });

            let costPerDamageDisplay = '-';
            if (totalDamageDiff > 0) {
              if (diffPrice > 0) {
                costPerDamageDisplay = `¥ ${(diffPrice / totalDamageDiff).toFixed(1)}`;
              } else {
                costPerDamageDisplay = '收益'; // 提升了伤害且没多花钱
              }
            } else if (totalDamageDiff < 0) {
              if (diffPrice < 0) {
                costPerDamageDisplay = `省 ¥ ${Math.abs(diffPrice / totalDamageDiff).toFixed(1)}`; // 降低伤害但省钱
              } else {
                costPerDamageDisplay = '纯亏'; // 降低伤害且多花钱
              }
            } else {
              costPerDamageDisplay =
                diffPrice > 0 ? '只花钱不提升' : diffPrice < 0 ? '纯省钱' : '-';
            }

            return (
              <div
                key={seat.id}
                className="flex h-full flex-1 flex-col overflow-hidden rounded-xl border border-yellow-800/40 bg-slate-900/60 p-4"
              >
                {/* 顶部：席位标题（固定） */}
                <div className="mb-3 flex flex-shrink-0 items-center justify-between border-b border-yellow-800/30 pb-2">
                  <div className="flex items-center gap-2">
                    <h3
                      className={`text-sm font-bold ${seat.isSample ? 'text-yellow-500' : 'text-yellow-100'}`}
                    >
                      {getSeatDisplayName(seat, experimentSeats)}
                    </h3>
                    {seat.isSample && (
                      <select
                        id={`sample-seat-set-${seat.id}`}
                        name={`sample-seat-set-${seat.id}`}
                        value={selectedSampleSetIndex}
                        onChange={(e) =>
                          setSelectedSampleSetIndex(Number(e.target.value))
                        }
                        className="cursor-pointer rounded border border-yellow-700/40 bg-slate-800/80 px-2 py-0.5 text-xs text-yellow-100 focus:ring-1 focus:ring-yellow-600/50 focus:outline-none"
                      >
                        {equipmentSets.map((set, index) => (
                          <option key={set.id} value={index}>
                            {set.name || `装备组合 ${index + 1}`}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!seat.isSample && (
                      <button
                        onClick={() => {
                          const equipmentSetName =
                            equipmentSets[selectedSampleSetIndex]?.name ||
                            `装备组合 ${selectedSampleSetIndex + 1}`;
                          setConfirmOverwriteDialog({
                            seatId: seat.id,
                            seatName: getSeatDisplayName(seat, experimentSeats),
                            equipmentSetName,
                          });
                        }}
                        className="flex items-center gap-1 rounded border border-yellow-600/40 bg-yellow-600/20 px-2 py-1 text-xs font-medium text-yellow-400 transition-colors hover:bg-yellow-600/30 hover:text-yellow-300"
                        title="将此席位装备应用到当前装备"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span>应用</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 中间：可滚动区域（装备列表 + 符石套装效果 + 属性变化） */}
                <div className="custom-scrollbar mb-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
                  {/* 装备列表区 */}
                  <div className="space-y-4">
                    {CATEGORIES.map((category) => {
                      // 检查此分类下在当前对比席位是否有任何装备需要展示
                      return (
                        <div key={category.name} className="space-y-2">
                          <div className="mb-2 border-b border-yellow-800/30 pb-1 text-xs font-bold text-yellow-600">
                            {category.name}
                          </div>
                          <div className="space-y-2">
                            {category.slots.map((slotDef) => {
                              const eq = seatEquip.find(
                                (e) =>
                                  e.type === slotDef.type &&
                                  (slotDef.slot === undefined ||
                                    e.slot === slotDef.slot)
                              );
                              const currentEq = sampleEquipment.find(
                                (e) =>
                                  e.type === slotDef.type &&
                                  (slotDef.slot === undefined ||
                                    e.slot === slotDef.slot)
                              );

                              // 逻辑：
                              // 1. 如果是对比席位（非样本），且与“当前装备”完全一致（ID相同，或者都为空）
                              const isSameAsCurrent =
                                !seat.isSample &&
                                ((!eq && !currentEq) ||
                                  (eq && currentEq && eq.id === currentEq.id));

                              if (isSameAsCurrent) {
                                return (
                                  <div
                                    key={slotDef.id}
                                    onClick={() => {
                                      if (!seat.isSample) {
                                        setSelectedSlot({
                                          seatId: seat.id,
                                          slotType: slotDef.type,
                                          slotSlot: slotDef.slot,
                                          slotLabel: slotDef.label,
                                          currentEquip: currentEq,
                                        });
                                        // 关闭其他弹窗
                                        setSelectedLibEquip(null);
                                        setSelectedPendingItem(null);
                                      }
                                    }}
                                    className={`flex items-center gap-2 rounded-lg border border-slate-800/50 bg-slate-900/40 p-2.5 text-xs shadow-sm ${!seat.isSample ? 'cursor-pointer transition-all hover:border-yellow-600/40 hover:bg-slate-900/60' : ''}`}
                                  >
                                    <span className="w-10 shrink-0 border-r border-slate-700/50 pr-2 text-right text-slate-500">
                                      {slotDef.label}
                                    </span>
                                    <span className="font-medium tracking-wide text-slate-400">
                                      当前装备
                                    </span>
                                  </div>
                                );
                              }

                              if (!eq) {
                                return (
                                  <div
                                    key={slotDef.id}
                                    onClick={() => {
                                      if (!seat.isSample) {
                                        setSelectedSlot({
                                          seatId: seat.id,
                                          slotType: slotDef.type,
                                          slotSlot: slotDef.slot,
                                          slotLabel: slotDef.label,
                                        });
                                        // 关闭其他弹窗
                                        setSelectedLibEquip(null);
                                        setSelectedPendingItem(null);
                                      }
                                    }}
                                    className={`flex items-center gap-2 rounded-lg border border-slate-800/50 bg-slate-900/40 p-2.5 text-xs shadow-sm ${!seat.isSample ? 'cursor-pointer transition-all hover:border-yellow-600/40 hover:bg-slate-900/60' : ''}`}
                                  >
                                    <span className="w-10 shrink-0 border-r border-slate-700/50 pr-2 text-right text-slate-500">
                                      {slotDef.label}
                                    </span>
                                    <span className="text-slate-600 italic">
                                      空
                                    </span>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={slotDef.id}
                                  onClick={() => {
                                    if (!seat.isSample) {
                                      setSelectedSlot({
                                        seatId: seat.id,
                                        slotType: slotDef.type,
                                        slotSlot: slotDef.slot,
                                        slotLabel: slotDef.label,
                                        currentEquip: eq,
                                      });
                                      // 关闭其他弹窗
                                      setSelectedLibEquip(null);
                                      setSelectedPendingItem(null);
                                    }
                                  }}
                                  className={`flex rounded-lg border border-slate-700/80 bg-slate-800/80 p-2.5 text-xs shadow-sm ${!seat.isSample ? 'cursor-pointer transition-all hover:border-yellow-600/60 hover:bg-slate-800' : ''}`}
                                >
                                  <span className="mt-0.5 w-10 shrink-0 border-r border-slate-700/50 pr-2 text-right text-slate-400">
                                    {slotDef.label}
                                  </span>
                                  <div className="ml-2 h-8 w-8 shrink-0 overflow-hidden rounded border border-slate-700/50 bg-slate-950/50">
                                    <img
                                      src={
                                        eq.imageUrl ||
                                        getEquipmentDefaultImage(eq.type)
                                      }
                                      alt={eq.name}
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                  <div className="min-w-0 flex-1 pl-2">
                                    <div className="flex items-start justify-between">
                                      <span className="truncate text-sm font-bold text-yellow-100">
                                        {eq.name}
                                      </span>
                                      {eq.price ? (
                                        <span className="ml-2 shrink-0 font-bold text-[#fff064]">
                                          ¥ {eq.price}
                                        </span>
                                      ) : null}
                                    </div>

                                    {eq.mainStat && (
                                      <div className="mt-1 leading-snug break-all whitespace-pre-line text-slate-300">
                                        {eq.mainStat}
                                      </div>
                                    )}

                                    {eq.extraStat && (
                                      <div className="mt-1 leading-snug break-all whitespace-pre-line text-red-400">
                                        {eq.extraStat}
                                      </div>
                                    )}

                                    {eq.highlights &&
                                      eq.highlights.length > 0 && (
                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                          {eq.highlights.map((hl, j) => (
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
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 符石套装效果区域 */}
                  {seatRuneStoneInfo && (
                    <div className="rounded-lg bg-slate-950/40 p-3">
                      <div className="mb-2 text-xs font-bold text-yellow-400">
                        符石套装效果
                      </div>
                      <div className="text-xs leading-relaxed text-slate-300">
                        {seatRuneStoneInfo || '无套装'}
                      </div>
                    </div>
                  )}

                  {/* 属性对比区域（不含核心伤害提升） */}
                  <div className="rounded-lg bg-slate-950/40 p-3">
                    <div className="mb-2 text-xs font-bold text-yellow-400">
                      属性及伤害变化
                    </div>
                    {seat.isSample ? (
                      <div className="py-4 text-center text-xs text-slate-500 italic">
                        样本席位，作为对比基准
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                          {Object.entries(displayDiffs).map(([k, v]) => {
                            const isPositive = v > 0;
                            return (
                              <div
                                key={k}
                                className="flex justify-between text-xs"
                              >
                                <span className="text-slate-400">
                                  {statNames[k] || k}:
                                </span>
                                <span
                                  className={
                                    isPositive
                                      ? 'text-green-400'
                                      : 'text-red-400'
                                  }
                                >
                                  {isPositive ? '+' : ''}
                                  {Math.round(v)}
                                </span>
                              </div>
                            );
                          })}
                          {Object.keys(displayDiffs).length === 0 && (
                            <div className="col-span-2 text-xs text-slate-500 italic">
                              无属性变化
                            </div>
                          )}
                        </div>

                        {/* 符石套装变化 */}
                        {runeStoneChange && (
                          <div className="mt-3 border-t border-yellow-800/30 pt-2">
                            <div className="mb-1.5 text-xs font-bold text-yellow-400">
                              符石套装变化
                            </div>
                            <div className="text-xs text-cyan-400">
                              {runeStoneChange}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 底部：核心伤害提升（固定） */}
                <div className="flex-shrink-0 rounded-lg border-t border-yellow-800/30 bg-slate-950/60 p-3">
                  {seat.isSample ? (
                    <div className="text-center text-xs text-slate-500 italic">
                      当前基准
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-yellow-100">核心伤害提升:</span>
                        <span
                          className={
                            totalDamageDiff > 0
                              ? 'text-green-400'
                              : totalDamageDiff < 0
                                ? 'text-red-400'
                                : 'text-slate-400'
                          }
                        >
                          {totalDamageDiff > 0 ? '+' : ''}
                          {Math.round(totalDamageDiff)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">差价成本:</span>
                        <span className="text-yellow-400">
                          ¥{' '}
                          {diffPrice > 0
                            ? `+${Number(diffPrice.toFixed(2))}`
                            : Number(diffPrice.toFixed(2))}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">单点伤害成本:</span>
                        <span className="text-yellow-400">
                          {costPerDamageDisplay}
                          {costPerDamageDisplay.includes('¥') ? ' / 点' : ''}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* 第三列：明细属性对比 */}
          <div className="flex-1 overflow-auto rounded-xl border border-yellow-800/40 bg-slate-900/60 p-4">
            {(() => {
              // 准备两个席位的对比数据
              const sampleEquipment =
                equipmentSets[selectedSampleSetIndex]?.items ||
                currentEquipment;
              const displaySeats = experimentSeats.slice(0, 2);

              const allSeatsData = displaySeats.map((seat) => {
                const seatEquip = seat.isSample
                  ? sampleEquipment
                  : seat.equipment;
                const { totals, totalPrice } =
                  calculateEquipmentTotalStats(seatEquip);
                const seatCombatStats = computeDerivedStats(
                  baseAttributes,
                  seatEquip,
                  treasure
                );

                return {
                  seat,
                  seatEquip,
                  totals,
                  totalPrice,
                  seatCombatStats,
                };
              });

              // 属性列表 - 与"固定属性"页签对齐
              const attributeList = [
                // 五围属性
                { key: 'physique', label: '体质', isBase: true },
                { key: 'magic', label: '魔力', isBase: true },
                { key: 'strength', label: '力量', isBase: true },
                { key: 'endurance', label: '耐力', isBase: true },
                { key: 'agility', label: '敏捷', isBase: true },
                // 攻击属性
                { key: 'magicDamage', label: '法术伤害', isBase: false },
                { key: 'spiritualPower', label: '灵力', isBase: false },
                { key: 'magicCritLevel', label: '法术暴击等级', isBase: false },
                { key: 'speed', label: '速度', isBase: false },
                { key: 'hit', label: '命中', isBase: false },
                { key: 'fixedDamage', label: '固定伤害', isBase: false },
                { key: 'pierceLevel', label: '穿刺等级', isBase: false },
                {
                  key: 'elementalMastery',
                  label: '五行克制能力',
                  isBase: false,
                },
                // 防御属性
                { key: 'hp', label: '气血', isBase: false },
                { key: 'magicDefense', label: '法术防御', isBase: false },
                { key: 'defense', label: '物理防御', isBase: false },
                { key: 'block', label: '格挡值', isBase: false },
                { key: 'antiCritLevel', label: '抗暴击等级', isBase: false },
                {
                  key: 'sealResistLevel',
                  label: '抵抗封印等级',
                  isBase: false,
                },
                { key: 'dodge', label: '躲避', isBase: false },
                {
                  key: 'elementalResistance',
                  label: '五行克制抵御能力',
                  isBase: false,
                },
              ];

              return (
                <div className="flex h-full flex-col space-y-4">
                  <h3 className="flex-shrink-0 text-sm font-bold text-yellow-400">
                    明细属性对比
                  </h3>

                  {/* 属性对比表 */}
                  <div className="flex-1 overflow-auto rounded-lg border border-yellow-800/30 bg-slate-900/40">
                    <table className="w-full border-collapse text-xs">
                      <thead className="sticky top-0">
                        <tr className="bg-slate-800/80">
                          <th className="w-24 border-r border-yellow-800/30 p-2.5 text-left text-xs font-bold text-yellow-400">
                            属性
                          </th>
                          {allSeatsData.map(({ seat }) => (
                            <th
                              key={seat.id}
                              className={`p-2.5 text-center text-xs font-bold ${seat.isSample ? 'text-yellow-500' : 'text-yellow-100'}`}
                            >
                              {getSeatDisplayName(seat, experimentSeats)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {attributeList.map((attr) => {
                          const sampleValue = attr.isBase
                            ? baseAttributes[
                                attr.key as keyof typeof baseAttributes
                              ] + (allSeatsData[0].totals[attr.key] || 0)
                            : allSeatsData[0].seatCombatStats[
                                attr.key as keyof (typeof allSeatsData)[0]['seatCombatStats']
                              ] || 0;

                          return (
                            <tr
                              key={attr.key}
                              className="border-b border-yellow-800/10 hover:bg-slate-800/20"
                            >
                              <td className="border-r border-yellow-800/20 p-2.5 text-xs font-medium text-slate-300">
                                {attr.label}
                              </td>
                              {allSeatsData.map(
                                ({ seat, totals, seatCombatStats }, idx) => {
                                  const currentValue = attr.isBase
                                    ? baseAttributes[
                                        attr.key as keyof typeof baseAttributes
                                      ] + (totals[attr.key] || 0)
                                    : seatCombatStats[
                                        attr.key as keyof typeof seatCombatStats
                                      ] || 0;

                                  const diff =
                                    idx === 0 ? 0 : currentValue - sampleValue;
                                  const isUnchanged = diff === 0 && idx !== 0;
                                  const isPositive = diff > 0;
                                  const isNegative = diff < 0;

                                  return (
                                    <td
                                      key={seat.id}
                                      className="p-2.5 text-center text-xs"
                                    >
                                      {isUnchanged ? (
                                        <span className="text-slate-500">
                                          —
                                        </span>
                                      ) : (
                                        <div className="flex flex-col items-center gap-0.5">
                                          <div
                                            className={
                                              seat.isSample
                                                ? 'font-bold text-yellow-100'
                                                : 'text-slate-200'
                                            }
                                          >
                                            {Math.round(currentValue)}
                                          </div>
                                          {idx !== 0 && !isUnchanged && (
                                            <div
                                              className={`text-[10px] font-medium ${isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-slate-500'}`}
                                            >
                                              {isPositive ? '+' : ''}
                                              {Math.round(diff)}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                  );
                                }
                              )}
                            </tr>
                          );
                        })}

                        {/* 分隔行 */}
                        <tr className="bg-slate-800/60">
                          <td
                            colSpan={allSeatsData.length + 1}
                            className="p-0"
                          ></td>
                        </tr>

                        {/* 符石组合对比 - 按装备栏位分别展示 */}
                        {(() => {
                          const slotLabels = [
                            { type: 'weapon', label: '武器' },
                            { type: 'helmet', label: '头盔' },
                            { type: 'armor', label: '衣服' },
                            { type: 'belt', label: '腰带' },
                            { type: 'shoes', label: '鞋子' },
                          ];

                          return slotLabels.map(({ type, label }) => (
                            <tr
                              key={type}
                              className="border-b border-yellow-800/10 hover:bg-slate-800/20"
                            >
                              <td className="border-r border-yellow-800/20 p-2.5 text-xs font-medium text-slate-300">
                                {label}符石
                              </td>
                              {allSeatsData.map(({ seat, seatEquip }, idx) => {
                                const equipment = seatEquip.find(
                                  (eq) => eq.type === type
                                );
                                const runeSetName =
                                  equipment?.runeStoneSetsNames?.[0];

                                const sampleEquipment =
                                  allSeatsData[0].seatEquip.find(
                                    (eq) => eq.type === type
                                  );
                                const sampleRuneSetName =
                                  sampleEquipment?.runeStoneSetsNames?.[0];
                                const isDifferent =
                                  idx !== 0 &&
                                  runeSetName !== sampleRuneSetName;

                                return (
                                  <td
                                    key={seat.id}
                                    className="p-2.5 text-center text-xs"
                                  >
                                    <div
                                      className={`${seat.isSample ? 'font-bold text-purple-400' : isDifferent ? 'text-purple-300' : 'text-slate-400'}`}
                                    >
                                      {runeSetName || '无'}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ));
                        })()}

                        {/* 分隔行 */}
                        <tr className="bg-slate-800/60">
                          <td
                            colSpan={allSeatsData.length + 1}
                            className="p-0"
                          ></td>
                        </tr>

                        {/* 符石套装效果对比 */}
                        <tr className="border-b border-yellow-800/10 hover:bg-slate-800/20">
                          <td className="border-r border-yellow-800/20 p-2.5 text-xs font-medium text-slate-300">
                            符石套装效果
                          </td>
                          {allSeatsData.map(({ seat, seatEquip }, idx) => {
                            const runeSetEffect =
                              summarizeEquipmentEffects(seatEquip, {
                                includeRuneSetName: true,
                                includeRuneSetEffect: true,
                              }) || '无';
                            const sampleRuneSetEffect =
                              summarizeEquipmentEffects(
                                allSeatsData[0].seatEquip,
                                {
                                  includeRuneSetName: true,
                                  includeRuneSetEffect: true,
                                }
                              ) || '无';
                            const isDifferent =
                              idx !== 0 &&
                              runeSetEffect !== sampleRuneSetEffect;

                            return (
                              <td
                                key={seat.id}
                                className="p-2.5 text-center text-xs"
                              >
                                <div
                                  className={`${seat.isSample ? 'font-bold text-orange-400' : isDifferent ? 'text-orange-300' : 'text-slate-400'}`}
                                >
                                  {runeSetEffect}
                                </div>
                              </td>
                            );
                          })}
                        </tr>

                        {/* 灵饰套装效果对比 */}
                        <tr className="border-b border-yellow-800/10 hover:bg-slate-800/20">
                          <td className="border-r border-yellow-800/20 p-2.5 text-xs font-medium text-slate-300">
                            灵饰套装效果
                          </td>
                          {allSeatsData.map(({ seat, seatEquip }, idx) => {
                            const trinketSetEffect =
                              summarizeEquipmentEffects(seatEquip, {
                                predicate: (eq) => eq.type === 'trinket',
                                includeSetName: true,
                                includeSpecialEffect: true,
                                includeRefinementEffect: true,
                                includeHighlights: true,
                              }) || '无';
                            const sampleTrinketSetEffect =
                              summarizeEquipmentEffects(
                                allSeatsData[0].seatEquip,
                                {
                                  predicate: (eq) => eq.type === 'trinket',
                                  includeSetName: true,
                                  includeSpecialEffect: true,
                                  includeRefinementEffect: true,
                                  includeHighlights: true,
                                }
                              ) || '无';
                            const isDifferent =
                              idx !== 0 &&
                              trinketSetEffect !== sampleTrinketSetEffect;

                            return (
                              <td
                                key={seat.id}
                                className="p-2.5 text-center text-xs"
                              >
                                <div
                                  className={`${seat.isSample ? 'font-bold text-cyan-400' : isDifferent ? 'text-cyan-300' : 'text-slate-400'}`}
                                >
                                  {trinketSetEffect}
                                </div>
                              </td>
                            );
                          })}
                        </tr>

                        {/* 分隔行 */}
                        <tr className="bg-slate-800/60">
                          <td
                            colSpan={allSeatsData.length + 1}
                            className="p-0"
                          ></td>
                        </tr>

                        {/* 伤害预估 */}
                        <tr className="border-b border-yellow-800/10 hover:bg-slate-800/20">
                          <td className="border-r border-yellow-800/20 p-2.5 text-xs font-medium text-slate-300">
                            综合伤害
                          </td>
                          {allSeatsData.map(
                            ({ seat, seatCombatStats }, idx) => {
                              const magicDamage =
                                seatCombatStats.magicDamage || 0;
                              const magicPower =
                                seatCombatStats.magicPower || 0;
                              const physicalDamage =
                                seatCombatStats.damage || 0;
                              const totalDamage =
                                magicDamage +
                                magicPower * 0.7 +
                                physicalDamage * 0.25;

                              const sampleMagicDamage =
                                allSeatsData[0].seatCombatStats.magicDamage ||
                                0;
                              const sampleMagicPower =
                                allSeatsData[0].seatCombatStats.magicPower || 0;
                              const samplePhysicalDamage =
                                allSeatsData[0].seatCombatStats.damage || 0;
                              const sampleTotalDamage =
                                sampleMagicDamage +
                                sampleMagicPower * 0.7 +
                                samplePhysicalDamage * 0.25;

                              const diff =
                                idx === 0 ? 0 : totalDamage - sampleTotalDamage;
                              const isUnchanged =
                                Math.abs(diff) < 0.1 && idx !== 0;
                              const isPositive = diff > 0;
                              const isNegative = diff < 0;

                              return (
                                <td
                                  key={seat.id}
                                  className="p-2.5 text-center text-xs"
                                >
                                  {isUnchanged ? (
                                    <span className="text-slate-500">—</span>
                                  ) : (
                                    <div className="flex flex-col items-center gap-0.5">
                                      <div
                                        className={
                                          seat.isSample
                                            ? 'font-bold text-yellow-100'
                                            : 'text-slate-200'
                                        }
                                      >
                                        {Math.round(totalDamage)}
                                      </div>
                                      {idx !== 0 && !isUnchanged && (
                                        <div
                                          className={`text-[10px] font-medium ${isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-slate-500'}`}
                                        >
                                          {isPositive ? '+' : ''}
                                          {Math.round(diff)}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </td>
                              );
                            }
                          )}
                        </tr>

                        {/* 分隔行 */}
                        <tr className="bg-slate-800/60">
                          <td
                            colSpan={allSeatsData.length + 1}
                            className="p-0"
                          ></td>
                        </tr>

                        {/* 价格对比 - 样本席位显示横线，对比席位只显示额外花费 */}
                        <tr className="border-b border-yellow-800/10 hover:bg-slate-800/20">
                          <td className="border-r border-yellow-800/20 p-2.5 text-xs font-medium text-slate-300">
                            总价格
                          </td>
                          {allSeatsData.map(({ seat, totalPrice }, idx) => {
                            const samplePrice = allSeatsData[0].totalPrice;
                            const diff =
                              idx === 0 ? 0 : totalPrice - samplePrice;

                            return (
                              <td
                                key={seat.id}
                                className="p-2.5 text-center text-xs"
                              >
                                {seat.isSample ? (
                                  <span className="text-slate-500">—</span>
                                ) : (
                                  <div
                                    className={`${diff > 0 ? 'text-red-400' : diff < 0 ? 'text-green-400' : 'text-slate-500'}`}
                                  >
                                    {diff === 0
                                      ? '—'
                                      : `${diff > 0 ? '+' : ''}¥${Math.round(diff)}`}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>

                        {/* 1点伤害成本 */}
                        <tr className="hover:bg-slate-800/20">
                          <td className="border-r border-yellow-800/20 p-2.5 text-xs font-medium text-slate-300">
                            1点伤害成本
                          </td>
                          {allSeatsData.map(
                            ({ seat, totalPrice, seatCombatStats }, idx) => {
                              if (seat.isSample) {
                                return (
                                  <td
                                    key={seat.id}
                                    className="p-2.5 text-center text-xs"
                                  >
                                    <span className="text-slate-500">—</span>
                                  </td>
                                );
                              }

                              const magicDamage =
                                seatCombatStats.magicDamage || 0;
                              const magicPower =
                                seatCombatStats.magicPower || 0;
                              const physicalDamage =
                                seatCombatStats.damage || 0;
                              const totalDamage =
                                magicDamage +
                                magicPower * 0.7 +
                                physicalDamage * 0.25;

                              const sampleMagicDamage =
                                allSeatsData[0].seatCombatStats.magicDamage ||
                                0;
                              const sampleMagicPower =
                                allSeatsData[0].seatCombatStats.magicPower || 0;
                              const samplePhysicalDamage =
                                allSeatsData[0].seatCombatStats.damage || 0;
                              const sampleTotalDamage =
                                sampleMagicDamage +
                                sampleMagicPower * 0.7 +
                                samplePhysicalDamage * 0.25;

                              const damageDiff =
                                totalDamage - sampleTotalDamage;
                              const priceDiff =
                                totalPrice - allSeatsData[0].totalPrice;
                              const costPerDamage =
                                damageDiff > 0 ? priceDiff / damageDiff : 0;

                              return (
                                <td
                                  key={seat.id}
                                  className="p-2.5 text-center text-xs"
                                >
                                  {damageDiff <= 0 ? (
                                    <span className="text-slate-500">—</span>
                                  ) : (
                                    <div className="text-[#fff064]">
                                      ¥{Math.round(costPerDamage)}
                                    </div>
                                  )}
                                </td>
                              );
                            }
                          )}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* 详情弹窗 */}
        {simulatedLibEquip && selectedLibEquip && (
          <div className="absolute inset-0 z-10 flex flex-col bg-slate-950/95 p-5">
            <div className="mb-4 flex flex-shrink-0 items-center justify-between">
              <h3 className="font-bold text-yellow-100">装备详情 & 挂载</h3>
              <button
                onClick={() => setSelectedLibEquip(null)}
                className="flex items-center gap-1 text-sm text-yellow-400 hover:text-yellow-300"
              >
                <X className="h-5 w-5" /> 返回
              </button>
            </div>

            <div className="custom-scrollbar mb-4 flex-1 overflow-y-auto">
              <div className="space-y-3">
                {/* 装备名称和状态 */}
                <div className="rounded-xl border border-yellow-800/40 bg-slate-900 p-4">
                  <div className="flex gap-6">
                    {/* 装备图片 */}
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-yellow-800/30 bg-slate-950/50">
                      <img
                        src={
                          simulatedLibEquip.imageUrl ||
                          getEquipmentDefaultImage(simulatedLibEquip.type)
                        }
                        alt={simulatedLibEquip.name}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    {/* 左列：装备信息 */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <div className="text-2xl font-bold text-yellow-400">
                          {simulatedLibEquip.name}
                        </div>
                        <div className="rounded border border-green-600/50 bg-green-900/20 px-2 py-0.5 text-[10px] font-medium text-green-400">
                          已入库
                        </div>
                      </div>

                      {/* 亮点标签 */}
                      {simulatedLibEquip.highlights &&
                        simulatedLibEquip.highlights.length > 0 && (
                          <div className="mb-3 flex flex-wrap gap-1.5">
                            {simulatedLibEquip.highlights.map((hl, j) => (
                              <span
                                key={j}
                                className="rounded border border-red-500/50 px-2 py-0.5 text-xs font-medium text-red-400"
                              >
                                {hl}
                              </span>
                            ))}
                          </div>
                        )}

                      {simulatedLibEquip.description && (
                        <div className="mb-2 text-sm leading-relaxed text-slate-300">
                          {simulatedLibEquip.description}
                        </div>
                      )}

                      {simulatedLibEquip.equippableRoles && (
                        <div>
                          <span className="text-xs text-green-400">
                            【装备角色】
                          </span>
                          <span className="ml-1 text-xs text-slate-300">
                            {simulatedLibEquip.equippableRoles}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 右列：价格信息 */}
                    <div className="flex shrink-0 flex-col gap-3 border-l border-yellow-800/30 pl-6">
                      <div className="text-right">
                        <div className="mb-1 text-[10px] text-slate-500">
                          售价
                        </div>
                        <div className="text-xl font-bold text-[#fff064]">
                          ¥ {formatPrice(simulatedLibEquip.price)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="mb-1 text-[10px] text-slate-500">
                          跨服费用
                        </div>
                        <div className="text-xl font-bold text-[#fff064]">
                          ¥ {formatPrice(simulatedLibEquip.crossServerFee)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 基础信息 */}
                <div className="rounded-xl border border-yellow-800/40 bg-slate-900 p-4">
                  <div className="mb-3 flex gap-6">
                    {simulatedLibEquip.level && (
                      <div>
                        <span className="text-sm font-bold text-yellow-400">
                          等级 {simulatedLibEquip.level}
                        </span>
                      </div>
                    )}
                    {simulatedLibEquip.element &&
                      simulatedLibEquip.element !== '无' && (
                        <div>
                          <span className="text-sm text-yellow-400">五行 </span>
                          <span className="text-sm font-bold text-yellow-400">
                            {simulatedLibEquip.element}
                          </span>
                        </div>
                      )}
                  </div>

                  <div className="mb-2 text-sm text-yellow-100">
                    {simulatedLibEquip.mainStat}
                  </div>

                  {simulatedLibEquip.durability && (
                    <div className="text-sm text-slate-300">
                      耐久度 {simulatedLibEquip.durability}
                    </div>
                  )}

                  {simulatedLibEquip.forgeLevel !== undefined &&
                    simulatedLibEquip.gemstone && (
                      <>
                        <div className="mt-1 text-sm text-slate-300">
                          {simulatedLibEquip.type === 'trinket'
                            ? '星辉石等级 '
                            : simulatedLibEquip.type === 'jade'
                              ? '玉魄阶数 '
                              : '锻炼等级 '}
                          {simulatedLibEquip.forgeLevel}
                        </div>
                        {simulatedLibEquip.type !== 'jade' && (
                          <div className="relative mt-1 text-sm text-slate-300">
                            <span className="text-slate-300">镶嵌宝石 </span>
                            <span
                              ref={
                                runePopover?.type === 'gemstone'
                                  ? setReferenceElement
                                  : null
                              }
                              className="-mx-1.5 inline-flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 text-red-400 transition-colors hover:bg-slate-800/80"
                              onClick={() =>
                                setRunePopover({ type: 'gemstone' })
                              }
                            >
                              {simulatedLibEquip.gemstone}
                              <Edit2 className="h-3 w-3 text-red-400/60" />
                            </span>
                          </div>
                        )}
                      </>
                    )}

                  {simulatedLibEquip.extraStat && (
                    <div className="mt-1 text-sm text-green-400">
                      {simulatedLibEquip.extraStat}
                    </div>
                  )}

                  {/* 宝石选择浮层 */}
                  {runePopover?.type === 'gemstone' && (
                    <div
                      ref={setPopperElement}
                      style={{ ...styles.popper, zIndex: 9999 }}
                      {...attributes.popper}
                      className="w-40 overflow-hidden rounded-lg border border-yellow-700/50 bg-slate-800 shadow-xl"
                    >
                      <div className="custom-scrollbar max-h-64 overflow-y-auto p-1">
                        <div className="mb-1 border-b border-yellow-900/30 px-2 py-1.5 text-xs text-yellow-500/80">
                          选择宝石
                        </div>
                        {AVAILABLE_GEMSTONES.map((gemstone) => (
                          <div
                            key={gemstone}
                            className="cursor-pointer rounded px-3 py-2 text-sm text-red-400 transition-colors hover:bg-slate-700"
                            onClick={() => {
                              setSimulatedLibEquip({
                                ...simulatedLibEquip,
                                gemstone,
                              });
                              setRunePopover(null);
                            }}
                          >
                            {gemstone}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 宝石选择关闭层 */}
                  {runePopover?.type === 'gemstone' && (
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setRunePopover(null)}
                    />
                  )}
                </div>

                {/* 符石信息 / 特效 */}
                {simulatedLibEquip.type === 'trinket' &&
                  simulatedLibEquip.specialEffect && (
                    <div className="space-y-2 rounded-xl border border-yellow-800/40 bg-slate-900 p-4">
                      <div className="text-sm text-purple-400">
                        特效：{simulatedLibEquip.specialEffect}
                      </div>
                    </div>
                  )}

                {simulatedLibEquip.type !== 'trinket' &&
                  simulatedLibEquip.type !== 'jade' &&
                  simulatedLibEquip.runeStoneSets &&
                  simulatedLibEquip.runeStoneSets.length > 0 && (
                    <div className="space-y-2 rounded-xl border border-yellow-800/40 bg-slate-900 p-4">
                      {/* 开运孔数 - 可点击修改 */}
                      <div className="relative">
                        <div
                          ref={
                            runePopover?.type === 'luckyHoles'
                              ? setReferenceElement
                              : null
                          }
                          className="-mx-2 inline-flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm text-green-400 transition-colors hover:bg-slate-800/80"
                          onClick={() => setRunePopover({ type: 'luckyHoles' })}
                        >
                          开运孔数：{simulatedLibEquip.luckyHoles || '0'}
                          <Edit2 className="h-3 w-3 text-green-400/60" />
                        </div>

                        {/* 开运孔数选择浮层 */}
                        {runePopover?.type === 'luckyHoles' && (
                          <div
                            ref={setPopperElement}
                            style={{ ...styles.popper, zIndex: 9999 }}
                            {...attributes.popper}
                            className="w-32 overflow-hidden rounded-lg border border-yellow-700/50 bg-slate-800 shadow-xl"
                          >
                            <div className="p-1">
                              <div className="mb-1 border-b border-yellow-900/30 px-2 py-1.5 text-xs text-yellow-500/80">
                                选择孔数
                              </div>
                              {[0, 1, 2, 3, 4, 5].map((num) => (
                                <div
                                  key={num}
                                  className="cursor-pointer rounded px-3 py-2 text-sm text-green-400 transition-colors hover:bg-slate-700"
                                  onClick={() => {
                                    const newEquip = {
                                      ...simulatedLibEquip,
                                      luckyHoles: num.toString(),
                                    };

                                    // 调整符石数组长度以匹配新的开孔数
                                    if (
                                      newEquip.runeStoneSets &&
                                      newEquip.runeStoneSets.length > 0
                                    ) {
                                      newEquip.runeStoneSets = [
                                        ...newEquip.runeStoneSets,
                                      ];
                                      const currentRunes = [
                                        ...(newEquip.runeStoneSets[0] || []),
                                      ];

                                      if (num < currentRunes.length) {
                                        // 减少孔数，截断符石数组
                                        newEquip.runeStoneSets[0] =
                                          currentRunes.slice(0, num);
                                      } else if (num > currentRunes.length) {
                                        // 增加孔数时先补空占位，避免自动注入真实符石属性
                                        while (
                                          newEquip.runeStoneSets[0].length < num
                                        ) {
                                          newEquip.runeStoneSets[0].push({
                                            id: `empty_rune_${newEquip.runeStoneSets[0].length + 1}`,
                                            name: '未配置符石',
                                            type: 'empty',
                                            stats: {},
                                          });
                                        }
                                      }
                                    }

                                    setSimulatedLibEquip(newEquip);
                                    setRunePopover(null);
                                  }}
                                >
                                  {num} 个孔
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {runePopover && (
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setRunePopover(null)}
                        />
                      )}

                      {simulatedLibEquip.runeStoneSets[0].map(
                        (stone: any, idx: number) => (
                          <div key={idx} className="relative">
                            <div
                              ref={
                                runePopover?.type === 'rune' &&
                                runePopover.index === idx
                                  ? setReferenceElement
                                  : null
                              }
                              className="-mx-2 inline-flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm text-green-400 transition-colors hover:bg-slate-800/80"
                              onClick={() =>
                                setRunePopover({ type: 'rune', index: idx })
                              }
                            >
                              <span>
                                符石{idx + 1}：{stone.name || ''}{' '}
                                {Object.entries(stone.stats)
                                  .map(([key, value]) => {
                                    const localStatNames: Record<
                                      string,
                                      string
                                    > = {
                                      hp: '气血',
                                      magic: '魔法',
                                      damage: '伤害',
                                      hit: '命中',
                                      defense: '防御',
                                      magicDefense: '法防',
                                      speed: '速度',
                                      dodge: '躲避',
                                      magicDamage: '法伤',
                                      physique: '体质',
                                      magicPower: '魔力',
                                      strength: '力量',
                                      endurance: '耐力',
                                      agility: '敏捷',
                                    };
                                    return `${localStatNames[key] || key} +${value}`;
                                  })
                                  .join(' ')}
                              </span>
                              <Edit2 className="h-3 w-3 text-green-400/60" />
                            </div>

                            {/* 符石选择浮层 */}
                            {runePopover?.type === 'rune' &&
                              runePopover.index === idx && (
                                <div
                                  ref={setPopperElement}
                                  style={{ ...styles.popper, zIndex: 9999 }}
                                  {...attributes.popper}
                                  className="w-64 overflow-hidden rounded-lg border border-yellow-700/50 bg-slate-800 shadow-xl"
                                >
                                  <div className="custom-scrollbar max-h-60 overflow-y-auto p-1">
                                    <div className="mb-1 border-b border-yellow-900/30 px-2 py-1.5 text-xs text-yellow-500/80">
                                      选择要替换的符石
                                    </div>
                                    {AVAILABLE_RUNES.map((r) => (
                                      <div
                                        key={r.id}
                                        className="flex cursor-pointer items-center justify-between rounded px-3 py-2 text-sm transition-colors hover:bg-slate-700"
                                        onClick={() => {
                                          const newEquip = {
                                            ...simulatedLibEquip,
                                          };
                                          newEquip.runeStoneSets = [
                                            ...newEquip.runeStoneSets,
                                          ];
                                          newEquip.runeStoneSets[0] = [
                                            ...newEquip.runeStoneSets[0],
                                          ];
                                          newEquip.runeStoneSets[0][idx] = {
                                            ...r,
                                          };
                                          setSimulatedLibEquip(newEquip);
                                          setRunePopover(null);
                                        }}
                                      >
                                        <span className="font-medium text-green-400">
                                          {r.name}
                                        </span>
                                        <span className="text-xs text-slate-300">
                                          {Object.entries(r.stats)
                                            .map(([k, v]) => {
                                              const localStatNames: Record<
                                                string,
                                                string
                                              > = {
                                                hp: '气血',
                                                magic: '魔法',
                                                damage: '伤害',
                                                hit: '命中',
                                                defense: '防御',
                                                magicDefense: '法防',
                                                speed: '速度',
                                                dodge: '躲避',
                                                magicDamage: '法伤',
                                                physique: '体质',
                                                magicPower: '魔力',
                                                strength: '力量',
                                                endurance: '耐力',
                                                agility: '敏捷',
                                              };
                                              return `${localStatNames[k] || k} +${v}`;
                                            })
                                            .join(' ')}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                          </div>
                        )
                      )}

                      <div className="relative">
                        {simulatedLibEquip.starPosition && (
                          <div
                            ref={
                              runePopover?.type === 'starPosition'
                                ? setReferenceElement
                                : null
                            }
                            className="-mx-2 inline-flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm text-green-400 transition-colors hover:bg-slate-800/80"
                            onClick={() =>
                              setRunePopover({ type: 'starPosition' })
                            }
                          >
                            星位：{simulatedLibEquip.starPosition}
                            <Edit2 className="h-3 w-3 text-green-400/60" />
                          </div>
                        )}

                        {/* 星位选择浮层 */}
                        {runePopover?.type === 'starPosition' && (
                          <div
                            ref={setPopperElement}
                            style={{ ...styles.popper, zIndex: 9999 }}
                            {...attributes.popper}
                            className="w-48 overflow-hidden rounded-lg border border-yellow-700/50 bg-slate-800 shadow-xl"
                          >
                            <div className="custom-scrollbar max-h-60 overflow-y-auto p-1">
                              <div className="mb-1 border-b border-yellow-900/30 px-2 py-1.5 text-xs text-yellow-500/80">
                                选择星位属性
                              </div>
                              {AVAILABLE_STAR_POSITIONS.map((sp, i) => (
                                <div
                                  key={i}
                                  className="cursor-pointer rounded px-3 py-2 text-sm text-green-400 transition-colors hover:bg-slate-700"
                                  onClick={() => {
                                    setSimulatedLibEquip({
                                      ...simulatedLibEquip,
                                      starPosition: sp,
                                    });
                                    setRunePopover(null);
                                  }}
                                >
                                  {sp}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="relative">
                        {simulatedLibEquip.starAlignment && (
                          <div
                            ref={
                              runePopover?.type === 'starAlignment'
                                ? setReferenceElement
                                : null
                            }
                            className="-mx-2 inline-flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm text-green-400 transition-colors hover:bg-slate-800/80"
                            onClick={() =>
                              setRunePopover({ type: 'starAlignment' })
                            }
                          >
                            星相互合：{simulatedLibEquip.starAlignment}
                            <Edit2 className="h-3 w-3 text-green-400/60" />
                          </div>
                        )}

                        {/* 星相互合选择浮层 */}
                        {runePopover?.type === 'starAlignment' && (
                          <div
                            ref={setPopperElement}
                            style={{ ...styles.popper, zIndex: 9999 }}
                            {...attributes.popper}
                            className="w-48 overflow-hidden rounded-lg border border-yellow-700/50 bg-slate-800 shadow-xl"
                          >
                            <div className="custom-scrollbar max-h-60 overflow-y-auto p-1">
                              <div className="mb-1 border-b border-yellow-900/30 px-2 py-1.5 text-xs text-yellow-500/80">
                                选择星相互合属性
                              </div>
                              {AVAILABLE_STAR_ALIGNMENTS.map((sa, i) => (
                                <div
                                  key={i}
                                  className="cursor-pointer rounded px-3 py-2 text-sm text-green-400 transition-colors hover:bg-slate-700"
                                  onClick={() => {
                                    setSimulatedLibEquip({
                                      ...simulatedLibEquip,
                                      starAlignment: sa,
                                    });
                                    setRunePopover(null);
                                  }}
                                >
                                  {sa}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 符石组合 - 可点击修改 */}
                      {simulatedLibEquip.runeStoneSetsNames &&
                        simulatedLibEquip.runeStoneSetsNames.length > 0 && (
                          <div className="relative">
                            <div
                              ref={
                                runePopover?.type === 'runeSet'
                                  ? setReferenceElement
                                  : null
                              }
                              className="-mx-2 mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm text-purple-400 transition-colors hover:bg-slate-800/80"
                              onClick={() =>
                                setRunePopover({ type: 'runeSet' })
                              }
                            >
                              符石组合：
                              {simulatedLibEquip.runeStoneSetsNames[0]}
                              <Edit2 className="h-3 w-3 text-purple-400/60" />
                            </div>

                            {/* 符石组合选择浮层 */}
                            {runePopover?.type === 'runeSet' && (
                              <div
                                ref={setPopperElement}
                                style={{ ...styles.popper, zIndex: 9999 }}
                                {...attributes.popper}
                                className="w-48 overflow-hidden rounded-lg border border-yellow-700/50 bg-slate-800 shadow-xl"
                              >
                                <div className="custom-scrollbar max-h-60 overflow-y-auto p-1">
                                  <div className="mb-1 border-b border-yellow-900/30 px-2 py-1.5 text-xs text-yellow-500/80">
                                    选择符石组合
                                  </div>
                                  {AVAILABLE_RUNE_SETS.map((rsName, i) => (
                                    <div
                                      key={i}
                                      className="cursor-pointer rounded px-3 py-2 text-sm text-purple-400 transition-colors hover:bg-slate-700"
                                      onClick={() => {
                                        const newEquip = {
                                          ...simulatedLibEquip,
                                        };
                                        newEquip.runeStoneSetsNames = [
                                          rsName,
                                          ...(newEquip.runeStoneSetsNames?.slice(
                                            1
                                          ) || []),
                                        ];
                                        setSimulatedLibEquip(newEquip);
                                        setRunePopover(null);
                                      }}
                                    >
                                      {rsName}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                  )}
              </div>
            </div>

            {/* 挂载操作区 */}
            <div className="flex-shrink-0 border-t border-yellow-800/30 pt-4">
              <div className="mb-3 text-sm font-bold text-yellow-100">
                选择挂载位置：
              </div>
              <div className="custom-scrollbar flex gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => {
                    handleReplaceCurrent(simulatedLibEquip || selectedLibEquip);
                    setSelectedLibEquip(null);
                  }}
                  className="flex w-[calc(100%/6)] min-w-[140px] flex-shrink-0 flex-col items-center justify-center rounded-lg border border-yellow-600/40 bg-yellow-900/30 p-3 text-center transition-colors hover:bg-yellow-900/50"
                >
                  <span className="text-sm font-medium text-yellow-100">
                    替换到【当前状态】
                  </span>
                </button>

                {experimentSeats
                  .filter((s) => !s.isSample)
                  .map((seat) => (
                    <button
                      key={seat.id}
                      onClick={() => {
                        handleApplyToSeat(
                          seat.id,
                          simulatedLibEquip || selectedLibEquip
                        );
                        setSelectedLibEquip(null);
                      }}
                      className="flex w-[calc(100%/6)] min-w-[140px] flex-shrink-0 flex-col items-center justify-center rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-center transition-colors hover:bg-slate-800/80"
                    >
                      <span className="text-sm text-slate-200">
                        挂载到【{getSeatDisplayName(seat, experimentSeats)}】
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
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
                              hp: target.hp,
                              level: 175,
                              dungeonName: undefined,
                            } as any);
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
                                hp: target.hp,
                                level: target.level,
                                element: target.element,
                                formation: target.formation,
                                dungeonName: dungeon.name,
                              } as any);
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
