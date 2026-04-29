import {
  getDamageRuleSet,
  type DamageAttributeConversionRule,
  type DamageModifierRule,
  type DamageRuleSet,
  type DamageSkillBonusRule,
  type DamageSkillFormulaRule,
} from '@/shared/models/damage-rules';
import {
  buildSimulatorCharacterDomain,
  type SimulatorCharacterDomain,
  type SimulatorNumericMap,
} from '@/shared/models/simulator-domain';
import type { StarAlignmentConfig } from '@/features/simulator/store/gameTypes';
import {
  extractActiveRuneSetMeta,
  isStrictStarAlignmentConfigActive,
  normalizeRuneColor,
} from '@/shared/lib/simulator-equipment-meta';
import {
  resolveElementRelationFromElements,
  resolveFormationBaseDamageFactor,
  resolveFormationCounterState,
  resolveFormationSpeedFactor,
} from '@/shared/lib/simulator-battle-context';
import {
  buildActiveOrnamentSetSummaries,
  parseOrnamentSetRulesConfig,
  type ActiveOrnamentSetRuntimeEffect,
} from '@/shared/lib/simulator-ornament-set';
import {
  parseRegularSetRulesConfig,
  resolveRegularSetAttributeBonuses,
} from '@/shared/lib/simulator-regular-set';
import { parseStarFullColorRulesConfig } from '@/shared/lib/simulator-rune-star-rules';
import type { SimulatorCharacterBundle } from '@/shared/models/simulator-types';
import {
  computeMagicSkillBaseTerm,
  computeWeaponDamageToMagicDamageBonus,
  getPrdPanelBaseConstant,
  resolvePassiveCultivationLevels,
  resolveTrustedBasePanelConstant,
} from '@/shared/lib/simulator-core-rules';

type JsonObject = Record<string, unknown>;

const DEFAULT_SELF_FORMATION_FACTOR = 1;
const DEFAULT_FORMATION_COUNTER_STATE = '无克/普通';

export type DamageEngineTargetInput = {
  name?: string;
  magicDefense: number;
  speed?: number;
  magicDefenseCultivation?: number;
  shenmuValue?: number;
  magicResult?: number;
  magicDefenseResult?: number;
  defenseState?: string;
  specialMagicDamageReductionFactor?: number;
};

export type DamageEngineRequest = {
  skillCode?: string;
  skillName?: string;
  ruleVersionId?: string;
  ruleVersionCode?: string;
  targetCount?: number;
  selfFormation?: string;
  targetFormation?: string;
  selfElement?: string;
  targetElement?: string;
  formationFactor?: number;
  formationCounterState?: string;
  elementRelation?: string;
  transformCardFactor?: number;
  weather?: string;
  shenmuValue?: number;
  magicResult?: number;
  targetMagicDefense?: number;
  targetMagicDefenseResult?: number;
  targetSpeed?: number;
  targetMagicDefenseCultivation?: number;
  targetDefenseState?: string;
  specialMagicDamageReductionFactor?: number;
  targetName?: string;
  activeBonusRuleCodes?: string[];
  panelMagicDamageOverride?: number;
  luohanFactor?: number;
  damageVarianceFactor?: number;
  criticalChance?: number;
  criticalExpectationMultiplier?: number;
  targets?: DamageEngineTargetInput[];
};

export type DamageEngineTargetResult = {
  targetName: string;
  damage: number;
  critDamage: number;
  totalDamage: number;
  totalCritDamage: number;
  expectedDamage?: number;
  expectedTotalDamage?: number;
  breakdown: JsonObject;
};

export type DamageEngineResult = {
  ruleVersion: {
    id: string;
    versionCode: string;
    versionName: string;
  };
  skill: {
    skillCode: string;
    skillName: string;
    baseLevel: number;
    finalLevel: number;
    bonusLevel: number;
  };
  panelStats: {
    hp: number;
    mp: number;
    hit: number;
    damage: number;
    magicDamage: number;
    spellDamageLevel: number;
    defense: number;
    magicDefense: number;
    speed: number;
    dodge: number;
    spirit: number;
    magicCritLevel: number;
  };
  targets: DamageEngineTargetResult[];
};

export type DamageEngineRuleExecutionInput = {
  bundle: SimulatorCharacterBundle;
  domain: SimulatorCharacterDomain;
  ruleSet: DamageRuleSet;
  request: DamageEngineRequest;
};

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampTargetCount(value: number | undefined) {
  const parsed = Math.floor(toFiniteNumber(value, 1));
  return Math.min(10, Math.max(1, parsed));
}

