'use client';

import { useEffect, useState } from 'react';
import type { Equipment } from '@/features/simulator/store/gameTypes';
import { Trash2, X } from 'lucide-react';

import { EquipmentImage } from '@/shared/blocks/simulator/EquipmentPanel/EquipmentImage';
import {
  buildSimulatorEquipmentSelectorHelperText,
  sortSimulatorEquipmentSelectorItems,
  type SimulatorEquipmentLibraryItem,
} from '@/shared/lib/simulator-equipment-library';
import { getEquipmentSpotlightTags } from '@/shared/lib/simulator-equipment-spotlight';
import { buildSimulatorInventorySelectorStatusLabels } from '@/shared/lib/simulator-inventory-status';

import { mergeEquipmentWithInheritance } from './laboratory-utils';

type LaboratorySelectedSlot = {
  seatId: string;
  slotType: Equipment['type'];
  slotSlot?: number;
  slotLabel: string;
  baseEquip?: Equipment;
  currentEquip?: Equipment;
  inheritGemstones?: boolean;
  inheritRuneStones?: boolean;
};

type Props = {
  libraryItems: SimulatorEquipmentLibraryItem[];
  selectedSlot: LaboratorySelectedSlot;
  formatPrice: (price: number | undefined) => string;
  onClose: () => void;
  onClearEquipment: (
    seatId: string,
    type: Equipment['type'],
    slot?: number
  ) => void;
  onSelectEquipment: (
    seatId: string,
    equipment: Equipment,
    options?: {
      inheritGemstones?: boolean;
      inheritRuneStones?: boolean;
    }
  ) => void;
};

