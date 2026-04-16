'use client';

import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '@/features/simulator/store/gameStore';
import type { Equipment } from '@/features/simulator/store/gameTypes';
import {
  applySimulatorCandidateEquipmentToStore,
  buildSimulatorCandidateEquipmentPayload,
} from '@/features/simulator/utils/simulatorCandidateEquipment';
import { applySimulatorBundleToStore } from '@/features/simulator/utils/simulatorBundle';
import {
  buildSimulatorArtifactConfigFromTreasure,
  buildSimulatorArtifactSpotlightTags,
  buildSimulatorArtifactSummary,
  buildSimulatorArtifactTreasure,
  SIMULATOR_ARTIFACT_PRESETS,
  SIMULATOR_ARTIFACT_STAT_OPTIONS,
  type SimulatorArtifactConfig,
} from '@/shared/lib/simulator-artifact';
import { getSimulatorNetworkErrorMessage, isNavigatorOffline } from '@/shared/lib/simulator-network';
import { buildSimulatorEquipmentLibraryItems } from '@/shared/lib/simulator-equipment-library';
import { mapSimulatorInventoryLibraryItemToPendingEquipment } from '@/shared/lib/simulator-inventory-library';
import {
  Copy,
  Edit2,
  Gem,
  Package,
  Plus,
  Settings,
  Shield,
  Sparkles,
  Sword,
  Trash2,
  type LucideIcon,
} from 'lucide-react';

import type {
  SimulatorAccessoryEquipmentType,
  SimulatorPrimaryEquipmentType,
} from '@/shared/lib/simulator-equipment';
import {
  SIMULATOR_PRIMARY_EQUIPMENT_TYPES,
} from '@/shared/lib/simulator-equipment';
import {
  findSimulatorSlotDefinition,
  getSimulatorSlotLabel,
  SIMULATOR_JADE_SLOT_DEFINITIONS,
  SIMULATOR_PRIMARY_SLOT_DEFINITIONS,
  SIMULATOR_TRINKET_SLOT_DEFINITIONS,
} from '@/shared/lib/simulator-slot-config';
import {
  formatEquipmentExtraAttributeSummary,
  sumEquipmentExtraAttributeTotals,
} from '@/shared/lib/simulator-extra-attribute-summary';
import {
  buildActiveRegularSetSummaries,
  formatActiveRegularSetSummary,
  parseRegularSetRulesConfig,
} from '@/shared/lib/simulator-regular-set';

import { EquipmentDetailModal } from './EquipmentDetailModal';
import { EquipmentInventoryModal } from './EquipmentInventoryModal';
import { EquipmentLibraryModal } from './EquipmentLibraryModal';
import {
  EquipmentPanelSlot,
  type EquipmentPanelSlotInfo,
} from './EquipmentPanelSlot';
import { getEquipmentRuneStoneSetInfo } from './RuneStoneHelper';
import { useEquipmentExtensionConfigs } from '../use-equipment-extension-configs';

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

type EquipmentPanelSlotType =
  | SimulatorPrimaryEquipmentType
  | SimulatorAccessoryEquipmentType;