function roundForBreakdown(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clampMin(value: unknown, fallback: number, min: number) {
  return Math.max(min, toFiniteNumber(value, fallback));
}

function clampRatio(value: unknown, fallback: number) {
  const parsed = toFiniteNumber(value, fallback);
  if (parsed <= 0) {
    return 0;
  }
  if (parsed >= 1) {
    return 1;
  }
  return parsed;
}

function resolveMagicCritChanceFromLevel(level: unknown) {
  const normalizedLevel = Math.max(0, toFiniteNumber(level, 0));
  return Math.min(0.95, normalizedLevel / 1750);
}

function resolveWeatherFactor(params: {
  school: string;
  weather?: string;
}) {
  return params.school === '龙宫' && params.weather === '雨天' ? 1.1 : 1;
}

function resolveMagicTargetDefenseFactor(_value?: string) {
  // 防御指令只影响物理伤害，当前龙宫法伤链路显式保持不变。
  return 1;
}

function buildRuleInputValues(
  domain: SimulatorCharacterDomain,
  rules: DamageAttributeConversionRule[]
) {
  const sourceAttrs = new Set(rules.map((rule) => rule.sourceAttr));
  const inputs: SimulatorNumericMap = {};

  for (const sourceAttr of sourceAttrs) {
    if (sourceAttr === 'baseHp') {
      inputs[sourceAttr] = resolveTrustedBasePanelConstant(
        domain.attributeSources[sourceAttr],
        getPrdPanelBaseConstant('hp')
      );
      continue;
    }

    if (sourceAttr === 'baseMp') {
      inputs[sourceAttr] = getPrdPanelBaseConstant('mp');
      continue;
    }

    inputs[sourceAttr] = toFiniteNumber(domain.attributeSources[sourceAttr]);
  }

  for (const sourceAttr of sourceAttrs) {
    if (domain.equipmentAttributeTotals[sourceAttr] !== undefined) {
      inputs[sourceAttr] =
        (inputs[sourceAttr] ?? 0) +
        toFiniteNumber(domain.equipmentAttributeTotals[sourceAttr]);
    }

    if (sourceAttr === 'spirit') {
      inputs[sourceAttr] =
        (inputs[sourceAttr] ?? 0) +
        toFiniteNumber(domain.equipmentAttributeTotals.magicPower);
    }
  }

  return inputs;
}

function resolveRuleDerivedPanelStat(
  valueBag: SimulatorNumericMap,
  equipmentTotals: SimulatorNumericMap,
  statKey: string,
  fallback?: number
) {
  const resolved =
    toFiniteNumber(valueBag[statKey]) +
    toFiniteNumber(equipmentTotals[statKey]);

  if (resolved !== 0 || fallback === undefined) {
    return resolved;
  }

  return toFiniteNumber(fallback);
}

function computeAttributeConversions(
  sourceValues: SimulatorNumericMap,
  rules: DamageAttributeConversionRule[]
) {
  const valueBag: SimulatorNumericMap = { ...sourceValues };
  const totals: SimulatorNumericMap = {};
  const contributions = rules.map((rule) => {
    const sourceValue = toFiniteNumber(valueBag[rule.sourceAttr]);
    const coefficient = toFiniteNumber(rule.coefficient);
    const rawContribution = sourceValue * coefficient;
    const contribution =
      rule.valueType === 'floor_linear'
        ? Math.floor(rawContribution)
        : rawContribution;
    totals[rule.targetAttr] = (totals[rule.targetAttr] ?? 0) + contribution;
    valueBag[rule.targetAttr] = (valueBag[rule.targetAttr] ?? 0) + contribution;

    return {
      sourceAttr: rule.sourceAttr,
      targetAttr: rule.targetAttr,
      sourceValue,
      coefficient,
      contribution,
    };
  });

  return {
    totals,
    contributions,
    valueBag,
  };
}

function getCultivationLevel(
  domain: SimulatorCharacterDomain,
  cultivationType: string
) {
  return toFiniteNumber(domain.cultivationLevels[cultivationType]);
}

function resolveLookupValue(
  rule: DamageModifierRule | undefined,
  inputKey: string | number | undefined,
  fallback: number
) {
  if (!rule) {
    return fallback;
  }

  if (rule.modifierType === 'lookup') {
    const lookup = rule.valueLookup;
    const normalizedKey = String(inputKey ?? '');
    const directValue = lookup[normalizedKey];
    if (typeof directValue === 'number') {
      return directValue;
    }

    if (typeof lookup.default === 'number') {
      return lookup.default;
    }

    if (
      Number.isFinite(Number(normalizedKey)) &&
      Number(normalizedKey) >= 5 &&
      typeof lookup['5+'] === 'number'
    ) {
      return lookup['5+'] as number;
    }

    return fallback;
  }

  if (rule.modifierType === 'addend' || rule.modifierType === 'multiplier') {
    return toFiniteNumber(rule.value, fallback);
  }

  return fallback;
}

function findModifierByDomain(ruleSet: DamageRuleSet, modifierDomain: string) {
  return ruleSet.modifiers.find(
    (item) => item.modifierDomain === modifierDomain
  );
}

function matchesConditionValue(
  expected: unknown,
  actual: string | undefined
): boolean {
  if (expected === undefined || expected === null || actual === undefined) {
    return expected === undefined || expected === null;
  }

  if (Array.isArray(expected)) {
    return expected.some((value) => String(value) === actual);
  }

  return String(expected) === actual;
}

function matchesScopedRule(
  value: string | null | undefined,
  actual: string | undefined
) {
  if (!value || value.trim().length === 0) {
    return true;
  }

  return value === actual;
}

const PRIMARY_EQUIPMENT_SLOTS = new Set([
  'weapon',
  'helmet',
  'necklace',
  'armor',
  'belt',
  'shoes',
]);

const STAR_POSITION_STAT_ALIAS: Array<[string, string]> = [
  ['法术伤害', 'magicDamage'],
  ['法伤', 'magicDamage'],
  ['气血', 'hp'],
  ['速度', 'speed'],
  ['法术防御', 'magicDefense'],
  ['法防', 'magicDefense'],
  ['防御', 'defense'],
  ['伤害', 'damage'],
  ['命中', 'hit'],
  ['躲避', 'dodge'],
  ['灵力', 'spirit'],
];

const STAR_ALIGNMENT_ATTR_ALIAS: Array<[string, string]> = [
  ['体质', 'physique'],
  ['魔力', 'magic'],
  ['力量', 'strength'],
  ['耐力', 'endurance'],
  ['敏捷', 'agility'],
];

type StarBonusResolution = {
  panelStatBonuses: Record<string, number>;
  attributeSourceBonuses: Record<string, number>;
  fullSetActive: boolean;
  fullSetAttributeBonus: number;
  fullColorSetRule: {
    color: string;
    label: string;
    targetKey: string;
    value: number;
    bonusType: 'panel_stat' | 'attribute_source';
  } | null;
  starPositionBonuses: Array<{
    equipmentId: string;
    slot: string;
    label: string;
    targetKey: string;
    value: number;
    color?: string;
  }>;
  starAlignmentBonuses: Array<{
    equipmentId: string;
    slot: string;
    label: string;
    targetKey: string;
    value: number;
  }>;
};

type ActivePanelStatBonusRule = {
  ruleCode: string;
  skillCode: string;
  skillName: string;
  bonusValue: number;
  activeCount: number;
  targetKeys: string[];
};

type IgnoredBonusRule = {
  ruleCode: string;
  skillCode: string;
  skillName: string;
  ignoredCount: number;
  reason: 'limit_exceeded';
};

type OrnamentSetBonusResolution = {
  panelStatBonuses: Record<string, number>;
  attributeSourceBonuses: Record<string, number>;
  skillDamageAddends: ActiveOrnamentSetRuntimeEffect[];
  activeSets: ReturnType<typeof buildActiveOrnamentSetSummaries>;
};

function isDisabledStarBonus(value: unknown) {
  if (typeof value !== 'string') {
    return true;
  }

  const normalized = value.trim();
  return !normalized || normalized === '无';
}

function parseStarBonusValue(value: string) {
  const matched = value.match(/([+-]?\d+(?:\.\d+)?)/);
  if (!matched) {
    return null;
  }

  const parsed = Number(matched[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStarAlignmentConfig(
  value: unknown
): StarAlignmentConfig | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const id =
    typeof record.id === 'string' && record.id.trim().length > 0
      ? record.id.trim()
      : '';
  const label =
    typeof record.label === 'string' && record.label.trim().length > 0
      ? record.label.trim()
      : '';
  const attrType =
    typeof record.attrType === 'string' && record.attrType.trim().length > 0
      ? record.attrType.trim()
      : '';
  const attrValue = Number(record.attrValue);

  if (!id || !label || !attrType || !Number.isFinite(attrValue)) {
    return undefined;
  }

  const colors = Array.isArray(record.colors)
    ? record.colors
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : undefined;

  return {
    id,
    label,
    attrType,
    attrValue,
    comboName:
      typeof record.comboName === 'string' && record.comboName.trim().length > 0
        ? record.comboName.trim()
        : undefined,
    colors: colors && colors.length > 0 ? colors : undefined,
  };
}

function resolveStarPositionBonus(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const label =
      typeof record.label === 'string' && record.label.trim().length > 0
        ? record.label.trim()
        : '';
    const targetKey =
      typeof record.attrType === 'string' && record.attrType.trim().length > 0
        ? record.attrType.trim()
        : '';
    const parsedValue = toFiniteNumber(record.attrValue, Number.NaN);
    const color = normalizeRuneColor(record.color) || undefined;

    if (label && targetKey && Number.isFinite(parsedValue)) {
      return { label, targetKey, value: parsedValue, color };
    }
  }

  if (isDisabledStarBonus(value)) {
    return null;
  }

  const label = String(value).trim();
  const parsedValue = parseStarBonusValue(label);
  if (parsedValue === null) {
    return null;
  }

  for (const [alias, targetKey] of STAR_POSITION_STAT_ALIAS) {
    if (label.includes(alias)) {
      return { label, targetKey, value: parsedValue, color: undefined };
    }
  }

  return null;
}

function resolveStarAlignmentBonus(params: {
  value: unknown;
  config: unknown;
  notes: unknown;
}) {
  const structuredConfig = toStarAlignmentConfig(params.config);
  if (structuredConfig) {
    const label = structuredConfig.label;
    const targetKey = structuredConfig.attrType;
    const parsedValue = toFiniteNumber(structuredConfig.attrValue, Number.NaN);

    if (
      label &&
      targetKey &&
      Number.isFinite(parsedValue) &&
      isStrictStarAlignmentConfigActive({
        notes: params.notes,
        config: structuredConfig,
      })
    ) {
      return {
        label,
        targetKey,
        value: parsedValue,
        strictMatched: true,
      };
    }
  }

  if (isDisabledStarBonus(params.value)) {
    return null;
  }

  const label = String(params.value).trim();
  const parsedValue = parseStarBonusValue(label);
  if (parsedValue === null) {
    return null;
  }

  for (const [alias, targetKey] of STAR_ALIGNMENT_ATTR_ALIAS) {
    if (label.includes(alias)) {
      return { label, targetKey, value: parsedValue, strictMatched: false };
    }
  }

  return null;
}

function resolveStarBonuses(
  domain: SimulatorCharacterDomain,
  ruleSet: DamageRuleSet
): StarBonusResolution {
  const panelStatBonuses: Record<string, number> = {};
  const attributeSourceBonuses: Record<string, number> = {};
  const starPositionBonuses: StarBonusResolution['starPositionBonuses'] = [];
  const starAlignmentBonuses: StarBonusResolution['starAlignmentBonuses'] = [];
  const alignedPrimarySlots = new Set<string>();
  const fullColorRules = parseStarFullColorRulesConfig(
    ruleSet.equipmentExtensionConfigs.find(
      (item) => item.configKey === 'star_full_color_rules'
    )?.value
  );
  const primaryStarColors = new Map<string, string>();

  for (const equipment of domain.equipment) {
    if (!PRIMARY_EQUIPMENT_SLOTS.has(equipment.slot)) {
      continue;
    }

    const notes = equipment.build?.notes ?? {};
    const starPositionBonus = resolveStarPositionBonus(
      notes.starPositionConfig ?? notes.starPosition
    );
    if (starPositionBonus) {
      panelStatBonuses[starPositionBonus.targetKey] =
        (panelStatBonuses[starPositionBonus.targetKey] ?? 0) +
        starPositionBonus.value;
      starPositionBonuses.push({
        equipmentId: equipment.id,
        slot: equipment.slot,
        ...starPositionBonus,
      });
      if (starPositionBonus.color) {
        primaryStarColors.set(equipment.slot, starPositionBonus.color);
      }
    }

    const starAlignmentBonus = resolveStarAlignmentBonus({
      value: notes.starAlignment,
      config: notes.starAlignmentConfig,
      notes,
    });
    if (starAlignmentBonus) {
      attributeSourceBonuses[starAlignmentBonus.targetKey] =
        (attributeSourceBonuses[starAlignmentBonus.targetKey] ?? 0) +
        starAlignmentBonus.value;
      starAlignmentBonuses.push({
        equipmentId: equipment.id,
        slot: equipment.slot,
        ...starAlignmentBonus,
      });
      if (starAlignmentBonus.strictMatched) {
        alignedPrimarySlots.add(equipment.slot);
      }
    }
  }

  const fullSetActive = PRIMARY_EQUIPMENT_SLOTS.size === alignedPrimarySlots.size;
  const fullSetAttributeBonus = fullSetActive ? 2 : 0;
  const allPrimaryStarColors =
    primaryStarColors.size === PRIMARY_EQUIPMENT_SLOTS.size
      ? Array.from(primaryStarColors.values())
      : [];
  const matchedFullColorRule =
    allPrimaryStarColors.length === PRIMARY_EQUIPMENT_SLOTS.size &&
    allPrimaryStarColors.every((color) => color === allPrimaryStarColors[0])
      ? fullColorRules.find((rule) => rule.color === allPrimaryStarColors[0]) ??
        null
      : null;

  if (fullSetAttributeBonus > 0) {
    for (const [, targetKey] of STAR_ALIGNMENT_ATTR_ALIAS) {
      attributeSourceBonuses[targetKey] =
        (attributeSourceBonuses[targetKey] ?? 0) + fullSetAttributeBonus;
    }
  }

  if (matchedFullColorRule) {
    if (matchedFullColorRule.bonusType === 'panel_stat') {
      panelStatBonuses[matchedFullColorRule.targetKey] =
        (panelStatBonuses[matchedFullColorRule.targetKey] ?? 0) +
        matchedFullColorRule.value;
    } else {
      attributeSourceBonuses[matchedFullColorRule.targetKey] =
        (attributeSourceBonuses[matchedFullColorRule.targetKey] ?? 0) +
        matchedFullColorRule.value;
    }
  }

  return {
    panelStatBonuses,
    attributeSourceBonuses,
    fullSetActive,
    fullSetAttributeBonus,
    fullColorSetRule: matchedFullColorRule,
    starPositionBonuses,
    starAlignmentBonuses,
  };
}

function resolveOrnamentSetBonuses(
  domain: SimulatorCharacterDomain,
  ruleSet: DamageRuleSet
): OrnamentSetBonusResolution {
  const ornamentSetConfig =
    ruleSet.equipmentExtensionConfigs.find(
      (item) => item.configKey === 'ornament_set_rules'
    )?.value ?? [];
  const rules = parseOrnamentSetRulesConfig(ornamentSetConfig);
  const activeSets = buildActiveOrnamentSetSummaries({
    equipment: domain.equipment.map((equipment) => ({
      id: equipment.id,
      slot: equipment.slot,
      level: equipment.level,
      setName:
        typeof equipment.build?.setEffect?.setName === 'string'
          ? equipment.build.setEffect.setName
          : undefined,
    })),
    rules,
  });

  const panelStatBonuses: Record<string, number> = {};
  const attributeSourceBonuses: Record<string, number> = {};
  const skillDamageAddends: ActiveOrnamentSetRuntimeEffect[] = [];

  for (const activeSet of activeSets) {
    for (const effect of activeSet.effects) {
      if (effect.type === 'panel_stat_bonus' && effect.targetKey) {
        panelStatBonuses[effect.targetKey] =
          (panelStatBonuses[effect.targetKey] ?? 0) + toFiniteNumber(effect.value);
        continue;
      }

      if (effect.type === 'attribute_source_bonus' && effect.targetKey) {
        attributeSourceBonuses[effect.targetKey] =
          (attributeSourceBonuses[effect.targetKey] ?? 0) +
          toFiniteNumber(effect.value);
        continue;
      }

      if (effect.type === 'skill_damage_addend') {
        skillDamageAddends.push(effect);
      }
    }
  }

  return {
    panelStatBonuses,
    attributeSourceBonuses,
    skillDamageAddends,
    activeSets,
  };
}

function resolveRegularSetBonuses(
  domain: SimulatorCharacterDomain,
  ruleSet: DamageRuleSet
) {
  const regularSetConfig =
    ruleSet.equipmentExtensionConfigs.find(
      (item) => item.configKey === 'regular_set_rules'
    )?.value ?? [];
  const rules = parseRegularSetRulesConfig(regularSetConfig);

  return resolveRegularSetAttributeBonuses(
    domain.equipment.map((equipment) => ({
      slot: equipment.slot,
      setName:
        typeof equipment.build?.setEffect?.setName === 'string'
          ? equipment.build.setEffect.setName
          : undefined,
    })),
    rules
  );
}

function buildEquipmentNotesForActivation(
  equipment: SimulatorCharacterDomain['equipment'][number]
) {
  return {
    ...(equipment.build?.notes ?? {}),
    holeCount: equipment.build?.holeCount,
  };
}

function extractActiveRuneColors(
  equipment: SimulatorCharacterDomain['equipment'][number]
) {
  return extractActiveRuneSetMeta(
    buildEquipmentNotesForActivation(equipment)
  ).activeColors;
}

function getFirstRuneColorBySlot(domain: SimulatorCharacterDomain) {
  return Object.fromEntries(
    domain.equipment
      .map((equipment) => [equipment.slot, extractActiveRuneColors(equipment)[0]])
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
}

function matchesFullRuneSetCondition(
  condition: JsonObject,
  domain: SimulatorCharacterDomain
) {
  const slotColorMap = condition.slotColorMap;
  if (!slotColorMap || typeof slotColorMap !== 'object') {
    return false;
  }

  const activeColorBySlot = getFirstRuneColorBySlot(domain);

  const slotMatched = Object.entries(slotColorMap as Record<string, unknown>).every(
    ([slot, expectedColor]) => {
      const normalizedExpected = normalizeRuneColor(expectedColor);
      return Boolean(normalizedExpected) && activeColorBySlot[slot] === normalizedExpected;
    }
  );

  if (!slotMatched) {
    return false;
  }

  if (condition.requireStarResonance !== true) {
    return true;
  }

  return domain.equipment
    .filter((equipment) => PRIMARY_EQUIPMENT_SLOTS.has(equipment.slot))
    .every((equipment) =>
      isStrictStarAlignmentConfigActive({
        notes: buildEquipmentNotesForActivation(equipment),
        config:
          equipment.build?.notes?.starAlignmentConfig as Parameters<
            typeof isStrictStarAlignmentConfigActive
          >[0]['config'],
      })
    );
}

function deriveActiveBonusRuleCodes(params: {
  domain: SimulatorCharacterDomain;
  ruleSet: DamageRuleSet;
  school: string;
  roleType: string;
  explicitRuleCodes: string[];
}) {
  const derivedCodes = [...params.explicitRuleCodes];
  const matchedRules: DamageSkillBonusRule[] = [];
  const ignoredRules: IgnoredBonusRule[] = [];

  for (const rule of params.ruleSet.skillBonuses) {
    const condition = rule.condition ?? {};
    const triggerType =
      typeof condition.triggerType === 'string'
        ? condition.triggerType
        : 'manual';

    if (triggerType !== 'rune_combo') {
      continue;
    }

    if (
      !matchesConditionValue(condition.school, params.school) ||
      !matchesConditionValue(condition.roleType, params.roleType)
    ) {
      continue;
    }

    const expectedColors = Array.isArray(condition.colorSequence)
      ? condition.colorSequence
          .map((value) => normalizeRuneColor(value))
          .filter((value): value is string => Boolean(value))
      : [];

    if (expectedColors.length === 0) {
      continue;
    }

    const slotCount = Math.max(
      expectedColors.length,
      Math.floor(toFiniteNumber(condition.slotCount, expectedColors.length))
    );
    const positionScope = Array.isArray(condition.positionScope)
      ? condition.positionScope
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
      : [];

    const matchedEquipmentCount = params.domain.equipment.filter((equipment) => {
      if (positionScope.length > 0 && !positionScope.includes(equipment.slot)) {
        return false;
      }

      const activeColors = extractActiveRuneColors(equipment);
      if (
        activeColors.length < slotCount ||
        activeColors.length < expectedColors.length
      ) {
        return false;
      }

      return expectedColors.every(
        (color, index) => activeColors[index] === color
      );
    }).length;

    if (matchedEquipmentCount > 0) {
      for (let index = 0; index < matchedEquipmentCount; index += 1) {
        matchedRules.push(rule);
      }
    }
  }

  const groupedRules = new Map<string, DamageSkillBonusRule[]>();
  for (const rule of matchedRules) {
    const groupKey = `${rule.bonusGroup || 'default'}::${rule.skillCode || rule.ruleCode}`;
    const items = groupedRules.get(groupKey) ?? [];
    items.push(rule);
    groupedRules.set(groupKey, items);
  }

  for (const rules of groupedRules.values()) {
    const globalMaxActive = Math.max(
      1,
      ...rules.map((rule) =>
        Math.max(
          0,
          Math.floor(toFiniteNumber(rule.limitPolicy?.globalMaxActive, 1))
        )
      )
    );
    const sorted = [...rules].sort(
      (left, right) =>
        toFiniteNumber(right.bonusValue) - toFiniteNumber(left.bonusValue) ||
        toFiniteNumber(left.sort) - toFiniteNumber(right.sort)
    );
    const selectedRules = sorted.slice(0, globalMaxActive);
    const droppedRules = sorted.slice(globalMaxActive);

    for (const rule of selectedRules) {
      derivedCodes.push(rule.ruleCode);
    }

    if (droppedRules.length > 0) {
      const droppedByRuleCode = new Map<string, IgnoredBonusRule>();
      for (const rule of droppedRules) {
        const current = droppedByRuleCode.get(rule.ruleCode);
        if (current) {
          current.ignoredCount += 1;
          continue;
        }

        droppedByRuleCode.set(rule.ruleCode, {
          ruleCode: rule.ruleCode,
          skillCode: rule.skillCode,
          skillName: rule.skillName,
          ignoredCount: 1,
          reason: 'limit_exceeded',
        });
      }

      ignoredRules.push(...droppedByRuleCode.values());
    }
  }

  return {
    derivedCodes,
    ignoredRules,
  };
}

function matchesModifierTrigger(
  condition: JsonObject,
  domain: SimulatorCharacterDomain
) {
  const triggerType =
    typeof condition.triggerType === 'string' ? condition.triggerType : 'manual';

  if (triggerType === 'manual') {
    return true;
  }

  if (triggerType === 'rune_full_set') {
    return matchesFullRuneSetCondition(condition, domain);
  }

  return false;
}

function findScopedModifierByDomain(params: {
  ruleSet: DamageRuleSet;
  modifierDomain: string;
  school?: string;
  roleType?: string;
  skillCode?: string;
  domain?: SimulatorCharacterDomain;
}) {
  const scopedMatch = params.ruleSet.modifiers.find((item) => {
    if (item.modifierDomain !== params.modifierDomain) {
      return false;
    }

    const condition = item.condition ?? {};

    return (
      matchesConditionValue(condition.school, params.school) &&
      matchesConditionValue(condition.roleType, params.roleType) &&
      matchesConditionValue(condition.skillCode, params.skillCode) &&
      (!params.domain || matchesModifierTrigger(condition, params.domain))
    );
  });

  return (
    scopedMatch ?? findModifierByDomain(params.ruleSet, params.modifierDomain)
  );
}

function findActiveScopedModifiersByDomain(params: {
  ruleSet: DamageRuleSet;
  modifierDomain: string;
  school?: string;
  roleType?: string;
  skillCode?: string;
  domain: SimulatorCharacterDomain;
}) {
  return params.ruleSet.modifiers.filter((item) => {
    if (item.modifierDomain !== params.modifierDomain) {
      return false;
    }

    const condition = item.condition ?? {};

    return (
      matchesConditionValue(condition.school, params.school) &&
      matchesConditionValue(condition.roleType, params.roleType) &&
      matchesConditionValue(condition.skillCode, params.skillCode) &&
      matchesModifierTrigger(condition, params.domain)
    );
  });
}

function resolveTransformCardFactor(
  request: DamageEngineRequest,
  ruleSet: DamageRuleSet
) {
  if (typeof request.transformCardFactor === 'number') {
    return request.transformCardFactor;
  }

  const rule = findModifierByDomain(ruleSet, 'transform_card');
  return resolveLookupValue(rule, 'default', 1);
}

function resolveAddendValue(
  requestValue: number | undefined,
  targetValue: number | undefined,
  fallback = 0
) {
  if (typeof targetValue === 'number') {
    return targetValue;
  }

  if (typeof requestValue === 'number') {
    return requestValue;
  }

  return fallback;
}

function findSkill(
  bundle: SimulatorCharacterBundle,
  request: DamageEngineRequest
) {
  if (request.skillCode) {
    const byCode = bundle.skills.find(
      (item) => item.skillCode === request.skillCode
    );
    if (byCode) {
      return byCode;
    }
  }

  if (request.skillName) {
    const byName = bundle.skills.find(
      (item) => item.skillName === request.skillName
    );
    if (byName) {
      return byName;
    }
  }

  return (
    bundle.skills.find((item) => item.skillCode === 'dragon_roll') ??
    bundle.skills[0] ??
    null
  );
}

function resolveSkillBonus(
  skillCode: string,
  ruleSet: DamageRuleSet,
  activeBonusRuleCodes: string[]
) {
  if (activeBonusRuleCodes.length === 0) {
    return {
      bonusLevel: 0,
      matchedRules: [] as DamageSkillBonusRule[],
    };
  }

  const matchedRules = ruleSet.skillBonuses.filter(
    (item) =>
      item.skillCode === skillCode &&
      activeBonusRuleCodes.includes(item.ruleCode) &&
      (item.bonusType === 'skill_level' || !item.bonusType)
  );

  if (matchedRules.length === 0) {
    return {
      bonusLevel: 0,
      matchedRules,
    };
  }

  const shouldTakeMax = matchedRules.every(
    (item) => item.conflictPolicy === 'take_max'
  );
  const bonusLevel = shouldTakeMax
    ? Math.max(...matchedRules.map((item) => toFiniteNumber(item.bonusValue)))
    : matchedRules.reduce(
        (sum, item) => sum + toFiniteNumber(item.bonusValue),
        0
      );

  return {
    bonusLevel,
    matchedRules,
  };
}

function resolvePanelStatBonusesFromSkillBonuses(
  skillCode: string,
  ruleSet: DamageRuleSet,
  activeBonusRuleCodes: string[]
) {
  const ruleCodeCounts = new Map<string, number>();
  for (const ruleCode of activeBonusRuleCodes) {
    ruleCodeCounts.set(ruleCode, (ruleCodeCounts.get(ruleCode) ?? 0) + 1);
  }

  const matchedRules: ActivePanelStatBonusRule[] = [];
  const panelStatBonuses: Record<string, number> = {};

  for (const rule of ruleSet.skillBonuses) {
    if (rule.bonusType !== 'panel_stat_bonus') {
      continue;
    }

    const activeCount = ruleCodeCounts.get(rule.ruleCode) ?? 0;
    if (activeCount <= 0) {
      continue;
    }

    const condition = rule.condition ?? {};
    if (
      condition.skillCode !== undefined &&
      !matchesConditionValue(condition.skillCode, skillCode)
    ) {
      continue;
    }

    const targetKeys = (
      Array.isArray(condition.targetKeys)
        ? condition.targetKeys
        : [condition.targetKey ?? condition.attrType]
    )
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean);

    if (targetKeys.length === 0) {
      continue;
    }

    const bonusValue = toFiniteNumber(rule.bonusValue);
    for (const targetKey of targetKeys) {
      panelStatBonuses[targetKey] =
        (panelStatBonuses[targetKey] ?? 0) + bonusValue * activeCount;
    }

    matchedRules.push({
      ruleCode: rule.ruleCode,
      skillCode: rule.skillCode,
      skillName: rule.skillName,
      bonusValue,
      activeCount,
      targetKeys,
    });
  }

  return {
    panelStatBonuses,
    matchedRules,
  };
}

function findSkillFormula(params: {
  skillCode: string;
  ruleSet: DamageRuleSet;
  school?: string;
  roleType?: string;
}) {
  const scopedMatch = params.ruleSet.skillFormulas.find(
    (item) =>
      item.skillCode === params.skillCode &&
      matchesScopedRule(item.school, params.school) &&
      matchesScopedRule(item.roleType, params.roleType)
  );

  return (
    scopedMatch ??
    params.ruleSet.skillFormulas.find((item) => item.skillCode === params.skillCode) ??
    null
  );
}

function computeSkillBaseTerm(
  rule: DamageSkillFormulaRule,
  skillLevel: number
) {
  const baseTerm = rule.baseFormula.baseTerm as JsonObject | undefined;
  const type =
    typeof baseTerm?.type === 'string' ? baseTerm.type : 'quadratic';

  if (type === 'linear') {
    return (
      toFiniteNumber(baseTerm?.multiplier) * skillLevel +
      toFiniteNumber(baseTerm?.addend)
    );
  }

  if (type === 'prd_magic_skill') {
    return computeMagicSkillBaseTerm({
      skillCode: rule.skillCode,
      skillLevel,
    });
  }

  const a = toFiniteNumber(baseTerm?.a);
  const b = toFiniteNumber(baseTerm?.b);
  const c = toFiniteNumber(baseTerm?.c);

  return a * skillLevel * skillLevel + b * skillLevel + c;
}

function buildDefaultTargets(
  request: DamageEngineRequest,
  domain: SimulatorCharacterDomain
): DamageEngineTargetInput[] {
  if (request.targets && request.targets.length > 0) {
    return request.targets.map((target) => ({
      ...target,
      magicDefenseResult:
        request.targetMagicDefenseResult ?? target.magicDefenseResult,
      defenseState: request.targetDefenseState ?? target.defenseState,
      specialMagicDamageReductionFactor:
        request.specialMagicDamageReductionFactor ??
        target.specialMagicDamageReductionFactor,
    }));
  }

  const fallbackTarget = domain.battleContext;

  return [
    {
      name: request.targetName || fallbackTarget?.targetName || '默认目标',
      magicDefense: toFiniteNumber(
        request.targetMagicDefense,
        fallbackTarget?.targetMagicDefense ?? 0
      ),
      magicDefenseCultivation: toFiniteNumber(
        request.targetMagicDefenseCultivation,
        fallbackTarget?.targetMagicDefenseCultivation ?? 0
      ),
      speed: toFiniteNumber(request.targetSpeed, fallbackTarget?.targetSpeed ?? 0),
      shenmuValue: request.shenmuValue ?? fallbackTarget?.shenmuValue,
      magicResult: request.magicResult ?? fallbackTarget?.magicResult,
      magicDefenseResult:
        request.targetMagicDefenseResult ??
        fallbackTarget?.targetMagicDefenseResult,
      defenseState: request.targetDefenseState ?? fallbackTarget?.targetDefenseState,
      specialMagicDamageReductionFactor:
        request.specialMagicDamageReductionFactor ??
        fallbackTarget?.specialMagicDamageReductionFactor,
    },
  ];
}

function resolveSkillManaCost(
  skill: SimulatorCharacterBundle['skills'][number]
) {
  try {
    const sourceDetail = JSON.parse(skill.sourceDetailJson || '{}') as JsonObject;
    const persistedManaCost = toFiniteNumber(sourceDetail.manaCost, Number.NaN);
    if (Number.isFinite(persistedManaCost)) {
      return persistedManaCost;
    }
  } catch {
    // ignore malformed legacy payload
  }

  if (skill.skillCode === 'dragon_teng') {
    return 30;
  }

  return 0;
}

function resolveModifierContribution(params: {
  modifier: DamageModifierRule;
  sourceValue: number;
}) {
  if (params.modifier.modifierType === 'multiplier') {
    return params.sourceValue * toFiniteNumber(params.modifier.value);
  }

  if (params.modifier.modifierType === 'addend') {
    return toFiniteNumber(params.modifier.value);
  }

  return 0;
}

function normalizePercentValue(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.abs(value) >= 1 ? value / 100 : value;
}

function collectEquipmentEffectTexts(
  equipment: SimulatorCharacterDomain['equipment'][number]
) {
  const values: string[] = [];

  for (const container of [
    equipment.build?.specialEffect,
    equipment.build?.setEffect,
    equipment.build?.notes,
  ]) {
    if (!container || typeof container !== 'object') {
      continue;
    }

    for (const value of Object.values(container)) {
      if (typeof value === 'string' && value.trim().length > 0) {
        values.push(value.trim());
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && item.trim().length > 0) {
            values.push(item.trim());
          }
        }
      }
    }
  }

  return Array.from(new Set(values));
}

