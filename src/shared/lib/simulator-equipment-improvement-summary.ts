import type { Equipment } from '@/features/simulator/store/gameTypes';

import { getEquipmentRuneStoneSetInfo } from '@/shared/blocks/simulator/EquipmentPanel/RuneStoneHelper';
import { computeWeaponDamageToMagicDamageBonus } from '@/shared/lib/simulator-core-rules';
import {
  formatEquipmentExtraAttributeSummary,
  sumEquipmentExtraAttributeTotals,
} from '@/shared/lib/simulator-extra-attribute-summary';
import { sumEquipmentGemstoneStats } from '@/shared/lib/simulator-equipment-meta';
import {
  getRuneComboTierLabel,
  resolveRuneComboActivation,
} from '@/shared/lib/simulator-rune-combo';

export type EquipmentImprovementSummaryItem = {
  key: string;
  label: string;
  value: string;
  rawValue?: number;
  note?: string;
};

export type EquipmentImprovementEffectItem = {
  key: string;
  label: string;
  value: string;
  note?: string;
};

export type EquipmentImprovementMetrics = {
  magicDamage: number;
  spellDamageLevel: number;
  magicCritLevel: number;
  magicCritRate: number;
  magicResult: number;
  speed: number;
  magicDefense: number;
  hit: number;
  damage: number;
  hp: number;
  defense: number;
  directSpirit: number;
  spiritEquivalentTotal: number;
};

export type EquipmentImprovementSummary = {
  numericSummary: EquipmentImprovementSummaryItem[];
  spiritEquivalentSummary: EquipmentImprovementSummaryItem[];
  effectSummary: EquipmentImprovementEffectItem[];
  metrics: EquipmentImprovementMetrics;
};

export type EquipmentImprovementDiffItem = EquipmentImprovementSummaryItem & {
  tone: 'up' | 'down' | 'neutral';
};

export type EquipmentImprovementEffectDiffItem = {
  key: string;
  label: string;
  value: string;
  tone: 'added' | 'removed' | 'changed';
  note?: string;
};

export type EquipmentImprovementDiffSummary = {
  numericSummary: EquipmentImprovementDiffItem[];
  spiritEquivalentSummary: EquipmentImprovementDiffItem[];
  effectSummary: EquipmentImprovementEffectDiffItem[];
};

type SummaryStatKey =
  | 'magicDamage'
  | 'spellDamageLevel'
  | 'magicCritLevel'
  | 'magicResult'
  | 'speed'
  | 'magicDefense'
  | 'hit'
  | 'damage'
  | 'hp'
  | 'defense'
  | 'spiritualPower'
  | 'spirit'
  | 'magicPower';

const SUMMARY_STAT_ORDER: Array<{
  key: SummaryStatKey;
  label: string;
  note?: string;
}> = [
  { key: 'magicDamage', label: '法伤' },
  {
    key: 'spellDamageLevel',
    label: '法伤等级',
    note: '当前会并入面板法伤',
  },
  {
    key: 'magicCritLevel',
    label: '法爆等级',
    note: '会同步折算为法暴率',
  },
  { key: 'spiritualPower', label: '灵力', note: '同步联动法伤 / 法防' },
  { key: 'magicResult', label: '法结', note: '结果区固定加成' },
  { key: 'speed', label: '速度' },
  { key: 'magicDefense', label: '法防' },
  { key: 'hit', label: '命中' },
  { key: 'damage', label: '伤害', note: '武器伤害仍会按 /4 折算部分面板法伤' },
  { key: 'hp', label: '气血' },
  { key: 'defense', label: '防御' },
];

function toFiniteNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  const decimals = Math.abs(value) < 10 ? 2 : 1;
  return value
    .toFixed(decimals)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*[1-9])0+$/, '$1');
}

function formatSignedNumber(value: number) {
  const safeValue = toFiniteNumber(value);
  return `${safeValue > 0 ? '+' : ''}${formatNumber(safeValue)}`;
}

function formatSignedPercent(value: number) {
  const safeValue = toFiniteNumber(value);
  return `${safeValue > 0 ? '+' : ''}${safeValue.toFixed(2)}%`;
}

