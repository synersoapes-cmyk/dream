'use client';

import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '@/features/simulator/store/gameStore';
import type {
  Equipment,
  RuneStone,
} from '@/features/simulator/store/gameTypes';
import { getEquipmentDefaultImage } from '@/features/simulator/utils/equipmentImage';
import { Edit2, X } from 'lucide-react';
import { usePopper } from 'react-popper';

import {
  applySimulatorRuneSetSelection,
  createEmptyRuneStone,
  ensureSimulatorEquipmentRuneEditingState,
  getSimulatorActiveRuneSetIndex,
  getSimulatorRuneSetOptions,
  isSimulatorPrimaryEquipment,
} from '@/shared/lib/simulator-rune-editor';
import {
  getSimulatorEquipmentFieldLabel as getFieldLabel,
  SIMULATOR_EDITABLE_STAT_KEYS,
  SIMULATOR_EQUIPMENT_TYPE_STAT_HINTS,
} from '@/shared/lib/simulator-equipment-editor';
import { STAR_POSITION_OPTIONS } from '@/shared/blocks/simulator/star-position-options';
import { useSimulatorStarResonanceRules } from '@/shared/blocks/simulator/use-star-resonance-rules';
import { getSimulatorStatLabel } from '@/shared/lib/simulator-stat-labels';

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

const AVAILABLE_RUNE_SET_EFFECTS = ['锐不可当', '破血狂攻', '弱点击破'];
const inputClassName =
  'w-full rounded-lg border border-yellow-700/40 bg-slate-900/70 px-3 py-2 text-sm text-yellow-100 outline-none transition-colors focus:border-yellow-500';
const textareaClassName = `${inputClassName} min-h-24 resize-y`;

type EditableStatKey = (typeof SIMULATOR_EDITABLE_STAT_KEYS)[number];

interface EquipmentDetailModalProps {
  equipment: Equipment;
  onClose: () => void;
}

