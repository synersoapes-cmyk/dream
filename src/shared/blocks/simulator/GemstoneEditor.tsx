'use client';

import type {
  Equipment,
  EquipmentGemstone,
} from '@/features/simulator/store/gameTypes';
import { Plus, Trash2 } from 'lucide-react';

import {
  createEquipmentGemstoneDraft,
  deriveEquipmentGemstoneStats,
  findEquipmentGemstoneDefinition,
  SIMULATOR_GEMSTONE_DEFINITIONS,
  summarizeEquipmentGemstones,
} from '@/shared/lib/simulator-equipment-meta';

const inputClassName =
  'w-full rounded-lg border border-yellow-700/40 bg-slate-900/70 px-3 py-2 text-sm text-yellow-100 outline-none transition-colors focus:border-yellow-500';

function toOptionalNumber(value: string) {
  if (value.trim() === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildNextEquipment(
  equipment: Equipment,
  gemstones: EquipmentGemstone[] | undefined
) {
  const nextGemstones =
    gemstones && gemstones.length > 0 ? gemstones : undefined;
  return {
    ...equipment,
    gemstones: nextGemstones,
    gemstone: summarizeEquipmentGemstones(nextGemstones),
  };
}

type Props = {
  equipment: Equipment;
  onChange: (nextEquipment: Equipment) => void;
  title?: string;
};

export function GemstoneEditor({
  equipment,
  onChange,
  title = '宝石配置',
}: Props) {
  const gemstones = equipment.gemstones ?? [];

  const updateGemstones = (nextGemstones: EquipmentGemstone[] | undefined) => {
    onChange(buildNextEquipment(equipment, nextGemstones));
  };

  const handleAddGemstone = () => {
    const baseName = SIMULATOR_GEMSTONE_DEFINITIONS[0]?.name ?? '舍利子';
    updateGemstones([
      ...gemstones,
      createEquipmentGemstoneDraft(baseName, gemstones.length),
    ]);
  };

  const handleRemoveGemstone = (index: number) => {
    updateGemstones(
      gemstones.filter((_, currentIndex) => currentIndex !== index)
    );
  };

  const handleGemstonePatch = (
    index: number,
    patch: Partial<EquipmentGemstone>
  ) => {
    updateGemstones(
      gemstones.map((gemstone, currentIndex) =>
        currentIndex === index
          ? {
              ...gemstone,
              ...patch,
            }
          : gemstone
      )
    );
  };

  const handleGemstoneNameChange = (index: number, name: string) => {
    const previous = gemstones[index];
    if (!previous) {
      return;
    }

    const nextDraft = createEquipmentGemstoneDraft(name, index);
    handleGemstonePatch(index, {
      ...nextDraft,
      id: previous.id,
      level: previous.level,
      quantity: previous.quantity,
      imageUrl: previous.imageUrl,
      stats: deriveEquipmentGemstoneStats(name, previous.level),
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-emerald-700/40 bg-slate-900 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-emerald-300">{title}</div>
          <div className="mt-1 text-xs text-slate-400">
            当前摘要：{equipment.gemstone || '未配置'}
          </div>
        </div>
        <button
          type="button"
          onClick={handleAddGemstone}
          className="inline-flex items-center gap-1 rounded-lg border border-emerald-600/40 bg-emerald-900/20 px-3 py-2 text-xs text-emerald-300 transition-colors hover:bg-emerald-900/40"
        >
          <Plus className="h-4 w-4" />
          添加宝石
        </button>
      </div>

      {gemstones.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-sm text-slate-400">
          还没有配置结构化宝石，添加后会自动同步摘要文本，并进入前台 /
          服务端属性汇总。
        </div>
      )}

      <div className="space-y-3">
        {gemstones.map((gemstone, index) => {
          const definition = findEquipmentGemstoneDefinition(gemstone.name);
          const statKey = definition?.defaultStat;
          const statLabel = definition?.statLabel ?? '数值';
          const statValue =
            statKey && gemstone.stats ? gemstone.stats[statKey] : undefined;

          return (
            <div
              key={gemstone.id || `gemstone_row_${index}`}
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-yellow-100">
                    宝石 {index + 1}
                  </div>
                  <div className="text-xs text-slate-400">
                    类型：
                    {(definition?.type ?? gemstone.type) || '未知'} · 五行：
                    {definition?.element ?? gemstone.element ?? '未设置'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveGemstone(index)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-700/40 bg-red-950/30 px-2.5 py-1.5 text-xs text-red-300 transition-colors hover:bg-red-950/50"
                >
                  <Trash2 className="h-4 w-4" />
                  删除
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <div className="text-xs text-slate-400">名称</div>
                  <select
                    value={gemstone.name}
                    onChange={(event) =>
                      handleGemstoneNameChange(index, event.target.value)
                    }
                    className={inputClassName}
                  >
                    {SIMULATOR_GEMSTONE_DEFINITIONS.map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-slate-400">图片 URL</div>
                  <input
                    value={gemstone.imageUrl ?? ''}
                    onChange={(event) =>
                      handleGemstonePatch(index, {
                        imageUrl: event.target.value || undefined,
                      })
                    }
                    className={inputClassName}
                    placeholder="可选"
                  />
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-slate-400">等级</div>
                  <input
                    value={gemstone.level ?? ''}
                    onChange={(event) => {
                      const nextLevel = toOptionalNumber(event.target.value);
                      handleGemstonePatch(index, {
                        level: nextLevel,
                        stats: deriveEquipmentGemstoneStats(
                          gemstone.name,
                          nextLevel
                        ),
                      });
                    }}
                    className={inputClassName}
                    inputMode="numeric"
                  />
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-slate-400">数量</div>
                  <input
                    value={gemstone.quantity ?? 1}
                    onChange={(event) =>
                      handleGemstonePatch(index, {
                        quantity: toOptionalNumber(event.target.value),
                      })
                    }
                    className={inputClassName}
                    inputMode="numeric"
                  />
                </label>

                <label className="space-y-1 md:col-span-2">
                  <div className="text-xs text-slate-400">{statLabel}</div>
                  <input
                    value={statValue ?? ''}
                    onChange={(event) => {
                      const nextValue = toOptionalNumber(event.target.value);
                      handleGemstonePatch(index, {
                        stats:
                          statKey && nextValue !== undefined
                            ? ({
                                [statKey]: nextValue,
                              } as EquipmentGemstone['stats'])
                            : undefined,
                      });
                    }}
                    className={inputClassName}
                    inputMode="decimal"
                    placeholder={
                      statKey === 'spellAbsorbRate'
                        ? '例如 5 表示 5%'
                        : '请输入数值'
                    }
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
