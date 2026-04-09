'use client';

import { useState } from 'react';
import { useGameStore } from '@/features/simulator/store/gameStore';
import type { Equipment } from '@/features/simulator/store/gameTypes';
import { applySimulatorBundleToStore } from '@/features/simulator/utils/simulatorBundle';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit2,
  Gem,
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
  findSimulatorSlotDefinition,
  getSimulatorSlotLabel,
  SIMULATOR_JADE_SLOT_DEFINITIONS,
  SIMULATOR_PRIMARY_SLOT_DEFINITIONS,
  SIMULATOR_TRINKET_SLOT_DEFINITIONS,
} from '@/shared/lib/simulator-slot-config';

import { EquipmentDetailModal } from './EquipmentDetailModal';
import { EquipmentLibraryModal } from './EquipmentLibraryModal';
import {
  EquipmentPanelSlot,
  type EquipmentPanelSlotInfo,
} from './EquipmentPanelSlot';
import { getEquipmentRuneStoneSetInfo } from './RuneStoneHelper';

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

function getEquipmentLibraryKey(equipment: Equipment) {
  const normalizedName = equipment.name.trim().toLowerCase();
  const normalizedMainStat = equipment.mainStat.trim().toLowerCase();

  return [
    equipment.type,
    equipment.slot ?? 'default',
    normalizedName,
    equipment.level ?? 'default',
    normalizedMainStat,
    equipment.price ?? 'default',
  ].join(':');
}

function mergeLibraryEquipments(...groups: Equipment[][]) {
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const merged: Equipment[] = [];

  groups.forEach((group) => {
    group.forEach((equipment) => {
      const libraryKey = getEquipmentLibraryKey(equipment);

      if (seenIds.has(equipment.id) || seenKeys.has(libraryKey)) {
        return;
      }

      seenIds.add(equipment.id);
      seenKeys.add(libraryKey);
      merged.push(equipment);
    });
  });

  return merged;
}

type EquipmentPanelSlotType =
  | SimulatorPrimaryEquipmentType
  | SimulatorAccessoryEquipmentType;

export function EquipmentPanel() {
  const equipment = useGameStore((state) => state.equipment);
  const equipmentSets = useGameStore((state) => state.equipmentSets);
  const pendingEquipments = useGameStore((state) => state.pendingEquipments);
  const syncedCloudState = useGameStore((state) => state.syncedCloudState);
  const activeSetIndex = useGameStore((state) => state.activeSetIndex);
  const selectEquipmentSet = useGameStore((state) => state.selectEquipmentSet);
  const updateEquipmentSetName = useGameStore(
    (state) => state.updateEquipmentSetName
  );
  const addEquipmentSet = useGameStore((state) => state.addEquipmentSet);
  const duplicateEquipmentSet = useGameStore(
    (state) => state.duplicateEquipmentSet
  );
  const removeEquipmentSet = useGameStore((state) => state.removeEquipmentSet);
  const moveEquipmentSet = useGameStore((state) => state.moveEquipmentSet);
  const updateEquipment = useGameStore((state) => state.updateEquipment);

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
  const [libraryModalInfo, setLibraryModalInfo] = useState<{
    type: EquipmentPanelSlotType;
    name: string;
    slot?: number;
  } | null>(null);
  const libraryEquipments = mergeLibraryEquipments(
    equipment,
    equipmentSets.flatMap((set) => set.items),
    syncedCloudState?.equipment ?? [],
    syncedCloudState?.equipmentSets.flatMap((set) => set.items) ?? [],
    pendingEquipments
      .filter((item) => item.status === 'confirmed')
      .map((item) => item.equipment)
  );

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
            <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-3">
              {equipmentSets.map((set, idx) => (
                <div key={set.id || idx} className="group/set relative">
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
                    <>
                      <button
                        type="button"
                        onClick={() => selectEquipmentSet(idx)}
                        className={`w-full rounded-lg px-2 py-2 pr-20 text-left text-xs font-medium transition-all ${
                          idx === activeSetIndex
                            ? 'bg-yellow-600 text-slate-900 shadow-lg shadow-yellow-900/30'
                            : 'bg-slate-800/60 text-yellow-400/80 hover:bg-slate-700/60 hover:text-yellow-300'
                        }`}
                      >
                        {getSetName(idx)}
                      </button>
                      <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover/set:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveEquipmentSet(idx, 'left');
                          }}
                          disabled={idx === 0}
                          className="flex h-5 w-5 items-center justify-center rounded hover:bg-slate-700/70 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ChevronLeft className="h-3 w-3 text-yellow-200" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveEquipmentSet(idx, 'right');
                          }}
                          disabled={idx === equipmentSets.length - 1}
                          className="flex h-5 w-5 items-center justify-center rounded hover:bg-slate-700/70 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ChevronRight className="h-3 w-3 text-yellow-200" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateEquipmentSet(idx);
                          }}
                          className="flex h-5 w-5 items-center justify-center rounded hover:bg-emerald-500/20"
                        >
                          <Copy className="h-3 w-3 text-emerald-300/80" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditedSetName(getSetName(idx));
                            setEditingSetIndex(idx);
                          }}
                          className="flex h-5 w-5 items-center justify-center rounded hover:bg-blue-500/20"
                        >
                          <Edit2 className="h-3 w-3 text-blue-400/70" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeEquipmentSet(idx);
                          }}
                          disabled={equipmentSets.length <= 1}
                          className="flex h-5 w-5 items-center justify-center rounded hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Trash2 className="h-3 w-3 text-red-300/80" />
                        </button>
                      </div>
                    </>
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
          availableEquipments={libraryEquipments}
          onSelect={(equipment) => {
            // 为选中的装备设置正确的 slot 信息
            const equipmentToAdd = {
              ...equipment,
              slot: libraryModalInfo.slot,
            };
            updateEquipment(equipmentToAdd);
          }}
          onClose={() => setLibraryModalInfo(null)}
        />
      )}
    </div>
  );
}
