import type { EquipmentEffectModifier } from '@/features/simulator/store/gameTypes';

type JsonObject = Record<string, unknown>;

export type JadePercentSemanticOption = {
  code: EquipmentEffectModifier['code'];
  label: string;
  suffix: string;
  description?: string;
  requiresElement?: boolean;
};

export const DEFAULT_JADE_PERCENT_SEMANTIC_OPTIONS: JadePercentSemanticOption[] =
  [
    {
      code: 'spell_ignore_percent',
      label: '法术忽视 / 穿透',
      suffix: '%',
      description: '按目标法防忽视比例参与服务端伤害计算。',
    },
    {
      code: 'spell_damage_percent',
      label: '基础法术伤害',
      suffix: '%',
      description: '按面板法伤百分比参与服务端伤害计算。',
    },
    {
      code: 'magic_upper_percent',
      label: '魔法值上限',
      suffix: '%',
      description: '会同时修正当前前台面板和服务端面板的 mp。',
    },
    {
      code: 'element_overcome_percent',
      label: '五行属性增强',
      suffix: '%',
      description: '当前按“词条元素匹配我方五行且处于克制关系时，加到五行系数”执行。',
      requiresElement: true,
    },
  ];

function parseJsonObject(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as JsonObject;
}

export function parseJadePercentSemanticOptions(
  value: unknown
): JadePercentSemanticOption[] {
  if (!Array.isArray(value)) {
    return DEFAULT_JADE_PERCENT_SEMANTIC_OPTIONS;
  }

  const parsed: JadePercentSemanticOption[] = value
    .map((item) => {
      const record = parseJsonObject(item);
      const code =
        typeof record.code === 'string' && record.code.trim().length > 0
          ? record.code.trim()
          : '';
      const label =
        typeof record.label === 'string' && record.label.trim().length > 0
          ? record.label.trim()
          : '';

      if (!code || !label || record.enabled === false) {
        return null;
      }

      return {
        code: code as EquipmentEffectModifier['code'],
        label,
        suffix:
          typeof record.suffix === 'string' && record.suffix.trim().length > 0
            ? record.suffix.trim()
            : '%',
        description:
          typeof record.description === 'string' &&
          record.description.trim().length > 0
            ? record.description.trim()
            : undefined,
        requiresElement:
          record.requiresElement === true ||
          record.sourceMode === 'element' ||
          code === 'element_overcome_percent',
      } satisfies JadePercentSemanticOption;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return parsed.length > 0 ? parsed : DEFAULT_JADE_PERCENT_SEMANTIC_OPTIONS;
}
