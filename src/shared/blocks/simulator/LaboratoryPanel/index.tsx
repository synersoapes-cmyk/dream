// @ts-nocheck
"use client";
import { DUNGEON_DATABASE } from '@/features/simulator/store/gameData';
import { computeDerivedStats } from '@/features/simulator/store/gameLogic';
import { useGameStore } from '@/features/simulator/store/gameStore';
import { applySimulatorCandidateEquipmentToStore } from '@/features/simulator/utils/simulatorCandidateEquipment';
import { applySimulatorLabSessionToStore } from '@/features/simulator/utils/simulatorLabSession';
import { buildDungeonDatabaseFromTemplates } from '@/features/simulator/utils/targetTemplates';
import { useState, useMemo, useRef, useEffect } from 'react';
import { Package, Plus, Minus, Sword, ChevronRight, Target, X, Upload, Edit2, Trash2, Save, RefreshCcw } from 'lucide-react';
import type { Equipment, PendingEquipment } from '@/features/simulator/store/gameTypes';
import { UploadPopover } from '@/shared/blocks/simulator/CharacterPanel/UploadPopover';
import { toast } from 'sonner';
import { validateImageFile } from '@/features/simulator/utils/demoLoader';
import { motion, AnimatePresence } from 'motion/react';
import { PendingEquipmentDetailModal } from './PendingEquipmentDetailModal';
import { usePopper } from 'react-popper';
import { getEquipmentRuneStoneSetInfo, getConsolidatedRuneStoneSetInfo } from '@/shared/blocks/simulator/EquipmentPanel/RuneStoneHelper';
import { EquipmentImage } from '@/shared/blocks/simulator/EquipmentPanel/EquipmentImage';
import { PendingEquipmentCard } from './PendingEquipmentCard';
import { LibraryEquipmentCard } from './LibraryEquipmentCard';
import { getEquipmentDefaultImage } from '@/features/simulator/utils/equipmentImage';
import { applySimulatorBundleToStore } from '@/features/simulator/utils/simulatorBundle';

// 简化的属性中文映射
const statNames: Record<string, string> = {
  hp: '气血', magic: '魔法', hit: '命中', damage: '伤害',
  magicDamage: '法伤', defense: '防御', magicDefense: '法防',
  speed: '速度', dodge: '躲避', physique: '体质', 
  magicPower: '魔力', strength: '力量', endurance: '耐力', agility: '敏捷'
};

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

const AVAILABLE_STAR_POSITIONS = ['无', '伤害 +2.5', '气血 +10', '速度 +1.5', '防御 +2', '法伤 +2.5', '躲避 +2'];
const AVAILABLE_STAR_ALIGNMENTS = ['无', '体质 +2', '魔力 +2', '力量 +2', '耐力 +2', '敏捷 +2'];

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
  '腾蛟'
];

const AVAILABLE_GEMSTONES = [
  '红玛瑙',
  '太阳石',
  '月亮石',
  '黑宝石',
  '舍利子',
  '光芒石',
  '翡翠石',
  '神秘石'
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
      { id: 'shoes', label: '鞋子', type: 'shoes' }
    ]
  },
  {
    name: '灵饰',
    slots: [
      { id: 'trinket1', label: '戒指', type: 'trinket', slot: 1 },
      { id: 'trinket2', label: '耳饰', type: 'trinket', slot: 2 },
      { id: 'trinket3', label: '手镯', type: 'trinket', slot: 3 },
      { id: 'trinket4', label: '佩饰', type: 'trinket', slot: 4 }
    ]
  },
  {
    name: '玉魄',
    slots: [
      { id: 'jade1', label: '阳玉', type: 'jade', slot: 1 },
      { id: 'jade2', label: '阴玉', type: 'jade', slot: 2 }
    ]
  }
];

