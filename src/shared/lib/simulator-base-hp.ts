function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function inferBaseHpSource(params: {
  panelHp: unknown;
  physique: unknown;
  endurance: unknown;
  equipmentHp?: unknown;
}) {
  const panelHp = toFiniteNumber(params.panelHp);
  const physique = toFiniteNumber(params.physique);
  const endurance = toFiniteNumber(params.endurance);
  const equipmentHp = toFiniteNumber(params.equipmentHp);

  const inferred = (panelHp - physique * 12 - endurance * 4 - equipmentHp) / 5;

  if (!Number.isFinite(inferred) || inferred <= 0) {
    return 0;
  }

  return Number(inferred.toFixed(4));
}