export function formatEquipmentMagicCritRateFromLevel(level: number | undefined) {
  const safeLevel = Math.max(0, Number(level ?? 0));
  const percent = Math.min(95, (safeLevel / 1750) * 100);
  return percent;
}

function getPrimaryStructuredStats(equipment: Equipment) {
  const statsEntries = Object.entries(equipment.stats ?? {}).filter(([, value]) =>
    Number.isFinite(Number(value))
  );

  if (statsEntries.length > 0) {
    return Object.fromEntries(
      statsEntries.map(([key, value]) => [key, Number(value ?? 0)])
    ) as Record<string, number>;
  }

  return Object.fromEntries(
    Object.entries(equipment.baseStats ?? {})
      .filter(([, value]) => Number.isFinite(Number(value)))
      .map(([key, value]) => [key, Number(value ?? 0)])
  ) as Record<string, number>;
}

function getActiveRuneSetStats(equipment: Equipment) {
  const totals: Record<string, number> = {};
  const activeRuneSet =
    equipment.runeStoneSets?.[equipment.activeRuneStoneSet ?? 0] ??
    equipment.runeStoneSets?.[0] ??
    [];

  for (const runeStone of activeRuneSet) {
    for (const [key, value] of Object.entries(runeStone.stats ?? {})) {
      totals[key] = (totals[key] ?? 0) + toFiniteNumber(value);
    }
  }

  return totals;
}

function getEquipmentContributionStats(equipment: Equipment) {
  const totals: Record<string, number> = {
    ...getPrimaryStructuredStats(equipment),
  };

  for (const [key, value] of Object.entries(
    sumEquipmentGemstoneStats(equipment.gemstones)
  )) {
    totals[key] = (totals[key] ?? 0) + toFiniteNumber(value);
  }

  for (const [key, value] of Object.entries(getActiveRuneSetStats(equipment))) {
    totals[key] = (totals[key] ?? 0) + toFiniteNumber(value);
  }

  if (
    equipment.starPositionConfig?.attrType &&
    Number.isFinite(Number(equipment.starPositionConfig.attrValue))
  ) {
    totals[equipment.starPositionConfig.attrType] =
      (totals[equipment.starPositionConfig.attrType] ?? 0) +
      toFiniteNumber(equipment.starPositionConfig.attrValue);
  }

  if (
    equipment.starAlignmentConfig?.attrType &&
    Number.isFinite(Number(equipment.starAlignmentConfig.attrValue))
  ) {
    totals[equipment.starAlignmentConfig.attrType] =
      (totals[equipment.starAlignmentConfig.attrType] ?? 0) +
      toFiniteNumber(equipment.starAlignmentConfig.attrValue);
  }

  return totals;
}

function buildNumericSummary(
  totals: Record<string, number>,
  extraAttributeSummary: string[]
) {
  const items: EquipmentImprovementSummaryItem[] = [];
  const directSpirit =
    toFiniteNumber(totals.spiritualPower) +
    toFiniteNumber(totals.spirit) +
    toFiniteNumber(totals.magicPower);

  for (const rule of SUMMARY_STAT_ORDER) {
    let rawValue = toFiniteNumber(totals[rule.key]);

    if (rule.key === 'spiritualPower') {
      rawValue = directSpirit;
    }

    if (rawValue === 0) {
      continue;
    }

    items.push({
      key: rule.key,
      label: rule.label,
      value: formatSignedNumber(rawValue),
      rawValue,
      note: rule.note,
    });

    if (rule.key === 'magicCritLevel') {
      const critRate = formatEquipmentMagicCritRateFromLevel(rawValue);
      items.push({
        key: 'magicCritRate',
        label: '法暴率',
        value: formatSignedPercent(critRate),
        rawValue: critRate,
        note: `由法爆等级 ${formatSignedNumber(rawValue)} 推导，当前按 95% 封顶`,
      });
    }
  }

  if (extraAttributeSummary.length > 0) {
    items.push({
      key: 'extraAttributes',
      label: extraAttributeSummary.length >= 2 ? '双加' : '附加属性',
      value: extraAttributeSummary.join(' / '),
      note: '基础属性会继续按龙宫法系转面板',
    });
  }

  return items;
}

