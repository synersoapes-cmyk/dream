import { computeCombatStatsWithPanelBaseline } from '@/features/simulator/store/gameLogic';
import type {
  BaseAttributes,
  CombatStats,
  Equipment,
  MeridianConfig,
  SyncedCloudState,
  Treasure,
} from '@/features/simulator/store/gameTypes';

import { sumEquipmentGemstoneStats } from '@/shared/lib/simulator-equipment-meta';
import {
  getTrackedStatContributionFromBonuses,
  resolveSimulatorStarRuntimeBonuses,
} from '@/shared/lib/simulator-rune-star-rules';
import type { RegularSetRuntimeRule } from '@/shared/lib/simulator-regular-set';
import {
  findSimulatorSlotDefinition,
  getSimulatorSlotLabel,
} from '@/shared/lib/simulator-slot-config';

export type PanelSourceBreakdownKey =
  | 'magicDamage'
  | 'spiritualPower'
  | 'speed'
  | 'magicDefense'
  | 'hp'
  | 'magicCritLevel'
  | 'fixedDamage'
  | 'pierceLevel'
  | 'hit';

export type PanelSourceBreakdownItem = {
  key: PanelSourceBreakdownKey;
  label: string;
  total: number;
  baseline: number;
  delta: number;
  sources: Array<{
    label: string;
    value: number;
  }>;
  sourceDetails: PanelSourceDetailGroup[];
  hasBaseline: boolean;
};

export type PanelSourceValueItem = {
  label: string;
  value: number;
  note?: string;
};

export type PanelSourceDetailGroup = {
  label: string;
  items: PanelSourceValueItem[];
};

export type PanelSourceDeltaBreakdownItem = {
  key: PanelSourceBreakdownKey;
  label: string;
  totalDiff: number;
  sourceDiffs: Array<{
    label: string;
    value: number;
  }>;
  sourceDetailDiffs: PanelSourceDetailGroup[];
};

type BreakdownContext = {
  baseAttributes: BaseAttributes;
  equipment: Equipment[];
  treasure: Treasure | null;
  bodyStrength: number;
  meridian: MeridianConfig;
  formation?: string;
  regularSetRules?: RegularSetRuntimeRule[];
  syncedCloudState?: SyncedCloudState | null;
};

const BREAKDOWN_KEYS: PanelSourceBreakdownKey[] = [
  'magicDamage',
  'spiritualPower',
  'speed',
  'magicDefense',
  'hp',
  'magicCritLevel',
  'fixedDamage',
  'pierceLevel',
  'hit',
];

const BREAKDOWN_LABELS: Record<PanelSourceBreakdownKey, string> = {
  magicDamage: '法伤',
  spiritualPower: '灵力',
  speed: '速度',
  magicDefense: '法防',
  hp: '气血',
  magicCritLevel: '法爆等级',
  fixedDamage: '固伤',
  pierceLevel: '穿刺',
  hit: '命中',
};

const ATTRIBUTE_DETAIL_LABELS: Partial<Record<keyof BaseAttributes, string>> = {
  hp: '基础气血',
  physique: '体质',
  magicPower: '灵力',
  strength: '力量',
  endurance: '耐力',
  agility: '敏捷',
  level: '等级',
};

const MERIDIAN_DETAIL_LABELS: Record<keyof MeridianConfig, string> = {
  physique: '经脉体质',
  magic: '经脉魔力',
  strength: '经脉力量',
  endurance: '经脉耐力',
  agility: '经脉敏捷',
  magicPower: '经脉灵力',
};

function toRoundedNumber(value: number | undefined) {
  return Math.round(Number(value ?? 0));
}