function parseSpellIgnorePercentFromText(text: string) {
  const match = text.match(
    /(法术(?:忽视|忽略|穿透)|法穿|法术忽视\/穿透)[^\d]{0,8}(\d+(?:\.\d+)?)\s*%/i
  );
  if (!match) {
    return null;
  }

  return normalizePercentValue(toFiniteNumber(match[2], 0));
}

function parseSpellDamagePercentFromText(text: string) {
  const match = text.match(
    /((?:基础)?法(?:术)?伤害|(?:基础)?法伤)[^\d]{0,8}([+-]?\d+(?:\.\d+)?)\s*%/i
  );
  if (!match) {
    return null;
  }

  return normalizePercentValue(toFiniteNumber(match[2], 0));
}

function parseMagicUpperPercentFromText(text: string) {
  const match = text.match(/魔法(?:值)?上限[^\d]{0,8}([+-]?\d+(?:\.\d+)?)\s*%/i);
  if (!match) {
    return null;
  }

  return normalizePercentValue(toFiniteNumber(match[1], 0));
}

function parseElementOvercomePercentFromText(text: string) {
  const match = text.match(
    /(金|木|水|火|土)属性(?:克制)?效果[^\d]{0,8}([+-]?\d+(?:\.\d+)?)\s*%/i
  );
  if (!match) {
    return null;
  }

  return {
    element: match[1],
    value: normalizePercentValue(toFiniteNumber(match[2], 0)),
  };
}