function buildSpiritEquivalentSummary(
  equipment: Equipment,
  totals: Record<string, number>,
  extraAttributeTotals: Partial<
    Record<'physique' | 'magic' | 'strength' | 'endurance' | 'agility', number>
  >
) {
  const items: EquipmentImprovementSummaryItem[] = [];
  const directSpirit =
    toFiniteNumber(totals.spiritualPower) +
    toFiniteNumber(totals.spirit) +
    toFiniteNumber(totals.magicPower);
  const magicDamage = toFiniteNumber(totals.magicDamage);
  const spellDamageLevel = toFiniteNumber(totals.spellDamageLevel);
  const weaponMagicDamageBonus =
    equipment.type === 'weapon'
      ? computeWeaponDamageToMagicDamageBonus(totals.damage)
      : 0;
  const extraAttributeSpiritEquivalent =
    toFiniteNumber(extraAttributeTotals.physique) * 0.3 +
    toFiniteNumber(extraAttributeTotals.magic) * 0.7 +
    toFiniteNumber(extraAttributeTotals.strength) * 0.4 +
    toFiniteNumber(extraAttributeTotals.endurance) * 0.2;
  const spiritEquivalentTotal =
    directSpirit +
    magicDamage +
    spellDamageLevel +
    weaponMagicDamageBonus +
    extraAttributeSpiritEquivalent;

  if (spiritEquivalentTotal !== 0) {
    items.push({
      key: 'spiritEquivalentTotal',
      label: '灵力等价',
      value: `约 ${formatSignedNumber(spiritEquivalentTotal)} 面板法伤来源`,
      rawValue: spiritEquivalentTotal,
      note: '只汇总当前能稳定解释为法系面板收益的词条',
    });
  }

  if (directSpirit !== 0) {
    items.push({
      key: 'directSpirit',
      label: '灵力直加',
      value: formatSignedNumber(directSpirit),
      rawValue: directSpirit,
      note: '同步提供法伤 / 法防等价收益',
    });
  }

  if (magicDamage !== 0) {
    items.push({
      key: 'magicDamageEquivalent',
      label: '法伤直加',
      value: formatSignedNumber(magicDamage),
      rawValue: magicDamage,
      note: '可视作同量面板法伤来源',
    });
  }

  if (spellDamageLevel !== 0) {
    items.push({
      key: 'spellDamageLevelEquivalent',
      label: '法伤等级',
      value: formatSignedNumber(spellDamageLevel),
      rawValue: spellDamageLevel,
      note: '当前会直接并入面板法伤',
    });
  }

  if (weaponMagicDamageBonus !== 0) {
    items.push({
      key: 'weaponDamageEquivalent',
      label: '武器伤害折算',
      value: formatSignedNumber(weaponMagicDamageBonus),
      rawValue: weaponMagicDamageBonus,
      note: `当前按伤害 / 4 计入面板法伤，原始伤害 ${formatSignedNumber(
        toFiniteNumber(totals.damage)
      )}`,
    });
  }

  if (extraAttributeSpiritEquivalent !== 0) {
    const details = [
      toFiniteNumber(extraAttributeTotals.magic) !== 0
        ? `魔力 ${formatSignedNumber(
            toFiniteNumber(extraAttributeTotals.magic)
          )} -> 灵力约 ${formatSignedNumber(
            toFiniteNumber(extraAttributeTotals.magic) * 0.7
          )}`
        : null,
      toFiniteNumber(extraAttributeTotals.physique) !== 0
        ? `体质 ${formatSignedNumber(
            toFiniteNumber(extraAttributeTotals.physique)
          )} -> 灵力约 ${formatSignedNumber(
            toFiniteNumber(extraAttributeTotals.physique) * 0.3
          )}`
        : null,
      toFiniteNumber(extraAttributeTotals.strength) !== 0
        ? `力量 ${formatSignedNumber(
            toFiniteNumber(extraAttributeTotals.strength)
          )} -> 灵力约 ${formatSignedNumber(
            toFiniteNumber(extraAttributeTotals.strength) * 0.4
          )}`
        : null,
      toFiniteNumber(extraAttributeTotals.endurance) !== 0
        ? `耐力 ${formatSignedNumber(
            toFiniteNumber(extraAttributeTotals.endurance)
          )} -> 灵力约 ${formatSignedNumber(
            toFiniteNumber(extraAttributeTotals.endurance) * 0.2
          )}`
        : null,
    ].filter((item): item is string => Boolean(item));

    items.push({
      key: 'extraAttributeEquivalent',
      label: '双加折算',
      value: formatSignedNumber(extraAttributeSpiritEquivalent),
      rawValue: extraAttributeSpiritEquivalent,
      note: details.join(' / '),
    });
  }

  return {
    items,
    spiritEquivalentTotal,
    directSpirit,
  };
}