function toOptionalNumber(value: string) {
  if (value.trim() === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isAccessoryEquipment(
  type: Equipment['type']
): type is 'trinket' | 'jade' {
  return type === 'trinket' || type === 'jade';
}

function getAccessoryType(type: Equipment['type']): 'trinket' | 'jade' | null {
  return isAccessoryEquipment(type) ? type : null;
}

export function EquipmentDetailModal({
  equipment,
  onClose,
}: EquipmentDetailModalProps) {
  const updateEquipment = useGameStore((state) => state.updateEquipment);
  const removeEquipment = useGameStore((state) => state.removeEquipment);
  const [simulatedLibEquip, setSimulatedLibEquip] = useState<Equipment>(() =>
    ensureSimulatorEquipmentRuneEditingState(equipment)
  );

  // 符石和星石编辑相关状态
  const [runePopover, setRunePopover] = useState<{
    type:
      | 'rune'
      | 'starPosition'
      | 'starAlignment'
      | 'luckyHoles'
      | 'runeSet'
      | 'runeSetEffect';
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

  const formatPrice = (price: number | undefined) => {
    if (price === undefined) return '-';
    const hasDecimal = price % 1 !== 0;
    return hasDecimal ? price.toFixed(2) : price.toString();
  };

  const handleSave = () => {
    updateEquipment(simulatedLibEquip);
    onClose();
  };

  const handleUnequip = () => {
    removeEquipment(equipment.id);
    onClose();
  };

  const isPrimaryEquipment = isSimulatorPrimaryEquipment(
    simulatedLibEquip.type
  );
  const {
    options: starAlignmentOptions,
    isLoading: isLoadingStarRules,
    isPrimarySlot: canSelectStarAlignment,
  } = useSimulatorStarResonanceRules(
    isPrimaryEquipment ? simulatedLibEquip.type : undefined
  );
  const activeRuneSetIndex = getSimulatorActiveRuneSetIndex(simulatedLibEquip);
  const activeRuneSet =
    simulatedLibEquip.runeStoneSets?.[activeRuneSetIndex] ?? [];
  const runeSetOptions = getSimulatorRuneSetOptions(simulatedLibEquip);
  const isAccessory = isAccessoryEquipment(simulatedLibEquip.type);
  const accessoryType = getAccessoryType(simulatedLibEquip.type);
  const accessoryStatKeys = useMemo(
    () =>
      accessoryType
        ? SIMULATOR_EQUIPMENT_TYPE_STAT_HINTS[accessoryType].filter(
            (key): key is EditableStatKey =>
            (SIMULATOR_EDITABLE_STAT_KEYS as readonly string[]).includes(key)
          )
        : [],
    [accessoryType]
  );

  useEffect(() => {
    setSimulatedLibEquip(ensureSimulatorEquipmentRuneEditingState(equipment));
    setRunePopover(null);
  }, [equipment]);

  const updateAccessoryField = (patch: Partial<Equipment>) => {
    setSimulatedLibEquip((current) => ({
      ...current,
      ...patch,
    }));
  };

  const updateAccessoryStat = (key: EditableStatKey, value: string) => {
    const nextValue = toOptionalNumber(value);
    setSimulatedLibEquip((current) => {
      const nextStats = { ...(current.stats || {}) };
      const nextBaseStats = { ...(current.baseStats || {}) };

      if (nextValue === undefined) {
        delete nextStats[key];
        delete nextBaseStats[key];
      } else {
        nextStats[key] = nextValue;
        nextBaseStats[key] = nextValue;
      }

      return {
        ...current,
        stats: nextStats,
        baseStats: nextBaseStats,
      };
    });
  };

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-yellow-700/60 bg-slate-950 shadow-2xl">
        <div className="mb-4 flex flex-shrink-0 items-center justify-between p-5 pb-0">
          <h3 className="font-bold text-yellow-100">装备详情</h3>
          <button
            onClick={onClose}
            className="flex items-center gap-1 text-sm text-yellow-400 hover:text-yellow-300"
          >
            <X className="h-5 w-5" /> 返回
          </button>
        </div>

        <div className="custom-scrollbar mb-4 flex-1 overflow-y-auto p-5 pt-0">
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
                      已装备
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
                    <div className="mb-1 text-[10px] text-slate-500">售价</div>
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
                  <div className="mt-1 text-sm text-slate-300">
                    {simulatedLibEquip.type === 'trinket'
                      ? '星辉石等级 '
                      : simulatedLibEquip.type === 'jade'
                        ? '玉魄阶数 '
                        : '锻炼等级 '}
                    {simulatedLibEquip.forgeLevel}
                    {simulatedLibEquip.type !== 'jade' && (
                      <>
                        {' '}
                        镶嵌宝石{' '}
                        <span className="text-red-400">
                          {simulatedLibEquip.gemstone}
                        </span>
                      </>
                    )}
                  </div>
                )}

              {simulatedLibEquip.extraStat && (
                <div className="mt-1 text-sm text-green-400">
                  {simulatedLibEquip.extraStat}
                </div>
              )}

              {isAccessory && simulatedLibEquip.specialEffect && (
                <div className="mt-1 text-sm text-purple-400">
                  特效：{simulatedLibEquip.specialEffect}
                </div>
              )}

              {isAccessory && simulatedLibEquip.refinementEffect && (
                <div className="mt-1 text-sm text-cyan-400">
                  附加效果：{simulatedLibEquip.refinementEffect}
                </div>
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

            {isAccessory && (
              <div className="space-y-4 rounded-xl border border-blue-700/40 bg-slate-900 p-4">
                <div className="text-sm font-semibold text-blue-300">
                  {simulatedLibEquip.type === 'trinket'
                    ? '灵饰编辑'
                    : '玉魄编辑'}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <div className="text-xs text-slate-400">
                      {getFieldLabel('slot')}
                    </div>
                    <input
                      value={simulatedLibEquip.slot ?? ''}
                      onChange={(event) =>
                        updateAccessoryField({
                          slot: toOptionalNumber(event.target.value),
                        })
                      }
                      className={inputClassName}
                      inputMode="numeric"
                    />
                  </label>
                  <label className="space-y-1">
                    <div className="text-xs text-slate-400">
                      {getFieldLabel('level')}
                    </div>
                    <input
                      value={simulatedLibEquip.level ?? ''}
                      onChange={(event) =>
                        updateAccessoryField({
                          level: toOptionalNumber(event.target.value),
                        })
                      }
                      className={inputClassName}
                      inputMode="numeric"
                    />
                  </label>
                  <label className="space-y-1">
                    <div className="text-xs text-slate-400">
                      {getFieldLabel('forgeLevel')}
                    </div>
                    <input
                      value={simulatedLibEquip.forgeLevel ?? ''}
                      onChange={(event) =>
                        updateAccessoryField({
                          forgeLevel: toOptionalNumber(event.target.value),
                        })
                      }
                      className={inputClassName}
                      inputMode="numeric"
                    />
                  </label>
                  <label className="space-y-1">
                    <div className="text-xs text-slate-400">
                      {getFieldLabel('price')}
                    </div>
                    <input
                      value={simulatedLibEquip.price ?? ''}
                      onChange={(event) =>
                        updateAccessoryField({
                          price: toOptionalNumber(event.target.value),
                        })
                      }
                      className={inputClassName}
                      inputMode="decimal"
                    />
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <div className="text-xs text-slate-400">
                      {getFieldLabel('mainStat')}
                    </div>
                    <textarea
                      value={simulatedLibEquip.mainStat || ''}
                      onChange={(event) =>
                        updateAccessoryField({
                          mainStat: event.target.value,
                        })
                      }
                      className={textareaClassName}
                    />
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <div className="text-xs text-slate-400">
                      {getFieldLabel('extraStat')}
                    </div>
                    <textarea
                      value={simulatedLibEquip.extraStat || ''}
                      onChange={(event) =>
                        updateAccessoryField({
                          extraStat: event.target.value || undefined,
                        })
                      }
                      className={textareaClassName}
                    />
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <div className="text-xs text-slate-400">
                      {getFieldLabel('specialEffect')}
                    </div>
                    <input
                      value={simulatedLibEquip.specialEffect || ''}
                      onChange={(event) =>
                        updateAccessoryField({
                          specialEffect: event.target.value || undefined,
                        })
                      }
                      className={inputClassName}
                    />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {accessoryStatKeys.map((key) => (
                    <label key={key} className="space-y-1">
                      <div className="text-xs text-slate-400">
                        {getSimulatorStatLabel(key)}
                      </div>
                      <input
                        value={simulatedLibEquip.stats?.[key] ?? ''}
                        onChange={(event) =>
                          updateAccessoryStat(key, event.target.value)
                        }
                        className={inputClassName}
                        inputMode="decimal"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {isPrimaryEquipment && (
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
                              const newEquip =
                                ensureSimulatorEquipmentRuneEditingState({
                                  ...simulatedLibEquip,
                                  luckyHoles: num.toString(),
                                });
                              const nextActiveIndex =
                                getSimulatorActiveRuneSetIndex(newEquip);
                              const currentRunes = [
                                ...(newEquip.runeStoneSets?.[nextActiveIndex] ||
                                  []),
                              ];

                              if (num < currentRunes.length) {
                                newEquip.runeStoneSets![nextActiveIndex] =
                                  currentRunes.slice(0, num);
                              } else if (num > currentRunes.length) {
                                while (currentRunes.length < num) {
                                  currentRunes.push(
                                    createEmptyRuneStone(currentRunes.length)
                                  );
                                }
                                newEquip.runeStoneSets![nextActiveIndex] =
                                  currentRunes;
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

                {activeRuneSet.map((stone: RuneStone, idx: number) => (
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
                        符石{idx + 1}：{stone?.name || ''}{' '}
                        {stone?.description || ''}
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
                                  const newEquip =
                                    ensureSimulatorEquipmentRuneEditingState(
                                      simulatedLibEquip
                                    );
                                  const nextActiveIndex =
                                    getSimulatorActiveRuneSetIndex(newEquip);
                                  const nextRunes = [
                                    ...(newEquip.runeStoneSets?.[
                                      nextActiveIndex
                                    ] || []),
                                  ];
                                  nextRunes[idx] = { ...r };
                                  newEquip.runeStoneSets![nextActiveIndex] =
                                    nextRunes;
                                  setSimulatedLibEquip(newEquip);
                                  setRunePopover(null);
                                }}
                              >
                                <span className="font-medium text-green-400">
                                  {r.name}
                                </span>
                                <span className="text-xs text-slate-300">
                                  {Object.entries(r?.stats || {})
                                    .map(([k, v]) => {
                                      return `${getSimulatorStatLabel(k)} +${v}`;
                                    })
                                    .join(' ')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                ))}

                <div className="relative">
                  <div
                    ref={
                      runePopover?.type === 'starPosition'
                        ? setReferenceElement
                        : null
                    }
                    className="-mx-2 inline-flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm text-green-400 transition-colors hover:bg-slate-800/80"
                    onClick={() => setRunePopover({ type: 'starPosition' })}
                  >
                    星位：{simulatedLibEquip.starPosition || '无'}
                    <Edit2 className="h-3 w-3 text-green-400/60" />
                  </div>

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
                        {STAR_POSITION_OPTIONS.map((option) => (
                          <div
                            key={option.id}
                            className="cursor-pointer rounded px-3 py-2 transition-colors hover:bg-slate-700"
                            onClick={() => {
                              setSimulatedLibEquip({
                                ...simulatedLibEquip,
                                starPosition: option.label,
                                starPositionConfig:
                                  option.id === 'none' ? undefined : { ...option },
                              });
                              setRunePopover(null);
                            }}
                          >
                            <div className="text-sm text-green-400">
                              {option.label}
                            </div>
                            {option.attrType && (
                              <div className="mt-1 text-[11px] text-slate-400">
                                {option.attrType} · {option.attrValue}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative">
                  {canSelectStarAlignment && (
                    <div
                      ref={
                        runePopover?.type === 'starAlignment'
                          ? setReferenceElement
                          : null
                      }
                      className="-mx-2 inline-flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm text-green-400 transition-colors hover:bg-slate-800/80"
                      onClick={() => setRunePopover({ type: 'starAlignment' })}
                    >
                      星相互合：{simulatedLibEquip.starAlignment || '无'}
                      <Edit2 className="h-3 w-3 text-green-400/60" />
                    </div>
                  )}

                  {/* 星相互合选择浮层 */}
                  {runePopover?.type === 'starAlignment' && canSelectStarAlignment && (
                    <div
                      ref={setPopperElement}
                      style={{ ...styles.popper, zIndex: 9999 }}
                      {...attributes.popper}
                      className="w-72 overflow-hidden rounded-lg border border-yellow-700/50 bg-slate-800 shadow-xl"
                    >
                      <div className="custom-scrollbar max-h-60 overflow-y-auto p-1">
                        <div className="mb-1 border-b border-yellow-900/30 px-2 py-1.5 text-xs text-yellow-500/80">
                          选择星相互合规则
                        </div>
                        {isLoadingStarRules && (
                          <div
                            className="px-3 py-2 text-xs text-slate-400"
                          >
                            读取规则中...
                          </div>
                        )}
                        {starAlignmentOptions.map((option) => (
                          <div
                            key={option.id}
                            className="cursor-pointer rounded px-3 py-2 transition-colors hover:bg-slate-700"
                            onClick={() => {
                              setSimulatedLibEquip({
                                ...simulatedLibEquip,
                                starAlignment: option.value,
                                starAlignmentConfig:
                                  option.id === 'none'
                                    ? undefined
                                    : {
                                        id: option.id,
                                        label: option.value,
                                        attrType: option.attrType,
                                        attrValue: option.attrValue,
                                        comboName: option.title,
                                        colors: option.colors,
                                      },
                              });
                              setRunePopover(null);
                            }}
                          >
                            <div className="text-sm text-green-400">
                              {option.title}
                              <span className="ml-2 text-xs text-slate-400">
                                {option.value}
                              </span>
                            </div>
                            <div className="mt-1 text-[11px] text-slate-400">
                              {option.description}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 符石组合 - 可点击修改 */}
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
                    {simulatedLibEquip.runeStoneSetsNames?.[
                      activeRuneSetIndex
                    ] || '未配置'}
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
                        {runeSetOptions.map((rsName) => (
                          <div
                            key={rsName}
                            className="cursor-pointer rounded px-3 py-2 text-sm text-purple-400 transition-colors hover:bg-slate-700"
                            onClick={() => {
                              setSimulatedLibEquip(
                                applySimulatorRuneSetSelection(
                                  simulatedLibEquip,
                                  rsName
                                )
                              );
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

                {/* 符石套装效果 - 可点击修改 */}
                <div className="relative">
                  <div
                    ref={
                      runePopover?.type === 'runeSetEffect'
                        ? setReferenceElement
                        : null
                    }
                    className="-mx-2 mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm text-orange-400 transition-colors hover:bg-slate-800/80"
                    onClick={() => setRunePopover({ type: 'runeSetEffect' })}
                  >
                    符石套装效果：{simulatedLibEquip.runeSetEffect || '无'}
                    <Edit2 className="h-3 w-3 text-orange-400/60" />
                  </div>

                  {/* 符石套装效果选择浮层 */}
                  {runePopover?.type === 'runeSetEffect' && (
                    <div
                      ref={setPopperElement}
                      style={{ ...styles.popper, zIndex: 9999 }}
                      {...attributes.popper}
                      className="w-48 overflow-hidden rounded-lg border border-yellow-700/50 bg-slate-800 shadow-xl"
                    >
                      <div className="custom-scrollbar max-h-60 overflow-y-auto p-1">
                        <div className="mb-1 border-b border-yellow-900/30 px-2 py-1.5 text-xs text-yellow-500/80">
                          选择套装效果
                        </div>
                        {['无', ...AVAILABLE_RUNE_SET_EFFECTS].map(
                          (effectName, i) => (
                            <div
                              key={i}
                              className="cursor-pointer rounded px-3 py-2 text-sm text-orange-400 transition-colors hover:bg-slate-700"
                              onClick={() => {
                                setSimulatedLibEquip({
                                  ...simulatedLibEquip,
                                  runeSetEffect:
                                    effectName === '无'
                                      ? undefined
                                      : effectName,
                                });
                                setRunePopover(null);
                              }}
                            >
                              {effectName}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 底部操作区 */}
        <div className="flex-shrink-0 border-t border-yellow-800/30 bg-slate-900 p-5 pt-4">
          <div className="flex gap-4">
            <button
              onClick={handleUnequip}
              className="flex flex-1 flex-col items-center justify-center rounded-lg border border-red-600/40 bg-red-900/30 p-3 text-center transition-colors hover:bg-red-900/50"
            >
              <span className="text-sm font-medium text-red-400">卸下装备</span>
            </button>
            <button
              onClick={handleSave}
              className="flex flex-1 flex-col items-center justify-center rounded-lg bg-yellow-600 p-3 text-center text-slate-900 transition-colors hover:bg-yellow-500"
            >
              <span className="text-sm font-bold">保存修改</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