function resolveEquipmentEffectModifiers(domain: SimulatorCharacterDomain) {
  const modifiers: Array<{
    equipmentId: string;
    equipmentName: string;
    code: string;
    source: string;
    value: number;
    label?: string;
  }> = [];
  const modifierKeys = new Set<string>();

  const pushModifier = (modifier: {
    equipmentId: string;
    equipmentName: string;
    code: string;
    source: string;
    value: number;
    label?: string;
  }) => {
    const key = [
      modifier.equipmentId,
      modifier.code,
      roundForBreakdown(modifier.value, 6),
      modifier.label?.trim() ?? '',
    ].join('::');

    if (modifierKeys.has(key)) {
      return;
    }

    modifierKeys.add(key);
    modifiers.push(modifier);
  };

  for (const equipment of domain.equipment) {
    const persistedModifiers = equipment.build?.notes.effectModifiers;
    if (Array.isArray(persistedModifiers)) {
      for (const item of persistedModifiers) {
        if (!item || typeof item !== 'object') {
          continue;
        }

        const record = item as Record<string, unknown>;
        if (typeof record.code !== 'string') {
          continue;
        }

        const normalizedValue = normalizePercentValue(
          toFiniteNumber(record.value, Number.NaN)
        );
        if (!Number.isFinite(normalizedValue)) {
          continue;
        }

        pushModifier({
          equipmentId: equipment.id,
          equipmentName: equipment.name,
          code: record.code,
          source:
            typeof record.source === 'string' && record.source.trim().length > 0
              ? record.source
              : 'persisted_modifier',
          value: normalizedValue,
          label: typeof record.label === 'string' ? record.label : undefined,
        });
      }
    }

    for (const text of collectEquipmentEffectTexts(equipment)) {
      const spellIgnorePercent = parseSpellIgnorePercentFromText(text);
      if (spellIgnorePercent !== null) {
        pushModifier({
          equipmentId: equipment.id,
          equipmentName: equipment.name,
          code: 'spell_ignore_percent',
          source: 'effect_text',
          value: spellIgnorePercent,
          label: text,
        });
      }

      const spellDamagePercent = parseSpellDamagePercentFromText(text);
      if (spellDamagePercent !== null) {
        pushModifier({
          equipmentId: equipment.id,
          equipmentName: equipment.name,
          code: 'spell_damage_percent',
          source: 'effect_text',
          value: spellDamagePercent,
          label: text,
        });
      }

      const magicUpperPercent = parseMagicUpperPercentFromText(text);
      if (magicUpperPercent !== null) {
        pushModifier({
          equipmentId: equipment.id,
          equipmentName: equipment.name,
          code: 'magic_upper_percent',
          source: 'effect_text',
          value: magicUpperPercent,
          label: text,
        });
      }

      const elementOvercomePercent = parseElementOvercomePercentFromText(text);
      if (elementOvercomePercent !== null) {
        pushModifier({
          equipmentId: equipment.id,
          equipmentName: equipment.name,
          code: 'element_overcome_percent',
          source: elementOvercomePercent.element,
          value: elementOvercomePercent.value,
          label: text,
        });
      }
    }
  }

  return modifiers;
}

