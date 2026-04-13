import type { SimulatorElement } from '@/shared/models/simulator-domain';

export const SIMULATOR_FORMATION_OPTIONS = [
  '普通阵',
  '天覆阵',
  '地载阵',
  '风扬阵',
  '云垂阵',
  '龙飞阵',
  '虎翼阵',
  '鸟翔阵',
  '蛇蟠阵',
] as const;

export const FORMATION_COUNTER_STATE_OPTIONS = [
  '大克',
  '小克',
  '无克/普通',
  '被小克',
  '被大克',
] as const;

const FORMATION_BASE_DAMAGE_FACTOR_MAP: Record<string, number> = {
  普通阵: 1,
  天覆阵: 1.2,
};

const FORMATION_SPEED_FACTOR_MAP: Record<string, number> = {
  普通阵: 1,
  天覆阵: 0.9,
};

const FORMATION_COUNTER_VALUE_MAP: Record<string, Record<string, number>> = {
  普通阵: {
    普通阵: 0,
    天覆阵: -5,
    地载阵: 5,
    风扬阵: -5,
    云垂阵: 5,
    龙飞阵: -5,
    虎翼阵: 5,
    鸟翔阵: -5,
    蛇蟠阵: 5,
  },
  天覆阵: {
    普通阵: 5,
    天覆阵: 0,
    地载阵: 10,
    风扬阵: -10,
    云垂阵: -5,
    龙飞阵: 10,
    虎翼阵: -5,
    鸟翔阵: 5,
    蛇蟠阵: -10,
  },
  地载阵: {
    普通阵: -5,
    天覆阵: -10,
    地载阵: 0,
    风扬阵: 10,
    云垂阵: 5,
    龙飞阵: -5,
    虎翼阵: 10,
    鸟翔阵: -10,
    蛇蟠阵: 5,
  },
  风扬阵: {
    普通阵: 5,
    天覆阵: 10,
    地载阵: -10,
    风扬阵: 0,
    云垂阵: -5,
    龙飞阵: -5,
    虎翼阵: -10,
    鸟翔阵: 10,
    蛇蟠阵: 5,
  },
  云垂阵: {
    普通阵: -5,
    天覆阵: 5,
    地载阵: -5,
    风扬阵: 5,
    云垂阵: 0,
    龙飞阵: -10,
    虎翼阵: -10,
    鸟翔阵: 10,
    蛇蟠阵: 10,
  },
  龙飞阵: {
    普通阵: 5,
    天覆阵: -10,
    地载阵: 5,
    风扬阵: 5,
    云垂阵: 10,
    龙飞阵: 0,
    虎翼阵: -5,
    鸟翔阵: -5,
    蛇蟠阵: -5,
  },
  虎翼阵: {
    普通阵: -5,
    天覆阵: 5,
    地载阵: -10,
    风扬阵: 10,
    云垂阵: 10,
    龙飞阵: 5,
    虎翼阵: 0,
    鸟翔阵: -10,
    蛇蟠阵: -5,
  },
  鸟翔阵: {
    普通阵: 5,
    天覆阵: -5,
    地载阵: 10,
    风扬阵: -10,
    云垂阵: -10,
    龙飞阵: 5,
    虎翼阵: 10,
    鸟翔阵: 0,
    蛇蟠阵: -5,
  },
  蛇蟠阵: {
    普通阵: -5,
    天覆阵: 10,
    地载阵: -5,
    风扬阵: -5,
    云垂阵: -10,
    龙飞阵: 5,
    虎翼阵: 5,
    鸟翔阵: 5,
    蛇蟠阵: 0,
  },
};

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveElementRelationFromElements(
  selfElement: unknown,
  targetElement: unknown
) {
  const self = normalizeString(selfElement);
  const target = normalizeString(targetElement);
  if (!self || !target) {
    return '无克/普通';
  }

  const relationMap: Record<string, string> = {
    '金-木': '克制',
    '木-土': '克制',
    '土-水': '克制',
    '水-火': '克制',
    '火-金': '克制',
    '木-金': '被克制',
    '土-木': '被克制',
    '水-土': '被克制',
    '火-水': '被克制',
    '金-火': '被克制',
  };

  return relationMap[`${self}-${target}`] || '无克/普通';
}

export function resolveFormationBaseDamageFactor(formation: unknown) {
  const normalized = normalizeString(formation);
  return FORMATION_BASE_DAMAGE_FACTOR_MAP[normalized] ?? 1;
}

export function resolveFormationSpeedFactor(formation: unknown) {
  const normalized = normalizeString(formation);
  return FORMATION_SPEED_FACTOR_MAP[normalized] ?? 1;
}

export function resolveFormationCounterState(params: {
  selfFormation?: unknown;
  targetFormation?: unknown;
}) {
  const selfFormation = normalizeString(params.selfFormation) || '普通阵';
  const targetFormation = normalizeString(params.targetFormation) || '普通阵';

  if (!selfFormation || !targetFormation || selfFormation === targetFormation) {
    return '无克/普通';
  }

  const counterValue =
    FORMATION_COUNTER_VALUE_MAP[selfFormation]?.[targetFormation];
  if (!Number.isFinite(counterValue)) {
    return '无克/普通';
  }

  if (counterValue >= 10) return '大克';
  if (counterValue > 0) return '小克';
  if (counterValue <= -10) return '被大克';
  if (counterValue < 0) return '被小克';
  return '无克/普通';
}

export function resolveBattleContextDerivedFields(params: {
  selfFormation?: unknown;
  targetFormation?: unknown;
  selfElement?: unknown;
  targetElement?: unknown;
}) {
  return {
    formationFactor: resolveFormationBaseDamageFactor(params.selfFormation),
    formationSpeedFactor: resolveFormationSpeedFactor(params.selfFormation),
    formationCounterState: resolveFormationCounterState({
      selfFormation: params.selfFormation,
      targetFormation: params.targetFormation,
    }),
    elementRelation: resolveElementRelationFromElements(
      params.selfElement,
      params.targetElement
    ),
  };
}

export function toSimulatorElement(
  value: unknown,
  fallback: SimulatorElement = '水'
) {
  const normalized = normalizeString(value);
  return ['金', '木', '水', '火', '土'].includes(normalized)
    ? (normalized as SimulatorElement)
    : fallback;
}