function buildEffectSummary(equipment: Equipment) {
  const items: EquipmentImprovementEffectItem[] = [];
  const activation = resolveRuneComboActivation(equipment);
  const runeSetName = getEquipmentRuneStoneSetInfo([equipment])[0];

  if (equipment.specialEffect) {
    items.push({
      key: 'specialEffect',
      label: '特技/特效',
      value: equipment.specialEffect,
      note: '高优先级效果，当前不并入灵力等价折算',
    });
  }

  if (equipment.setName) {
    items.push({
      key: 'setName',
      label: '套装',
      value: equipment.setName,
      note: '套装效果独立于纯数值摘要展示',
    });
  }

  if (runeSetName || equipment.runeSetEffect) {
    items.push({
      key: 'runeSetEffect',
      label: '符石套装',
      value: equipment.runeSetEffect
        ? `${runeSetName ? `${runeSetName} · ` : ''}${equipment.runeSetEffect}`
        : runeSetName ?? '',
      note: '套装类效果保留独立说明，不强制折算成单一数值',
    });
  }

  if (activation.normalizedSetName) {
    items.push({
      key: 'runeCombo',
      label: '符石组合',
      value: activation.isActivated
        ? `${activation.normalizedSetName}${
            activation.matchedTier
              ? ` · ${getRuneComboTierLabel(activation.matchedTier)}`
              : ''
          }`
        : `${activation.normalizedSetName} · 未激活`,
      note: activation.isActivated
        ? '当前已命中组合规则'
        : '当前只保留单颗符石属性，不触发组合效果',
    });
  }

  if (equipment.starAlignmentConfig || equipment.starAlignment) {
    items.push({
      key: 'starAlignment',
      label: '星相互合',
      value:
        equipment.starAlignmentConfig?.comboName ||
        equipment.starAlignment ||
        '已配置',
      note: equipment.starAlignmentConfig?.attrType
        ? `${equipment.starAlignmentConfig.attrType} +${formatNumber(
            toFiniteNumber(equipment.starAlignmentConfig.attrValue)
          )}`
        : '当前保留为独立规则效果',
    });
  }

  if (equipment.highlights && equipment.highlights.length > 0) {
    items.push({
      key: 'highlights',
      label: '亮点',
      value: equipment.highlights.join(' / '),
      note: '保留 OCR / 人工标记的高价值亮点',
    });
  }

  return items;
}

export function buildEquipmentImprovementSummary(
  equipment: Equipment
): EquipmentImprovementSummary {
  const totals = getEquipmentContributionStats(equipment);
  const extraAttributeTotals = sumEquipmentExtraAttributeTotals([equipment]);
  const extraAttributeSummary =
    formatEquipmentExtraAttributeSummary(extraAttributeTotals);
  const numericSummary = buildNumericSummary(totals, extraAttributeSummary);
  const spiritSummary = buildSpiritEquivalentSummary(
    equipment,
    totals,
    extraAttributeTotals
  );
  const effectSummary = buildEffectSummary(equipment);
  const magicCritLevel = toFiniteNumber(totals.magicCritLevel);

  return {
    numericSummary,
    spiritEquivalentSummary: spiritSummary.items,
    effectSummary,
    metrics: {
      magicDamage: toFiniteNumber(totals.magicDamage),
      spellDamageLevel: toFiniteNumber(totals.spellDamageLevel),
      magicCritLevel,
      magicCritRate: formatEquipmentMagicCritRateFromLevel(magicCritLevel),
      magicResult: toFiniteNumber(totals.magicResult),
      speed: toFiniteNumber(totals.speed),
      magicDefense: toFiniteNumber(totals.magicDefense),
      hit: toFiniteNumber(totals.hit),
      damage: toFiniteNumber(totals.damage),
      hp: toFiniteNumber(totals.hp),
      defense: toFiniteNumber(totals.defense),
      directSpirit: spiritSummary.directSpirit,
      spiritEquivalentTotal: spiritSummary.spiritEquivalentTotal,
    },
  };
}