export function formatPanelSourceSignedValue(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

export function sortPanelSourceValueItems<T extends PanelSourceValueItem>(
  items: T[]
) {
  return [...items].sort((left, right) => {
    const diff = Math.abs(right.value) - Math.abs(left.value);
    if (diff !== 0) return diff;
    return right.value - left.value;
  });
}

export function buildPanelSourceBreakdownSummary(
  item: PanelSourceBreakdownItem,
  limit = 2
) {
  if (item.sources.length === 0) {
    return null;
  }

  return sortPanelSourceValueItems(item.sources)
    .slice(0, limit)
    .map(
      (source, index) =>
        `${index === 0 ? '主因' : '次因'} ${source.label} ${formatPanelSourceSignedValue(source.value)}`
    )
    .join(' · ');
}

export function buildPanelSourceDeltaSummary(
  item: PanelSourceDeltaBreakdownItem,
  limit = 2
) {
  if (item.sourceDiffs.length === 0) {
    return '当前没有额外来源差异';
  }

  return sortPanelSourceValueItems(item.sourceDiffs)
    .slice(0, limit)
    .map(
      (source, index) =>
        `${index === 0 ? '主因' : '次因'} ${source.label} ${formatPanelSourceSignedValue(source.value)}`
    )
    .join(' · ');
}

function sumSingleEquipmentStats(item: Equipment) {
  const totals: Record<string, number> = {};

  const activeRuneSet =
    item.runeStoneSets && item.runeStoneSets.length > 0
      ? (item.runeStoneSets[item.activeRuneStoneSet ?? 0] ??
        item.runeStoneSets[0])
      : [];

  for (const [key, value] of Object.entries(item.stats ?? {})) {
    totals[key] = (totals[key] ?? 0) + Number(value ?? 0);
  }

  for (const [key, value] of Object.entries(
    sumEquipmentGemstoneStats(item.gemstones)
  )) {
    totals[key] = (totals[key] ?? 0) + Number(value ?? 0);
  }

  for (const runeStone of activeRuneSet ?? []) {
    for (const [key, value] of Object.entries(runeStone.stats ?? {})) {
      totals[key] = (totals[key] ?? 0) + Number(value ?? 0);
    }
  }

  return totals;
}

function sumStarPositionStats(item: Equipment) {
  const totals: Record<string, number> = {};
  const starBonus = item.starPositionConfig;

  if (!starBonus?.attrType || !Number.isFinite(Number(starBonus.attrValue))) {
    return totals;
  }

  totals[starBonus.attrType] = Number(starBonus.attrValue ?? 0);
  return totals;
}

function sumRuneStoneStats(item: Equipment) {
  const totals: Record<string, number> = {};

  const activeRuneSet =
    item.runeStoneSets && item.runeStoneSets.length > 0
      ? (item.runeStoneSets[item.activeRuneStoneSet ?? 0] ??
        item.runeStoneSets[0])
      : [];

  for (const runeStone of activeRuneSet ?? []) {
    for (const [key, value] of Object.entries(runeStone.stats ?? {})) {
      totals[key] = (totals[key] ?? 0) + Number(value ?? 0);
    }
  }

  return totals;
}

function sumBaseEquipmentStats(item: Equipment) {
  const totals: Record<string, number> = {};

  for (const [key, value] of Object.entries(item.baseStats ?? {})) {
    totals[key] = (totals[key] ?? 0) + Number(value ?? 0);
  }

  return totals;
}

function sumComponentStats(
  item: Equipment | undefined,
  component: 'base' | 'gemstone' | 'rune' | 'star'
) {
  if (!item) {
    return {};
  }

  if (component === 'base') {
    return sumBaseEquipmentStats(item);
  }

  if (component === 'gemstone') {
    return sumEquipmentGemstoneStats(item.gemstones);
  }

  if (component === 'star') {
    return sumStarPositionStats(item);
  }

  return sumRuneStoneStats(item);
}

function getEquipmentSlotDisplayLabel(item: Equipment) {
  const definition = findSimulatorSlotDefinition(item.type, item.slot);
  return definition ? getSimulatorSlotLabel(definition) : item.type;
}

function getTrackedEquipmentContributionFromStats(
  key: PanelSourceBreakdownKey,
  item: Equipment | undefined,
  totals: Record<string, number>
) {
  if (!item) {
    return 0;
  }
  const spiritBonus =
    Number(totals.magicPower ?? 0) + Number(totals.spirit ?? 0);

  switch (key) {
    case 'magicDamage':
      return (
        Number(totals.magicDamage ?? 0) +
        spiritBonus +
        (item.type === 'weapon' ? Number(totals.damage ?? 0) / 4 : 0)
      );
    case 'spiritualPower':
      return spiritBonus;
    case 'speed':
      return Number(totals.speed ?? 0);
    case 'magicDefense':
      return Number(totals.magicDefense ?? 0) + spiritBonus;
    case 'hp':
      return Number(totals.hp ?? 0);
    case 'magicCritLevel':
      return Number(totals.magicCritLevel ?? 0);
    case 'fixedDamage':
      return Number(totals.fixedDamage ?? totals.magicResult ?? 0);
    case 'pierceLevel':
      return Number(totals.pierceLevel ?? 0);
    case 'hit':
      return Number(totals.hit ?? 0);
  }
}

function getTrackedEquipmentContribution(
  key: PanelSourceBreakdownKey,
  item: Equipment | undefined
) {
  return getTrackedEquipmentContributionFromStats(
    key,
    item,
    item ? sumSingleEquipmentStats(item) : {}
  );
}

function buildEquipmentDetailGroups(
  key: PanelSourceBreakdownKey,
  currentEquipment: Equipment[],
  baselineEquipment: Equipment[]
) {
  const baselineMap = new Map(
    baselineEquipment.map((item) => [`${item.type}:${item.slot ?? 0}`, item])
  );
  const currentMap = new Map(
    currentEquipment.map((item) => [`${item.type}:${item.slot ?? 0}`, item])
  );
  const slotKeys = new Set([...baselineMap.keys(), ...currentMap.keys()]);
  const equipmentItems: PanelSourceValueItem[] = [];
  const gemstoneItems: PanelSourceValueItem[] = [];
  const runeItems: PanelSourceValueItem[] = [];
  const starItems: PanelSourceValueItem[] = [];

  slotKeys.forEach((slotKey) => {
    const currentItem = currentMap.get(slotKey);
    const baselineItem = baselineMap.get(slotKey);
    const slotLabel = getEquipmentSlotDisplayLabel(
      currentItem ?? baselineItem!
    );
    const currentName = currentItem?.name;
    const baselineName = baselineItem?.name;

    let label = slotLabel;
    if (currentName && baselineName && currentName !== baselineName) {
      label = `${slotLabel}·${currentName}`;
    } else if (currentName) {
      label = `${slotLabel}·${currentName}`;
    } else if (baselineName) {
      label = `${slotLabel}·卸下 ${baselineName}`;
    }

    const pushIfNeeded = (
      bucket: PanelSourceValueItem[],
      component: 'base' | 'gemstone' | 'rune' | 'star'
    ) => {
      const currentValue = getTrackedEquipmentContributionFromStats(
        key,
        currentItem,
        sumComponentStats(currentItem, component)
      );
      const baselineValue = getTrackedEquipmentContributionFromStats(
        key,
        baselineItem,
        sumComponentStats(baselineItem, component)
      );
      const diff =
        toRoundedNumber(currentValue) - toRoundedNumber(baselineValue);

      if (diff !== 0) {
        let note: string | undefined;

        if (
          key === 'magicDamage' &&
          component === 'base' &&
          currentItem?.type === 'weapon'
        ) {
          note = '含武器伤害/4转法伤';
        } else if (
          key === 'magicDamage' &&
          (component === 'gemstone' || component === 'rune' || component === 'star')
        ) {
          note = '直接计入法伤';
        } else if (key === 'spiritualPower' || key === 'magicDefense') {
          note = '灵力同时联动法伤/法防';
        } else if (key === 'hp' && component === 'base') {
          note = '仅统计装备气血底子';
        } else if (key === 'hit' && component === 'base') {
          note = '命中直接计入面板';
        }

        bucket.push({
          label,
          value: diff,
          ...(note ? { note } : {}),
        });
      }
    };

    pushIfNeeded(equipmentItems, 'base');
    pushIfNeeded(gemstoneItems, 'gemstone');
    pushIfNeeded(runeItems, 'rune');
    pushIfNeeded(starItems, 'star');
  });

  const currentStarBonuses = resolveSimulatorStarRuntimeBonuses(currentEquipment);
  const baselineStarBonuses = resolveSimulatorStarRuntimeBonuses(baselineEquipment);
  const fullColorDiff =
    Math.round(
      getTrackedStatContributionFromBonuses(key, currentStarBonuses) -
        getTrackedStatContributionFromBonuses(key, baselineStarBonuses)
    ) -
    starItems.reduce((sum, item) => sum + item.value, 0);

  if (fullColorDiff !== 0) {
    starItems.push({
      label: '全套同色奖励',
      value: fullColorDiff,
      note: currentStarBonuses.fullColorSetRule
        ? `${currentStarBonuses.fullColorSetRule.label} 已激活`
        : baselineStarBonuses.fullColorSetRule
          ? `${baselineStarBonuses.fullColorSetRule.label} 已移除`
          : '星石全套颜色奖励变动',
    });
  }

  return [
    {
      label: '装备底子',
      items: sortPanelSourceValueItems(equipmentItems),
    },
    {
      label: '宝石',
      items: sortPanelSourceValueItems(gemstoneItems),
    },
    {
      label: '符石',
      items: sortPanelSourceValueItems(runeItems),
    },
    {
      label: '星石',
      items: sortPanelSourceValueItems(starItems),
    },
  ].filter((group) => group.items.length > 0);
}

function buildAttributeDetailItems(
  key: PanelSourceBreakdownKey,
  current: BaseAttributes,
  baseline: BaseAttributes
) {
  const items: PanelSourceValueItem[] = [];

  const add = (label: string, value: number, note?: string) => {
    const rounded = toRoundedNumber(value);
    if (rounded !== 0) {
      items.push({
        label,
        value: rounded,
        ...(note ? { note } : {}),
      });
    }
  };

  const deltaPhysique = current.physique - baseline.physique;
  const deltaMagic = current.magic - baseline.magic;
  const deltaMagicPower = current.magicPower - baseline.magicPower;
  const deltaStrength = current.strength - baseline.strength;
  const deltaEndurance = current.endurance - baseline.endurance;
  const deltaAgility = current.agility - baseline.agility;

  switch (key) {
    case 'magicDamage':
    case 'spiritualPower':
    case 'magicDefense':
      add(
        ATTRIBUTE_DETAIL_LABELS.magicPower ?? '灵力',
        deltaMagicPower,
        '灵力直接联动法伤/法防'
      );
      add(
        ATTRIBUTE_DETAIL_LABELS.physique ?? '体质',
        deltaPhysique * 0.3,
        '体质按 0.3 灵力折算'
      );
      add(
        ATTRIBUTE_DETAIL_LABELS.magic ?? '魔力',
        deltaMagic * 0.7,
        '魔力按 0.7 灵力折算'
      );
      add(
        ATTRIBUTE_DETAIL_LABELS.strength ?? '力量',
        deltaStrength * 0.4,
        '力量按 0.4 灵力折算'
      );
      add(
        ATTRIBUTE_DETAIL_LABELS.endurance ?? '耐力',
        deltaEndurance * 0.2,
        '耐力按 0.2 灵力折算'
      );
      break;
    case 'speed':
      add(
        ATTRIBUTE_DETAIL_LABELS.physique ?? '体质',
        deltaPhysique * 0.1,
        '体质按 0.1 速度折算'
      );
      add(
        ATTRIBUTE_DETAIL_LABELS.strength ?? '力量',
        deltaStrength * 0.1,
        '力量按 0.1 速度折算'
      );
      add(
        ATTRIBUTE_DETAIL_LABELS.endurance ?? '耐力',
        deltaEndurance * 0.1,
        '耐力按 0.1 速度折算'
      );
      add(
        ATTRIBUTE_DETAIL_LABELS.agility ?? '敏捷',
        deltaAgility * 0.7,
        '敏捷按 0.7 速度折算'
      );
      break;
    case 'hp':
      add(
        ATTRIBUTE_DETAIL_LABELS.physique ?? '体质',
        deltaPhysique * 4.5,
        '体质按 4.5 气血折算'
      );
      break;
    case 'hit':
      add(
        ATTRIBUTE_DETAIL_LABELS.strength ?? '力量',
        deltaStrength * 1.7,
        '仙族力量按 1.7 命中折算'
      );
      break;
    case 'magicCritLevel':
    case 'fixedDamage':
    case 'pierceLevel':
      break;
  }

  return sortPanelSourceValueItems(items);
}

function buildMeridianDetailItems(
  key: PanelSourceBreakdownKey,
  current: MeridianConfig,
  baseline: MeridianConfig
) {
  const items: PanelSourceValueItem[] = [];

  const add = (label: string, value: number, note?: string) => {
    const rounded = toRoundedNumber(value);
    if (rounded !== 0) {
      items.push({
        label,
        value: rounded,
        ...(note ? { note } : {}),
      });
    }
  };

  const deltaPhysique = current.physique - baseline.physique;
  const deltaMagic = current.magic - baseline.magic;
  const deltaStrength = current.strength - baseline.strength;
  const deltaEndurance = current.endurance - baseline.endurance;
  const deltaAgility = current.agility - baseline.agility;
  const deltaMagicPower = current.magicPower - baseline.magicPower;

  switch (key) {
    case 'magicDamage':
    case 'spiritualPower':
    case 'magicDefense':
      add(
        MERIDIAN_DETAIL_LABELS.physique,
        deltaPhysique * 0.3,
        '经脉体质按 0.3 灵力折算'
      );
      add(
        MERIDIAN_DETAIL_LABELS.magic,
        deltaMagic * 0.7,
        '经脉魔力按 0.7 灵力折算'
      );
      add(
        MERIDIAN_DETAIL_LABELS.strength,
        deltaStrength * 0.4,
        '经脉力量按 0.4 灵力折算'
      );
      add(
        MERIDIAN_DETAIL_LABELS.endurance,
        deltaEndurance * 0.2,
        '经脉耐力按 0.2 灵力折算'
      );
      add(
        MERIDIAN_DETAIL_LABELS.magicPower,
        deltaMagicPower,
        '经脉灵力直接联动法伤/法防'
      );
      break;
    case 'speed':
      add(
        MERIDIAN_DETAIL_LABELS.physique,
        deltaPhysique * 0.1,
        '经脉体质按 0.1 速度折算'
      );
      add(
        MERIDIAN_DETAIL_LABELS.strength,
        deltaStrength * 0.1,
        '经脉力量按 0.1 速度折算'
      );
      add(
        MERIDIAN_DETAIL_LABELS.endurance,
        deltaEndurance * 0.1,
        '经脉耐力按 0.1 速度折算'
      );
      add(
        MERIDIAN_DETAIL_LABELS.agility,
        deltaAgility * 0.7,
        '经脉敏捷按 0.7 速度折算'
      );
      break;
    case 'hp':
      add(
        MERIDIAN_DETAIL_LABELS.physique,
        deltaPhysique * 4.5,
        '经脉体质按 4.5 气血折算'
      );
      break;
    case 'hit':
      add(
        MERIDIAN_DETAIL_LABELS.strength,
        deltaStrength * 1.7,
        '经脉力量按 1.7 命中折算'
      );
      break;
    case 'magicCritLevel':
    case 'fixedDamage':
    case 'pierceLevel':
      break;
  }

  return sortPanelSourceValueItems(items);
}

function buildCultivationDetailItems(
  key: PanelSourceBreakdownKey,
  totalValue: number
) {
  if (totalValue === 0) {
    return [] as PanelSourceValueItem[];
  }

  if (key === 'hp') {
    return [
      {
        label: '强身',
        value: totalValue,
        note: '强身百分比只作用于气血基础部分',
      },
    ];
  }

  if (key === 'speed') {
    return [
      {
        label: '神速',
        value: totalValue,
        note: '神速按每级固定 +1.5 速度结算',
      },
    ];
  }

  return [] as PanelSourceValueItem[];
}

function buildTreasureDetailItems(
  key: PanelSourceBreakdownKey,
  current: Treasure | null,
  baseline: Treasure | null
) {
  const currentValue = current?.isActive
    ? Number(current.stats?.[key === 'fixedDamage' ? 'magicResult' : key] ?? 0)
    : 0;
  const baselineValue = baseline?.isActive
    ? Number(baseline.stats?.[key === 'fixedDamage' ? 'magicResult' : key] ?? 0)
    : 0;
  const diff = toRoundedNumber(currentValue) - toRoundedNumber(baselineValue);

  if (diff === 0) {
    return [] as PanelSourceValueItem[];
  }

  return [
    {
      label: current?.name || baseline?.name || '神器加成',
      value: diff,
      note: '神器当前按手动录入单属性直接计入',
    },
  ];
}

function buildSourceDetails(
  key: PanelSourceBreakdownKey,
  params: BreakdownContext,
  sourceEntries: PanelSourceValueItem[]
) {
  if (!params.syncedCloudState) {
    return [] as PanelSourceDetailGroup[];
  }

  const details: PanelSourceDetailGroup[] = [];
  const baseline = params.syncedCloudState;

  sourceEntries.forEach((source) => {
    let items: PanelSourceValueItem[] = [];

    if (source.label === '加点/档案') {
      items = buildAttributeDetailItems(
        key,
        params.baseAttributes,
        baseline.baseAttributes
      );
    } else if (source.label === '装备/符石') {
      const equipmentGroups = buildEquipmentDetailGroups(
        key,
        params.equipment,
        baseline.equipment
      );
      details.push(...equipmentGroups);
      items = [];
    } else if (source.label === '经脉') {
      items = buildMeridianDetailItems(key, params.meridian, baseline.meridian);
    } else if (source.label === '修炼') {
      items = buildCultivationDetailItems(key, source.value);
    } else if (source.label === '神器') {
      items = buildTreasureDetailItems(key, params.treasure, baseline.treasure);
    } else if (source.label === '其他联动') {
      items = [{ label: '规则联动平差', value: source.value }];
    }

    if (items.length > 0) {
      details.push({
        label: source.label,
        items: sortPanelSourceValueItems(items),
      });
    }
  });

  return details;
}

function buildBaselineCombatStats(
  params: BreakdownContext
): CombatStats & Record<string, number> {
  if (params.syncedCloudState) {
    return {
      ...params.syncedCloudState.combatStats,
    } as CombatStats & Record<string, number>;
  }

  return computeCombatStatsWithPanelBaseline({
    baseAttributes: params.baseAttributes,
    equipment: params.equipment,
    treasure: params.treasure,
    bodyStrength: params.bodyStrength,
    formation: params.formation,
    meridian: params.meridian,
    regularSetRules: params.regularSetRules,
    runeSkillBaselineEquipment: params.equipment,
  });
}

function buildCurrentCombatStats(
  params: BreakdownContext
): CombatStats & Record<string, number> {
  return computeCombatStatsWithPanelBaseline(
    {
      baseAttributes: params.baseAttributes,
      equipment: params.equipment,
      treasure: params.treasure,
      bodyStrength: params.bodyStrength,
      formation: params.formation,
      meridian: params.meridian,
      regularSetRules: params.regularSetRules,
      runeSkillBaselineEquipment:
        params.syncedCloudState?.equipment ?? params.equipment,
    },
    params.syncedCloudState
      ? {
          panelStats: params.syncedCloudState.combatStats,
          baseAttributes: params.syncedCloudState.baseAttributes,
          equipment: params.syncedCloudState.equipment,
          treasure: params.syncedCloudState.treasure,
          bodyStrength: params.syncedCloudState.cultivation.bodyStrength,
          formation:
            params.syncedCloudState.playerSetup?.formation ??
            params.syncedCloudState.formation,
          meridian: params.syncedCloudState.meridian,
          regularSetRules: params.regularSetRules,
          runeSkillBaselineEquipment: params.syncedCloudState.equipment,
        }
      : null
  );
}

function buildVariantCombatStats(
  params: BreakdownContext,
  variant: Partial<BreakdownContext>
): CombatStats & Record<string, number> {
  if (!params.syncedCloudState) {
    return buildCurrentCombatStats({
      ...params,
      ...variant,
    });
  }

  const baseline = params.syncedCloudState;

  return computeCombatStatsWithPanelBaseline(
    {
      baseAttributes: variant.baseAttributes ?? baseline.baseAttributes,
      equipment: variant.equipment ?? baseline.equipment,
      treasure:
        variant.treasure === undefined ? baseline.treasure : variant.treasure,
      bodyStrength: variant.bodyStrength ?? baseline.cultivation.bodyStrength,
      formation:
        variant.formation ??
        baseline.playerSetup?.formation ??
        baseline.formation,
      meridian: variant.meridian ?? baseline.meridian,
      regularSetRules: params.regularSetRules,
      runeSkillBaselineEquipment: baseline.equipment,
    },
    {
      panelStats: baseline.combatStats,
      baseAttributes: baseline.baseAttributes,
      equipment: baseline.equipment,
      treasure: baseline.treasure,
      bodyStrength: baseline.cultivation.bodyStrength,
      formation: baseline.playerSetup?.formation ?? baseline.formation,
      meridian: baseline.meridian,
      regularSetRules: params.regularSetRules,
      runeSkillBaselineEquipment: baseline.equipment,
    }
  );
}

export function buildSimulatorPanelSourceBreakdowns(
  params: BreakdownContext
): PanelSourceBreakdownItem[] {
  const hasBaseline = Boolean(params.syncedCloudState);
  const baselineStats = buildBaselineCombatStats(params);
  const currentStats = buildCurrentCombatStats(params);

  if (!hasBaseline) {
    return BREAKDOWN_KEYS.map((key) => ({
      key,
      label: BREAKDOWN_LABELS[key],
      total: toRoundedNumber(currentStats[key]),
      baseline: toRoundedNumber(currentStats[key]),
      delta: 0,
      sources: [],
      sourceDetails: [],
      hasBaseline: false,
    }));
  }

  const attributeOnlyStats = buildVariantCombatStats(params, {
    baseAttributes: params.baseAttributes,
  });
  const equipmentOnlyStats = buildVariantCombatStats(params, {
    equipment: params.equipment,
  });
  const meridianOnlyStats = buildVariantCombatStats(params, {
    meridian: params.meridian,
  });
  const treasureOnlyStats = buildVariantCombatStats(params, {
    treasure: params.treasure,
  });
  const cultivationOnlyStats = buildVariantCombatStats(params, {
    bodyStrength: params.bodyStrength,
  });

  return BREAKDOWN_KEYS.map((key) => {
    const baselineValue = toRoundedNumber(baselineStats[key]);
    const totalValue = toRoundedNumber(currentStats[key]);
    const deltaValue = totalValue - baselineValue;

    const sourceEntries = [
      {
        label: '加点/档案',
        value: toRoundedNumber(attributeOnlyStats[key]) - baselineValue,
      },
      {
        label: '装备/符石',
        value: toRoundedNumber(equipmentOnlyStats[key]) - baselineValue,
      },
      {
        label: '经脉',
        value: toRoundedNumber(meridianOnlyStats[key]) - baselineValue,
      },
      {
        label: '修炼',
        value: toRoundedNumber(cultivationOnlyStats[key]) - baselineValue,
      },
      {
        label: '神器',
        value: toRoundedNumber(treasureOnlyStats[key]) - baselineValue,
      },
    ].filter((entry) => entry.value !== 0);

    const knownTotal = sourceEntries.reduce(
      (sum, entry) => sum + entry.value,
      0
    );
    const residual = deltaValue - knownTotal;

    if (residual !== 0) {
      sourceEntries.push({
        label: '其他联动',
        value: residual,
      });
    }

    const sourceDetails = buildSourceDetails(key, params, sourceEntries);

    return {
      key,
      label: BREAKDOWN_LABELS[key],
      total: totalValue,
      baseline: baselineValue,
      delta: deltaValue,
      sources: sourceEntries,
      sourceDetails,
      hasBaseline: true,
    };
  });
}

export function buildSimulatorPanelSourceDeltaBreakdowns(
  sample: PanelSourceBreakdownItem[],
  current: PanelSourceBreakdownItem[]
): PanelSourceDeltaBreakdownItem[] {
  const sampleMap = new Map(sample.map((item) => [item.key, item]));
  const currentMap = new Map(current.map((item) => [item.key, item]));

  return BREAKDOWN_KEYS.map((key) => {
    const sampleItem = sampleMap.get(key);
    const currentItem = currentMap.get(key);
    const sourceLabels = new Set<string>([
      ...(sampleItem?.sources.map((item) => item.label) ?? []),
      ...(currentItem?.sources.map((item) => item.label) ?? []),
    ]);

    const sourceDiffs = Array.from(sourceLabels)
      .map((label) => {
        const sampleValue =
          sampleItem?.sources.find((item) => item.label === label)?.value ?? 0;
        const currentValue =
          currentItem?.sources.find((item) => item.label === label)?.value ?? 0;

        return {
          label,
          value: currentValue - sampleValue,
        };
      })
      .filter((item) => item.value !== 0)
      .sort((left, right) => Math.abs(right.value) - Math.abs(left.value));

    const detailLabels = new Set<string>([
      ...(sampleItem?.sourceDetails.map((item) => item.label) ?? []),
      ...(currentItem?.sourceDetails.map((item) => item.label) ?? []),
    ]);

    const sourceDetailDiffs = Array.from(detailLabels)
      .map((label) => {
        const sampleDetails =
          sampleItem?.sourceDetails.find((item) => item.label === label)
            ?.items ?? [];
        const currentDetails =
          currentItem?.sourceDetails.find((item) => item.label === label)
            ?.items ?? [];
        const itemLabels = new Set<string>([
          ...sampleDetails.map((item) => item.label),
          ...currentDetails.map((item) => item.label),
        ]);

        const items = Array.from(itemLabels)
          .map((itemLabel) => {
            const sampleValue =
              sampleDetails.find((item) => item.label === itemLabel)?.value ??
              0;
            const currentValue =
              currentDetails.find((item) => item.label === itemLabel)?.value ??
              0;

            return {
              label: itemLabel,
              value: currentValue - sampleValue,
            };
          })
          .filter((item) => item.value !== 0);

        return {
          label,
          items: sortPanelSourceValueItems(items),
        };
      })
      .filter((group) => group.items.length > 0);

    return {
      key,
      label: BREAKDOWN_LABELS[key],
      totalDiff: (currentItem?.delta ?? 0) - (sampleItem?.delta ?? 0),
      sourceDiffs,
      sourceDetailDiffs,
    };
  }).filter(
    (item) =>
      item.totalDiff !== 0 ||
      item.sourceDiffs.length > 0 ||
      item.sourceDetailDiffs.length > 0
  );
}