export function calculateDamageFromRuleSet({
  bundle,
  domain,
  ruleSet,
  request,
}: DamageEngineRuleExecutionInput): DamageEngineResult {
  const profile = bundle.profile;
  const character = bundle.character;

  if (!profile) {
    throw new Error('character profile not found');
  }

  const skill = findSkill(bundle, request);
  if (!skill) {
    throw new Error('skill not found');
  }

  const resolvedSchool = profile.school || character.school;
  const resolvedRoleType = domain.roleType;
  const skillFormula = findSkillFormula({
    skillCode: skill.skillCode,
    ruleSet,
    school: resolvedSchool,
    roleType: resolvedRoleType,
  });
  if (!skillFormula) {
    throw new Error(`skill formula not found for ${skill.skillCode}`);
  }
  const scopedAttributeConversions = ruleSet.attributeConversions.filter(
    (item) =>
      matchesScopedRule(item.school, resolvedSchool) &&
      matchesScopedRule(item.roleType, resolvedRoleType)
  );
  const modifierScope = {
    ruleSet,
    school: resolvedSchool,
    roleType: resolvedRoleType,
    skillCode: skill.skillCode,
    domain,
  };
  const starBonuses = resolveStarBonuses(domain, ruleSet);
  const ornamentSetBonuses = resolveOrnamentSetBonuses(domain, ruleSet);
  const regularSetBonuses = resolveRegularSetBonuses(domain, ruleSet);
  const equipmentEffectModifiers = resolveEquipmentEffectModifiers(domain);
  const spellIgnorePercent = Math.max(
    0,
    Math.min(
      1,
      equipmentEffectModifiers
        .filter((item) => item.code === 'spell_ignore_percent')
        .reduce((sum, item) => sum + item.value, 0)
    )
  );
  const spellDamagePercent = equipmentEffectModifiers
    .filter((item) => item.code === 'spell_damage_percent')
    .reduce((sum, item) => sum + item.value, 0);
  const activeBonusRuleCodes = request.activeBonusRuleCodes ?? [];
  const derivedBonusRules = deriveActiveBonusRuleCodes({
    domain,
    ruleSet,
    school: resolvedSchool,
    roleType: domain.roleType,
    explicitRuleCodes: activeBonusRuleCodes,
  });
  const resolvedActiveBonusRuleCodes = derivedBonusRules.derivedCodes;
  const activePanelStatBonusModifiers = findActiveScopedModifiersByDomain({
    ...modifierScope,
    modifierDomain: 'panel_stat_bonus',
  });
  const rulePanelStatBonuses = activePanelStatBonusModifiers.reduce<
    Record<string, number>
  >((totals, modifier) => {
    const statKey = modifier.targetKey || modifier.modifierKey;
    totals[statKey] = (totals[statKey] ?? 0) + toFiniteNumber(modifier.value);
    return totals;
  }, {});
  const activePanelStatSkillBonuses = resolvePanelStatBonusesFromSkillBonuses(
    skill.skillCode,
    ruleSet,
    resolvedActiveBonusRuleCodes
  );
  const panelStatBonuses = {
    ...starBonuses.panelStatBonuses,
    ...ornamentSetBonuses.panelStatBonuses,
  };
  for (const [key, value] of Object.entries(rulePanelStatBonuses)) {
    panelStatBonuses[key] = (panelStatBonuses[key] ?? 0) + value;
  }
  for (const [key, value] of Object.entries(
    activePanelStatSkillBonuses.panelStatBonuses
  )) {
    panelStatBonuses[key] = (panelStatBonuses[key] ?? 0) + value;
  }

  const ruleInputValues = buildRuleInputValues(domain, scopedAttributeConversions);
  for (const [key, value] of Object.entries(starBonuses.attributeSourceBonuses)) {
    ruleInputValues[key] = (ruleInputValues[key] ?? 0) + value;
  }
  for (const [key, value] of Object.entries(
    ornamentSetBonuses.attributeSourceBonuses
  )) {
    ruleInputValues[key] = (ruleInputValues[key] ?? 0) + value;
  }
  for (const [key, value] of Object.entries(
    regularSetBonuses.attributeSourceBonuses
  )) {
    ruleInputValues[key] = (ruleInputValues[key] ?? 0) + value;
  }
  const derivedStats = computeAttributeConversions(
    ruleInputValues,
    scopedAttributeConversions
  );
  const passiveCultivationLevels = resolvePassiveCultivationLevels(
    domain.cultivationLevels
  );
  const equipmentTotals = domain.equipmentAttributeTotals;
  const skillBonus = resolveSkillBonus(
    skill.skillCode,
    ruleSet,
    resolvedActiveBonusRuleCodes
  );
  const finalSkillLevel =
    toFiniteNumber(skill.finalLevel || skill.baseLevel) + skillBonus.bonusLevel;
  const resolvedSkillManaCost = resolveSkillManaCost(skill);
  const baseTerm = computeSkillBaseTerm(skillFormula, finalSkillLevel);
  const targetCount = clampTargetCount(
    request.targetCount ?? domain.battleContext?.splitTargetCount
  );
  const splitFactorRule = findScopedModifierByDomain({
    ...modifierScope,
    modifierDomain: 'split_factor',
  });
  const splitFactorLookupKey =
    splitFactorRule?.modifierType === 'lookup' &&
    typeof splitFactorRule.valueLookup[String(targetCount)] === 'number'
      ? targetCount
      : targetCount >= 5
        ? '5+'
        : targetCount;
  const splitFactor = resolveLookupValue(
    splitFactorRule,
    splitFactorLookupKey,
    Math.max(0.5, 1 - targetCount * 0.1)
  );
  const formationFactor = toFiniteNumber(
    request.formationFactor,
    resolveFormationBaseDamageFactor(
      request.selfFormation || domain.battleContext?.selfFormation
    ) || DEFAULT_SELF_FORMATION_FACTOR
  );
  const derivedFormationCounterState = resolveFormationCounterState({
    selfFormation: request.selfFormation || domain.battleContext?.selfFormation,
    targetFormation:
      request.targetFormation || domain.battleContext?.targetFormation,
  });
  const formationSpeedFactor = resolveFormationSpeedFactor(
    request.selfFormation || domain.battleContext?.selfFormation
  );
  const formationCounterFactor = resolveLookupValue(
    findScopedModifierByDomain({
      ...modifierScope,
      modifierDomain: 'formation_counter',
    }),
    request.formationCounterState ||
      domain.battleContext?.formationCounterState ||
      derivedFormationCounterState ||
      DEFAULT_FORMATION_COUNTER_STATE,
    1
  );
  const derivedElementRelation = resolveElementRelationFromElements(
    request.selfElement || domain.battleContext?.selfElement,
    request.targetElement || domain.battleContext?.targetElement
  );
  const resolvedElementRelation =
    request.elementRelation ||
    domain.battleContext?.elementRelation ||
    derivedElementRelation ||
    '无克/普通';
  const resolvedSelfElement = request.selfElement || domain.battleContext?.selfElement;
  const magicUpperPercent = equipmentEffectModifiers
    .filter((item) => item.code === 'magic_upper_percent')
    .reduce((sum, item) => sum + item.value, 0);
  const elementOvercomePercent =
    resolvedElementRelation === '克制'
      ? equipmentEffectModifiers
          .filter(
            (item) =>
              item.code === 'element_overcome_percent' &&
              (!item.source || item.source === resolvedSelfElement)
          )
          .reduce((sum, item) => sum + item.value, 0)
      : 0;
  const elementFactor =
    resolveLookupValue(
      findScopedModifierByDomain({
        ...modifierScope,
        modifierDomain: 'element_relation',
      }),
      resolvedElementRelation,
      1
    ) + elementOvercomePercent;
  const transformCardFactor = resolveTransformCardFactor(request, ruleSet);
  const luohanFactor = clampRatio(request.luohanFactor, 1);
  const damageVarianceFactor = clampMin(request.damageVarianceFactor, 1, 0);
  const criticalChance = clampRatio(request.criticalChance, 0);
  const criticalExpectationMultiplier = clampMin(
    request.criticalExpectationMultiplier,
    2,
    1
  );
  const attackerMagicCultivation = getCultivationLevel(domain, 'magicAttack');
  const equipmentMagicResult =
    toFiniteNumber(equipmentTotals.magicResult) +
    toFiniteNumber(panelStatBonuses.magicResult);
  const hasPanelMagicDamageOverride =
    typeof request.panelMagicDamageOverride === 'number' &&
    Number.isFinite(request.panelMagicDamageOverride);
  const spiritBeforeRules = toFiniteNumber(ruleInputValues.spirit);
  const spiritAfterRules = toFiniteNumber(
    derivedStats.valueBag.spirit,
    spiritBeforeRules
  ) + toFiniteNumber(panelStatBonuses.spirit);
  const ruleDerivedMagicDamage = toFiniteNumber(
    derivedStats.valueBag.magicDamage
  );
  const weaponDamageMagicDamageBonus = computeWeaponDamageToMagicDamageBonus(
    equipmentTotals.damage
  );
  const equipmentMagicDamageFlat = toFiniteNumber(equipmentTotals.magicDamage);
  const spellDamageLevel = clampMin(
    toFiniteNumber(domain.rawProfile.spellDamageLevel) +
      toFiniteNumber(equipmentTotals.spellDamageLevel) +
      toFiniteNumber(panelStatBonuses.spellDamageLevel),
    0,
    0
  );
  const magicCritLevel = clampMin(
    toFiniteNumber(domain.rawProfile.magicCritLevel) +
      toFiniteNumber(equipmentTotals.magicCritLevel) +
      toFiniteNumber(panelStatBonuses.magicCritLevel),
    0,
    0
  );
  const resolvedCriticalChance =
    typeof request.criticalChance === 'number' &&
    Number.isFinite(request.criticalChance)
      ? criticalChance
      : resolveMagicCritChanceFromLevel(magicCritLevel);
  const panelMagicDamageBeforePercent =
    ruleDerivedMagicDamage +
    weaponDamageMagicDamageBonus +
    equipmentMagicDamageFlat +
    spellDamageLevel +
    toFiniteNumber(panelStatBonuses.spirit) +
    toFiniteNumber(panelStatBonuses.magicDamage);
  const panelMagicDamageAfterPercent =
    panelMagicDamageBeforePercent * (1 + spellDamagePercent);
  const panelMagicDamageFromRules = panelMagicDamageAfterPercent;
  const panelMagicDamageBreakdown = {
    formula: '(服务端规则转化法伤 + 装备法伤 + 面板加成法伤) * (1 + 百分比法伤)',
    school: profile.school || character.school,
    roleType: domain.roleType,
    ruleInputValues: Object.fromEntries(
      Object.entries(ruleInputValues).map(([key, value]) => [
        key,
        roundForBreakdown(toFiniteNumber(value), 4),
      ])
    ),
    spiritBeforeRules: roundForBreakdown(spiritBeforeRules, 4),
    spiritContributions: derivedStats.contributions
      .filter((item) => item.targetAttr === 'spirit')
      .map((item) => ({
        sourceAttr: item.sourceAttr,
        sourceValue: roundForBreakdown(item.sourceValue, 4),
        coefficient: roundForBreakdown(item.coefficient, 4),
        contribution: roundForBreakdown(item.contribution, 4),
      })),
    spiritAfterRules: roundForBreakdown(spiritAfterRules, 4),
    panelStatBonuses: Object.fromEntries(
      Object.entries(panelStatBonuses).map(([key, value]) => [
        key,
        roundForBreakdown(value, 4),
      ])
    ),
    magicDamageContributions: derivedStats.contributions
      .filter((item) => item.targetAttr === 'magicDamage')
      .map((item) => ({
        sourceAttr: item.sourceAttr,
        sourceValue: roundForBreakdown(item.sourceValue, 4),
        coefficient: roundForBreakdown(item.coefficient, 4),
        contribution: roundForBreakdown(item.contribution, 4),
      })),
    ruleDerivedMagicDamage: roundForBreakdown(ruleDerivedMagicDamage, 4),
    weaponDamageMagicDamageBonus: roundForBreakdown(
      weaponDamageMagicDamageBonus,
      4
    ),
    equipmentMagicDamageFlat: roundForBreakdown(equipmentMagicDamageFlat, 4),
    spellDamageLevel: roundForBreakdown(spellDamageLevel, 4),
    panelStatBonusMagicDamage: roundForBreakdown(
      toFiniteNumber(panelStatBonuses.magicDamage),
      4
    ),
    panelMagicDamageBeforePercent: roundForBreakdown(
      panelMagicDamageBeforePercent,
      4
    ),
    spellDamagePercent: roundForBreakdown(spellDamagePercent, 4),
    percentApplied: !hasPanelMagicDamageOverride,
    panelMagicDamageAfterPercent: roundForBreakdown(
      panelMagicDamageAfterPercent,
      4
    ),
    overrideApplied: hasPanelMagicDamageOverride,
    overrideValue: hasPanelMagicDamageOverride
      ? roundForBreakdown(toFiniteNumber(request.panelMagicDamageOverride), 4)
      : null,
  };
  const panelMagicDamage = hasPanelMagicDamageOverride
    ? toFiniteNumber(request.panelMagicDamageOverride)
    : panelMagicDamageFromRules;
  const resolvedHpBase = toFiniteNumber(derivedStats.valueBag.hp);
  const resolvedHp =
    resolvedHpBase * (1 + passiveCultivationLevels.bodyStrength / 100) +
    toFiniteNumber(equipmentTotals.hp) +
    toFiniteNumber(panelStatBonuses.hp);
  const resolvedMpBase = toFiniteNumber(derivedStats.valueBag.mp);
  const resolvedMpAfterPercent =
    (resolvedMpBase * (1 + passiveCultivationLevels.meditation / 100) +
      toFiniteNumber(equipmentTotals.mp) +
      toFiniteNumber(equipmentTotals.magic) +
      toFiniteNumber(panelStatBonuses.mp)) *
    (1 + magicUpperPercent);
  const resolvedMagicDefense = resolveRuleDerivedPanelStat(
    derivedStats.valueBag,
    equipmentTotals,
    'magicDefense',
    profile.magicDefense
  ) +
    toFiniteNumber(panelStatBonuses.spirit) +
    toFiniteNumber(panelStatBonuses.magicDefense);
  const resolvedHit = resolveRuleDerivedPanelStat(
    derivedStats.valueBag,
    equipmentTotals,
    'hit',
    profile.hit
  ) + toFiniteNumber(panelStatBonuses.hit);
  const resolvedDamage = resolveRuleDerivedPanelStat(
    derivedStats.valueBag,
    equipmentTotals,
    'damage',
    profile.damage
  ) + toFiniteNumber(panelStatBonuses.damage);
  const resolvedDefense =
    toFiniteNumber(derivedStats.valueBag.defense) *
      (1 + passiveCultivationLevels.physicalFitness / 100) +
    toFiniteNumber(equipmentTotals.defense) +
    toFiniteNumber(panelStatBonuses.defense);
  const resolvedSpeedBeforeFormation = resolveRuleDerivedPanelStat(
    derivedStats.valueBag,
    equipmentTotals,
    'speed',
    profile.speed
  ) +
    passiveCultivationLevels.divineSpeed * 1.5 +
    toFiniteNumber(panelStatBonuses.speed);
  const resolvedSpeed = resolvedSpeedBeforeFormation * formationSpeedFactor;
  const resolvedDodge = resolveRuleDerivedPanelStat(
    derivedStats.valueBag,
    equipmentTotals,
    'dodge',
    domain.profile.dodge
  ) + toFiniteNumber(panelStatBonuses.dodge);
  const activeSkillDamageAddendModifiers = findActiveScopedModifiersByDomain({
    ...modifierScope,
    modifierDomain: 'skill_damage_addend',
  });
  const activeOrnamentSkillDamageAddends =
    ornamentSetBonuses.skillDamageAddends.filter(
      (item) => !item.skillCode || item.skillCode === skill.skillCode
    );
  const weather = request.weather || domain.battleContext?.weather || '';
  const weatherFactor = resolveWeatherFactor({
    school: resolvedSchool,
    weather,
  });

  const targets = buildDefaultTargets(request, domain).map((target, index) => {
    const targetName = target.name || `目标${index + 1}`;
    const shenmuValue = resolveAddendValue(
      request.shenmuValue,
      target.shenmuValue,
      0
    );
    const magicResult = resolveAddendValue(
      request.magicResult,
      target.magicResult,
      equipmentMagicResult
    );
    const targetMagicDefense = toFiniteNumber(target.magicDefense);
    const targetMagicDefenseCultivation = toFiniteNumber(
      target.magicDefenseCultivation
    );
    const targetMagicDefenseResult = toFiniteNumber(target.magicDefenseResult);
    const targetSpeed = toFiniteNumber(target.speed);
    const targetDefenseState = target.defenseState || '';
    const targetDefenseFactor = resolveMagicTargetDefenseFactor(
      targetDefenseState
    );
    const specialMagicDamageReductionFactor = clampRatio(
      target.specialMagicDamageReductionFactor,
      domain.battleContext?.specialMagicDamageReductionFactor ?? 1
    );
    const actualTargetMagicDefense = targetMagicDefense * (1 - spellIgnorePercent);
    const cultivationDiff =
      attackerMagicCultivation - targetMagicDefenseCultivation;
    const combinedFormationFactor = formationFactor * formationCounterFactor;
    const conditionalDamageAddends = [
      ...activeSkillDamageAddendModifiers.map((modifier) => {
        const sourceKey = modifier.sourceKey || modifier.modifierKey;
        const sourceValue =
          sourceKey === 'targetSpeed'
            ? targetSpeed
            : sourceKey === 'manaCost'
              ? resolvedSkillManaCost
              : 0;

        return {
          sourceType: 'rule_modifier',
          modifierId: modifier.id,
          modifierKey: modifier.modifierKey,
          setName: null,
          tier: null,
          sourceKey,
          sourceValue: roundForBreakdown(sourceValue, 4),
          contribution: roundForBreakdown(
            resolveModifierContribution({
              modifier,
              sourceValue,
            }),
            4
          ),
        };
      }),
      ...activeOrnamentSkillDamageAddends.map((effect) => {
        const sourceKey = effect.sourceKey || 'fixed';
        const sourceValue =
          sourceKey === 'targetSpeed'
            ? targetSpeed
            : sourceKey === 'manaCost'
              ? resolvedSkillManaCost
              : 0;

        return {
          sourceType: 'ornament_set',
          modifierId: null,
          modifierKey: effect.label || effect.type,
          setName: effect.setName,
          tier: effect.tier,
          sourceKey,
          sourceValue: roundForBreakdown(sourceValue, 4),
          contribution: roundForBreakdown(
            effect.modifierType === 'multiplier'
              ? sourceValue * toFiniteNumber(effect.value)
              : toFiniteNumber(effect.value),
            4
          ),
        };
      }),
    ];
    const conditionalDamageAddend = conditionalDamageAddends.reduce(
      (sum, item) => sum + item.contribution,
      0
    );

    const nonResultDamageBeforeMitigation =
      (baseTerm + panelMagicDamage - actualTargetMagicDefense) *
        combinedFormationFactor *
        transformCardFactor *
        elementFactor *
        splitFactor *
        (1 + cultivationDiff * 0.02) +
      cultivationDiff * 5 +
      shenmuValue +
      conditionalDamageAddend;
    const nonResultDamageBeforeLuohan =
      nonResultDamageBeforeMitigation *
      weatherFactor *
      targetDefenseFactor *
      specialMagicDamageReductionFactor;
    const nonResultDamage = nonResultDamageBeforeLuohan * luohanFactor;
    const rawDamageBeforeVariance = nonResultDamage + magicResult;
    const rawDamageAfterVariance = rawDamageBeforeVariance * damageVarianceFactor;
    const rawDamage = rawDamageAfterVariance - targetMagicDefenseResult;

    const damage = Math.max(1, Math.round(rawDamage));
    const critDamage = Math.max(1, Math.round(damage * 1.5));
    const expectedDamage =
      resolvedCriticalChance > 0
        ? Number(
            (
              damage *
              (1 +
                resolvedCriticalChance * (criticalExpectationMultiplier - 1))
            ).toFixed(2)
          )
        : undefined;

    return {
      targetName,
      damage,
      critDamage,
      totalDamage: damage * targetCount,
      totalCritDamage: critDamage * targetCount,
      expectedDamage,
      expectedTotalDamage:
        expectedDamage === undefined
          ? undefined
          : Number((expectedDamage * targetCount).toFixed(2)),
      breakdown: {
        ruleVersionId: ruleSet.version.id,
        ruleVersionCode: ruleSet.version.versionCode,
        characterId: character.id,
        school: resolvedSchool,
        roleType: domain.roleType,
        skillCode: skill.skillCode,
        skillName: skill.skillName,
        formulaKey: skillFormula.formulaKey,
        formulaExpression:
          skillFormula.extraFormula.formula ||
          '(base + panel_magic_damage - actual_target_magic_defense) * formation_factor * transform_card_factor * element_factor * split_factor * (1 + cult_diff * 0.02) + cult_diff * 5 + shenmu_value + magic_result',
        baseLevel: toFiniteNumber(skill.baseLevel),
        storedFinalLevel: toFiniteNumber(skill.finalLevel),
        bonusLevel: skillBonus.bonusLevel,
        matchedBonusRules: skillBonus.matchedRules.map((item) => ({
          ruleCode: item.ruleCode,
          skillCode: item.skillCode,
          skillName: item.skillName,
          bonusType: item.bonusType,
          bonusValue: item.bonusValue,
        })),
        ignoredBonusRules: derivedBonusRules.ignoredRules.map((item) => ({
          ...item,
          reasonLabel: '超出上限失效',
        })),
        activeBonusRuleCodes: resolvedActiveBonusRuleCodes,
        finalSkillLevel,
        baseTerm: Number(baseTerm.toFixed(2)),
        panelMagicDamage,
        panelMagicDamageBreakdown: {
          ...panelMagicDamageBreakdown,
          result: roundForBreakdown(panelMagicDamage, 4),
        },
        panelMagicDamageSource: hasPanelMagicDamageOverride
          ? 'request.panelMagicDamageOverride'
          : 'rule_attribute',
        targetMagicDefense,
        actualTargetMagicDefense: roundForBreakdown(actualTargetMagicDefense, 4),
        spellIgnorePercent: roundForBreakdown(spellIgnorePercent, 4),
        spellDamagePercent: roundForBreakdown(spellDamagePercent, 4),
        magicUpperPercent: roundForBreakdown(magicUpperPercent, 4),
        elementOvercomePercent: roundForBreakdown(elementOvercomePercent, 4),
        targetSpeed,
        targetMagicDefenseCultivation,
        resolvedSkillManaCost,
        cultivationDiff,
        formationFactor,
        formationSpeedFactor: roundForBreakdown(formationSpeedFactor, 4),
        formationCounterFactor,
        combinedFormationFactor,
        transformCardFactor,
        luohanFactor,
        damageVarianceFactor,
        elementFactor,
        splitFactor,
        weather,
        weatherFactor,
        shenmuValue,
        magicResult,
        targetMagicDefenseResult,
        targetDefenseState,
        targetDefenseFactor,
        specialMagicDamageReductionFactor,
        criticalChance: roundForBreakdown(resolvedCriticalChance, 4),
        magicCritLevel: roundForBreakdown(magicCritLevel, 4),
        criticalExpectationMultiplier: roundForBreakdown(
          criticalExpectationMultiplier,
          4
        ),
        conditionalDamageAddend: roundForBreakdown(conditionalDamageAddend, 4),
        conditionalDamageAddends,
        nonResultDamageBeforeMitigation: roundForBreakdown(
          nonResultDamageBeforeMitigation,
          4
        ),
        nonResultDamageBeforeLuohan: roundForBreakdown(
          nonResultDamageBeforeLuohan,
          4
        ),
        nonResultDamage: roundForBreakdown(nonResultDamage, 4),
        rawDamageBeforeVariance: roundForBreakdown(rawDamageBeforeVariance, 4),
        rawDamageAfterVariance: roundForBreakdown(rawDamageAfterVariance, 4),
        rawDamage: Number(rawDamage.toFixed(2)),
        finalDamage: damage,
        critDamage,
        expectedDamage,
        derivedStatsFromRules: {
          hp: Number((derivedStats.totals.hp ?? 0).toFixed(2)),
          mp: Number((derivedStats.totals.mp ?? 0).toFixed(2)),
          spirit: Number((derivedStats.totals.spirit ?? 0).toFixed(2)),
          hit: Number((derivedStats.totals.hit ?? 0).toFixed(2)),
          damage: Number((derivedStats.totals.damage ?? 0).toFixed(2)),
          magicDamage: Number(
            (derivedStats.totals.magicDamage ?? 0).toFixed(2)
          ),
          defense: Number((derivedStats.totals.defense ?? 0).toFixed(2)),
          magicDefense: Number(
            (derivedStats.totals.magicDefense ?? 0).toFixed(2)
          ),
          speed: Number((derivedStats.totals.speed ?? 0).toFixed(2)),
          dodge: Number((derivedStats.totals.dodge ?? 0).toFixed(2)),
        },
        attributeContributions: derivedStats.contributions.map((item) => ({
          ...item,
          contribution: Number(item.contribution.toFixed(4)),
        })),
        ruleInputValues: Object.fromEntries(
          Object.entries(ruleInputValues).map(([key, value]) => [
            key,
            roundForBreakdown(toFiniteNumber(value), 4),
          ])
        ),
        ruleResolvedPanelStats: {
          hp: roundForBreakdown(resolvedHp),
          mp: roundForBreakdown(resolvedMpAfterPercent),
          spirit: roundForBreakdown(spiritAfterRules, 4),
          hit: roundForBreakdown(resolvedHit),
          damage: roundForBreakdown(resolvedDamage),
          magicDamage: roundForBreakdown(panelMagicDamage, 4),
          spellDamageLevel: roundForBreakdown(spellDamageLevel, 4),
          defense: roundForBreakdown(resolvedDefense),
          magicDefense: roundForBreakdown(resolvedMagicDefense),
          speed: roundForBreakdown(resolvedSpeed),
          speedBeforeFormation: roundForBreakdown(resolvedSpeedBeforeFormation),
          dodge: roundForBreakdown(resolvedDodge),
          magicCritLevel: roundForBreakdown(magicCritLevel, 4),
        },
        activePanelStatBonusModifiers: activePanelStatBonusModifiers.map(
          (modifier) => ({
            id: modifier.id,
            modifierKey: modifier.modifierKey,
            targetKey: modifier.targetKey,
            value: modifier.value,
          })
        ),
        activePanelStatBonusRules: activePanelStatSkillBonuses.matchedRules.map(
          (rule) => ({
            ruleCode: rule.ruleCode,
            skillCode: rule.skillCode,
            skillName: rule.skillName,
            bonusValue: roundForBreakdown(rule.bonusValue, 4),
            activeCount: rule.activeCount,
            targetKeys: rule.targetKeys,
          })
        ),
        starBonuses: {
          panelStatBonuses: Object.fromEntries(
            Object.entries(starBonuses.panelStatBonuses).map(([key, value]) => [
              key,
              roundForBreakdown(value, 4),
            ])
          ),
          attributeSourceBonuses: Object.fromEntries(
            Object.entries(starBonuses.attributeSourceBonuses).map(
              ([key, value]) => [key, roundForBreakdown(value, 4)]
            )
          ),
          fullSetActive: starBonuses.fullSetActive,
          fullSetAttributeBonus: starBonuses.fullSetAttributeBonus,
          fullColorSetRule: starBonuses.fullColorSetRule
            ? {
                ...starBonuses.fullColorSetRule,
                value: roundForBreakdown(starBonuses.fullColorSetRule.value, 4),
              }
            : null,
          starPositionBonuses: starBonuses.starPositionBonuses.map((item) => ({
            ...item,
            value: roundForBreakdown(item.value, 4),
          })),
          starAlignmentBonuses: starBonuses.starAlignmentBonuses.map((item) => ({
            ...item,
            value: roundForBreakdown(item.value, 4),
          })),
        },
        ornamentSetBonuses: {
          panelStatBonuses: Object.fromEntries(
            Object.entries(ornamentSetBonuses.panelStatBonuses).map(
              ([key, value]) => [key, roundForBreakdown(value, 4)]
            )
          ),
          attributeSourceBonuses: Object.fromEntries(
            Object.entries(ornamentSetBonuses.attributeSourceBonuses).map(
              ([key, value]) => [key, roundForBreakdown(value, 4)]
            )
          ),
          activeSets: ornamentSetBonuses.activeSets.map((item) => ({
            setName: item.setName,
            slotCount: item.slotCount,
            totalLevel: item.totalLevel,
            tier: item.tier,
            matchedRule: item.matchedRule,
            matchedTier: item.matchedTier,
            slots: item.slots,
            effects: item.effects.map((effect) => ({
              type: effect.type,
              targetKey: effect.targetKey,
              value: roundForBreakdown(effect.value, 4),
              skillCode: effect.skillCode,
              sourceKey: effect.sourceKey,
              modifierType: effect.modifierType,
              label: effect.label,
            })),
          })),
        },
        regularSetBonuses: {
          attributeSourceBonuses: Object.fromEntries(
            Object.entries(regularSetBonuses.attributeSourceBonuses).map(
              ([key, value]) => [key, roundForBreakdown(value, 4)]
            )
          ),
          activeSets: regularSetBonuses.activeSets.map((item) => ({
            setName: item.setName,
            count: item.count,
            tier: item.tier,
            effects: item.effects.map((effect) => ({
              targetKey: effect.targetKey,
              value: roundForBreakdown(effect.value, 4),
            })),
          })),
        },
        equipmentEffectModifiers: equipmentEffectModifiers.map((modifier) => ({
          ...modifier,
          value: roundForBreakdown(modifier.value, 4),
        })),
        equipmentAttributeTotals: equipmentTotals,
      },
    };
  });

  return {
    ruleVersion: {
      id: ruleSet.version.id,
      versionCode: ruleSet.version.versionCode,
      versionName: ruleSet.version.versionName,
    },
    skill: {
      skillCode: skill.skillCode,
      skillName: skill.skillName,
      baseLevel: toFiniteNumber(skill.baseLevel),
      finalLevel: finalSkillLevel,
      bonusLevel: skillBonus.bonusLevel,
    },
    panelStats: {
      hp: resolvedHp,
      mp: resolvedMpAfterPercent,
      hit: resolvedHit,
      damage: resolvedDamage,
      magicDamage: panelMagicDamage,
      spellDamageLevel: roundForBreakdown(spellDamageLevel, 4),
      defense: resolvedDefense,
      magicDefense: resolvedMagicDefense,
      speed: resolvedSpeed,
      dodge: resolvedDodge,
      spirit: roundForBreakdown(spiritAfterRules, 4),
      magicCritLevel: roundForBreakdown(magicCritLevel, 4),
    },
    targets,
  };
}

export async function calculateDamageWithRules(
  bundle: SimulatorCharacterBundle,
  request: DamageEngineRequest
): Promise<DamageEngineResult> {
  const domain = buildSimulatorCharacterDomain(bundle);

  if (!bundle.profile || !domain) {
    throw new Error('character profile not found');
  }

  const ruleSet = await getDamageRuleSet({
    versionId: request.ruleVersionId,
    versionCode: request.ruleVersionCode,
  });

  if (!ruleSet) {
    throw new Error('damage rule version not found');
  }

  return calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet,
    request,
  });
}
