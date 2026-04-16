import type { CharacterStatMap, Equipment } from '@/features/simulator/store/gameTypes';

import { getSimulatorStatLabel } from '@/shared/lib/simulator-stat-labels';

const EQUIPMENT_PREVIEW_STAT_ORDER = [
  'magicDamage',
  'magicDefense',
  'damage',
  'hit',
  'speed',
  'hp',
  'defense',
  'magicResult',
  'magicCritLevel',
  'fixedDamage',
  'physique',
  'magicPower',
  'strength',
  'endurance',
  'agility',
] as const;

function getFirstMeaningfulLine(value?: string) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const line = value
    .split('\n')
    .map((item) => item.trim())
    .find((item) => item.length > 0);

  return line && line.length > 0 ? line : undefined;
}

function buildStatsPreviewLine(stats?: CharacterStatMap) {
  if (!stats) {
    return undefined;
  }

  const previewEntries = EQUIPMENT_PREVIEW_STAT_ORDER.map((key) => {
    const value = stats[key];
    if (typeof value !== 'number' || value === 0) {
      return null;
    }

    return `${getSimulatorStatLabel(key, 'mainStat')} +${Math.round(value)}`;
  }).filter((value): value is string => Boolean(value));

  if (previewEntries.length > 0) {
    return previewEntries.slice(0, 2).join(' ');
  }

  const fallbackEntries = Object.entries(stats)
    .filter(([, value]) => typeof value === 'number' && value !== 0)
    .slice(0, 2)
    .map(
      ([key, value]) =>
        `${getSimulatorStatLabel(key, 'mainStat')} +${Math.round(Number(value))}`
    );

  return fallbackEntries.length > 0
    ? fallbackEntries.join(' ')
    : undefined;
}

export function getEquipmentPrimaryPreviewLine(equipment: Equipment) {
  return (
    getFirstMeaningfulLine(equipment.mainStat) ||
    buildStatsPreviewLine(equipment.stats) ||
    buildStatsPreviewLine(equipment.baseStats) ||
    '待补充属性'
  );
}

export function getEquipmentSecondaryPreviewLine(equipment: Equipment) {
  return getFirstMeaningfulLine(equipment.extraStat);
}