export function EquipmentPanel() {
  const currentCharacter = useGameStore((state) => state.currentCharacter);
  const baseAttributes = useGameStore((state) => state.baseAttributes);
  const combatStats = useGameStore((state) => state.combatStats);
  const equipment = useGameStore((state) => state.equipment);
  const equipmentSets = useGameStore((state) => state.equipmentSets);
  const pendingEquipments = useGameStore((state) => state.pendingEquipments);
  const syncedCloudState = useGameStore((state) => state.syncedCloudState);
  const activeSetIndex = useGameStore((state) => state.activeSetIndex);
  const meridian = useGameStore((state) => state.meridian);
  const treasure = useGameStore((state) => state.treasure);
  const selectEquipmentSet = useGameStore((state) => state.selectEquipmentSet);
  const updateEquipmentSetName = useGameStore(
    (state) => state.updateEquipmentSetName
  );
  const addEquipmentSet = useGameStore((state) => state.addEquipmentSet);
  const duplicateEquipmentSet = useGameStore(
    (state) => state.duplicateEquipmentSet
  );
  const removeEquipmentSet = useGameStore((state) => state.removeEquipmentSet);
  const updateEquipment = useGameStore((state) => state.updateEquipment);
  const updateTreasure = useGameStore((state) => state.updateTreasure);
  const setActiveRegularSetRules = useGameStore(
    (state) => state.setActiveRegularSetRules
  );

  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(
    null
  );
  const [editingSetIndex, setEditingSetIndex] = useState<number | null>(null);
  const [editedSetName, setEditedSetName] = useState('');
  const [isSavingEquipment, setIsSavingEquipment] = useState(false);
  const [saveEquipmentMessage, setSaveEquipmentMessage] = useState<
    string | null
  >(null);
  const [saveEquipmentError, setSaveEquipmentError] = useState<string | null>(
    null
  );
  const [isSavingArtifact, setIsSavingArtifact] = useState(false);
  const [saveArtifactMessage, setSaveArtifactMessage] = useState<string | null>(
    null
  );
  const [saveArtifactError, setSaveArtifactError] = useState<string | null>(
    null
  );
  const [libraryModalInfo, setLibraryModalInfo] = useState<{
    type: EquipmentPanelSlotType;
    name: string;
    slot?: number;
  } | null>(null);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
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
  const loadManagedInventoryItems = async () => {
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
    } catch (error) {
      console.error('Failed to load simulator managed inventory:', error);
    }
  };
  const libraryItems = useMemo(
    () =>
      buildSimulatorEquipmentLibraryItems({
        // 总库需要跟随当前 workbench 的实时方案变更，不能锁死在上次云端快照。
        currentEquipment: equipment,
        equipmentSets,
        activeSetIndex,
        inventoryLibraryItems: activeManagedInventoryItems,
        candidateLibraryItems: pendingEquipments.filter(
          (item) => item.status === 'confirmed'
        ),
      }),
    [
      activeSetIndex,
      activeManagedInventoryItems,
      equipment,
      equipmentSets,
      pendingEquipments,
    ]
  );
  const inventoryModalItems = useMemo(
    () =>
      buildSimulatorEquipmentLibraryItems({
        currentEquipment: equipment,
        equipmentSets,
        activeSetIndex,
        inventoryLibraryItems: managedInventoryItems,
        candidateLibraryItems: pendingEquipments.filter(
          (item) => item.status === 'confirmed'
        ),
      }),
    [
      activeSetIndex,
      equipment,
      equipmentSets,
      managedInventoryItems,
      pendingEquipments,
    ]
  );
  const handleRemoveCandidateInventoryItems = async (
    items: Array<{
      id: string;
      selectable: boolean;
      sourceKinds: string[];
    }>
  ) => {
    if (items.length === 0) {
      throw new Error('当前没有可移出的候选装备');
    }

    const removableIds = new Set<string>();

    items.forEach((item) => {
      if (!item.selectable || !item.sourceKinds.includes('candidate_library')) {
        throw new Error('选中的装备里包含非候选装备，不能批量移出');
      }

      removableIds.add(item.id);
    });

    const currentPendingEquipments = useGameStore.getState().pendingEquipments;
    const nextPendingEquipments = currentPendingEquipments.filter(
      (pendingItem) => !removableIds.has(pendingItem.id)
    );

    if (nextPendingEquipments.length === currentPendingEquipments.length) {
      throw new Error('候选装备不存在，可能已经被移除');
    }

    const response = await fetch('/api/simulator/current/candidate-equipment', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: buildSimulatorCandidateEquipmentPayload(nextPendingEquipments),
      }),
    });
    const payload = await response.json();

    if (!response.ok || payload?.code !== 0) {
      throw new Error(payload?.message || '保存候选装备库失败');
    }

    if (Array.isArray(payload?.data)) {
      applySimulatorCandidateEquipmentToStore(payload.data);
    }
  };
  const handleRemoveCandidateInventoryItem = async (item: {
    id: string;
    selectable: boolean;
    sourceKinds: string[];
  }) => {
    await handleRemoveCandidateInventoryItems([item]);
  };
  const handleRefreshInventoryLibrarySources = async () => {
    await Promise.all([
      loadManagedInventoryItems(),
      fetch('/api/simulator/current/candidate-equipment', {
        method: 'GET',
        cache: 'no-store',
      })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok || payload?.code !== 0 || !Array.isArray(payload?.data)) {
            throw new Error(payload?.message || '读取候选装备库失败');
          }

          applySimulatorCandidateEquipmentToStore(payload.data);
        })
        .catch((error) => {
          console.error('Failed to refresh simulator candidate equipment:', error);
        }),
    ]);
  };
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

  useEffect(() => {
    setActiveRegularSetRules(regularSetRules);
  }, [regularSetRules, setActiveRegularSetRules]);

  useEffect(() => {
    if (!currentCharacter?.id) {
      return;
    }

    void loadManagedInventoryItems();
  }, [currentCharacter?.id, showInventoryModal, syncedCloudState?.equipment?.length]);

  // 获取装备组合名称（从state获取，或使用默认名称）
  const getSetName = (index: number) => {
    if (equipmentSets[index]?.name) {
      // 去掉末尾的"组合"二字
      return equipmentSets[index].name.replace(/组合$/, '');
    }
    return `配置${index + 1}`;
  };

  // 保存装备组合名称
  const saveSetName = (index: number) => {
    if (editedSetName.trim()) {
      updateEquipmentSetName(index, editedSetName.trim());
    }
    setEditingSetIndex(null);
  };

  const iconMap: Record<EquipmentPanelSlotType, LucideIcon> = {
    weapon: Sword,
    helmet: Shield,
    necklace: Gem,
    armor: Shield,
    belt: Gem,
    shoes: Sparkles,
    trinket: Sparkles,
    jade: Gem,
  };

  const equipmentSlots: EquipmentPanelSlotInfo[] =
    SIMULATOR_PRIMARY_SLOT_DEFINITIONS.map((slot) => ({
      ...slot,
      type: slot.type as SimulatorPrimaryEquipmentType,
      name: getSimulatorSlotLabel(slot, 'equipmentPanel'),
      icon: iconMap[slot.type as SimulatorPrimaryEquipmentType],
    }));

  const trinketSlots: EquipmentPanelSlotInfo[] =
    SIMULATOR_TRINKET_SLOT_DEFINITIONS.map((slot) => ({
      ...slot,
      type: slot.type as SimulatorAccessoryEquipmentType,
      name: getSimulatorSlotLabel(slot, 'equipmentPanel'),
      icon: iconMap[slot.type as SimulatorAccessoryEquipmentType],
    }));

  const jadeSlots: EquipmentPanelSlotInfo[] =
    SIMULATOR_JADE_SLOT_DEFINITIONS.map((slot) => ({
      ...slot,
      type: slot.type as SimulatorAccessoryEquipmentType,
      name: getSimulatorSlotLabel(slot, 'equipmentPanel'),
      icon: iconMap[slot.type as SimulatorAccessoryEquipmentType],
    }));

  const getEquipmentInSlot = (type: EquipmentPanelSlotType, slot?: number) => {
    return equipment.find(
      (e) => e.type === type && (slot === undefined || e.slot === slot)
    );
  };

  const equippedMainItems = equipmentSlots
    .map((slotInfo) => getEquipmentInSlot(slotInfo.type, slotInfo.slot))
    .filter(Boolean) as Equipment[];
  const equippedTrinkets = trinketSlots
    .map((slotInfo) => getEquipmentInSlot(slotInfo.type, slotInfo.slot))
    .filter(Boolean) as Equipment[];
  const equippedJades = jadeSlots
    .map((slotInfo) => getEquipmentInSlot(slotInfo.type, slotInfo.slot))
    .filter(Boolean) as Equipment[];

  const runeStoneEffectTexts = getEquipmentEffectTexts(equippedMainItems, {
    includeRuneSetName: true,
    includeRuneSetEffect: true,
  });
  const trinketEffectTexts = getEquipmentEffectTexts(equippedTrinkets, {
    includeSetName: true,
    includeSpecialEffect: true,
    includeRefinementEffect: true,
    includeHighlights: true,
  });
  const jadeEffectTexts = getEquipmentEffectTexts(equippedJades, {
    includeSpecialEffect: true,
    includeRefinementEffect: true,
    includeExtraStat: true,
    includeHighlights: true,
  });
  const equippedPrimaryItems = equipment.filter((item) =>
    (SIMULATOR_PRIMARY_EQUIPMENT_TYPES as readonly string[]).includes(item.type)
  );
  const primaryExtraAttributeSummary = formatEquipmentExtraAttributeSummary(
    sumEquipmentExtraAttributeTotals(equippedPrimaryItems)
  );
  const regularSetSummary = buildActiveRegularSetSummaries(
    equippedPrimaryItems.map((item) => ({
      slot: item.type,
      setName: item.setName,
    })),
    regularSetRules
  ).map((item) => formatActiveRegularSetSummary(item));
  const artifactConfig = useMemo(
    () => buildSimulatorArtifactConfigFromTreasure(treasure),
    [treasure]
  );
  const artifactSummary = useMemo(
    () => buildSimulatorArtifactSummary(artifactConfig),
    [artifactConfig]
  );
  const artifactSpotlightTags = useMemo(
    () => buildSimulatorArtifactSpotlightTags(artifactConfig),
    [artifactConfig]
  );

  const updateArtifact = (patch: Partial<SimulatorArtifactConfig>) => {
    const nextConfig: SimulatorArtifactConfig = {
      name: artifactConfig?.name ?? '神器加成',
      statKey: artifactConfig?.statKey ?? 'magicDamage',
      value: artifactConfig?.value ?? 12,
      description: artifactConfig?.description,
      isActive: artifactConfig?.isActive ?? true,
      ...patch,
    };

    updateTreasure(buildSimulatorArtifactTreasure(nextConfig));
    setSaveArtifactMessage(null);
    setSaveArtifactError(null);
  };

  const applyArtifactPreset = (preset: SimulatorArtifactConfig) => {
    updateTreasure(buildSimulatorArtifactTreasure(preset));
    setSaveArtifactMessage(null);
    setSaveArtifactError(null);
  };

  const renderEffectSummary = (
    labels: string[],
    options: {
      emptyText: string;
      emptyClassName: string;
      filledClassName: string;
      textClassName: string;
    }
  ) => {
    if (labels.length === 0) {
      return <div className={options.emptyClassName}>{options.emptyText}</div>;
    }

    return (
      <div className={options.filledClassName}>
        <div className="flex flex-wrap justify-center gap-1.5">
          {labels.map((label) => (
            <span
              key={label}
              className={`${options.textClassName} rounded-full border px-2 py-0.5 text-[11px] leading-5`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const formatPrice = (price: number | undefined) => {
    const value = Number(price || 0);
    return value.toLocaleString('zh-CN');
  };

  const handleEquipClick = (type: EquipmentPanelSlotType, slot?: number) => {
    const current = getEquipmentInSlot(type, slot);

    // 如果已装备，打开详情弹窗
    if (current) {
      setSelectedEquipment(current);
      return;
    }

    // 未装备：打开装备库选择浮层
    const slotDefinition = findSimulatorSlotDefinition(type, slot);
    const slotName = slotDefinition
      ? getSimulatorSlotLabel(slotDefinition, 'equipmentPanel')
      : '装备';

    setLibraryModalInfo({
      type,
      name: slotName,
      slot,
    });
  };

  const handleSaveEquipment = async () => {
    setIsSavingEquipment(true);
    setSaveEquipmentError(null);
    setSaveEquipmentMessage(null);

    try {
      const resp = await fetch('/api/simulator/current/equipment', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          equipment,
          equipmentSets,
          activeSetIndex,
        }),
      });

      const payload = await resp.json();
      if (!resp.ok || payload?.code !== 0 || !payload?.data) {
        throw new Error(payload?.message || '保存失败');
      }

      applySimulatorBundleToStore(payload.data, {
        preserveWorkbenchState: true,
      });
      setSaveEquipmentMessage('当前装备已保存到云端');
    } catch (error) {
      console.error('Failed to save simulator equipment:', error);
      setSaveEquipmentError(
        error instanceof Error ? error.message : '保存失败'
      );
    } finally {
      setIsSavingEquipment(false);
    }
  };

  const handleSaveArtifact = async () => {
    setIsSavingArtifact(true);
    setSaveArtifactError(null);
    setSaveArtifactMessage(null);

    try {
      if (isNavigatorOffline()) {
        throw new Error('OFFLINE');
      }

      const resp = await fetch('/api/simulator/current/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level: baseAttributes.level,
          faction: baseAttributes.faction,
          baseHp: baseAttributes.hp,
          physique: baseAttributes.physique,
          magic: baseAttributes.magic,
          potentialPoints: baseAttributes.potentialPoints,
          strength: baseAttributes.strength,
          endurance: baseAttributes.endurance,
          agility: baseAttributes.agility,
          magicPower: baseAttributes.magicPower || 0,
          spiritualPower: combatStats.spiritualPower || 0,
          hp: combatStats.hp || 0,
          mp: combatStats.magic || 0,
          damage: combatStats.damage || 0,
          defense: combatStats.defense || 0,
          magicDamage: combatStats.magicDamage || 0,
          magicDefense: combatStats.magicDefense || 0,
          speed: combatStats.speed || 0,
          hit: combatStats.hit || 0,
          dodge: combatStats.dodge || 0,
          meridianConfig: meridian,
          ...(combatStats.sealHit !== undefined
            ? { sealHit: combatStats.sealHit }
            : {}),
          treasure,
        }),
      });

      const payload = await resp.json();
      if (!resp.ok || payload?.code !== 0 || !payload?.data) {
        throw new Error(payload?.message || '保存失败');
      }

      applySimulatorBundleToStore(payload.data, {
        preserveWorkbenchState: true,
      });
      setSaveArtifactMessage('神器加成已保存到云端');
    } catch (error) {
      console.error('Failed to save simulator artifact:', error);
      setSaveArtifactError(
        error instanceof Error && error.message === 'OFFLINE'
          ? '请检查网络'
          : getSimulatorNetworkErrorMessage(error, '保存失败')
      );
    } finally {
      setIsSavingArtifact(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-yellow-800/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl">
      {/* 标题栏 */}
      <div className="flex items-center justify-between border-b border-yellow-700/60 bg-gradient-to-r from-yellow-900/50 to-yellow-800/30 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-600">
            <Settings className="h-5 w-5 text-slate-900" />
          </div>
          <div>
            <h2 className="text-base font-bold text-yellow-100">当前装备</h2>
            <p className="text-xs text-yellow-400/80">Current Equipment</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saveEquipmentError && (
            <span className="text-xs text-red-300">{saveEquipmentError}</span>
          )}
          {!saveEquipmentError && saveEquipmentMessage && (
            <span className="text-xs text-emerald-300">
              {saveEquipmentMessage}
            </span>
          )}
          <button
            className="rounded-lg border border-yellow-700/50 bg-slate-900/70 px-4 py-2 text-xs font-bold text-yellow-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSavingEquipment}
            onClick={handleSaveEquipment}
          >
            {isSavingEquipment ? '保存中...' : '保存装备'}
          </button>
        </div>
      </div>

      {/* 当前装备内容 */}
      <div className="flex-1 space-y-4 overflow-x-visible overflow-y-auto p-4">
        {/* 装备区域 - 包含装备组合切换器 */}
        <div className="rounded-xl border border-yellow-800/40 bg-slate-900/40 p-3">
          <div className="mb-3 flex items-center gap-2 border-b border-yellow-800/30 pb-2">
            <Sword className="h-4 w-4 text-yellow-400" />
            <div className="text-sm font-medium text-yellow-400">装备</div>
            <button
              type="button"
              onClick={() => setShowInventoryModal(true)}
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-yellow-700/50 bg-slate-900/70 px-2 py-1 text-[11px] font-medium text-yellow-200 transition-colors hover:bg-slate-800"
            >
              <Package className="h-3.5 w-3.5" />
              装备总库
            </button>
          </div>

          {/* 装备组合切换器 */}
          <div className="mb-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs text-yellow-400/70">装备组合</div>
              <button
                type="button"
                onClick={() => addEquipmentSet()}
                className="inline-flex items-center gap-1 rounded-md border border-yellow-700/50 bg-slate-900/70 px-2 py-1 text-[11px] font-medium text-yellow-200 transition-colors hover:bg-slate-800"
              >
                <Plus className="h-3 w-3" />
                新建方案
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
              {equipmentSets.map((set, idx) => (
                <div
                  key={set.id || idx}
                  className={`rounded-xl border p-3 ${
                    idx === activeSetIndex
                      ? 'border-yellow-500/70 bg-yellow-900/15 shadow-[0_0_0_1px_rgba(250,204,21,0.08)]'
                      : 'border-yellow-800/30 bg-slate-900/35'
                  }`}
                >
                  {editingSetIndex === idx ? (
                    <input
                      id={`equipment-set-name-${idx}`}
                      name={`equipment-set-name-${idx}`}
                      type="text"
                      value={editedSetName}
                      onChange={(e) => setEditedSetName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveSetName(idx);
                        if (e.key === 'Escape') setEditingSetIndex(null);
                      }}
                      onBlur={() => saveSetName(idx)}
                      autoFocus
                      placeholder={getSetName(idx)}
                      className={`w-full rounded-lg py-2 text-center text-xs font-medium transition-all focus:outline-none ${
                        idx === activeSetIndex
                          ? 'border-2 border-yellow-400 bg-yellow-600 text-slate-900 shadow-lg shadow-yellow-900/30'
                          : 'border-2 border-yellow-600/60 bg-slate-800/60 text-yellow-400/80'
                      }`}
                    />
                  ) : (
                    <div className="space-y-2">
                      <div className="rounded-lg border border-slate-800/80 bg-slate-950/45 px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-yellow-100">
                              {getSetName(idx)}
                            </div>
                            <div className="mt-1 text-[11px] text-slate-400">
                              已配置 {(set.items || []).length} 个部位
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              idx === activeSetIndex
                                ? 'bg-yellow-500 text-slate-950'
                                : 'border border-yellow-800/40 bg-yellow-900/20 text-yellow-200/80'
                            }`}
                          >
                            {idx === activeSetIndex ? '当前使用' : '待切换'}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {idx === activeSetIndex ? (
                            <div className="inline-flex items-center rounded-md border border-emerald-600/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-200">
                              当前正在使用这个方案
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => selectEquipmentSet(idx)}
                              className="inline-flex items-center rounded-md border border-yellow-600/50 bg-yellow-500/15 px-3 py-1.5 text-[11px] font-semibold text-yellow-100 transition-colors hover:bg-yellow-500/25"
                            >
                              切换到此方案
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => duplicateEquipmentSet(idx)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-200 transition-colors hover:bg-emerald-500/20"
                          title="复制方案"
                        >
                          <Copy className="h-3.5 w-3.5 text-emerald-300/90" />
                          <span>复制</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditedSetName(getSetName(idx));
                            setEditingSetIndex(idx);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/20 bg-blue-500/10 px-2.5 py-1.5 text-[11px] text-blue-200 transition-colors hover:bg-blue-500/20"
                          title="重命名"
                        >
                          <Edit2 className="h-3.5 w-3.5 text-blue-300/90" />
                          <span>重命名</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeEquipmentSet(idx)}
                          disabled={equipmentSets.length <= 1}
                          className="inline-flex items-center gap-1.5 rounded-md border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-200 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-30"
                          title="删除方案"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-300/90" />
                          <span>删除</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 装备槽位 */}
          <div className="grid grid-cols-2 gap-2">
            {equipmentSlots.map((slotInfo) => (
              <EquipmentPanelSlot
                key={`${slotInfo.type}-${slotInfo.slot || 0}`}
                slotInfo={slotInfo}
                equip={getEquipmentInSlot(slotInfo.type, slotInfo.slot)}
                onClick={() => handleEquipClick(slotInfo.type, slotInfo.slot)}
              />
            ))}
          </div>

          {/* 符石套装效果 */}
          <div className="mt-3 border-t border-yellow-800/30 pt-3">
            <div className="mb-2 flex items-center gap-2">
              <Gem className="h-3.5 w-3.5 text-cyan-400" />
              <div className="text-xs font-medium text-cyan-400">
                符石套装效果
              </div>
            </div>
            {renderEffectSummary(runeStoneEffectTexts, {
              emptyText: '暂无符石套装',
              emptyClassName:
                'rounded-lg bg-slate-900/40 px-3 py-2 text-center text-xs text-yellow-500/50 italic',
              filledClassName:
                'rounded-lg border border-cyan-700/30 bg-cyan-900/20 px-3 py-2',
              textClassName: 'border-cyan-500/40 bg-cyan-950/40 text-cyan-200',
            })}
          </div>

          <div className="mt-3 border-t border-yellow-800/30 pt-3">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
              <div className="text-xs font-medium text-emerald-300">
                常规套装效果
              </div>
            </div>
            {renderEffectSummary(regularSetSummary, {
              emptyText: '暂无常规套装',
              emptyClassName:
                'rounded-lg bg-slate-900/40 px-3 py-2 text-center text-xs text-emerald-300/50 italic',
              filledClassName:
                'rounded-lg border border-emerald-700/30 bg-emerald-900/10 px-3 py-2',
              textClassName:
                'border-emerald-500/40 bg-emerald-950/40 text-emerald-100',
            })}
          </div>

          <div className="mt-3 border-t border-yellow-800/30 pt-3">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <div className="text-xs font-medium text-amber-300">双加汇总</div>
            </div>
            {renderEffectSummary(primaryExtraAttributeSummary, {
              emptyText: '暂无双加汇总',
              emptyClassName:
                'rounded-lg bg-slate-900/40 px-3 py-2 text-center text-xs text-amber-300/50 italic',
              filledClassName:
                'rounded-lg border border-amber-700/30 bg-amber-900/10 px-3 py-2',
              textClassName:
                'border-amber-500/40 bg-amber-950/40 text-amber-100',
            })}
          </div>
        </div>

        {/* 灵饰区域 */}
        <div className="rounded-xl border border-blue-700/40 bg-slate-900/40 p-3">
          <div className="mb-3 flex items-center gap-2 border-b border-blue-700/30 pb-2">
            <Sparkles className="h-4 w-4 text-blue-400" />
            <div className="text-sm font-medium text-blue-400">灵饰</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {trinketSlots.map((slotInfo) => (
              <EquipmentPanelSlot
                key={`${slotInfo.type}-${slotInfo.slot || 0}`}
                slotInfo={slotInfo}
                equip={getEquipmentInSlot(slotInfo.type, slotInfo.slot)}
                onClick={() => handleEquipClick(slotInfo.type, slotInfo.slot)}
                theme="blue"
              />
            ))}
          </div>

          {/* 灵饰套装效果 */}
          <div className="mt-3 border-t border-blue-700/30 pt-3">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              <div className="text-xs font-medium text-blue-400">
                灵饰套装效果
              </div>
            </div>
            {renderEffectSummary(trinketEffectTexts, {
              emptyText: '暂无灵饰套装',
              emptyClassName:
                'rounded-lg bg-slate-900/40 px-3 py-2 text-center text-xs text-blue-500/50 italic',
              filledClassName:
                'rounded-lg border border-blue-700/30 bg-blue-900/20 px-3 py-2',
              textClassName: 'border-blue-500/40 bg-blue-950/40 text-blue-200',
            })}
          </div>
        </div>

        {/* 玉魄区域 */}
        <div className="rounded-xl border border-purple-700/40 bg-slate-900/40 p-3">
          <div className="mb-3 flex items-center gap-2 border-b border-purple-700/30 pb-2">
            <Gem className="h-4 w-4 text-purple-400" />
            <div className="text-sm font-medium text-purple-400">玉魄</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {jadeSlots.map((slotInfo) => (
              <EquipmentPanelSlot
                key={`${slotInfo.type}-${slotInfo.slot || 0}`}
                slotInfo={slotInfo}
                equip={getEquipmentInSlot(slotInfo.type, slotInfo.slot)}
                onClick={() => handleEquipClick(slotInfo.type, slotInfo.slot)}
                theme="purple"
              />
            ))}
          </div>

          <div className="mt-3 border-t border-purple-700/30 pt-3">
            <div className="mb-2 flex items-center gap-2">
              <Gem className="h-3.5 w-3.5 text-purple-400" />
              <div className="text-xs font-medium text-purple-400">
                玉魄效果
              </div>
            </div>
            {renderEffectSummary(jadeEffectTexts, {
              emptyText: '暂无玉魄效果',
              emptyClassName:
                'rounded-lg bg-slate-900/40 px-3 py-2 text-center text-xs text-purple-500/50 italic',
              filledClassName:
                'rounded-lg border border-purple-700/30 bg-purple-900/20 px-3 py-2',
              textClassName:
                'border-purple-500/40 bg-purple-950/40 text-purple-200',
            })}
          </div>
        </div>

        <div className="rounded-xl border border-emerald-700/40 bg-slate-900/40 p-3">
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-emerald-700/30 pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-300" />
              <div className="text-sm font-medium text-emerald-300">
                神器加成
              </div>
            </div>
            <div className="flex items-center gap-3">
              {saveArtifactError && (
                <span className="text-[11px] text-red-300">
                  {saveArtifactError}
                </span>
              )}
              {!saveArtifactError && saveArtifactMessage && (
                <span className="text-[11px] text-emerald-300">
                  {saveArtifactMessage}
                </span>
              )}
              <button
                type="button"
                onClick={handleSaveArtifact}
                disabled={isSavingArtifact}
                className="rounded-lg border border-emerald-600/40 bg-emerald-950/30 px-3 py-1.5 text-[11px] font-medium text-emerald-100 transition-colors hover:bg-emerald-900/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingArtifact ? '保存中...' : '保存神器'}
              </button>
            </div>
          </div>

          {artifactConfig ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-700/20 bg-emerald-950/10 px-3 py-2 text-xs text-emerald-100/90">
                {artifactSummary}
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-medium text-emerald-200/70">
                  当前亮点
                </div>
                <div className="flex flex-wrap gap-2">
                  {artifactSpotlightTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-[11px] text-emerald-100"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-medium text-emerald-200/70">
                  常用预设
                </div>
                <div className="flex flex-wrap gap-2">
                  {SIMULATOR_ARTIFACT_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => applyArtifactPreset(preset)}
                      className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${
                        artifactConfig.statKey === preset.statKey &&
                        artifactConfig.value === preset.value &&
                        artifactConfig.name === preset.name
                          ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'
                          : 'border-emerald-700/30 bg-slate-950/60 text-emerald-200/80 hover:bg-emerald-950/30'
                      }`}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="space-y-1 text-xs text-emerald-100/80">
                  <span>名称</span>
                  <input
                    type="text"
                    value={artifactConfig.name}
                    onChange={(event) =>
                      updateArtifact({ name: event.target.value.slice(0, 24) })
                    }
                    placeholder="神器加成"
                    className="w-full rounded-lg border border-emerald-700/30 bg-slate-950/70 px-3 py-2 text-sm text-emerald-50 outline-none transition-colors focus:border-emerald-500/60"
                  />
                </label>

                <label className="space-y-1 text-xs text-emerald-100/80">
                  <span>属性类型</span>
                  <select
                    value={artifactConfig.statKey}
                    onChange={(event) =>
                      updateArtifact({
                        statKey: event.target.value as SimulatorArtifactConfig['statKey'],
                      })
                    }
                    className="w-full rounded-lg border border-emerald-700/30 bg-slate-950/70 px-3 py-2 text-sm text-emerald-50 outline-none transition-colors focus:border-emerald-500/60"
                  >
                    {SIMULATOR_ARTIFACT_STAT_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-xs text-emerald-100/80">
                  <span>数值</span>
                  <input
                    type="number"
                    value={artifactConfig.value}
                    onChange={(event) =>
                      updateArtifact({ value: Number(event.target.value || 0) })
                    }
                    className="w-full rounded-lg border border-emerald-700/30 bg-slate-950/70 px-3 py-2 text-sm text-emerald-50 outline-none transition-colors focus:border-emerald-500/60"
                  />
                </label>

                <label className="flex items-center justify-between rounded-lg border border-emerald-700/20 bg-slate-950/50 px-3 py-2 text-xs text-emerald-100/80">
                  <span>立即生效</span>
                  <button
                    type="button"
                    onClick={() =>
                      updateArtifact({ isActive: !artifactConfig.isActive })
                    }
                    className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                      artifactConfig.isActive
                        ? 'bg-emerald-500/20 text-emerald-200'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {artifactConfig.isActive ? '已启用' : '未启用'}
                  </button>
                </label>
              </div>

              <label className="block space-y-1 text-xs text-emerald-100/80">
                <span>说明</span>
                <textarea
                  value={artifactConfig.description ?? ''}
                  onChange={(event) =>
                    updateArtifact({
                      description: event.target.value.slice(0, 120),
                    })
                  }
                  rows={3}
                  placeholder="例如：阳玉临时加成，便于对比不同神器变量。"
                  className="w-full rounded-lg border border-emerald-700/30 bg-slate-950/70 px-3 py-2 text-sm text-emerald-50 outline-none transition-colors focus:border-emerald-500/60"
                />
              </label>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => updateTreasure(null)}
                  className="rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-slate-800"
                >
                  清空神器
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-emerald-700/30 bg-emerald-950/10 px-4 py-8 text-center">
              <div className="text-sm text-emerald-100/90">
                当前还没有配置神器加成
              </div>
              <div className="text-xs text-emerald-200/60">
                这里会参与面板、实验室对比和伤害模拟。
              </div>
              <button
                type="button"
                onClick={() =>
                  updateTreasure(
                    buildSimulatorArtifactTreasure({
                      name: '神器加成',
                      statKey: 'magicDamage',
                      value: 12,
                      description: '默认法伤神器模板',
                      isActive: true,
                    })
                  )
                }
                className="rounded-lg border border-emerald-600/40 bg-emerald-950/40 px-4 py-2 text-xs font-medium text-emerald-100 transition-colors hover:bg-emerald-900/40"
              >
                新增神器
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 装备详情弹窗 */}
      {selectedEquipment && (
        <EquipmentDetailModal
          equipment={selectedEquipment}
          onClose={() => setSelectedEquipment(null)}
        />
      )}

      {/* 装备库选择浮层 */}
      {libraryModalInfo && (
        <EquipmentLibraryModal
          slotType={libraryModalInfo.type}
          slotName={libraryModalInfo.name}
          slotSlot={libraryModalInfo.slot}
          availableItems={libraryItems}
          onSelect={(item) => {
            // 为选中的装备设置正确的 slot 信息
            const equipmentToAdd = {
              ...item.equipment,
              slot: libraryModalInfo.slot,
            };
            updateEquipment(equipmentToAdd);
          }}
          onClose={() => setLibraryModalInfo(null)}
        />
      )}

      {showInventoryModal && (
        <EquipmentInventoryModal
          items={inventoryModalItems}
          formatPrice={formatPrice}
          onRemoveCandidateItems={handleRemoveCandidateInventoryItems}
          onRemoveCandidateItem={handleRemoveCandidateInventoryItem}
          onRefreshInventoryLibrarySources={handleRefreshInventoryLibrarySources}
          onClose={() => setShowInventoryModal(false)}
        />
      )}
    </div>
  );
}
