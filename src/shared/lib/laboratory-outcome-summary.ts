export type LaboratoryOutcomeTone = 'positive' | 'negative' | 'neutral';

function formatLaboratoryPointValue(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatLaboratoryDamageDelta(value: number) {
  const rounded = Math.round(value);

  if (rounded > 0) {
    return `伤害提升：+${rounded}点`;
  }

  if (rounded < 0) {
    return `伤害下降：${rounded}点`;
  }

  return '伤害提升：0点';
}

export function getLaboratoryOutcomeTone(value: number): LaboratoryOutcomeTone {
  if (value > 0) {
    return 'positive';
  }
  if (value < 0) {
    return 'negative';
  }
  return 'neutral';
}

export function buildLaboratoryMagicDamageCostLabel(params: {
  diffPrice: number;
  magicDamageDiff: number;
}) {
  const { diffPrice, magicDamageDiff } = params;

  if (magicDamageDiff > 0) {
    if (diffPrice > 0) {
      return `¥ ${(diffPrice / magicDamageDiff).toFixed(1)} / 点法伤`;
    }

    return '收益';
  }

  if (magicDamageDiff < 0) {
    if (diffPrice < 0) {
      return `省 ¥ ${Math.abs(diffPrice / magicDamageDiff).toFixed(1)} / 点法伤`;
    }

    return '纯亏';
  }

  if (diffPrice > 0) {
    return '只花钱不提法伤';
  }

  if (diffPrice < 0) {
    return '纯省钱';
  }

  return '-';
}

export function buildLaboratoryMarginalWarning(params: {
  diffPrice: number;
  magicDamageDiff: number;
}) {
  const { diffPrice, magicDamageDiff } = params;

  if (diffPrice >= 5000 && magicDamageDiff > 0 && magicDamageDiff <= 2) {
    return `低性比：多花 ¥ ${Math.round(diffPrice)} 仅提升 ${formatLaboratoryPointValue(magicDamageDiff)} 点法伤`;
  }

  return null;
}

export function buildLaboratoryOutcomeSummary(params: {
  totalDamageDiff: number;
  diffPrice: number;
}) {
  const { totalDamageDiff, diffPrice } = params;

  if (totalDamageDiff > 0 && diffPrice <= 0) {
    return '白赚提升';
  }

  if (totalDamageDiff > 0 && diffPrice > 0) {
    return '可关注提升';
  }

  if (totalDamageDiff === 0 && diffPrice < 0) {
    return '纯省钱';
  }

  if (totalDamageDiff === 0 && diffPrice > 0) {
    return '只花钱不提伤';
  }

  if (totalDamageDiff < 0 && diffPrice < 0) {
    return '降伤省钱';
  }

  if (totalDamageDiff < 0) {
    return '纯亏';
  }

  return '持平';
}
