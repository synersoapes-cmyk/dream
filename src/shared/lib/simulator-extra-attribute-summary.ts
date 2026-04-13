import type { Equipment } from '@/features/simulator/store/gameTypes';

const BASE_ATTRIBUTE_ALIAS_MAP = {
  physique: '体质',
  magic: '魔力',
  strength: '力量',
  endurance: '耐力',
  agility: '敏捷',
} as const;

type BaseAttributeKey = keyof typeof BASE_ATTRIBUTE_ALIAS_MAP;

function sumAttributeMatches(
  totals: Partial<Record<BaseAttributeKey, number>>,
  text: string,
  attrKey: BaseAttributeKey
) {
  const attrLabel = BASE_ATTRIBUTE_ALIAS_MAP[attrKey];
  const pairPattern = new RegExp(
    `(?:${attrLabel}\\s*([+-]?\\d+(?:\\.\\d+)?))|(?:([+-]?\\d+(?:\\.\\d+)?)${attrLabel})`,
    'g'
  );

  for (const match of text.matchAll(pairPattern)) {
    const value = Number(match[1] ?? match[2]);
    if (!Number.isFinite(value) || value === 0) {
      continue;
    }
    totals[attrKey] = (totals[attrKey] ?? 0) + value;
  }
}

export function sumEquipmentExtraAttributeTotals(
  equipments: Equipment[]
): Partial<Record<BaseAttributeKey, number>> {
  const totals: Partial<Record<BaseAttributeKey, number>> = {};

  for (const equipment of equipments) {
    const texts = [equipment.extraStat, equipment.refinementEffect].filter(
      (value): value is string => typeof value === 'string' && value.trim().length > 0
    );

    for (const text of texts) {
      for (const attrKey of Object.keys(
        BASE_ATTRIBUTE_ALIAS_MAP
      ) as BaseAttributeKey[]) {
        sumAttributeMatches(totals, text, attrKey);
      }
    }
  }

  return totals;
}

export function formatEquipmentExtraAttributeSummary(
  totals: Partial<Record<BaseAttributeKey, number>>
) {
  return (Object.keys(BASE_ATTRIBUTE_ALIAS_MAP) as BaseAttributeKey[])
    .map((key) => {
      const value = totals[key];
      if (!Number.isFinite(value) || value === 0) {
        return null;
      }

      return `${BASE_ATTRIBUTE_ALIAS_MAP[key]} ${value! > 0 ? '+' : ''}${value}`;
    })
    .filter((value): value is string => Boolean(value));
}
