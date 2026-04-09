'use client';

import type { Equipment } from '@/features/simulator/store/gameTypes';
import { X, Trash2 } from 'lucide-react';

import { EquipmentImage } from '@/shared/blocks/simulator/EquipmentPanel/EquipmentImage';

type LaboratorySelectedSlot = {
  seatId: string;
  slotType: Equipment['type'];
  slotSlot?: number;
  slotLabel: string;
  currentEquip?: Equipment;
};

type Props = {
  libraryEquipments: Equipment[];
  selectedSlot: LaboratorySelectedSlot;
  formatPrice: (price: number | undefined) => string;
  onClose: () => void;
  onClearEquipment: (
    seatId: string,
    type: Equipment['type'],
    slot?: number
  ) => void;
  onSelectEquipment: (seatId: string, equipment: Equipment) => void;
};

export function LaboratorySlotSelectorModal({
  libraryEquipments,
  selectedSlot,
  formatPrice,
  onClose,
  onClearEquipment,
  onSelectEquipment,
}: Props) {
  const availableEquipments = libraryEquipments.filter((equipment) => {
    if (equipment.type !== selectedSlot.slotType) return false;
    if (
      selectedSlot.slotSlot !== undefined &&
      equipment.slot !== selectedSlot.slotSlot
    ) {
      return false;
    }
    return true;
  });

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
        {selectedSlot.currentEquip && (
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

        {availableEquipments.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {availableEquipments.map((equipment) => {
              const totalPrice =
                (equipment.price || 0) + (equipment.crossServerFee || 0);
              const isCurrentlyEquipped =
                selectedSlot.currentEquip?.id === equipment.id;

              return (
                <div
                  key={equipment.id}
                  onClick={() => {
                    if (!isCurrentlyEquipped) {
                      onSelectEquipment(selectedSlot.seatId, equipment);
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

                      {equipment.highlights && equipment.highlights.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {equipment.highlights.map((highlight, index) => (
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
          <div className="py-8 text-center text-slate-500">
            装备库中没有可用的{selectedSlot.slotLabel}
          </div>
        )}
      </div>
    </div>
  );
}