function buildDiffItem(
  key: string,
  label: string,
  diffValue: number,
  note?: string,
  options?: {
    valueFormatter?: (value: number) => string;
  }
): EquipmentImprovementDiffItem | null {
  if (diffValue === 0) {
    return null;
  }

  return {
    key,
    label,
    value: options?.valueFormatter
      ? options.valueFormatter(diffValue)
      : formatSignedNumber(diffValue),
    rawValue: diffValue,
    note,
    tone: diffValue > 0 ? 'up' : 'down',
  };
}

export function buildEquipmentImprovementDiffSummary(
  equipment: Equipment,
  baselineEquipment?: Equipment | null
): EquipmentImprovementDiffSummary {
  const current = buildEquipmentImprovementSummary(equipment);
  const baseline = baselineEquipment
    ? buildEquipmentImprovementSummary(baselineEquipment)
    : null;

  if (!baseline) {
    return {
      numericSummary: [],
      spiritEquivalentSummary: [],
      effectSummary: [],
    };
  }

  const numericSummary = [
    buildDiffItem(
      'magicDamage',
      '法伤变化',
      current.metrics.magicDamage - baseline.metrics.magicDamage
    ),
    buildDiffItem(
      'spellDamageLevel',
      '法伤等级变化',
      current.metrics.spellDamageLevel - baseline.metrics.spellDamageLevel,
      '当前会同步并入面板法伤'
    ),
    buildDiffItem(
      'magicCritRate',
      '法暴率变化',
      current.metrics.magicCritRate - baseline.metrics.magicCritRate,
      `法爆等级 ${formatSignedNumber(
        current.metrics.magicCritLevel - baseline.metrics.magicCritLevel
      )}`,
      {
        valueFormatter: (value) => formatSignedPercent(value),
      }
    ),
    buildDiffItem(
      'magicResult',
      '法结变化',
      current.metrics.magicResult - baseline.metrics.magicResult
    ),
    buildDiffItem(
      'speed',
      '速度变化',
      current.metrics.speed - baseline.metrics.speed
    ),
    buildDiffItem(
      'magicDefense',
      '法防变化',
      current.metrics.magicDefense - baseline.metrics.magicDefense
    ),
  ].filter((item): item is EquipmentImprovementDiffItem => Boolean(item));

  const spiritEquivalentSummary = [
    buildDiffItem(
      'spiritEquivalentTotal',
      '灵力等价变化',
      current.metrics.spiritEquivalentTotal -
        baseline.metrics.spiritEquivalentTotal,
      '仅按当前可明确解释为法系面板收益的词条计算'
    ),
  ].filter((item): item is EquipmentImprovementDiffItem => Boolean(item));

  const currentEffects = new Map(
    current.effectSummary.map((item) => [item.key, item] as const)
  );
  const baselineEffects = new Map(
    baseline.effectSummary.map((item) => [item.key, item] as const)
  );
  const effectKeys = Array.from(
    new Set([...currentEffects.keys(), ...baselineEffects.keys()])
  );
  const effectSummary = effectKeys.reduce<EquipmentImprovementEffectDiffItem[]>(
    (result, key) => {
      const nextItem = currentEffects.get(key);
      const prevItem = baselineEffects.get(key);

      if (nextItem && !prevItem) {
        result.push({
          key,
          label: nextItem.label,
          value: `新增：${nextItem.value}`,
          tone: 'added',
          note: nextItem.note,
        });
        return result;
      }

      if (!nextItem && prevItem) {
        result.push({
          key,
          label: prevItem.label,
          value: `移除：${prevItem.value}`,
          tone: 'removed',
          note: prevItem.note,
        });
        return result;
      }

      if (nextItem && prevItem && nextItem.value !== prevItem.value) {
        result.push({
          key,
          label: nextItem.label,
          value: `${prevItem.value} -> ${nextItem.value}`,
          tone: 'changed',
          note: nextItem.note ?? prevItem.note,
        });
      }

      return result;
    },
    []
  );

  return {
    numericSummary,
    spiritEquivalentSummary,
    effectSummary,
  };
}
