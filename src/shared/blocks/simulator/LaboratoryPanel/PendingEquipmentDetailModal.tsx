import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  Equipment,
  PendingEquipment,
} from '@/features/simulator/store/gameTypes';
import { Check, Edit2, Eye, Save, X } from 'lucide-react';
import { motion } from 'motion/react';

import { EquipmentImage } from '@/shared/blocks/simulator/EquipmentPanel/EquipmentImage';
import {
  getSimulatorEquipmentFieldLabel,
  SIMULATOR_CHANGE_TRACKED_FIELDS,
  SIMULATOR_EDITABLE_STAT_KEYS,
  SIMULATOR_EQUIPMENT_TYPE_OPTIONS,
  SIMULATOR_EQUIPMENT_TYPE_STAT_HINTS,
} from '@/shared/lib/simulator-equipment-editor';
import { getSimulatorStatLabel } from '@/shared/lib/simulator-stat-labels';

type EditableStatKey = (typeof SIMULATOR_EDITABLE_STAT_KEYS)[number];
type HintableEquipmentType = keyof typeof SIMULATOR_EQUIPMENT_TYPE_STAT_HINTS;

interface PendingEquipmentDetailModalProps {
  item: PendingEquipment;
  onClose: () => void;
  onDelete: () => void;
  onConfirm: () => void;
  onReplaceToCurrentState: () => void;
  onSave: (equipment: Equipment) => Promise<void> | void;
}

function toFiniteNumber(value: string | number | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatPrice(price: number | undefined) {
  if (price === undefined) return '-';
  const hasDecimal = price % 1 !== 0;
  return hasDecimal ? price.toFixed(2) : price.toString();
}

function getStatName(key: string): string {
  return getSimulatorStatLabel(key);
}

function getFieldLabel(key: string): string {
  return getSimulatorEquipmentFieldLabel(key);
}

function isHintableEquipmentType(
  type: Equipment['type']
): type is HintableEquipmentType {
  return type in SIMULATOR_EQUIPMENT_TYPE_STAT_HINTS;
}

function normalizeComparable(value: unknown) {
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }

  return value ?? '';
}

function buildConsistencyWarnings(draft: Equipment) {
  const warnings: string[] = [];
  const expectedStats = isHintableEquipmentType(draft.type)
    ? SIMULATOR_EQUIPMENT_TYPE_STAT_HINTS[draft.type]
    : [];
  const statKeys = Object.keys(draft.stats || {}).filter(
    (key): key is EditableStatKey =>
      (SIMULATOR_EDITABLE_STAT_KEYS as readonly string[]).includes(key) &&
      Boolean(
        Number(
          (draft.stats as Record<string, number | undefined> | undefined)?.[key]
        )
      )
  );

  if (
    expectedStats.length > 0 &&
    statKeys.length > 0 &&
    !statKeys.some((key) => expectedStats.includes(key))
  ) {
    warnings.push(
      `${draft.type} 当前缺少常见核心属性，建议核对类型或数值字段。`
    );
  }

  if (draft.type === 'weapon' && draft.slot !== undefined) {
    warnings.push('武器通常不需要槽位，建议检查类型或槽位。');
  }

  if (
    (draft.type === 'trinket' || draft.type === 'jade') &&
    (draft.slot === undefined || draft.slot < 1)
  ) {
    warnings.push('灵饰或玉魄缺少槽位，后续可能无法正确挂载。');
  }

  if (draft.price !== undefined && draft.price < 0) {
    warnings.push('售价不能为负数。');
  }

  if (draft.crossServerFee !== undefined && draft.crossServerFee < 0) {
    warnings.push('跨服费不能为负数。');
  }

  if (draft.level !== undefined && draft.level <= 0) {
    warnings.push('等级看起来不合理，建议检查是否识别成了 0。');
  }

  if (
    draft.mainStat &&
    draft.stats &&
    Object.keys(draft.stats).length > 0 &&
    !Object.keys(draft.stats).some((key) =>
      draft.mainStat?.toLowerCase().includes(key.toLowerCase())
    )
  ) {
    warnings.push('主属性描述和数值属性看起来不一致，建议人工复核。');
  }

  return warnings;
}