function calculateEquipmentTotalStats(equipments: Equipment[]) {
  const totals: Record<string, number> = {};
  let totalPrice = 0;

  equipments.forEach(eq => {
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
        activeSet.forEach(rs => {
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
  const comparisonSeats = allSeats.filter(s => !s.isSample);
  const index = comparisonSeats.findIndex(s => s.id === seat.id);
  return `对比席位${index + 1}`;
}

export function LaboratoryPanel() {
  const [libTab, setLibTab] = useState<'pending' | 'library'>('pending');
  const [selectedLibEquip, setSelectedLibEquip] = useState<Equipment | null>(null);
  const [deletingSeatId, setDeletingSeatId] = useState<string | null>(null);
  const [showTargetSelector, setShowTargetSelector] = useState(false);
  const [selectedPendingItem, setSelectedPendingItem] = useState<PendingEquipment | null>(null);
  
  // 席位栏位选择器状态
  const [selectedSlot, setSelectedSlot] = useState<{
    seatId: string;
    slotType: string;
    slotSlot?: number;
    slotLabel: string;
    currentEquip?: Equipment;
  } | null>(null);
  
  // 新装备库分类状态
  const [primaryCategory, setPrimaryCategory] = useState<'equipment' | 'trinket' | 'jade'>('equipment');
  const [secondaryCategory, setSecondaryCategory] = useState<string>('weapon');
  
  // 批量选择和删除状态
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSavingLab, setIsSavingLab] = useState(false);
  const [isLoadingLab, setIsLoadingLab] = useState(false);
  const [isSavingCurrentEquipment, setIsSavingCurrentEquipment] = useState(false);
  const [isSavingCandidateEquipment, setIsSavingCandidateEquipment] = useState(false);
  const [isLoadingCandidateEquipment, setIsLoadingCandidateEquipment] = useState(false);
  
  const pendingEquipments = useGameStore(state => state.pendingEquipments);
  const experimentSeats = useGameStore(state => state.experimentSeats);
  const currentEquipment = useGameStore(state => state.equipment);
  const equipmentSets = useGameStore(state => state.equipmentSets);
  const addExperimentSeat = useGameStore(state => state.addExperimentSeat);
  const removeExperimentSeat = useGameStore(state => state.removeExperimentSeat);
  const confirmPendingEquipment = useGameStore(state => state.confirmPendingEquipment);
  const removePendingEquipment = useGameStore(state => state.removePendingEquipment);
  const updatePendingEquipment = useGameStore(state => state.updatePendingEquipment);
  const updateExperimentSeatEquipment = useGameStore(state => state.updateExperimentSeatEquipment);
  const removeExperimentSeatEquipment = useGameStore(state => state.removeExperimentSeatEquipment);
  const combatTarget = useGameStore(state => state.combatTarget);
  const selectedDungeonIds = useGameStore(state => state.selectedDungeonIds);
  const updateCombatTarget = useGameStore(state => state.updateCombatTarget);
  const manualTargets = useGameStore(state => state.manualTargets);
  const skills = useGameStore(state => state.skills);
  
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
        if (!response.ok || payload?.code !== 0 || !Array.isArray(payload?.data)) {
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

  const pendingList = pendingEquipments.filter(e => e.status === 'pending');
  const libraryList = pendingEquipments.filter(e => e.status === 'confirmed');
  const libraryEquipments = libraryList.map(item => item.equipment);

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
      const response = await fetch('/api/simulator/current/candidate-equipment', {
        method: 'GET',
        cache: 'no-store',
      });

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
      const response = await fetch('/api/simulator/current/candidate-equipment', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: buildCandidateEquipmentPayload(),
        }),
      });

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
            name: seat.name || (seat.isSample ? '样本席位' : `对比席位${index}`),
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

  const handleSavePendingItemEdit = async (id: string, equipment: Equipment) => {
    updatePendingEquipment(id, equipment);
    setSelectedPendingItem((current) =>
      current && current.id === id ? { ...current, equipment } : current
    );
    await handleSaveCandidateEquipment(true);
    toast.success('识别结果已更新');
  };

  const buildNextCurrentEquipment = (equipment: Equipment) => {
    const existingIndex = currentEquipment.findIndex((item) =>
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

  const saveCurrentEquipment = async (nextEquipment: Equipment[], successMessage: string) => {
    try {
      setIsSavingCurrentEquipment(true);
      const response = await fetch('/api/simulator/current/equipment', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          equipment: nextEquipment,
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
      console.error('Failed to save simulator equipment from laboratory:', error);
      toast.error('保存当前装备失败');
      return false;
    } finally {
      setIsSavingCurrentEquipment(false);
    }
  };

  const handleReplaceCurrent = async (equipment: Equipment) => {
    const nextEquipment = buildNextCurrentEquipment(equipment);
    await saveCurrentEquipment(nextEquipment, `已将 ${equipment.name} 同步到当前装备`);
  };

  // 处理覆盖当前装备的确认
  const handleConfirmOverwrite = async () => {
    if (!confirmOverwriteDialog) return;
    
    const seat = experimentSeats.find(s => s.id === confirmOverwriteDialog.seatId);
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
  const baseSampleStats = useMemo(() => calculateEquipmentTotalStats(currentEquipment), [currentEquipment]);

  const [simulatedLibEquip, setSimulatedLibEquip] = useState<any>(null);

  // 符石和星石编辑相关状态
  const [runePopover, setRunePopover] = useState<{
    type: 'rune' | 'starPosition' | 'starAlignment' | 'luckyHoles' | 'runeSet' | 'gemstone';
    index?: number;
  } | null>(null);

  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null);
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: 'bottom-start',
    strategy: 'fixed',
    modifiers: [
      { name: 'preventOverflow', options: { padding: 8 } },
      { name: 'flip', options: { fallbackPlacements: ['top-start', 'right-start', 'left-start'] } },
      { name: 'offset', options: { offset: [0, 4] } }
    ]
  });

  useEffect(() => {
    if (!selectedLibEquip) {
      setSimulatedLibEquip(null);
      return;
    }
    
    const isTrinket = selectedLibEquip.type === 'trinket';
    const isJade = selectedLibEquip.type === 'jade';
    
    const base = {
      ...selectedLibEquip,
      level: selectedLibEquip.level || (selectedLibEquip.name.includes('无级别') ? 150 : 120),
      durability: selectedLibEquip.durability || (Math.floor(Math.random() * 300) + 200),
      description: selectedLibEquip.description || (isTrinket ? '吸取日月精华的灵饰。' : isJade ? '蕴含着上古气息的稀有玉魄。' : '蕴含神秘力量的珍贵物品。'),
      equippableRoles: selectedLibEquip.equippableRoles || (selectedLibEquip.type === 'weapon' ? '巨魔王，虎头怪' : '通用'),
    };

    if (isTrinket) {
      setSimulatedLibEquip({
        ...base,
        forgeLevel: selectedLibEquip.forgeLevel || 8,
        gemstone: '星辉石',
        specialEffect: selectedLibEquip.specialEffect || '健步如飞 (6级)',
      });
    } else if (isJade) {
      setSimulatedLibEquip({
        ...base,
        forgeLevel: selectedLibEquip.forgeLevel || 5,
        gemstone: '聚气晶',
        element: selectedLibEquip.element || '无',
      });
    } else {
      setSimulatedLibEquip({
        ...base,
        element: selectedLibEquip.element || ['金', '木', '水', '火', '土'][Math.floor(Math.random() * 5)],
        forgeLevel: selectedLibEquip.forgeLevel || 10,
        gemstone: selectedLibEquip.gemstone || (selectedLibEquip.type === 'weapon' ? '红玛瑙' : selectedLibEquip.type === 'necklace' ? '舍利子' : '黑宝石'),
        luckyHoles: selectedLibEquip.luckyHoles || '4孔/4孔',
        runeStoneSets: selectedLibEquip.runeStoneSets || [[
          { id: '1', name: '符石1', type: 'red', stats: { hp: 15 } },
          { id: '2', name: '符石2', type: 'blue', stats: { speed: 1.5 } }
        ]],
        runeStoneSetsNames: selectedLibEquip.runeStoneSetsNames || ['百步穿杨'],
        starPosition: selectedLibEquip.starPosition || '伤害 +2.5',
        starAlignment: selectedLibEquip.starAlignment || '体质 +2',
      });
    }
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
    toast.info('正在识别...', { description: '图片会先上传到 R2，再交给 Gemini 解析' });

    try {
      const configResponse = await fetch('/api/simulator/current/candidate-equipment/ocr/config', {
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

      const response = await fetch('/api/simulator/current/candidate-equipment/ocr', {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok || payload?.code !== 0 || !Array.isArray(payload?.data?.items)) {
        throw new Error(payload?.message || '识别失败');
      }

      applySimulatorCandidateEquipmentToStore(payload.data.items);

      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      const recognizedName = payload?.data?.item?.equipment?.name || '新装备';
      toast.success(`${timeStr} 识别到新物品：${recognizedName}`);
      
      // 如果需要记录到全局日志，可以在这里添加，不过不再在当��组件内展示
      useGameStore.getState().addOcrLog({
        type: 'success',
        message: `${timeStr}，识别到新物品${recognizedName}`,
      });
      
    } catch (error) {
      const description = error instanceof Error ? error.message : '请重试或更换清晰图片';
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
            const file = new File([blob], 'pasted-image.png', { type: blob.type });
            processFile(file);
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [libTab]);

  // 切换到"新装备��"时，默认选中"装备"分类
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
    <div className="flex-1 w-full flex gap-6 min-h-0 overflow-hidden">
      {/* 左侧：装备库 - 25% */}
      <div className="w-[25%] h-full overflow-hidden flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-yellow-800/60 rounded-2xl shadow-2xl">
        <div className="bg-gradient-to-r from-yellow-900/50 to-yellow-800/30 border-b border-yellow-700/60 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-yellow-600 flex items-center justify-center">
                <Package className="w-5 h-5 text-slate-900" />
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
                <RefreshCcw className={`h-3.5 w-3.5 ${isLoadingLab || isLoadingCandidateEquipment ? 'animate-spin' : ''}`} />
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
          <div className="flex bg-slate-900/80 rounded-lg p-1 border border-yellow-800/40 mt-3">
            <button 
              className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${libTab === 'pending' ? 'bg-yellow-600 text-slate-900 font-bold' : 'text-yellow-100/60 hover:text-yellow-100'}`} 
              onClick={() => setLibTab('pending')}
            >
              待确认新品 ({pendingList.length})
            </button>
            <button 
              className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${libTab === 'library' ? 'bg-yellow-600 text-slate-900 font-bold' : 'text-yellow-100/60 hover:text-yellow-100'}`} 
              onClick={() => setLibTab('library')}
            >
              新品装备库 ({libraryEquipments.length})
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {libTab === 'pending' ? (
             <div className="flex flex-col h-full relative">
               <div className="flex-1 overflow-y-auto space-y-4 pb-[72px] pr-2 custom-scrollbar">
                 {pendingList.map(item => (
                   <div 
                     key={item.id} 
                     onClick={() => {
                       setSelectedPendingItem(item);
                       // 关闭新装备库弹窗
                       setSelectedLibEquip(null);
                     }}
                     className="bg-slate-900/60 border border-yellow-800/40 rounded-xl p-2.5 cursor-pointer hover:border-yellow-600/60 hover:bg-slate-900/80 transition-all"
                   >
                     <div className="flex gap-3">
                       <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-950/50 border border-yellow-800/30 shrink-0"><img src={item.equipment.imageUrl || getEquipmentDefaultImage(item.equipment.type)} alt={item.equipment.name} className="w-full h-full object-cover" /></div>
                       {/* 左列：装备信息 */}
                       <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2 mb-1 flex-wrap">
                           <div className="text-yellow-100 font-bold text-sm">{item.equipment.name}</div>
                           <span className="text-orange-400 border border-orange-600/50 bg-orange-900/20 rounded px-1.5 py-0.5 text-[10px] font-medium">待确认</span>
                         </div>
                         
                         <div className="text-slate-300 text-xs leading-snug break-all whitespace-pre-line line-clamp-1">{item.equipment.mainStat}</div>
                         
                         {item.equipment.extraStat && (
                           <div className="text-red-400 text-xs leading-snug break-all whitespace-pre-line line-clamp-1">{item.equipment.extraStat}</div>
                         )}
                         
                         {item.equipment.highlights && item.equipment.highlights.length > 0 && (
                           <div className="flex flex-wrap gap-1 mt-1">
                             {item.equipment.highlights.map((hl, idx) => (
                               <span key={idx} className="text-red-400 border border-red-500/50 rounded px-1 py-0.5 text-[10px]">
                                 {hl}
                               </span>
                             ))}
                           </div>
                         )}
                       </div>
                       
                       {/* 右列：价格信息 - 固定宽度容纳8位数 */}
                       <div className="flex flex-col gap-1.5 shrink-0 border-l border-slate-700/50 pl-3 w-28">
                         <div className="text-right">
                           <div className="text-[9px] text-slate-500 mb-0.5">售价</div>
                           <div className="text-sm font-bold whitespace-nowrap text-[#fff064]">¥ {formatPrice(item.equipment.price)}</div>
                         </div>
                         <div className="text-right">
                           <div className="text-[9px] text-slate-500 mb-0.5">跨服</div>
                           <div className="text-sm font-bold whitespace-nowrap text-[#fff064]">¥ {formatPrice(item.equipment.crossServerFee)}</div>
                         </div>
                       </div>
                     </div>
                   </div>
                 ))}
                 {pendingList.length === 0 && (
                   <div className="text-center text-slate-500 text-sm py-10">暂��待确认装备</div>
                 )}
               </div>
               
               {/* 吸底上传区域 */}
               <div className="absolute bottom-0 left-0 right-0 pt-3 pb-1 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent">
                 <div
                   onDrop={handleDrop}
                   onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                   onDragLeave={() => setIsDragging(false)}
                   onClick={() => fileInputRef.current?.click()}
                   className={`w-full py-2 rounded-lg flex flex-col items-center justify-center gap-1 transition-all cursor-pointer relative overflow-hidden group shadow-xl shadow-slate-950/50 border-2 border-dashed ${
                     isDragging
                       ? 'border-yellow-500 bg-yellow-900/20'
                       : 'border-yellow-700/60 bg-slate-900 hover:border-yellow-600 hover:bg-slate-800'
                   }`}
                 >
                   <input
                     ref={fileInputRef}
                     type="file"
                     accept="image/*"
                     onChange={(e) => handleFileUpload(e.target.files)}
                     className="hidden"
                   />
                   <div className="absolute inset-0 bg-yellow-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                   
                   {isProcessing ? (
                     <div className="flex items-center gap-2 z-10 py-1">
                       <motion.div 
                         animate={{ rotate: 360 }} 
                         transition={{ duration: 1, repeat: Infinity, ease: "linear" }} 
                         className="w-4 h-4 border-2 border-yellow-600/30 border-t-yellow-600 rounded-full"
                       />
                       <span className="text-sm font-bold text-yellow-400">���在识别...</span>
                     </div>
                   ) : (
                     <div className="flex flex-col items-center z-10">
                       <div className="flex items-center gap-2 text-yellow-400">
                         <Upload className={`w-4 h-4 ${isDragging ? 'text-yellow-400' : 'text-yellow-600/80'}`} />
                         <span className="text-sm font-bold">上传装备截图</span>
                       </div>
                       <span className="text-[10px] text-slate-400 mt-0.5">点击/拖拽上传，支持直接粘贴</span>
                     </div>
                   )}
                 </div>
               </div>
             </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* 一��分类页签 */}
              <div className="flex bg-slate-900/60 rounded-lg p-1 border border-yellow-800/30 mb-3">
                {[
                  { key: 'equipment' as const, name: '装备', count: libraryEquipments.filter(e => ['weapon', 'helmet', 'necklace', 'armor', 'belt', 'shoes'].includes(e.type)).length },
                  { key: 'trinket' as const, name: '灵饰', count: libraryEquipments.filter(e => e.type === 'trinket').length },
                  { key: 'jade' as const, name: '玉魄', count: libraryEquipments.filter(e => e.type === 'jade').length }
                ].map(cat => (
                  <button
                    key={cat.key}
                    onClick={() => setPrimaryCategory(cat.key)}
                    className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${
                      primaryCategory === cat.key
                        ? 'bg-yellow-600 text-slate-900 font-bold'
                        : 'text-yellow-100/60 hover:text-yellow-100'
                    }`}
                  >
                    {cat.name} ({cat.count})
                  </button>
                ))}
              </div>
              
              {/* 二级分类页签 */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(() => {
                  const secondaryCategories = primaryCategory === 'equipment'
                    ? [
                        { id: 'weapon', name: '武器', type: 'weapon' },
                        { id: 'helmet', name: '头盔', type: 'helmet' },
                        { id: 'necklace', name: '项链', type: 'necklace' },
                        { id: 'armor', name: '衣服', type: 'armor' },
                        { id: 'belt', name: '腰带', type: 'belt' },
                        { id: 'shoes', name: '鞋子', type: 'shoes' }
                      ]
                    : primaryCategory === 'trinket'
                    ? [
                        { id: 'ring', name: '戒指', type: 'trinket', slot: 1 },
                        { id: 'earring', name: '耳饰', type: 'trinket', slot: 2 },
                        { id: 'bracelet', name: '手镯', type: 'trinket', slot: 3 },
                        { id: 'pendant', name: '佩饰', type: 'trinket', slot: 4 }
                      ]
                    : [
                        { id: 'jade1', name: '阳玉', type: 'jade', slot: 1 },
                        { id: 'jade2', name: '阴玉', type: 'jade', slot: 2 }
                      ];
                  
                  return secondaryCategories.map(cat => {
                    const count = libraryEquipments.filter(eq => {
                      if (eq.type !== cat.type) return false;
                      if ('slot' in cat && cat.slot !== undefined && eq.slot !== cat.slot) return false;
                      return true;
                    }).length;
                    
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSecondaryCategory(cat.id)}
                        className={`px-2.5 py-1 text-xs rounded-md transition-colors border ${
                          secondaryCategory === cat.id
                            ? 'bg-yellow-600/20 border-yellow-600/60 text-yellow-400 font-bold'
                            : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        {cat.name} ({count})
                      </button>
                    );
                  });
                })()}
              </div>
              
              {/* 选择和删除按钮 */}
              <div className="flex gap-2 mb-3">
                {!isSelectionMode ? (
                  <button
                    onClick={() => setIsSelectionMode(true)}
                    className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/40 rounded-lg text-blue-400 text-xs font-medium transition-colors"
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
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 text-xs font-medium transition-colors"
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
                      className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-600/40 rounded-lg text-red-400 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      删除 {selectedItemIds.length > 0 && `(${selectedItemIds.length})`}
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
                          { id: 'shoes', type: 'shoes' }
                        ].find(c => c.id === secondaryCategory);
                      } else if (primaryCategory === 'trinket') {
                        return [
                          { id: 'ring', type: 'trinket', slot: 1 },
                          { id: 'earring', type: 'trinket', slot: 2 },
                          { id: 'bracelet', type: 'trinket', slot: 3 },
                          { id: 'pendant', type: 'trinket', slot: 4 }
                        ].find(c => c.id === secondaryCategory);
                      } else {
                        return [
                          { id: 'jade1', type: 'jade', slot: 1 },
                          { id: 'jade2', type: 'jade', slot: 2 }
                        ].find(c => c.id === secondaryCategory);
                      }
                    })();
                    
                    if (!currentSecondary) return null;
                    
                    const filtered = libraryEquipments.filter(eq => {
                      if (eq.type !== currentSecondary.type) return false;
                      if ('slot' in currentSecondary && currentSecondary.slot !== undefined && eq.slot !== currentSecondary.slot) return false;
                      return true;
                    });
                    
                    return filtered.map(item => {
                      const totalPrice = (item.price || 0) + (item.crossServerFee || 0);
                      const isSelected = selectedItemIds.includes(item.id);
                      
                      return (
                        <div 
                          key={item.id} 
                          onClick={() => {
                            if (isSelectionMode) {
                              // 选择模式：切换选中状态
                              setSelectedItemIds(prev => 
                                prev.includes(item.id) 
                                  ? prev.filter(id => id !== item.id)
                                  : [...prev, item.id]
                              );
                            } else {
                              // 正常模式：显��详情
                              setSelectedLibEquip(item);
                              setSelectedPendingItem(null);
                            }
                          }}
                          className={`bg-slate-900/60 border rounded-xl p-3 cursor-pointer transition-colors flex flex-col gap-1.5 shadow-sm relative overflow-hidden group ${
                            isSelected 
                              ? 'border-yellow-600 bg-yellow-900/20' 
                              : 'border-yellow-800/40 hover:border-yellow-600/60'
                          }`}
                        >
                          {/* 选中状态指示器 */}
                          {isSelectionMode && (
                            <div className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                              isSelected 
                                ? 'bg-yellow-600 border-yellow-600' 
                                : 'bg-slate-800/50 border-slate-600'
                            }`}>
                              {isSelected && (
                                <svg className="w-3 h-3 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          )}
                          
                          {/* 右上角总价标签 */}
                          <div className="absolute top-0 right-0 bg-yellow-900/60 border-b border-l border-yellow-700/50 px-2 py-0.5 rounded-bl-lg">
                            <div className="text-[10px] text-yellow-500/80 font-medium leading-none mb-0.5">总价</div>
                            <div className="text-xs font-bold text-[#fff064]">¥ {formatPrice(totalPrice)}</div>
                          </div>
                          
                          <div className={`${isSelectionMode ? 'ml-7' : ''} mb-2`}><div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-950/50 border border-yellow-800/30"><img src={item.imageUrl || getEquipmentDefaultImage(item.type)} alt={item.name} className="w-full h-full object-cover" /></div></div>
                          
                          <div className={`text-yellow-100 font-bold text-sm truncate ${isSelectionMode ? 'pl-7' : ''} pr-16`}>{item.name}</div>
                          <div className={`text-slate-300 text-xs truncate mt-1 ${isSelectionMode ? 'pl-7' : ''}`}>{item.mainStat.split('\n')[0]}</div>
                          {item.extraStat && (
                            <div className={`text-red-400 text-xs truncate ${isSelectionMode ? 'pl-7' : ''}`}>{item.extraStat.split('\n')[0]}</div>
                          )}
                          {item.highlights && item.highlights.length > 0 && (
                            <div className={`flex flex-wrap gap-1 mt-auto ${isSelectionMode ? 'pl-7' : ''}`}>
                              {item.highlights.slice(0, 2).map((hl, idx) => (
                                <span key={idx} className="text-red-400 border border-red-500/50 rounded px-1 text-[10px]">
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
      <div className="flex-1 h-full overflow-hidden flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-yellow-800/60 rounded-2xl shadow-2xl relative">
        <div className="bg-gradient-to-r from-yellow-900/50 to-yellow-800/30 border-b border-yellow-700/60 px-5 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-yellow-600 flex items-center justify-center">
              <Sword className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <h2 className="text-base font-bold text-yellow-100">实验席位</h2>
              <p className="text-xs text-yellow-400/80">Experiment Seats · 目标: {combatTarget.dungeonName ? `${combatTarget.dungeonName} - ` : ''}{combatTarget.name || '手动目标'}</p>
            </div>
            <button 
              onClick={() => setShowTargetSelector(true)}
              className="ml-4 flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-yellow-100 border border-yellow-800/40 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Target className="w-4 h-4" /> 
              攻击目标：{combatTarget.dungeonName 
                ? `${combatTarget.dungeonName} - ${combatTarget.name}` 
                : combatTarget.name || '选择目标'}
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden flex gap-4 p-4">
          {/* 三个模块并排展示 */}
          {experimentSeats.slice(0, 2).map(seat => {
            // 样本席位使用选中的装备组合，对比席位使用自己的装备
            const sampleEquipment = equipmentSets[selectedSampleSetIndex]?.items || currentEquipment;
            const seatEquip = seat.isSample ? sampleEquipment : seat.equipment;
            const { totals, totalPrice } = calculateEquipmentTotalStats(seatEquip);
            const seatCombatStats = computeDerivedStats(baseAttributes, seatEquip, treasure);
            const baseCombatStats = computeDerivedStats(baseAttributes, sampleEquipment, treasure);
            
            const VALID_RUNE_SETS = ["全能", "法门", "逐兽", "聚焦", "仙骨", "药香", "心印", "招云", "腾蛟"];
            const filterValidRuneSets = (equipments: typeof currentEquipment) => {
              const allSets = getEquipmentRuneStoneSetInfo(equipments);
              return allSets.filter(s => VALID_RUNE_SETS.some(v => s.includes(v)))
                            .map(s => VALID_RUNE_SETS.find(v => s.includes(v)) as string);
            };
            
            const seatRuneSets = filterValidRuneSets(seatEquip);
            const baseRuneSets = filterValidRuneSets(sampleEquipment);
            
            // 找出变化的符石套装（假设只关注第一个变化的）
            const addedSets = seatRuneSets.filter(s => !baseRuneSets.includes(s));
            const removedSets = baseRuneSets.filter(s => !seatRuneSets.includes(s));
            
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
              Object.keys(totals).forEach(k => {
                const diff = totals[k] - (baseSampleStats.totals[k] || 0);
                if (Math.abs(diff) > 0.01) diffs[k] = diff;
              });
              Object.keys(baseSampleStats.totals).forEach(k => {
                if (!(k in totals)) {
                   diffs[k] = -(baseSampleStats.totals[k] || 0);
                }
              });

              // 实际战斗属性差异
              Object.keys(seatCombatStats).forEach(k => {
                const key = k as keyof typeof seatCombatStats;
                const diff = seatCombatStats[key] - baseCombatStats[key];
                if (Math.abs(diff) > 0.01) combatDiffs[key] = diff;
              });

              // 伤害提升计算：根据门派决定主属性
              const isMagicFaction = ['龙宫', '魔王寨', '神木林'].includes(baseAttributes.faction);
              totalDamageDiff = isMagicFaction 
                ? (combatDiffs.magicDamage || 0) 
                : (combatDiffs.damage || 0);
                
              diffPrice = totalPrice - baseSampleStats.totalPrice;
            }

            const displayDiffs = { ...combatDiffs };
            // 额外展示基础属性变化
            Object.keys(diffs).forEach(k => {
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
              costPerDamageDisplay = diffPrice > 0 ? '只花钱不提升' : diffPrice < 0 ? '纯省钱' : '-';
            }

            return (
              <div key={seat.id} className="flex-1 bg-slate-900/60 border border-yellow-800/40 rounded-xl p-4 flex flex-col h-full overflow-hidden">
                {/* 顶部：席位标题（固定） */}
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-yellow-800/30 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-bold text-sm ${seat.isSample ? 'text-yellow-500' : 'text-yellow-100'}`}>
                      {getSeatDisplayName(seat, experimentSeats)}
                    </h3>
                    {seat.isSample && (
                      <select
                        value={selectedSampleSetIndex}
                        onChange={(e) => setSelectedSampleSetIndex(Number(e.target.value))}
                        className="bg-slate-800/80 border border-yellow-700/40 rounded px-2 py-0.5 text-xs text-yellow-100 focus:outline-none focus:ring-1 focus:ring-yellow-600/50 cursor-pointer"
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
                          const equipmentSetName = equipmentSets[selectedSampleSetIndex]?.name || `装备组合 ${selectedSampleSetIndex + 1}`;
                          setConfirmOverwriteDialog({
                            seatId: seat.id,
                            seatName: getSeatDisplayName(seat, experimentSeats),
                            equipmentSetName
                          });
                        }}
                        className="flex items-center gap-1 px-2 py-1 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-600/40 rounded text-yellow-400 hover:text-yellow-300 text-xs font-medium transition-colors"
                        title="将此席位装备应用到当前装备"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>应用</span>
                      </button>
                    )}
                  </div>
                </div>
                
                {/* 中间：可滚动区域（��备列表 + 符石套装效果 + 属性变化） */}
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 mb-3 space-y-3">
                  {/* 装备列表区 */}
                  <div className="space-y-4">
                  {CATEGORIES.map(category => {
                    // 检查此分类下在 当前对比席位 是否有任何装备需要展示（如果是样本席位如果没有则不展示分类；如果不是样本，展示全栏��，但如果没有基础装备可能没必要，这里保持展示全部分类）
                    return (
                      <div key={category.name} className="space-y-2">
                        <div className="text-xs text-yellow-600 font-bold border-b border-yellow-800/30 pb-1 mb-2">
                          {category.name}
                        </div>
                        <div className="space-y-2">
                          {category.slots.map(slotDef => {
                            const eq = seatEquip.find(e => e.type === slotDef.type && (slotDef.slot === undefined || e.slot === slotDef.slot));
                            const currentEq = sampleEquipment.find(e => e.type === slotDef.type && (slotDef.slot === undefined || e.slot === slotDef.slot));

                            // 逻辑：
                            // 1. 如果是对比席位（非样本���，且与“当前装备”完全一致（ID相同，或者都为空）
                            const isSameAsCurrent = !seat.isSample && ((!eq && !currentEq) || (eq && currentEq && eq.id === currentEq.id));

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
                                        currentEquip: currentEq
                                      });
                                      // 关闭其他弹窗
                                      setSelectedLibEquip(null);
                                      setSelectedPendingItem(null);
                                    }
                                  }}
                                  className={`flex items-center gap-2 bg-slate-900/40 border border-slate-800/50 rounded-lg p-2.5 text-xs shadow-sm ${!seat.isSample ? 'cursor-pointer hover:border-yellow-600/40 hover:bg-slate-900/60 transition-all' : ''}`}
                                >
                                  <span className="text-slate-500 w-10 shrink-0 text-right pr-2 border-r border-slate-700/50">{slotDef.label}</span>
                                  <span className="text-slate-400 font-medium tracking-wide">当前装备</span>
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
                                        slotLabel: slotDef.label
                                      });
                                      // 关闭其他弹窗
                                      setSelectedLibEquip(null);
                                      setSelectedPendingItem(null);
                                    }
                                  }}
                                  className={`flex items-center gap-2 bg-slate-900/40 border border-slate-800/50 rounded-lg p-2.5 text-xs shadow-sm ${!seat.isSample ? 'cursor-pointer hover:border-yellow-600/40 hover:bg-slate-900/60 transition-all' : ''}`}
                                >
                                  <span className="text-slate-500 w-10 shrink-0 text-right pr-2 border-r border-slate-700/50">{slotDef.label}</span>
                                  <span className="text-slate-600 italic">空</span>
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
                                      currentEquip: eq
                                    });
                                    // 关闭其他弹窗
                                    setSelectedLibEquip(null);
                                    setSelectedPendingItem(null);
                                  }
                                }}
                                className={`bg-slate-800/80 border border-slate-700/80 rounded-lg p-2.5 text-xs flex shadow-sm ${!seat.isSample ? 'cursor-pointer hover:border-yellow-600/60 hover:bg-slate-800 transition-all' : ''}`}
                              >
                                <span className="text-slate-400 w-10 shrink-0 text-right pr-2 border-r border-slate-700/50 mt-0.5">{slotDef.label}</span>
                                <div className="w-8 h-8 rounded overflow-hidden bg-slate-950/50 border border-slate-700/50 shrink-0 ml-2"><img src={eq.imageUrl || getEquipmentDefaultImage(eq.type)} alt={eq.name} className="w-full h-full object-cover" /></div>
                                <div className="flex-1 min-w-0 pl-2">
                                  <div className="flex justify-between items-start">
                                    <span className="text-yellow-100 font-bold text-sm truncate">{eq.name}</span>
                                    {eq.price ? (
                                      <span className="font-bold shrink-0 ml-2 text-[#fff064]">¥ {eq.price}</span>
                                    ) : null}
                                  </div>
                                  
                                  {eq.mainStat && (
                                    <div className="text-slate-300 leading-snug break-all whitespace-pre-line mt-1">{eq.mainStat}</div>
                                  )}
                                  
                                  {eq.extraStat && (
                                    <div className="text-red-400 leading-snug break-all whitespace-pre-line mt-1">{eq.extraStat}</div>
                                  )}
                                  
                                  {eq.highlights && eq.highlights.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      {eq.highlights.map((hl, j) => (
                                        <span key={j} className="text-red-400 border border-red-500/50 rounded px-1 py-0.5 text-[10px]">
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
                    <div className="bg-slate-950/40 rounded-lg p-3">
                      <div className="text-xs font-bold text-yellow-400 mb-2">符石套装效果</div>
                      <div className="text-xs text-slate-300 leading-relaxed">
                        {seatRuneStoneInfo || '无套装'}
                      </div>
                    </div>
                  )}
                  
                  {/* 属性对比区域（不含核心伤害提升） */}
                  <div className="bg-slate-950/40 rounded-lg p-3">
                    <div className="text-xs font-bold text-yellow-400 mb-2">属性及伤害变化</div>
                    {seat.isSample ? (
                      <div className="text-slate-500 text-xs italic py-4 text-center">样本席位，作为对比基准</div>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                          {Object.entries(displayDiffs).map(([k, v]) => {
                            const isPositive = v > 0;
                            return (
                              <div key={k} className="flex justify-between text-xs">
                                <span className="text-slate-400">{statNames[k] || k}:</span>
                                <span className={isPositive ? 'text-green-400' : 'text-red-400'}>
                                  {isPositive ? '+' : ''}{Math.round(v)}
                                </span>
                              </div>
                            );
                          })}
                          {Object.keys(displayDiffs).length === 0 && (
                            <div className="col-span-2 text-slate-500 text-xs italic">无属性变化</div>
                          )}
                        </div>
                        
                        {/* 符石套装变化 */}
                        {runeStoneChange && (
                          <div className="mt-3 pt-2 border-t border-yellow-800/30">
                            <div className="text-xs font-bold text-yellow-400 mb-1.5">符石套装变化</div>
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
                <div className="flex-shrink-0 bg-slate-950/60 rounded-lg p-3 border-t border-yellow-800/30">
                  {seat.isSample ? (
                    <div className="text-slate-500 text-xs italic text-center">当前基准</div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-yellow-100">核心伤害提升:</span>
                        <span className={totalDamageDiff > 0 ? 'text-green-400' : totalDamageDiff < 0 ? 'text-red-400' : 'text-slate-400'}>
                          {totalDamageDiff > 0 ? '+' : ''}{Math.round(totalDamageDiff)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">差价成本:</span>
                        <span className="text-yellow-400">¥ {diffPrice > 0 ? `+${Number(diffPrice.toFixed(2))}` : Number(diffPrice.toFixed(2))}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">单点伤害成本:</span>
                        <span className="text-yellow-400">{costPerDamageDisplay}{costPerDamageDisplay.includes('¥') ? ' / 点' : ''}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* 第三列：明细属性对比 */}
          <div className="flex-1 bg-slate-900/60 border border-yellow-800/40 rounded-xl p-4 overflow-auto">
            {(() => {
              // 准备两个席位的对比数据
              const sampleEquipment = equipmentSets[selectedSampleSetIndex]?.items || currentEquipment;
              const displaySeats = experimentSeats.slice(0, 2);
              
              const allSeatsData = displaySeats.map(seat => {
                const seatEquip = seat.isSample ? sampleEquipment : seat.equipment;
                const { totals, totalPrice } = calculateEquipmentTotalStats(seatEquip);
                const seatCombatStats = computeDerivedStats(baseAttributes, seatEquip, treasure);
                
                return {
                  seat,
                  seatEquip,
                  totals,
                  totalPrice,
                  seatCombatStats
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
                { key: 'elementalMastery', label: '五行克制能力', isBase: false },
                // 防御属性
                { key: 'hp', label: '气血', isBase: false },
                { key: 'magicDefense', label: '法术防御', isBase: false },
                { key: 'defense', label: '物理防御', isBase: false },
                { key: 'block', label: '格挡值', isBase: false },
                { key: 'antiCritLevel', label: '抗暴击等级', isBase: false },
                { key: 'sealResistLevel', label: '抵抗封印等级', isBase: false },
                { key: 'dodge', label: '躲避', isBase: false },
                { key: 'elementalResistance', label: '五行克制抵御能力', isBase: false },
              ];
              
              return (
                <div className="space-y-4 h-full flex flex-col">
                  <h3 className="text-sm font-bold text-yellow-400 flex-shrink-0">明细属性对比</h3>
                  
                  {/* 属性对比表 */}
                  <div className="flex-1 bg-slate-900/40 rounded-lg border border-yellow-800/30 overflow-auto">
                    <table className="w-full border-collapse text-xs">
                      <thead className="sticky top-0">
                        <tr className="bg-slate-800/80">
                          <th className="text-left text-xs font-bold text-yellow-400 p-2.5 border-r border-yellow-800/30 w-24">属性</th>
                          {allSeatsData.map(({ seat }) => (
                            <th key={seat.id} className={`text-center text-xs font-bold p-2.5 ${seat.isSample ? 'text-yellow-500' : 'text-yellow-100'}`}>
                              {getSeatDisplayName(seat, experimentSeats)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {attributeList.map(attr => {
                          const sampleValue = attr.isBase 
                            ? baseAttributes[attr.key as keyof typeof baseAttributes] + (allSeatsData[0].totals[attr.key] || 0)
                            : allSeatsData[0].seatCombatStats[attr.key as keyof typeof allSeatsData[0]['seatCombatStats']] || 0;
                          
                          return (
                            <tr key={attr.key} className="hover:bg-slate-800/20 border-b border-yellow-800/10">
                              <td className="text-xs text-slate-300 p-2.5 border-r border-yellow-800/20 font-medium">
                                {attr.label}
                              </td>
                              {allSeatsData.map(({ seat, totals, seatCombatStats }, idx) => {
                                const currentValue = attr.isBase
                                  ? baseAttributes[attr.key as keyof typeof baseAttributes] + (totals[attr.key] || 0)
                                  : seatCombatStats[attr.key as keyof typeof seatCombatStats] || 0;
                                
                                const diff = idx === 0 ? 0 : currentValue - sampleValue;
                                const isUnchanged = diff === 0 && idx !== 0;
                                const isPositive = diff > 0;
                                const isNegative = diff < 0;
                                
                                return (
                                  <td key={seat.id} className="text-center text-xs p-2.5">
                                    {isUnchanged ? (
                                      <span className="text-slate-500">—</span>
                                    ) : (
                                      <div className="flex flex-col items-center gap-0.5">
                                        <div className={seat.isSample ? 'text-yellow-100 font-bold' : 'text-slate-200'}>
                                          {Math.round(currentValue)}
                                        </div>
                                        {idx !== 0 && !isUnchanged && (
                                          <div className={`text-[10px] font-medium ${isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-slate-500'}`}>
                                            {isPositive ? '+' : ''}{Math.round(diff)}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                        
                        {/* 分隔行 */}
                        <tr className="bg-slate-800/60">
                          <td colSpan={allSeatsData.length + 1} className="p-0"></td>
                        </tr>
                        
                        {/* 符石组合对比 - 按装备栏位分别展示 */}
                        {(() => {
                          const slotLabels = [
                            { type: 'weapon', label: '武器' },
                            { type: 'helmet', label: '头盔' },
                            { type: 'armor', label: '衣服' },
                            { type: 'belt', label: '腰带' },
                            { type: 'shoes', label: '鞋子' }
                          ];
                          
                          return slotLabels.map(({ type, label }) => (
                            <tr key={type} className="hover:bg-slate-800/20 border-b border-yellow-800/10">
                              <td className="text-xs text-slate-300 p-2.5 border-r border-yellow-800/20 font-medium">
                                {label}符石
                              </td>
                              {allSeatsData.map(({ seat, seatEquip }, idx) => {
                                const equipment = seatEquip.find(eq => eq.type === type);
                                const runeSetName = equipment?.runeStoneSetsNames?.[0];
                                
                                const sampleEquipment = allSeatsData[0].seatEquip.find(eq => eq.type === type);
                                const sampleRuneSetName = sampleEquipment?.runeStoneSetsNames?.[0];
                                const isDifferent = idx !== 0 && runeSetName !== sampleRuneSetName;
                                
                                return (
                                  <td key={seat.id} className="text-center text-xs p-2.5">
                                    <div className={`${seat.isSample ? 'text-purple-400 font-bold' : isDifferent ? 'text-purple-300' : 'text-slate-400'}`}>
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
                          <td colSpan={allSeatsData.length + 1} className="p-0"></td>
                        </tr>
                        
                        {/* 符石套装效果对比 */}
                        <tr className="hover:bg-slate-800/20 border-b border-yellow-800/10">
                          <td className="text-xs text-slate-300 p-2.5 border-r border-yellow-800/20 font-medium">
                            符石套装效果
                          </td>
                          {allSeatsData.map(({ seat, seatEquip }, idx) => {
                            const runeSetEffect = seatEquip.find(eq => eq.runeSetEffect)?.runeSetEffect;
                            const sampleRuneSetEffect = allSeatsData[0].seatEquip.find(eq => eq.runeSetEffect)?.runeSetEffect;
                            const isDifferent = idx !== 0 && runeSetEffect !== sampleRuneSetEffect;
                            
                            return (
                              <td key={seat.id} className="text-center text-xs p-2.5">
                                <div className={`${seat.isSample ? 'text-orange-400 font-bold' : isDifferent ? 'text-orange-300' : 'text-slate-400'}`}>
                                  {runeSetEffect || '无'}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                        
                        {/* 灵饰套装效果对比 */}
                        <tr className="hover:bg-slate-800/20 border-b border-yellow-800/10">
                          <td className="text-xs text-slate-300 p-2.5 border-r border-yellow-800/20 font-medium">
                            灵饰套装效果
                          </td>
                          {allSeatsData.map(({ seat, seatEquip }, idx) => {
                            const trinketSetEffect = seatEquip.find(eq => eq.type === 'trinket' && eq.setName)?.setName;
                            const sampleTrinketSetEffect = allSeatsData[0].seatEquip.find(eq => eq.type === 'trinket' && eq.setName)?.setName;
                            const isDifferent = idx !== 0 && trinketSetEffect !== sampleTrinketSetEffect;
                            
                            return (
                              <td key={seat.id} className="text-center text-xs p-2.5">
                                <div className={`${seat.isSample ? 'text-cyan-400 font-bold' : isDifferent ? 'text-cyan-300' : 'text-slate-400'}`}>
                                  {trinketSetEffect || '无'}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                        
                        {/* 分隔行 */}
                        <tr className="bg-slate-800/60">
                          <td colSpan={allSeatsData.length + 1} className="p-0"></td>
                        </tr>
                        
                        {/* 伤害预估 */}
                        <tr className="hover:bg-slate-800/20 border-b border-yellow-800/10">
                          <td className="text-xs text-slate-300 p-2.5 border-r border-yellow-800/20 font-medium">
                            综合伤害
                          </td>
                          {allSeatsData.map(({ seat, seatCombatStats }, idx) => {
                            const magicDamage = seatCombatStats.magicDamage || 0;
                            const magicPower = seatCombatStats.magicPower || 0;
                            const physicalDamage = seatCombatStats.damage || 0;
                            const totalDamage = magicDamage + (magicPower * 0.7) + (physicalDamage * 0.25);
                            
                            const sampleMagicDamage = allSeatsData[0].seatCombatStats.magicDamage || 0;
                            const sampleMagicPower = allSeatsData[0].seatCombatStats.magicPower || 0;
                            const samplePhysicalDamage = allSeatsData[0].seatCombatStats.damage || 0;
                            const sampleTotalDamage = sampleMagicDamage + (sampleMagicPower * 0.7) + (samplePhysicalDamage * 0.25);
                            
                            const diff = idx === 0 ? 0 : totalDamage - sampleTotalDamage;
                            const isUnchanged = Math.abs(diff) < 0.1 && idx !== 0;
                            const isPositive = diff > 0;
                            const isNegative = diff < 0;
                            
                            return (
                              <td key={seat.id} className="text-center text-xs p-2.5">
                                {isUnchanged ? (
                                  <span className="text-slate-500">—</span>
                                ) : (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <div className={seat.isSample ? 'text-yellow-100 font-bold' : 'text-slate-200'}>
                                      {Math.round(totalDamage)}
                                    </div>
                                    {idx !== 0 && !isUnchanged && (
                                      <div className={`text-[10px] font-medium ${isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-slate-500'}`}>
                                        {isPositive ? '+' : ''}{Math.round(diff)}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                        
                        {/* 分隔行 */}
                        <tr className="bg-slate-800/60">
                          <td colSpan={allSeatsData.length + 1} className="p-0"></td>
                        </tr>
                        
                        {/* 价格对比 - 样本席位显示横线，对比席位只显示额外花费 */}
                        <tr className="hover:bg-slate-800/20 border-b border-yellow-800/10">
                          <td className="text-xs text-slate-300 p-2.5 border-r border-yellow-800/20 font-medium">
                            总价格
                          </td>
                          {allSeatsData.map(({ seat, totalPrice }, idx) => {
                            const samplePrice = allSeatsData[0].totalPrice;
                            const diff = idx === 0 ? 0 : totalPrice - samplePrice;
                            
                            return (
                              <td key={seat.id} className="text-center text-xs p-2.5">
                                {seat.isSample ? (
                                  <span className="text-slate-500">—</span>
                                ) : (
                                  <div className={`${diff > 0 ? 'text-red-400' : diff < 0 ? 'text-green-400' : 'text-slate-500'}`}>
                                    {diff === 0 ? '—' : `${diff > 0 ? '+' : ''}¥${Math.round(diff)}`}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                        
                        {/* 1点伤害成本 */}
                        <tr className="hover:bg-slate-800/20">
                          <td className="text-xs text-slate-300 p-2.5 border-r border-yellow-800/20 font-medium">
                            1点伤害成本
                          </td>
                          {allSeatsData.map(({ seat, totalPrice, seatCombatStats }, idx) => {
                            if (seat.isSample) {
                              return (
                                <td key={seat.id} className="text-center text-xs p-2.5">
                                  <span className="text-slate-500">—</span>
                                </td>
                              );
                            }
                            
                            const magicDamage = seatCombatStats.magicDamage || 0;
                            const magicPower = seatCombatStats.magicPower || 0;
                            const physicalDamage = seatCombatStats.damage || 0;
                            const totalDamage = magicDamage + (magicPower * 0.7) + (physicalDamage * 0.25);
                            
                            const sampleMagicDamage = allSeatsData[0].seatCombatStats.magicDamage || 0;
                            const sampleMagicPower = allSeatsData[0].seatCombatStats.magicPower || 0;
                            const samplePhysicalDamage = allSeatsData[0].seatCombatStats.damage || 0;
                            const sampleTotalDamage = sampleMagicDamage + (sampleMagicPower * 0.7) + (samplePhysicalDamage * 0.25);
                            
                            const damageDiff = totalDamage - sampleTotalDamage;
                            const priceDiff = totalPrice - allSeatsData[0].totalPrice;
                            const costPerDamage = damageDiff > 0 ? priceDiff / damageDiff : 0;
                            
                            return (
                              <td key={seat.id} className="text-center text-xs p-2.5">
                                {damageDiff <= 0 ? (
                                  <span className="text-slate-500">—</span>
                                ) : (
                                  <div className="text-[#fff064]">
                                    ¥{Math.round(costPerDamage)}
                                  </div>
                                )}
                              </td>
                            );
                          })}
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
          <div className="absolute inset-0 bg-slate-950/95 z-10 p-5 flex flex-col">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h3 className="text-yellow-100 font-bold">装备详情 & 挂载</h3>
              <button 
                onClick={() => setSelectedLibEquip(null)}
                className="text-yellow-400 hover:text-yellow-300 text-sm flex items-center gap-1"
              >
                <X className="w-5 h-5" /> 返回
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar mb-4">
              <div className="space-y-3">
                {/* 装备名称和状态 */}
                <div className="bg-slate-900 border border-yellow-800/40 rounded-xl p-4">
                  <div className="flex gap-6">
                    {/* 装备图片 */}
                    <div className="w-24 h-24 rounded-lg overflow-hidden bg-slate-950/50 border border-yellow-800/30 shrink-0">
                      <img src={simulatedLibEquip.imageUrl || getEquipmentDefaultImage(simulatedLibEquip.type)} alt={simulatedLibEquip.name} className="w-full h-full object-cover" />
                    </div>
                    
                    {/* 左列：装备信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <div className="text-2xl font-bold text-yellow-400">{simulatedLibEquip.name}</div>
                        <div className="text-[10px] text-green-400 border border-green-600/50 bg-green-900/20 rounded px-2 py-0.5 font-medium">已入库</div>
                      </div>
                      
                      {/* 亮点标签 */}
                      {simulatedLibEquip.highlights && simulatedLibEquip.highlights.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {simulatedLibEquip.highlights.map((hl, j) => (
                            <span key={j} className="text-red-400 border border-red-500/50 rounded px-2 py-0.5 text-xs font-medium">
                              {hl}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {simulatedLibEquip.description && (
                        <div className="text-sm text-slate-300 leading-relaxed mb-2">{simulatedLibEquip.description}</div>
                      )}
                      
                      {simulatedLibEquip.equippableRoles && (
                        <div>
                          <span className="text-green-400 text-xs">【装备角色】</span>
                          <span className="text-slate-300 text-xs ml-1">{simulatedLibEquip.equippableRoles}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* 右列：价格信息 */}
                    <div className="flex flex-col gap-3 shrink-0 border-l border-yellow-800/30 pl-6">
                      <div className="text-right">
                         <div className="text-[10px] text-slate-500 mb-1">售价</div>
                         <div className="text-xl font-bold text-[#fff064]">¥ {formatPrice(simulatedLibEquip.price)}</div>
                      </div>
                      <div className="text-right">
                         <div className="text-[10px] text-slate-500 mb-1">跨服费用</div>
                         <div className="text-xl font-bold text-[#fff064]">¥ {formatPrice(simulatedLibEquip.crossServerFee)}</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* 基础信息 */}
                <div className="bg-slate-900 border border-yellow-800/40 rounded-xl p-4">
                  <div className="flex gap-6 mb-3">
                    {simulatedLibEquip.level && (
                      <div>
                        <span className="text-yellow-400 text-sm font-bold">等级 {simulatedLibEquip.level}</span>
                      </div>
                    )}
                    {simulatedLibEquip.element && simulatedLibEquip.element !== '无' && (
                      <div>
                        <span className="text-yellow-400 text-sm">五行 </span>
                        <span className="text-yellow-400 text-sm font-bold">{simulatedLibEquip.element}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-sm text-yellow-100 mb-2">{simulatedLibEquip.mainStat}</div>
                  
                  {simulatedLibEquip.durability && (
                    <div className="text-sm text-slate-300">耐久度 {simulatedLibEquip.durability}</div>
                  )}
                  
                  {simulatedLibEquip.forgeLevel !== undefined && simulatedLibEquip.gemstone && (
                    <>
                      <div className="text-sm text-slate-300 mt-1">
                        {simulatedLibEquip.type === 'trinket' ? '星辉石等级 ' : (simulatedLibEquip.type === 'jade' ? '玉魄阶数 ' : '锻炼等级 ')}
                        {simulatedLibEquip.forgeLevel}
                      </div>
                      {simulatedLibEquip.type !== 'jade' && (
                        <div className="text-sm text-slate-300 mt-1 relative">
                          <span className="text-slate-300">镶嵌宝石 </span>
                          <span 
                            ref={runePopover?.type === 'gemstone' ? setReferenceElement : null}
                            className="text-red-400 cursor-pointer hover:bg-slate-800/80 px-1.5 py-0.5 -mx-1.5 rounded transition-colors inline-flex items-center gap-1.5"
                            onClick={() => setRunePopover({ type: 'gemstone' })}
                          >
                            {simulatedLibEquip.gemstone}
                            <Edit2 className="w-3 h-3 text-red-400/60" />
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  
                  {simulatedLibEquip.extraStat && (
                    <div className="text-sm text-green-400 mt-1">{simulatedLibEquip.extraStat}</div>
                  )}
                  
                  {/* 宝石选择浮层 */}
                  {runePopover?.type === 'gemstone' && (
                    <div 
                      ref={setPopperElement}
                      style={{ ...styles.popper, zIndex: 9999 }}
                      {...attributes.popper}
                      className="w-40 bg-slate-800 border border-yellow-700/50 rounded-lg shadow-xl overflow-hidden"
                    >
                      <div className="max-h-64 overflow-y-auto custom-scrollbar p-1">
                        <div className="text-xs text-yellow-500/80 px-2 py-1.5 border-b border-yellow-900/30 mb-1">选择宝石</div>
                        {AVAILABLE_GEMSTONES.map((gemstone) => (
                          <div 
                            key={gemstone}
                            className="px-3 py-2 text-sm hover:bg-slate-700 cursor-pointer text-red-400 transition-colors rounded"
                            onClick={() => {
                              setSimulatedLibEquip({ ...simulatedLibEquip, gemstone });
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
                    <div className="fixed inset-0 z-40" onClick={() => setRunePopover(null)} />
                  )}
                </div>
                
                {/* 符石信息 / 特效 */}
                {simulatedLibEquip.type === 'trinket' && simulatedLibEquip.specialEffect && (
                  <div className="bg-slate-900 border border-yellow-800/40 rounded-xl p-4 space-y-2">
                    <div className="text-sm text-purple-400">特效：{simulatedLibEquip.specialEffect}</div>
                  </div>
                )}
                
                {simulatedLibEquip.type !== 'trinket' && simulatedLibEquip.type !== 'jade' && simulatedLibEquip.runeStoneSets && simulatedLibEquip.runeStoneSets.length > 0 && (
                  <div className="bg-slate-900 border border-yellow-800/40 rounded-xl p-4 space-y-2">
                    {/* 开运孔数 - 可点击修改 */}
                    <div className="relative">
                      <div 
                        ref={runePopover?.type === 'luckyHoles' ? setReferenceElement : null}
                        className="text-sm text-green-400 cursor-pointer hover:bg-slate-800/80 px-2 py-1 -mx-2 rounded transition-colors inline-flex items-center gap-1.5"
                        onClick={() => setRunePopover({ type: 'luckyHoles' })}
                      >
                        开运孔数：{simulatedLibEquip.luckyHoles || '0'}
                        <Edit2 className="w-3 h-3 text-green-400/60" />
                      </div>
                      
                      {/* 开运孔数选择浮层 */}
                      {runePopover?.type === 'luckyHoles' && (
                        <div 
                          ref={setPopperElement}
                          style={{ ...styles.popper, zIndex: 9999 }}
                          {...attributes.popper}
                          className="w-32 bg-slate-800 border border-yellow-700/50 rounded-lg shadow-xl overflow-hidden"
                        >
                          <div className="p-1">
                            <div className="text-xs text-yellow-500/80 px-2 py-1.5 border-b border-yellow-900/30 mb-1">选择孔数</div>
                            {[0, 1, 2, 3, 4, 5].map((num) => (
                              <div 
                                key={num}
                                className="px-3 py-2 text-sm hover:bg-slate-700 cursor-pointer text-green-400 transition-colors rounded"
                                onClick={() => {
                                  const newEquip = { ...simulatedLibEquip, luckyHoles: num.toString() };
                                  
                                  // 调整符石数组长度以匹配新的开孔数
                                  if (newEquip.runeStoneSets && newEquip.runeStoneSets.length > 0) {
                                    newEquip.runeStoneSets = [...newEquip.runeStoneSets];
                                    const currentRunes = [...(newEquip.runeStoneSets[0] || [])];
                                    
                                    if (num < currentRunes.length) {
                                      // 减少孔数，截断符石数组
                                      newEquip.runeStoneSets[0] = currentRunes.slice(0, num);
                                    } else if (num > currentRunes.length) {
                                      // 增加孔数，用默认符石填充
                                      const defaultRune = AVAILABLE_RUNES[0]; // 使用第一个符石作为默认
                                      while (newEquip.runeStoneSets[0].length < num) {
                                        newEquip.runeStoneSets[0].push({ ...defaultRune });
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
                      <div className="fixed inset-0 z-40" onClick={() => setRunePopover(null)} />
                    )}
                    
                    {simulatedLibEquip.runeStoneSets[0].map((stone: any, idx: number) => (
                      <div key={idx} className="relative">
                        <div 
                          ref={runePopover?.type === 'rune' && runePopover.index === idx ? setReferenceElement : null}
                          className="text-sm text-green-400 cursor-pointer hover:bg-slate-800/80 px-2 py-1 -mx-2 rounded transition-colors inline-flex items-center gap-1.5"
                          onClick={() => setRunePopover({ type: 'rune', index: idx })}
                        >
                          <span>
                            符石{idx + 1}：{stone.name || ''} {Object.entries(stone.stats).map(([key, value]) => {
                              const localStatNames: Record<string, string> = {
                                hp: '气血', magic: '魔法', damage: '伤害', hit: '命中',
                                defense: '防御', magicDefense: '法防', speed: '速度',
                                dodge: '躲避', magicDamage: '法伤', physique: '体质',
                                magicPower: '魔力', strength: '力量', endurance: '耐力', agility: '敏捷'
                              };
                              return `${localStatNames[key] || key} +${value}`;
                            }).join(' ')}
                          </span>
                          <Edit2 className="w-3 h-3 text-green-400/60" />
                        </div>
                        
                        {/* 符石选择浮层 */}
                        {runePopover?.type === 'rune' && runePopover.index === idx && (
                          <div 
                            ref={setPopperElement}
                            style={{ ...styles.popper, zIndex: 9999 }}
                            {...attributes.popper}
                            className="w-64 bg-slate-800 border border-yellow-700/50 rounded-lg shadow-xl overflow-hidden"
                          >
                            <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                              <div className="text-xs text-yellow-500/80 px-2 py-1.5 border-b border-yellow-900/30 mb-1">选择要替换的符石</div>
                              {AVAILABLE_RUNES.map(r => (
                                <div 
                                  key={r.id}
                                  className="px-3 py-2 text-sm hover:bg-slate-700 cursor-pointer transition-colors flex justify-between items-center rounded"
                                  onClick={() => {
                                    const newEquip = { ...simulatedLibEquip };
                                    newEquip.runeStoneSets = [...newEquip.runeStoneSets];
                                    newEquip.runeStoneSets[0] = [...newEquip.runeStoneSets[0]];
                                    newEquip.runeStoneSets[0][idx] = { ...r };
                                    setSimulatedLibEquip(newEquip);
                                    setRunePopover(null);
                                  }}
                                >
                                  <span className="text-green-400 font-medium">{r.name}</span>
                                  <span className="text-xs text-slate-300">
                                    {Object.entries(r.stats).map(([k,v]) => {
                                      const localStatNames: Record<string, string> = {
                                        hp: '气血', magic: '魔法', damage: '伤害', hit: '命中',
                                        defense: '防御', magicDefense: '法防', speed: '速度',
                                        dodge: '躲避', magicDamage: '法伤', physique: '体质',
                                        magicPower: '魔力', strength: '力量', endurance: '耐力', agility: '敏捷'
                                      };
                                      return `${localStatNames[k] || k} +${v}`;
                                    }).join(' ')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    <div className="relative">
                      {simulatedLibEquip.starPosition && (
                        <div 
                          ref={runePopover?.type === 'starPosition' ? setReferenceElement : null}
                          className="text-sm text-green-400 cursor-pointer hover:bg-slate-800/80 px-2 py-1 -mx-2 rounded transition-colors inline-flex items-center gap-1.5"
                          onClick={() => setRunePopover({ type: 'starPosition' })}
                        >
                          星位：{simulatedLibEquip.starPosition}
                          <Edit2 className="w-3 h-3 text-green-400/60" />
                        </div>
                      )}
                      
                      {/* 星位选择浮层 */}
                      {runePopover?.type === 'starPosition' && (
                        <div 
                          ref={setPopperElement}
                          style={{ ...styles.popper, zIndex: 9999 }}
                          {...attributes.popper}
                          className="w-48 bg-slate-800 border border-yellow-700/50 rounded-lg shadow-xl overflow-hidden"
                        >
                          <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                            <div className="text-xs text-yellow-500/80 px-2 py-1.5 border-b border-yellow-900/30 mb-1">选择星位属性</div>
                            {AVAILABLE_STAR_POSITIONS.map((sp, i) => (
                              <div 
                                key={i}
                                className="px-3 py-2 text-sm hover:bg-slate-700 cursor-pointer text-green-400 transition-colors rounded"
                                onClick={() => {
                                  setSimulatedLibEquip({ ...simulatedLibEquip, starPosition: sp });
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
                          ref={runePopover?.type === 'starAlignment' ? setReferenceElement : null}
                          className="text-sm text-green-400 cursor-pointer hover:bg-slate-800/80 px-2 py-1 -mx-2 rounded transition-colors inline-flex items-center gap-1.5"
                          onClick={() => setRunePopover({ type: 'starAlignment' })}
                        >
                          星相互合：{simulatedLibEquip.starAlignment}
                          <Edit2 className="w-3 h-3 text-green-400/60" />
                        </div>
                      )}
                      
                      {/* 星相互合选择浮层 */}
                      {runePopover?.type === 'starAlignment' && (
                        <div 
                          ref={setPopperElement}
                          style={{ ...styles.popper, zIndex: 9999 }}
                          {...attributes.popper}
                          className="w-48 bg-slate-800 border border-yellow-700/50 rounded-lg shadow-xl overflow-hidden"
                        >
                          <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                            <div className="text-xs text-yellow-500/80 px-2 py-1.5 border-b border-yellow-900/30 mb-1">选择星相互合属性</div>
                            {AVAILABLE_STAR_ALIGNMENTS.map((sa, i) => (
                              <div 
                                key={i}
                                className="px-3 py-2 text-sm hover:bg-slate-700 cursor-pointer text-green-400 transition-colors rounded"
                                onClick={() => {
                                  setSimulatedLibEquip({ ...simulatedLibEquip, starAlignment: sa });
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
                    {simulatedLibEquip.runeStoneSetsNames && simulatedLibEquip.runeStoneSetsNames.length > 0 && (
                      <div className="relative">
                        <div 
                          ref={runePopover?.type === 'runeSet' ? setReferenceElement : null}
                          className="text-sm text-purple-400 mt-1 cursor-pointer hover:bg-slate-800/80 px-2 py-1 -mx-2 rounded transition-colors inline-flex items-center gap-1.5"
                          onClick={() => setRunePopover({ type: 'runeSet' })}
                        >
                          符石组合：{simulatedLibEquip.runeStoneSetsNames[0]}
                          <Edit2 className="w-3 h-3 text-purple-400/60" />
                        </div>
                        
                        {/* 符石组合选择��层 */}
                        {runePopover?.type === 'runeSet' && (
                          <div 
                            ref={setPopperElement}
                            style={{ ...styles.popper, zIndex: 9999 }}
                            {...attributes.popper}
                            className="w-48 bg-slate-800 border border-yellow-700/50 rounded-lg shadow-xl overflow-hidden"
                          >
                            <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                              <div className="text-xs text-yellow-500/80 px-2 py-1.5 border-b border-yellow-900/30 mb-1">选择符石组合</div>
                              {AVAILABLE_RUNE_SETS.map((rsName, i) => (
                                <div 
                                  key={i}
                                  className="px-3 py-2 text-sm hover:bg-slate-700 cursor-pointer text-purple-400 transition-colors rounded"
                                  onClick={() => {
                                    const newEquip = { ...simulatedLibEquip };
                                    newEquip.runeStoneSetsNames = [rsName, ...(newEquip.runeStoneSetsNames?.slice(1) || [])];
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
              <div className="text-sm font-bold text-yellow-100 mb-3">选择挂载位置：</div>
              <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                <button
                  onClick={() => {
                    handleReplaceCurrent(simulatedLibEquip || selectedLibEquip);
                    setSelectedLibEquip(null);
                  }}
                  className="flex-shrink-0 w-[calc(100%/6)] min-w-[140px] text-center bg-yellow-900/30 hover:bg-yellow-900/50 border border-yellow-600/40 rounded-lg p-3 flex flex-col justify-center items-center transition-colors"
                >
                  <span className="text-yellow-100 text-sm font-medium">替换到【当前状态】</span>
                </button>
                
                {experimentSeats.filter(s => !s.isSample).map(seat => (
                  <button
                    key={seat.id}
                    onClick={() => {
                      handleApplyToSeat(seat.id, simulatedLibEquip || selectedLibEquip);
                      setSelectedLibEquip(null);
                    }}
                    className="flex-shrink-0 w-[calc(100%/6)] min-w-[140px] text-center bg-slate-800/50 hover:bg-slate-800/80 border border-slate-700 rounded-lg p-3 flex flex-col justify-center items-center transition-colors"
                  >
                    <span className="text-slate-200 text-sm">挂载到【{getSeatDisplayName(seat, experimentSeats)}】</span>
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
          <div className="absolute inset-0 bg-slate-950/80 z-20 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-slate-900 border border-yellow-800/60 rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[80%]">
              <div className="flex justify-between items-center p-4 border-b border-yellow-800/30">
                <h3 className="text-yellow-100 font-bold flex items-center gap-2">
                  <Target className="w-4 h-4 text-yellow-500" /> 选择战队目标
                </h3>
                <button onClick={() => setShowTargetSelector(false)} className="text-slate-400 hover:text-slate-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* 技能和秒几选择器 */}
              <div className="p-4 border-b border-yellow-800/30 space-y-3 bg-slate-800/30">
                <div className="space-y-1.5">
                  <label className="text-xs text-yellow-600 font-bold">技能选���</label>
                  <select 
                    value={selectedSkillName}
                    onChange={(e) => setSelectedSkillName(e.target.value)}
                    className="w-full bg-slate-800 border border-yellow-800/40 rounded-lg px-3 py-2 text-sm text-yellow-100 focus:outline-none focus:border-yellow-600"
                  >
                    {skills.map(skill => (
                      <option key={skill.name} value={skill.name}>
                        {skill.name} (Lv.{skill.level})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs text-yellow-600 font-bold">秒几</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(num => (
                      <button
                        key={num}
                        onClick={() => setSelectedTargetCount(num)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedTargetCount === num
                            ? 'bg-yellow-600 text-slate-900 border border-yellow-500'
                            : 'bg-slate-800 text-yellow-100 border border-yellow-800/40 hover:border-yellow-600/60'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {/* 手动目标列表 */}
                {manualTargets.length > 0 && (
                  <div>
                    <div className="text-xs text-yellow-600 font-bold mb-2">手动目标</div>
                    <div className="space-y-2">
                      {manualTargets.map(target => (
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
                              dungeonName: undefined
                            } as any);
                            setShowTargetSelector(false);
                          }}
                          className={`bg-slate-800/80 hover:bg-slate-700/80 border rounded-lg p-3 cursor-pointer transition-colors ${
                            combatTarget.name === target.name && !combatTarget.dungeonName
                              ? 'border-yellow-600 bg-yellow-900/10'
                              : 'border-slate-700'
                          }`}
                        >
                          <div className="text-sm text-yellow-100 font-bold">{target.name}</div>
                          <div className="flex gap-4 text-xs text-slate-400 mt-1.5">
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
                  <div className="text-xs text-yellow-600 font-bold mb-2">副本</div>
                  <div className="space-y-2">
                    {targetDungeons.map(dungeon => (
                      <div key={dungeon.id} className="space-y-1">
                        <div className="text-xs text-slate-400 font-medium px-2 py-1 bg-slate-800/40 rounded">
                          {dungeon.name} - {dungeon.description}
                        </div>
                        {dungeon.targets.map(target => (
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
                                dungeonName: dungeon.name
                              } as any);
                              setShowTargetSelector(false);
                            }}
                            className={`bg-slate-800/80 hover:bg-slate-700/80 border rounded-lg p-3 cursor-pointer transition-colors ml-2 ${
                              combatTarget.name === target.name && combatTarget.dungeonName === dungeon.name
                                ? 'border-yellow-600 bg-yellow-900/10'
                                : 'border-slate-700'
                            }`}
                          >
                            <div className="text-sm text-yellow-100 font-bold flex justify-between">
                              <span>{target.name}</span>
                              <span className="text-xs text-slate-500">Lv.{target.level}</span>
                            </div>
                            <div className="flex gap-4 text-xs text-slate-400 mt-1.5">
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
          <div className="absolute inset-0 bg-slate-950/80 z-30 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-slate-900 border border-red-800/60 rounded-xl shadow-2xl p-5 w-72">
              <h3 className="text-red-400 font-bold text-lg mb-2 text-center">确认删除</h3>
              <p className="text-slate-300 text-sm text-center mb-6">您确定要删除这个对比席位吗？该操作无法撤。</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeletingSeatId(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={() => {
                    removeExperimentSeat(deletingSeatId);
                    setDeletingSeatId(null);
                  }}
                  className="flex-1 bg-red-600/20 hover:bg-red-600/40 border border-red-600/50 text-red-400 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 栏位选择器弹窗 */}
        {selectedSlot && (() => {
          // 获取装备库中匹配的装备
          const availableEquipments = libraryEquipments.filter(eq => {
            if (eq.type !== selectedSlot.slotType) return false;
            if (selectedSlot.slotSlot !== undefined && eq.slot !== selectedSlot.slotSlot) return false;
            return true;
          });

          return (
            <div className="absolute inset-0 bg-slate-950/95 z-20 p-5 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-yellow-100 font-bold">选择装备 - {selectedSlot.slotLabel}</h3>
                <button 
                  onClick={() => setSelectedSlot(null)}
                  className="text-yellow-400 hover:text-yellow-300 text-sm"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar mb-4">
                {/* 删除选项��如果当前有装备） */}
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
                    className="bg-red-900/20 border border-red-600/40 rounded-lg p-3 cursor-pointer hover:border-red-600/60 hover:bg-red-900/30 transition-all mb-2"
                  >
                    <div className="flex items-center gap-2">
                      <Trash2 className="w-4 h-4 text-red-400" />
                      <span className="text-red-400 font-medium text-sm">删除装备（恢复到"当前装备"）</span>
                    </div>
                  </div>
                )}

                {/* 装备列表 - 网格���局 */}
                {availableEquipments.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {availableEquipments.map(equip => {
                      const totalPrice = (equip.price || 0) + (equip.crossServerFee || 0);
                      const isCurrentlyEquipped = selectedSlot.currentEquip?.id === equip.id;

                      return (
                        <div
                          key={equip.id}
                          onClick={() => {
                            if (!isCurrentlyEquipped) {
                              updateExperimentSeatEquipment(selectedSlot.seatId, equip);
                            }
                            setSelectedSlot(null);
                          }}
                          className={`bg-slate-900/60 border rounded-lg p-3 transition-all ${
                            isCurrentlyEquipped
                              ? 'border-green-600/60 bg-green-900/20'
                              : 'border-yellow-800/40 cursor-pointer hover:border-yellow-600/60 hover:bg-slate-900/80'
                          }`}
                        >
                          <div className="flex gap-3">
                            <EquipmentImage equipment={equip} size="md" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-yellow-100 font-bold text-sm">{equip.name}</span>
                                {isCurrentlyEquipped && (
                                  <span className="text-green-400 border border-green-600/50 bg-green-900/20 rounded px-1.5 py-0.5 text-[10px] font-medium">
                                    当前装备
                                  </span>
                                )}
                              </div>

                              {equip.mainStat && (
                                <div className="text-slate-300 text-xs leading-snug">{equip.mainStat}</div>
                              )}

                              {equip.extraStat && (
                                <div className="text-red-400 text-xs leading-snug mt-0.5">{equip.extraStat}</div>
                              )}

                              {equip.highlights && equip.highlights.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {equip.highlights.map((hl, j) => (
                                    <span key={j} className="text-red-400 border border-red-500/50 rounded px-1 py-0.5 text-[10px]">
                                      {hl}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-[10px] text-slate-500 mb-0.5">总价</div>
                              <div className="text-sm font-bold text-[#fff064]">¥ {formatPrice(totalPrice)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center text-slate-500 py-8">
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-slate-900 border-2 border-red-600/60 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-red-400 mb-1">确认删除</h3>
                <p className="text-slate-300 text-sm">
                  确定要删除选中的 <span className="font-bold text-red-400">{selectedItemIds.length}</span> 件装备吗？此操作无法撤销。
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  selectedItemIds.forEach(id => removePendingEquipment(id));
                  void handleSaveCandidateEquipment(true);
                  toast.success(`已删除 ${selectedItemIds.length} 件装备`);
                  setSelectedItemIds([]);
                  setIsSelectionMode(false);
                  setShowDeleteConfirm(false);
                }}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-500 border border-red-500 rounded-lg text-white font-medium transition-colors"
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
              className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] backdrop-blur-sm"
              onClick={() => setConfirmOverwriteDialog(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", duration: 0.3 }}
                className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-yellow-600/60 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-yellow-600/20 flex items-center justify-center flex-shrink-0">
                    <Upload className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-yellow-100 mb-1">确认覆盖当前装备</h3>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      确认将 <span className="font-bold text-yellow-400">{confirmOverwriteDialog.equipmentSetName}</span> 的所有装备覆盖到【当前装备】吗？
                    </p>
                    <p className="text-slate-400 text-xs mt-2">
                      此操作会将当前装备替换为对比席位中的装备配置
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setConfirmOverwriteDialog(null)}
                    className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 font-medium transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleConfirmOverwrite}
                    className="flex-1 py-2.5 px-4 bg-yellow-600 hover:bg-yellow-500 border border-yellow-500 rounded-lg text-slate-900 font-medium transition-colors"
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