export function LaboratorySlotSelectorModal({
  libraryItems,
  selectedSlot,
  formatPrice,
  onClose,
  onClearEquipment,
  onSelectEquipment,
}: Props) {
  const [inheritGemstones, setInheritGemstones] = useState(
    selectedSlot.inheritGemstones !== false
  );
  const [inheritRuneStones, setInheritRuneStones] = useState(
    selectedSlot.inheritRuneStones !== false
  );

  useEffect(() => {
    setInheritGemstones(selectedSlot.inheritGemstones !== false);
    setInheritRuneStones(selectedSlot.inheritRuneStones !== false);
  }, [
    selectedSlot.inheritGemstones,
    selectedSlot.inheritRuneStones,
    selectedSlot.seatId,
    selectedSlot.slotSlot,
    selectedSlot.slotType,
  ]);

  const availableItems = sortSimulatorEquipmentSelectorItems(
    libraryItems.filter((item) => {
      if (item.equipment.type !== selectedSlot.slotType) return false;
      if (
        selectedSlot.slotSlot !== undefined &&
        item.equipment.slot !== selectedSlot.slotSlot
      ) {
        return false;
      }
      return true;
    })
  );

  const hasOverride = Boolean(selectedSlot.currentEquip);
  const canRestoreCurrent =
    Boolean(selectedSlot.baseEquip) &&
    hasOverride &&
    (selectedSlot.currentEquip?.id !== selectedSlot.baseEquip?.id ||
      selectedSlot.inheritGemstones === false ||
      selectedSlot.inheritRuneStones === false);

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-slate-950/95 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold text-yellow-100">
          选择装备 - {selectedSlot.slotLabel}
        </h3>
        <button
          onClick={onClose}
          className="text-sm text-yellow-400 hover:text-yellow-300"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="custom-scrollbar mb-4 flex-1 overflow-y-auto">
        <div className="mb-4 rounded-lg border border-slate-800/80 bg-slate-900/70 p-3">
          <div className="mb-2 text-xs font-bold text-yellow-200">
            局部换装策略
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded border border-slate-700/70 bg-slate-950/50 px-3 py-2 text-xs text-slate-200">
              <input
                type="checkbox"
                checked={inheritGemstones}
                onChange={(event) => setInheritGemstones(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-yellow-500"
              />
              <span>继承旧宝石</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded border border-slate-700/70 bg-slate-950/50 px-3 py-2 text-xs text-slate-200">
              <input
                type="checkbox"
                checked={inheritRuneStones}
                onChange={(event) => setInheritRuneStones(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-yellow-500"
              />
              <span>继承旧符石</span>
            </label>
          </div>
          <div className="mt-2 text-[11px] leading-5 text-slate-400">
            继承来源为样本席位该栏位的当前装备，用于模拟只换底子、不重打一套打造。
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-sky-800/30 bg-sky-950/10 px-3 py-2 text-[11px] leading-5 text-sky-100/85">
          这里优先展示这个部位可直接参与实验的真实库存来源，包括 `库存待用`
          的正式库存和候选装备库。方案关系只作为辅助说明展示，已经标记为 `已售出
          / 已作废`
          的正式库存不会出现在这里；如果要继续使用，先到装备总库里执行“恢复待用”。
        </div>

        {canRestoreCurrent && (
          <div
            onClick={() => {
              if (selectedSlot.baseEquip) {
                onSelectEquipment(selectedSlot.seatId, selectedSlot.baseEquip, {
                  inheritGemstones,
                  inheritRuneStones,
                });
              } else {
                onClearEquipment(
                  selectedSlot.seatId,
                  selectedSlot.slotType,
                  selectedSlot.slotSlot
                );
              }
              onClose();
            }}
            className="mb-2 cursor-pointer rounded-lg border border-red-600/40 bg-red-900/20 p-3 transition-all hover:border-red-600/60 hover:bg-red-900/30"
          >
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-400" />
              <span className="text-sm font-medium text-red-400">
                删除装备（恢复到当前装备）
              </span>
            </div>
          </div>
        )}

        {!selectedSlot.baseEquip && hasOverride && (
          <div
            onClick={() => {
              onClearEquipment(
                selectedSlot.seatId,
                selectedSlot.slotType,
                selectedSlot.slotSlot
              );
              onClose();
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

        {availableItems.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {availableItems.map((item) => {
              const equipment = item.equipment;
              const spotlightTags = getEquipmentSpotlightTags(equipment);
              const totalPrice =
                (equipment.price || 0) + (equipment.crossServerFee || 0);
              const inventoryStatusLabels =
                buildSimulatorInventorySelectorStatusLabels(item);
              const helperText =
                buildSimulatorEquipmentSelectorHelperText(item);
              const isCurrentlyEquipped =
                selectedSlot.currentEquip?.id === equipment.id &&
                inheritGemstones ===
                  (selectedSlot.inheritGemstones !== false) &&
                inheritRuneStones ===
                  (selectedSlot.inheritRuneStones !== false);

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (!isCurrentlyEquipped) {
                      onSelectEquipment(
                        selectedSlot.seatId,
                        mergeEquipmentWithInheritance(
                          selectedSlot.baseEquip,
                          equipment,
                          {
                            inheritGemstones,
                            inheritRuneStones,
                          }
                        ),
                        {
                          inheritGemstones,
                          inheritRuneStones,
                        }
                      );
                    }
                    onClose();
                  }}
                  className={`rounded-lg border bg-slate-900/60 p-3 transition-all ${
                    isCurrentlyEquipped
                      ? 'border-green-600/60 bg-green-900/20'
                      : 'cursor-pointer border-yellow-800/40 hover:border-yellow-600/60 hover:bg-slate-900/80'
                  }`}
                >
                  <div className="flex gap-3">
                    <EquipmentImage equipment={equipment} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-sm font-bold text-yellow-100">
                          {equipment.name}
                        </span>
                        {isCurrentlyEquipped && (
                          <span className="rounded border border-green-600/50 bg-green-900/20 px-1.5 py-0.5 text-[10px] font-medium text-green-400">
                            当前装备
                          </span>
                        )}
                      </div>

                      {inventoryStatusLabels.length > 0 && (
                        <div className="mb-1.5 flex flex-wrap gap-1">
                          {inventoryStatusLabels.map((statusLabel) => {
                            const toneClassName =
                              statusLabel.tone === 'amber'
                                ? 'border-amber-500/40 bg-amber-950/30 text-amber-100'
                                : statusLabel.tone === 'violet'
                                  ? 'border-violet-500/40 bg-violet-950/30 text-violet-100'
                                  : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-100';

                            return (
                              <span
                                key={`${item.id}-${statusLabel.label}`}
                                className={`rounded border px-1.5 py-0.5 text-[10px] ${toneClassName}`}
                              >
                                {statusLabel.label}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {(item.primarySourceLabels?.length ?? 0) > 0 && (
                        <div className="mb-1.5 flex flex-wrap gap-1">
                          {(item.primarySourceLabels ?? [])
                            .slice(0, 3)
                            .map((sourceLabel) => (
                              <span
                                key={`${item.id}-${sourceLabel}`}
                                className="rounded border border-sky-700/40 bg-sky-950/30 px-1.5 py-0.5 text-[10px] text-sky-200"
                              >
                                {sourceLabel}
                              </span>
                            ))}
                          {(item.primarySourceLabels?.length ?? 0) > 3 && (
                            <span className="rounded border border-slate-700/60 bg-slate-900/70 px-1.5 py-0.5 text-[10px] text-slate-300">
                              +{(item.primarySourceLabels?.length ?? 0) - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {helperText ? (
                        <div className="mb-1 text-[11px] text-slate-400">
                          {helperText}
                        </div>
                      ) : null}

                      {equipment.mainStat && (
                        <div className="text-xs leading-snug text-slate-300">
                          {equipment.mainStat}
                        </div>
                      )}

                      {equipment.extraStat && (
                        <div className="mt-0.5 text-xs leading-snug text-red-400">
                          {equipment.extraStat}
                        </div>
                      )}

                      {spotlightTags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {spotlightTags.slice(0, 4).map((highlight, index) => (
                              <span
                                key={index}
                                className="rounded border border-red-500/50 px-1 py-0.5 text-[10px] text-red-400"
                              >
                                {highlight}
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
          <div className="rounded-lg border border-dashed border-slate-700/80 px-4 py-8 text-center">
            <div className="text-sm text-slate-300">
              这个部位还没有可直接参与实验的装备
            </div>
            <div className="mt-2 text-xs leading-5 text-slate-500">
              当前正式库存待用和候选装备库里都没有命中这个部位。可以先上传候选装备、确认入库，或到装备总库恢复待用。
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
