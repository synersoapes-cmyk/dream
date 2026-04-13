function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePercentValue(value: number) {
  return Math.abs(value) >= 1 ? value / 100 : value;
}

export function inferBaseHpSource(params: {
  panelHp: unknown;
  physique: unknown;
  equipmentHp?: unknown;
  bodyStrength?: unknown;
}) {
  const panelHp = toFiniteNumber(params.panelHp);
  const physique = toFiniteNumber(params.physique);
  const equipmentHp = toFiniteNumber(params.equipmentHp);
  const bodyStrengthFactor =
    1 + normalizePercentValue(toFiniteNumber(params.bodyStrength));
  const normalizedBodyStrengthFactor =
    bodyStrengthFactor > 0 ? bodyStrengthFactor : 1;

  const basePanelHp =
    (panelHp - equipmentHp) / normalizedBodyStrengthFactor - physique * 4.5;
  const inferred = basePanelHp / 5;

  if (!Number.isFinite(inferred) || inferred <= 0) {
    return 0;
  }

  return Number(inferred.toFixed(4));
}
