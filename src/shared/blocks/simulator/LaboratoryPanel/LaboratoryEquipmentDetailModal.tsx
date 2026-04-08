'use client';

import { useEffect, useState } from 'react';
import type {
  Equipment,
  ExperimentSeat,
  RuneStone,
} from '@/features/simulator/store/gameTypes';
import { getEquipmentDefaultImage } from '@/features/simulator/utils/equipmentImage';
import { Edit2, X } from 'lucide-react';
import { usePopper } from 'react-popper';

import { getSimulatorStatLabel } from '@/shared/lib/simulator-stat-labels';

import {
  AVAILABLE_GEMSTONES,
  AVAILABLE_RUNE_SETS,
  AVAILABLE_RUNES,
  AVAILABLE_STAR_ALIGNMENTS,
  AVAILABLE_STAR_POSITIONS,
  cloneEquipmentForEditor,
  getSeatDisplayName,
} from './laboratory-utils';

type Props = {
  equipment: Equipment;
  experimentSeats: ExperimentSeat[];
  formatPrice: (price: number | undefined) => string;
  onClose: () => void;
  onReplaceCurrent: (equipment: Equipment) => Promise<void> | void;
  onApplyToSeat: (seatId: string, equipment: Equipment) => Promise<void> | void;
};

export function LaboratoryEquipmentDetailModal({
  equipment,
  experimentSeats,
  formatPrice,
  onClose,
  onReplaceCurrent,
  onApplyToSeat,
}: Props) {
  const [draftEquipment, setDraftEquipment] = useState<Equipment>(
    cloneEquipmentForEditor(equipment)
  );
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
    setDraftEquipment(cloneEquipmentForEditor(equipment));
    setRunePopover(null);
  }, [equipment]);

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-slate-950/95 p-5">
      <div className="mb-4 flex flex-shrink-0 items-center justify-between">
        <h3 className="font-bold text-yellow-100">装备详情 & 挂载</h3>
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-sm text-yellow-400 hover:text-yellow-300"
        >
          <X className="h-5 w-5" /> 返回
        </button>
      </div>

      <div className="custom-scrollbar mb-4 flex-1 overflow-y-auto">
        <div className="space-y-3">
          <div className="rounded-xl border border-yellow-800/40 bg-slate-900 p-4">
            <div className="flex gap-6">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-yellow-800/30 bg-slate-950/50">
                <img
                  src={
                    draftEquipment.imageUrl ||
                    getEquipmentDefaultImage(draftEquipment.type)
                  }
                  alt={draftEquipment.name}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <div className="text-2xl font-bold text-yellow-400">
                    {draftEquipment.name}
                  </div>
                  <div className="rounded border border-green-600/50 bg-green-900/20 px-2 py-0.5 text-[10px] font-medium text-green-400">
                    已入库
                  </div>
                </div>

                {draftEquipment.highlights &&
                  draftEquipment.highlights.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {draftEquipment.highlights.map((highlight, index) => (
                        <span
                          key={index}
                          className="rounded border border-red-500/50 px-2 py-0.5 text-xs font-medium text-red-400"
                        >
                          {highlight}
                        </span>
                      ))}
                    </div>
                  )}

                {draftEquipment.description && (
                  <div className="mb-2 text-sm leading-relaxed text-slate-300">
                    {draftEquipment.description}
                  </div>
                )}

                {draftEquipment.equippableRoles && (
                  <div>
                    <span className="text-xs text-green-400">【装备角色】</span>
                    <span className="ml-1 text-xs text-slate-300">
                      {draftEquipment.equippableRoles}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-col gap-3 border-l border-yellow-800/30 pl-6">
                <div className="text-right">
                  <div className="mb-1 text-[10px] text-slate-500">售价</div>
                  <div className="text-xl font-bold text-[#fff064]">
                    ¥ {formatPrice(draftEquipment.price)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="mb-1 text-[10px] text-slate-500">
                    跨服费用
                  </div>
                  <div className="text-xl font-bold text-[#fff064]">
                    ¥ {formatPrice(draftEquipment.crossServerFee)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-yellow-800/40 bg-slate-900 p-4">
            <div className="mb-3 flex gap-6">
              {draftEquipment.level && (
                <div>
                  <span className="text-sm font-bold text-yellow-400">
                    等级 {draftEquipment.level}
                  </span>
                </div>
              )}
              {draftEquipment.element && draftEquipment.element !== '无' && (
                <div>
                  <span className="text-sm text-yellow-400">五行 </span>
                  <span className="text-sm font-bold text-yellow-400">
                    {draftEquipment.element}
                  </span>
                </div>
              )}
            </div>

            <div className="mb-2 text-sm text-yellow-100">
              {draftEquipment.mainStat}
            </div>

            {draftEquipment.durability && (
              <div className="text-sm text-slate-300">
                耐久度 {draftEquipment.durability}
              </div>
            )}

            {draftEquipment.forgeLevel !== undefined &&
              draftEquipment.gemstone && (
                <>
                  <div className="mt-1 text-sm text-slate-300">
                    {draftEquipment.type === 'trinket'
                      ? '星辉石等级 '
                      : draftEquipment.type === 'jade'
                        ? '玉魄阶数 '
                        : '锻炼等级 '}
                    {draftEquipment.forgeLevel}
                  </div>
                  {draftEquipment.type !== 'jade' && (
                    <div className="relative mt-1 text-sm text-slate-300">
                      <span className="text-slate-300">镶嵌宝石 </span>
                      <span
                        ref={
                          runePopover?.type === 'gemstone'
                            ? setReferenceElement
                            : null
                        }
                        className="-mx-1.5 inline-flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 text-red-400 transition-colors hover:bg-slate-800/80"
                        onClick={() => setRunePopover({ type: 'gemstone' })}
                      >
                        {draftEquipment.gemstone}
                        <Edit2 className="h-3 w-3 text-red-400/60" />
                      </span>
                    </div>
                  )}
                </>
              )}

            {draftEquipment.extraStat && (
              <div className="mt-1 text-sm text-green-400">
                {draftEquipment.extraStat}
              </div>
            )}

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
                        setDraftEquipment({ ...draftEquipment, gemstone });
                        setRunePopover(null);
                      }}
                    >
                      {gemstone}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {runePopover?.type === 'gemstone' && (
              <div
                className="fixed inset-0 z-40"
                onClick={() => setRunePopover(null)}
              />
            )}
          </div>

          {draftEquipment.type === 'trinket' &&
            draftEquipment.specialEffect && (
              <div className="space-y-2 rounded-xl border border-yellow-800/40 bg-slate-900 p-4">
                <div className="text-sm text-purple-400">
                  特效：{draftEquipment.specialEffect}
                </div>
              </div>
            )}

          {draftEquipment.type !== 'trinket' &&
            draftEquipment.type !== 'jade' &&
            draftEquipment.runeStoneSets &&
            draftEquipment.runeStoneSets.length > 0 && (
              <div className="space-y-2 rounded-xl border border-yellow-800/40 bg-slate-900 p-4">
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
                    开运孔数：{draftEquipment.luckyHoles || '0'}
                    <Edit2 className="h-3 w-3 text-green-400/60" />
                  </div>

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
                              const nextEquipment = {
                                ...draftEquipment,
                                luckyHoles: num.toString(),
                              };

                              if (
                                nextEquipment.runeStoneSets &&
                                nextEquipment.runeStoneSets.length > 0
                              ) {
                                nextEquipment.runeStoneSets = [
                                  ...nextEquipment.runeStoneSets,
                                ];
                                const currentRunes = [
                                  ...(nextEquipment.runeStoneSets[0] || []),
                                ];

                                if (num < currentRunes.length) {
                                  nextEquipment.runeStoneSets[0] =
                                    currentRunes.slice(0, num);
                                } else if (num > currentRunes.length) {
                                  while (
                                    nextEquipment.runeStoneSets[0].length < num
                                  ) {
                                    nextEquipment.runeStoneSets[0].push({
                                      id: `empty_rune_${nextEquipment.runeStoneSets[0].length + 1}`,
                                      name: '未配置符石',
                                      type: 'empty',
                                      stats: {},
                                    });
                                  }
                                }
                              }

                              setDraftEquipment(nextEquipment);
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

                {draftEquipment.runeStoneSets[0].map(
                  (stone: RuneStone, index: number) => (
                    <div key={index} className="relative">
                      <div
                        ref={
                          runePopover?.type === 'rune' &&
                          runePopover.index === index
                            ? setReferenceElement
                            : null
                        }
                        className="-mx-2 inline-flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm text-green-400 transition-colors hover:bg-slate-800/80"
                        onClick={() => setRunePopover({ type: 'rune', index })}
                      >
                        <span>
                          符石{index + 1}：{stone.name || ''}{' '}
                          {Object.entries(stone.stats)
                            .map(
                              ([key, value]) =>
                                `${getSimulatorStatLabel(key)} +${value}`
                            )
                            .join(' ')}
                        </span>
                        <Edit2 className="h-3 w-3 text-green-400/60" />
                      </div>

                      {runePopover?.type === 'rune' &&
                        runePopover.index === index && (
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
                              {AVAILABLE_RUNES.map((rune) => (
                                <div
                                  key={rune.id}
                                  className="flex cursor-pointer items-center justify-between rounded px-3 py-2 text-sm transition-colors hover:bg-slate-700"
                                  onClick={() => {
                                    const nextEquipment = {
                                      ...draftEquipment,
                                    };
                                    nextEquipment.runeStoneSets = [
                                      ...(nextEquipment.runeStoneSets ?? []),
                                    ];
                                    nextEquipment.runeStoneSets[0] = [
                                      ...(nextEquipment.runeStoneSets[0] ?? []),
                                    ];
                                    nextEquipment.runeStoneSets[0][index] = {
                                      ...rune,
                                    };
                                    setDraftEquipment(nextEquipment);
                                    setRunePopover(null);
                                  }}
                                >
                                  <span className="font-medium text-green-400">
                                    {rune.name}
                                  </span>
                                  <span className="text-xs text-slate-300">
                                    {Object.entries(rune.stats)
                                      .map(
                                        ([key, value]) =>
                                          `${getSimulatorStatLabel(key)} +${value}`
                                      )
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
                  {draftEquipment.starPosition && (
                    <div
                      ref={
                        runePopover?.type === 'starPosition'
                          ? setReferenceElement
                          : null
                      }
                      className="-mx-2 inline-flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm text-green-400 transition-colors hover:bg-slate-800/80"
                      onClick={() => setRunePopover({ type: 'starPosition' })}
                    >
                      星位：{draftEquipment.starPosition}
                      <Edit2 className="h-3 w-3 text-green-400/60" />
                    </div>
                  )}

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
                        {AVAILABLE_STAR_POSITIONS.map((starPosition, index) => (
                          <div
                            key={index}
                            className="cursor-pointer rounded px-3 py-2 text-sm text-green-400 transition-colors hover:bg-slate-700"
                            onClick={() => {
                              setDraftEquipment({
                                ...draftEquipment,
                                starPosition,
                              });
                              setRunePopover(null);
                            }}
                          >
                            {starPosition}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative">
                  {draftEquipment.starAlignment && (
                    <div
                      ref={
                        runePopover?.type === 'starAlignment'
                          ? setReferenceElement
                          : null
                      }
                      className="-mx-2 inline-flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm text-green-400 transition-colors hover:bg-slate-800/80"
                      onClick={() => setRunePopover({ type: 'starAlignment' })}
                    >
                      星相互合：{draftEquipment.starAlignment}
                      <Edit2 className="h-3 w-3 text-green-400/60" />
                    </div>
                  )}

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
                        {AVAILABLE_STAR_ALIGNMENTS.map(
                          (starAlignment, index) => (
                            <div
                              key={index}
                              className="cursor-pointer rounded px-3 py-2 text-sm text-green-400 transition-colors hover:bg-slate-700"
                              onClick={() => {
                                setDraftEquipment({
                                  ...draftEquipment,
                                  starAlignment,
                                });
                                setRunePopover(null);
                              }}
                            >
                              {starAlignment}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {draftEquipment.runeStoneSetsNames &&
                  draftEquipment.runeStoneSetsNames.length > 0 && (
                    <div className="relative">
                      <div
                        ref={
                          runePopover?.type === 'runeSet'
                            ? setReferenceElement
                            : null
                        }
                        className="-mx-2 mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm text-purple-400 transition-colors hover:bg-slate-800/80"
                        onClick={() => setRunePopover({ type: 'runeSet' })}
                      >
                        符石组合：
                        {draftEquipment.runeStoneSetsNames[0]}
                        <Edit2 className="h-3 w-3 text-purple-400/60" />
                      </div>

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
                            {AVAILABLE_RUNE_SETS.map((runeSetName, index) => (
                              <div
                                key={index}
                                className="cursor-pointer rounded px-3 py-2 text-sm text-purple-400 transition-colors hover:bg-slate-700"
                                onClick={() => {
                                  const nextEquipment = { ...draftEquipment };
                                  nextEquipment.runeStoneSetsNames = [
                                    runeSetName,
                                    ...(nextEquipment.runeStoneSetsNames?.slice(
                                      1
                                    ) || []),
                                  ];
                                  setDraftEquipment(nextEquipment);
                                  setRunePopover(null);
                                }}
                              >
                                {runeSetName}
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

      <div className="flex-shrink-0 border-t border-yellow-800/30 pt-4">
        <div className="mb-3 text-sm font-bold text-yellow-100">
          选择挂载位置：
        </div>
        <div className="custom-scrollbar flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={async () => {
              await onReplaceCurrent(draftEquipment);
              onClose();
            }}
            className="flex w-[calc(100%/6)] min-w-[140px] flex-shrink-0 flex-col items-center justify-center rounded-lg border border-yellow-600/40 bg-yellow-900/30 p-3 text-center transition-colors hover:bg-yellow-900/50"
          >
            <span className="text-sm font-medium text-yellow-100">
              替换到【当前状态】
            </span>
          </button>

          {experimentSeats
            .filter((seat) => !seat.isSample)
            .map((seat) => (
              <button
                key={seat.id}
                onClick={async () => {
                  await onApplyToSeat(seat.id, draftEquipment);
                  onClose();
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
  );
}