export function PendingEquipmentDetailModal({
  item,
  onClose,
  onDelete,
  onConfirm,
  onReplaceToCurrentState,
  onSave,
}: PendingEquipmentDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState<Equipment>(item.equipment);

  useEffect(() => {
    setDraft(item.equipment);
    setIsEditing(false);
    setIsSaving(false);
  }, [item]);

  const statEntries = useMemo(
    () =>
      SIMULATOR_EDITABLE_STAT_KEYS.map((key) => ({
        key,
        label: getStatName(key),
        value: draft.stats?.[key] ?? draft.baseStats?.[key] ?? 0,
      })),
    [draft]
  );

  const reviewWarnings = useMemo(() => {
    const warnings: string[] = [];

    if (!draft.name?.trim()) {
      warnings.push('装备名称为空，建议优先补全。');
    }

    if (!draft.mainStat?.trim()) {
      warnings.push('主属性描述为空，建议核对截图主面板。');
    }

    if (!draft.type) {
      warnings.push('装备类型为空，后续无法正确挂载到席位。');
    }

    if ((draft.type === 'trinket' || draft.type === 'jade') && !draft.slot) {
      warnings.push('当前是灵饰/玉魄，但槽位还没确定。');
    }

    const statCount = Object.keys(draft.stats || {}).length;
    if (statCount === 0) {
      warnings.push('还没有识别出任何数值属性，建议人工补录。');
    }

    if (draft.price === undefined) {
      warnings.push('售价还没填，后续无法做性价比分析。');
    }

    return [...warnings, ...buildConsistencyWarnings(draft)];
  }, [draft]);

  const suggestedChecks = useMemo(() => {
    const suggestions: string[] = [];
    const expectedStats = isHintableEquipmentType(draft.type)
      ? SIMULATOR_EQUIPMENT_TYPE_STAT_HINTS[draft.type]
      : [];

    if (expectedStats.length > 0) {
      suggestions.push(
        `当前类型常见属性：${expectedStats
          .map((key) => getStatName(key))
          .join(' / ')}`
      );
    }

    if (!draft.highlights || draft.highlights.length === 0) {
      suggestions.push('如果截图里有特技、特效或套装，建议补到亮点标签。');
    }

    if (!draft.extraStat) {
      suggestions.push('如果截图里有红字双加或附加词条，建议补到附加描述。');
    }

    if (draft.type === 'trinket' && draft.slot === undefined) {
      suggestions.push('灵饰建议补槽位，常见值是 1-4。');
    }

    return suggestions;
  }, [draft]);

  const changedFields = useMemo(() => {
    const scalarChanges = SIMULATOR_CHANGE_TRACKED_FIELDS.filter(
      (field) =>
        normalizeComparable(item.equipment[field]) !==
        normalizeComparable(draft[field])
    ).map((field) => ({
      label: getFieldLabel(field),
      before: item.equipment[field],
      after: draft[field],
    }));

    const statChanges = SIMULATOR_EDITABLE_STAT_KEYS.filter(
      (key) =>
        normalizeComparable(item.equipment.stats?.[key]) !==
        normalizeComparable(draft.stats?.[key])
    ).map((key) => ({
      label: getStatName(key),
      before: item.equipment.stats?.[key],
      after: draft.stats?.[key],
    }));

    return [...scalarChanges, ...statChanges];
  }, [draft, item.equipment]);

  const updateDraft = (patch: Partial<Equipment>) => {
    setDraft((current) => ({
      ...current,
      ...patch,
    }));
  };

  const updateStat = (key: EditableStatKey, value: string) => {
    const nextValue =
      value.trim() === '' ? undefined : toFiniteNumber(value, 0);
    setDraft((current) => {
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

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave({
        ...draft,
        price:
          draft.price === undefined || draft.price === null
            ? undefined
            : toFiniteNumber(draft.price, 0),
        crossServerFee:
          draft.crossServerFee === undefined || draft.crossServerFee === null
            ? undefined
            : toFiniteNumber(draft.crossServerFee, 0),
        level:
          draft.level === undefined || draft.level === null
            ? undefined
            : toFiniteNumber(draft.level, 0),
        forgeLevel:
          draft.forgeLevel === undefined || draft.forgeLevel === null
            ? undefined
            : toFiniteNumber(draft.forgeLevel, 0),
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-yellow-700/60 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-yellow-700/60 bg-gradient-to-r from-yellow-900/50 to-yellow-800/30 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-yellow-100">
              {draft.name || '未命名装备'}
            </h2>
            <p className="mt-1 text-xs text-yellow-400/80">
              {isEditing ? '编辑识别结果' : '待确认装备详情'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing((current) => !current)}
              className="inline-flex items-center gap-1 rounded-lg border border-yellow-700/40 bg-slate-900/60 px-3 py-2 text-sm text-yellow-100 transition hover:border-yellow-500/70"
            >
              {isEditing ? (
                <>
                  <Eye className="h-4 w-4" />
                  查看
                </>
              ) : (
                <>
                  <Edit2 className="h-4 w-4" />
                  编辑
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 transition-colors hover:text-slate-200"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              <div className="rounded-lg border border-yellow-800/30 bg-slate-950/40 p-4">
                <div className="mb-4 flex gap-4">
                  <EquipmentImage equipment={draft} size="xl" />
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label={getFieldLabel('name')}>
                          <input
                            value={draft.name || ''}
                            onChange={(event) =>
                              updateDraft({ name: event.target.value })
                            }
                            className={inputClassName}
                          />
                        </Field>
                        <Field label={getFieldLabel('type')}>
                          <select
                            value={draft.type}
                            onChange={(event) =>
                              updateDraft({
                                type: event.target.value as Equipment['type'],
                              })
                            }
                            className={inputClassName}
                          >
                            {SIMULATOR_EQUIPMENT_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                        {(draft.type === 'trinket' ||
                          draft.type === 'jade') && (
                          <Field label={getFieldLabel('slot')}>
                            <input
                              value={draft.slot ?? ''}
                              onChange={(event) =>
                                updateDraft({
                                  slot:
                                    event.target.value === ''
                                      ? undefined
                                      : toFiniteNumber(event.target.value, 1),
                                })
                              }
                              className={inputClassName}
                            />
                          </Field>
                        )}
                        <Field label={getFieldLabel('level')}>
                          <input
                            value={draft.level ?? ''}
                            onChange={(event) =>
                              updateDraft({
                                level:
                                  event.target.value === ''
                                    ? undefined
                                    : toFiniteNumber(event.target.value, 0),
                              })
                            }
                            className={inputClassName}
                          />
                        </Field>
                      </div>
                    ) : (
                      <>
                        <div className="mb-2 text-2xl font-bold text-yellow-400">
                          {draft.name}
                        </div>
                        <div className="mb-2 text-sm leading-relaxed whitespace-pre-line text-slate-200">
                          {draft.mainStat || '待补充主属性'}
                        </div>
                        {draft.extraStat && (
                          <div className="text-sm whitespace-pre-line text-red-400">
                            {draft.extraStat}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label={getFieldLabel('mainStat')}>
                      <textarea
                        value={draft.mainStat || ''}
                        onChange={(event) =>
                          updateDraft({ mainStat: event.target.value })
                        }
                        className={textareaClassName}
                        rows={3}
                      />
                    </Field>
                    <Field label={getFieldLabel('extraStat')}>
                      <textarea
                        value={draft.extraStat || ''}
                        onChange={(event) =>
                          updateDraft({
                            extraStat: event.target.value || undefined,
                          })
                        }
                        className={textareaClassName}
                        rows={3}
                      />
                    </Field>
                    <Field label={`${getFieldLabel('highlights')}（逗号分隔）`}>
                      <input
                        value={draft.highlights?.join(', ') || ''}
                        onChange={(event) =>
                          updateDraft({
                            highlights: event.target.value
                              .split(',')
                              .map((item) => item.trim())
                              .filter(Boolean),
                          })
                        }
                        className={inputClassName}
                      />
                    </Field>
                    <Field label={getFieldLabel('equippableRoles')}>
                      <input
                        value={draft.equippableRoles || ''}
                        onChange={(event) =>
                          updateDraft({
                            equippableRoles: event.target.value || undefined,
                          })
                        }
                        className={inputClassName}
                      />
                    </Field>
                  </div>
                ) : (
                  draft.highlights &&
                  draft.highlights.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {draft.highlights.map((highlight, index) => (
                        <span
                          key={index}
                          className="rounded border border-red-500/50 px-2 py-1 text-xs font-medium text-red-400"
                        >
                          {highlight}
                        </span>
                      ))}
                    </div>
                  )
                )}
              </div>

              <div className="rounded-lg border border-yellow-800/30 bg-slate-950/40 p-4">
                <div className="mb-3 text-sm font-bold text-yellow-400">
                  基础信息
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label={getFieldLabel('element')}>
                    {isEditing ? (
                      <input
                        value={draft.element || ''}
                        onChange={(event) =>
                          updateDraft({
                            element: event.target.value || undefined,
                          })
                        }
                        className={inputClassName}
                      />
                    ) : (
                      <ReadValue value={draft.element} />
                    )}
                  </Field>
                  <Field label={getFieldLabel('durability')}>
                    {isEditing ? (
                      <input
                        value={draft.durability ?? ''}
                        onChange={(event) =>
                          updateDraft({
                            durability:
                              event.target.value === ''
                                ? undefined
                                : toFiniteNumber(event.target.value, 0),
                          })
                        }
                        className={inputClassName}
                      />
                    ) : (
                      <ReadValue value={draft.durability} />
                    )}
                  </Field>
                  <Field label={getFieldLabel('forgeLevel')}>
                    {isEditing ? (
                      <input
                        value={draft.forgeLevel ?? ''}
                        onChange={(event) =>
                          updateDraft({
                            forgeLevel:
                              event.target.value === ''
                                ? undefined
                                : toFiniteNumber(event.target.value, 0),
                          })
                        }
                        className={inputClassName}
                      />
                    ) : (
                      <ReadValue value={draft.forgeLevel} />
                    )}
                  </Field>
                  <Field label={getFieldLabel('gemstone')}>
                    {isEditing ? (
                      <input
                        value={draft.gemstone || ''}
                        onChange={(event) =>
                          updateDraft({
                            gemstone: event.target.value || undefined,
                          })
                        }
                        className={inputClassName}
                      />
                    ) : (
                      <ReadValue value={draft.gemstone} />
                    )}
                  </Field>
                  <Field label={getFieldLabel('price')}>
                    {isEditing ? (
                      <input
                        value={draft.price ?? ''}
                        onChange={(event) =>
                          updateDraft({
                            price:
                              event.target.value === ''
                                ? undefined
                                : toFiniteNumber(event.target.value, 0),
                          })
                        }
                        className={inputClassName}
                      />
                    ) : (
                      <ReadValue value={`¥ ${formatPrice(draft.price)}`} />
                    )}
                  </Field>
                  <Field label={getFieldLabel('crossServerFee')}>
                    {isEditing ? (
                      <input
                        value={draft.crossServerFee ?? ''}
                        onChange={(event) =>
                          updateDraft({
                            crossServerFee:
                              event.target.value === ''
                                ? undefined
                                : toFiniteNumber(event.target.value, 0),
                          })
                        }
                        className={inputClassName}
                      />
                    ) : (
                      <ReadValue
                        value={`¥ ${formatPrice(draft.crossServerFee)}`}
                      />
                    )}
                  </Field>
                </div>
              </div>

              <div className="rounded-lg border border-yellow-800/30 bg-slate-950/40 p-4">
                <div className="mb-3 text-sm font-bold text-yellow-400">
                  数值属性
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {statEntries.map((entry) => (
                    <Field key={entry.key} label={entry.label}>
                      {isEditing ? (
                        <input
                          value={entry.value || ''}
                          onChange={(event) =>
                            updateStat(entry.key, event.target.value)
                          }
                          className={inputClassName}
                        />
                      ) : (
                        <ReadValue
                          value={entry.value ? String(entry.value) : undefined}
                        />
                      )}
                    </Field>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-amber-700/30 bg-amber-950/20 p-4">
                <div className="mb-3 text-sm font-bold text-amber-300">
                  需要人工关注
                </div>
                {reviewWarnings.length > 0 ? (
                  <ul className="space-y-2 text-xs leading-relaxed text-amber-100/90">
                    {reviewWarnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-emerald-300">
                    当前关键字段已经比较完整，可以直接确认入库。
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-cyan-700/30 bg-cyan-950/20 p-4">
                <div className="mb-3 text-sm font-bold text-cyan-300">
                  当前改动
                </div>
                {changedFields.length > 0 ? (
                  <div className="space-y-2 text-xs text-slate-200">
                    {changedFields.map((change, index) => (
                      <div
                        key={`${change.label}-${index}`}
                        className="rounded-lg border border-cyan-800/40 bg-slate-950/30 p-2"
                      >
                        <div className="font-medium text-cyan-200">
                          {change.label}
                        </div>
                        <div className="mt-1 text-slate-400">
                          原始：{String(change.before ?? '-')}
                        </div>
                        <div className="text-slate-200">
                          当前：{String(change.after ?? '-')}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">
                    你还没有修改任何字段。
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-violet-700/30 bg-violet-950/20 p-4">
                <div className="mb-3 text-sm font-bold text-violet-300">
                  智能提示
                </div>
                <ul className="space-y-2 text-xs leading-relaxed text-violet-100/90">
                  {suggestedChecks.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-yellow-800/30 bg-slate-950/40 p-4">
                <div className="mb-3 text-sm font-bold text-yellow-400">
                  OCR 原始结果
                </div>
                <textarea
                  value={item.rawText || '当前没有保留 OCR 原始文本'}
                  readOnly
                  className={`${textareaClassName} min-h-[220px] text-xs text-slate-300`}
                />
              </div>

              <div className="rounded-lg border border-yellow-800/30 bg-slate-950/40 p-4">
                <div className="mb-3 text-sm font-bold text-yellow-400">
                  识别建议
                </div>
                <ul className="space-y-2 text-xs leading-relaxed text-slate-300">
                  <li>优先修正名称、类型、主属性和数值属性。</li>
                  <li>价格和跨服费可以后补，不影响先入库。</li>
                  <li>
                    如果 OCR 丢了红字或特技，建议写到“附加描述”或亮点标签里。
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 border-t border-yellow-700/60 bg-slate-900/80 px-6 py-4">
          <button
            onClick={onDelete}
            className="flex-1 rounded-lg border border-red-700/50 bg-red-900/30 px-4 py-2.5 font-medium text-red-400 transition-colors hover:bg-red-900/50"
          >
            删除
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg border border-green-700/50 bg-green-900/30 px-4 py-2.5 font-medium text-green-400 transition-colors hover:bg-green-900/50"
          >
            确认入库
          </button>
          <button
            onClick={onReplaceToCurrentState}
            className="flex-1 rounded-lg border border-yellow-700/50 bg-yellow-900/30 px-4 py-2.5 font-medium text-yellow-400 transition-colors hover:bg-yellow-900/50"
          >
            替换到当前状态
          </button>
          {isEditing && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-600 px-4 py-2.5 font-semibold text-slate-900 transition hover:bg-yellow-500 disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <Save className="h-4 w-4" />
                  保存中
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  保存修改
                </>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs text-slate-400">{label}</div>
      {children}
    </div>
  );
}

function ReadValue({ value }: { value?: string | number }) {
  return (
    <div className="min-h-10 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
      {value || '-'}
    </div>
  );
}

const inputClassName =
  'w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-yellow-600';
const textareaClassName =
  'w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-yellow-600';
