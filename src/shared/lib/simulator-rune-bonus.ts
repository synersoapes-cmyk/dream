import type { Equipment } from '@/features/simulator/store/gameTypes';

import { resolveRuneComboActivation } from '@/shared/lib/simulator-rune-combo';
import { findRuneComboRuleByName } from '@/shared/lib/simulator-rune-star-rules';

type RuneComboEffectType = 'skill_level' | 'panel_spirit' | 'panel_stat';

type RuneComboEffectDefinition = {
  comboName: string;
  effectType: RuneComboEffectType;
  effectLabel: string;
  maxActive: number;
  bonusByTier: Record<number, number>;
};

export type ActiveRuneComboEffectSummary = {
  comboName: string;
  effectType: RuneComboEffectType;
  effectLabel: string;
  bonusValue: number;
  matchedTier: number | null;
  activeCount: number;
  overflowCount: number;
  sourceSlots: Equipment['type'][];
  ignoredSlots: Equipment['type'][];
};

export type RuneComboEffectDiff = {
  comboName: string;
  effectType: RuneComboEffectType;
  effectLabel: string;
  previousBonusValue: number;
  nextBonusValue: number;
  deltaBonusValue: number;
  previousMatchedTier: number | null;
  nextMatchedTier: number | null;
  previousActiveCount: number;
  nextActiveCount: number;
};

function getEffectDefinitionByComboName(
  comboName: string
): RuneComboEffectDefinition | null {
  const comboRule = findRuneComboRuleByName(comboName);
  if (!comboRule || !comboRule.effectType || comboRule.effectType === 'none') {
    return null;
  }

  const bonusByTier = Object.fromEntries(
    comboRule.tiers
      .filter((tier) => Number.isFinite(Number(tier.bonusValue)))
      .map((tier) => [tier.tier, Number(tier.bonusValue ?? 0)])
  );

  if (Object.keys(bonusByTier).length === 0) {
    return null;
  }

  return {
    comboName: comboRule.name,
    effectType: comboRule.effectType,
    effectLabel: comboRule.effectLabel ?? `${comboRule.name}加成`,
    maxActive: Math.max(1, comboRule.maxActive ?? 1),
    bonusByTier,
  };
}

function sortByBonusPriority(
  left: { bonusValue: number; matchedTier: number | null },
  right: { bonusValue: number; matchedTier: number | null }
) {
  return (
    right.bonusValue - left.bonusValue ||
    (right.matchedTier ?? 0) - (left.matchedTier ?? 0)
  );
}

export function resolveActiveRuneComboEffects(equipment: Equipment[]) {
  const matchedByComboName = new Map<
    string,
    Array<{
      slot: Equipment['type'];
      matchedTier: number;
      bonusValue: number;
      definition: RuneComboEffectDefinition;
    }>
  >();

  for (const item of equipment) {
    const activation = resolveRuneComboActivation(item);
    if (!activation.isActivated || activation.matchedTier === null) {
      continue;
    }

    const definition = getEffectDefinitionByComboName(activation.normalizedSetName);
    if (!definition) {
      continue;
    }

    const bonusValue = definition.bonusByTier[activation.matchedTier] ?? 0;
    if (bonusValue <= 0) {
      continue;
    }

    const current = matchedByComboName.get(definition.comboName) ?? [];
    current.push({
      slot: item.type,
      matchedTier: activation.matchedTier,
      bonusValue,
      definition,
    });
    matchedByComboName.set(definition.comboName, current);
  }

  return Array.from(matchedByComboName.entries())
    .map(([, items]): ActiveRuneComboEffectSummary => {
      const definition = items[0]!.definition;
      const sorted = [...items].sort(sortByBonusPriority);
      const applied = sorted.slice(0, definition.maxActive);
      const ignored = sorted.slice(definition.maxActive);

      return {
        comboName: definition.comboName,
        effectType: definition.effectType,
        effectLabel: definition.effectLabel,
        bonusValue: applied.reduce((sum, item) => sum + item.bonusValue, 0),
        matchedTier: applied[0]?.matchedTier ?? null,
        activeCount: applied.length,
        overflowCount: ignored.length,
        sourceSlots: applied.map((item) => item.slot),
        ignoredSlots: ignored.map((item) => item.slot),
      };
    })
    .sort(sortByBonusPriority);
}

export function diffActiveRuneComboEffects(
  previousEquipment: Equipment[],
  nextEquipment: Equipment[]
) {
  const previous = resolveActiveRuneComboEffects(previousEquipment);
  const next = resolveActiveRuneComboEffects(nextEquipment);
  const previousMap = new Map(previous.map((item) => [item.comboName, item]));
  const nextMap = new Map(next.map((item) => [item.comboName, item]));
  const comboNames = Array.from(
    new Set([...previousMap.keys(), ...nextMap.keys()])
  );

  return comboNames
    .map((comboName): RuneComboEffectDiff | null => {
      const previousItem = previousMap.get(comboName);
      const nextItem = nextMap.get(comboName);
      const previousBonusValue = previousItem?.bonusValue ?? 0;
      const nextBonusValue = nextItem?.bonusValue ?? 0;
      const deltaBonusValue = nextBonusValue - previousBonusValue;

      if (deltaBonusValue === 0) {
        return null;
      }

      return {
        comboName,
        effectType: nextItem?.effectType ?? previousItem?.effectType ?? 'skill_level',
        effectLabel:
          nextItem?.effectLabel ?? previousItem?.effectLabel ?? `${comboName}加成`,
        previousBonusValue,
        nextBonusValue,
        deltaBonusValue,
        previousMatchedTier: previousItem?.matchedTier ?? null,
        nextMatchedTier: nextItem?.matchedTier ?? null,
        previousActiveCount: previousItem?.activeCount ?? 0,
        nextActiveCount: nextItem?.activeCount ?? 0,
      };
    })
    .filter((item): item is RuneComboEffectDiff => Boolean(item))
    .sort((left, right) => Math.abs(right.deltaBonusValue) - Math.abs(left.deltaBonusValue));
}

export function buildRuneComboDropWarnings(
  diffs: RuneComboEffectDiff[]
) {
  const warnings = diffs.flatMap((item) => {
    if (item.deltaBonusValue >= 0) {
      return [];
    }

    switch (item.comboName) {
      case '海市蜃楼':
        return ['海市蜃楼跌落后，九龙诀带来的法伤与法防联动收益会同步变弱'];
      case '呼风唤雨':
        return ['呼风唤雨跌落后，龙卷雨击技能等级会同步下降'];
      case '龙腾':
        return ['龙腾组合跌落后，单体技能爆发会同步下降'];
      case '逆鳞':
        return ['逆鳞组合跌落后，相关技能等级会同步下降'];
      case '破浪诀':
        return ['丢弃破浪诀将降低大量基础伤害'];
      case '隔山打牛':
        return ['隔山打牛层数减少后，战斗内灵力爆发期望会下降'];
      default:
        return [];
    }
  });

  return Array.from(new Set(warnings));
}
