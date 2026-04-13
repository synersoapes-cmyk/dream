'use client';

import { useMemo } from 'react';
import type {
  Equipment,
  EquipmentEffectModifier,
} from '@/features/simulator/store/gameTypes';
import { Plus, Trash2 } from 'lucide-react';

import { useEquipmentExtensionConfigs } from '@/shared/blocks/simulator/use-equipment-extension-configs';
import { parseJadePercentSemanticOptions } from '@/shared/lib/simulator-jade-semantics';

const inputClassName =
  'w-full rounded-lg border border-yellow-700/40 bg-slate-900/70 px-3 py-2 text-sm text-yellow-100 outline-none transition-colors focus:border-yellow-500';

const SIMULATOR_ELEMENT_OPTIONS = ['金', '木', '水', '火', '土'] as const;

function toOptionalNumber(value: string) {
  if (value.trim() === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildDefaultModifier(
  options: ReturnType<typeof parseJadePercentSemanticOptions>
): EquipmentEffectModifier {
  const option = options[0]!;

  return {
    code: option.code,
    value: 0,
    label: `${option.label} +0${option.suffix}`,
    source: option.requiresElement ? '水' : 'editor',
  };
}

function buildModifierLabel(
  code: EquipmentEffectModifier['code'],
  value: number | undefined,
  source: string | undefined,
  options: ReturnType<typeof parseJadePercentSemanticOptions>
) {
  const option = options.find((item) => item.code === code);
  if (!option || value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  if (option.requiresElement) {
    return `${source || '水'}属性克制效果 +${value}${option.suffix}`;
  }

  return `${option.label} +${value}${option.suffix}`;
}

type Props = {
  equipment: Equipment;
  onChange: (nextEquipment: Equipment) => void;
  allowedCodes?: string[];
  poolDescription?: string;
};

export function AccessoryEffectModifierEditor({
  equipment,
  onChange,
  allowedCodes,
  poolDescription,
}: Props) {
  const { configs, isLoading } = useEquipmentExtensionConfigs([
    'jade_percent_semantics',
  ]);
  const modifierOptions = useMemo(
    () =>
      parseJadePercentSemanticOptions(
        configs.find((item) => item.configKey === 'jade_percent_semantics')
          ?.value
      ),
    [configs]
  );
  const modifiers = equipment.effectModifiers ?? [];
  const allowedCodeSet =
    allowedCodes && allowedCodes.length > 0 ? new Set(allowedCodes) : null;
  const filteredOptions =
    allowedCodeSet === null
      ? modifierOptions
      : modifierOptions.filter((item) => allowedCodeSet.has(item.code));
  const currentOnlyOptions = modifiers
    .filter(
      (modifier) =>
        !filteredOptions.some((item) => item.code === modifier.code)
    )
    .map((modifier) => ({
      code: modifier.code,
      label: modifier.label || String(modifier.code),
      suffix: '%',
      requiresElement: modifier.code === 'element_overcome_percent',
      description: undefined,
    }));
  const selectableOptions =
    filteredOptions.length > 0 ? filteredOptions : modifierOptions;
  const resolvedOptions = [...selectableOptions, ...currentOnlyOptions].filter(
    (item, index, source) =>
      source.findIndex((candidate) => candidate.code === item.code) === index
  );
  const disallowedModifiers =
    allowedCodeSet === null
      ? []
      : modifiers.filter((modifier) => !allowedCodeSet.has(modifier.code));

  const updateModifiers = (nextModifiers: EquipmentEffectModifier[] | undefined) => {
    onChange({
      ...equipment,
      effectModifiers: nextModifiers && nextModifiers.length > 0 ? nextModifiers : undefined,
    });
  };

  const handleAddModifier = () => {
    updateModifiers([...modifiers, buildDefaultModifier(selectableOptions)]);
  };

  const handleRemoveModifier = (index: number) => {
    updateModifiers(modifiers.filter((_, currentIndex) => currentIndex !== index));
  };

  const handlePatchModifier = (
    index: number,
    patch: Partial<EquipmentEffectModifier>
  ) => {
    updateModifiers(
      modifiers.map((modifier, currentIndex) =>
        currentIndex === index
          ? {
              ...modifier,
              ...patch,
            }
          : modifier
      )
    );
  };

  return (
    <div className="space-y-3 rounded-xl border border-violet-700/40 bg-slate-900 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-violet-300">玉魄百分比词条</div>
          <div className="mt-1 text-xs text-slate-400">
            {isLoading
              ? '正在读取规则中心里的玉魄百分比语义配置...'
              : '优先读取规则中心 jade_percent_semantics；无配置时回退到内置默认语义。'}
          </div>
          {poolDescription && (
            <div className="mt-1 text-xs text-cyan-400">{poolDescription}</div>
          )}
        </div>
        <button
          type="button"
          onClick={handleAddModifier}
          className="inline-flex items-center gap-1 rounded-lg border border-violet-600/40 bg-violet-900/20 px-3 py-2 text-xs text-violet-300 transition-colors hover:bg-violet-900/40"
        >
          <Plus className="h-4 w-4" />
          添加词条
        </button>
      </div>

      {modifiers.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-sm text-slate-400">
          还没有结构化百分比词条，可在这里录入玉魄的法术忽视、基础法术伤害、蓝量百分比等效果。
        </div>
      )}

      {disallowedModifiers.length > 0 && (
        <div className="rounded-lg border border-amber-700/50 bg-amber-950/20 px-3 py-3 text-sm text-amber-200">
          当前已有 {disallowedModifiers.length} 条百分比词条不在当前槽位的玉魄属性池内，建议检查后删除或同步规则配置。
        </div>
      )}

      <div className="space-y-3">
        {modifiers.map((modifier, index) => {
          const option =
            resolvedOptions.find(
              (item) => item.code === modifier.code
            ) ?? resolvedOptions[0]!;

          return (
            <div
              key={`${modifier.code}_${index}`}
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="text-sm font-medium text-yellow-100">
                  百分比词条 {index + 1}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveModifier(index)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-700/40 bg-red-950/30 px-2.5 py-1.5 text-xs text-red-300 transition-colors hover:bg-red-950/50"
                >
                  <Trash2 className="h-4 w-4" />
                  删除
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <div className="text-xs text-slate-400">词条类型</div>
                  <select
                    value={modifier.code}
                    onChange={(event) => {
                      const nextCode = event.target.value as EquipmentEffectModifier['code'];
                      const nextOption =
                        resolvedOptions.find((item) => item.code === nextCode) ??
                        resolvedOptions[0]!;
                      const nextSource = nextOption.requiresElement
                        ? modifier.source || '水'
                        : 'editor';
                      handlePatchModifier(index, {
                        code: nextCode,
                        label: buildModifierLabel(
                          nextCode,
                          modifier.value,
                          nextSource,
                          modifierOptions
                        ),
                        source: nextSource,
                      });
                    }}
                    className={inputClassName}
                  >
                    {resolvedOptions.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-slate-400">数值 ({option.suffix})</div>
                  <input
                    value={modifier.value}
                    onChange={(event) => {
                      const nextValue = toOptionalNumber(event.target.value) ?? 0;
                      const nextSource = option.requiresElement
                        ? modifier.source || '水'
                        : 'editor';
                      handlePatchModifier(index, {
                        value: nextValue,
                        label: buildModifierLabel(
                          modifier.code,
                          nextValue,
                          nextSource,
                          modifierOptions
                        ),
                        source: nextSource,
                      });
                    }}
                    className={inputClassName}
                    inputMode="decimal"
                  />
                </label>

                {option.requiresElement && (
                  <label className="space-y-1 md:col-span-2">
                    <div className="text-xs text-slate-400">适用五行</div>
                    <select
                      value={modifier.source || '水'}
                      onChange={(event) => {
                        const nextSource = event.target.value;
                        handlePatchModifier(index, {
                          source: nextSource,
                          label: buildModifierLabel(
                            modifier.code,
                            modifier.value,
                            nextSource,
                            modifierOptions
                          ),
                        });
                      }}
                      className={inputClassName}
                    >
                      {SIMULATOR_ELEMENT_OPTIONS.map((element) => (
                        <option key={element} value={element}>
                          {element}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {option.description && (
                  <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs leading-5 text-slate-400 md:col-span-2">
                    {option.description}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
