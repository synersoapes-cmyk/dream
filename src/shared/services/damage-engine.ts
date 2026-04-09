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
import type { SimulatorCharacterBundle } from '@/shared/models/simulator-types';

type JsonObject = Record<string, unknown>;

const DEFAULT_SELF_FORMATION_FACTOR = 1.2;
const DEFAULT_FORMATION_COUNTER_STATE = '无克/普通';

export type DamageEngineTargetInput = {
  name?: string;
  magicDefense: number;
  speed?: number;
  magicDefenseCultivation?: number;
  shenmuValue?: number;
  magicResult?: number;
};

export type DamageEngineRequest = {
  skillCode?: string;
  skillName?: string;
  ruleVersionId?: string;
  ruleVersionCode?: string;
  targetCount?: number;
  formationFactor?: number;
  formationCounterState?: string;
  elementRelation?: string;
  transformCardFactor?: number;
  shenmuValue?: number;
  magicResult?: number;
  targetMagicDefense?: number;
  targetSpeed?: number;
  targetMagicDefenseCultivation?: number;
  targetName?: string;
  activeBonusRuleCodes?: string[];
  panelMagicDamageOverride?: number;
  targets?: DamageEngineTargetInput[];
};

export type DamageEngineTargetResult = {
  targetName: string;
  damage: number;
  critDamage: number;
  totalDamage: number;
  totalCritDamage: number;
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
    defense: number;
    magicDefense: number;
    speed: number;
    dodge: number;
    spirit: number;
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

function buildRuleInputValues(
  domain: SimulatorCharacterDomain,
  rules: DamageAttributeConversionRule[]
) {
  const sourceAttrs = new Set(rules.map((rule) => rule.sourceAttr));
  const inputs: SimulatorNumericMap = {};

  for (const sourceAttr of sourceAttrs) {
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

const RUNE_COLOR_ALIAS: Record<string, string> = {
  red: '红',
  blue: '蓝',
  green: '绿',
  yellow: '黄',
  gold: '黄',
  white: '白',
  black: '黑',
  purple: '紫',
  orange: '橙',
  红: '红',
  蓝: '蓝',
  绿: '绿',
  黄: '黄',
  金: '黄',
  白: '白',
  黑: '黑',
  紫: '紫',
  橙: '橙',
};

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
  starPositionBonuses: Array<{
    equipmentId: string;
    slot: string;
    label: string;
    targetKey: string;
    value: number;
  }>;
  starAlignmentBonuses: Array<{
    equipmentId: string;
    slot: string;
    label: string;
    targetKey: string;
    value: number;
  }>;
};

function normalizeRuneColor(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const exactMatch =
    RUNE_COLOR_ALIAS[trimmed.toLowerCase()] ?? RUNE_COLOR_ALIAS[trimmed];
  if (exactMatch) {
    return exactMatch;
  }

  for (const [alias, normalized] of Object.entries(RUNE_COLOR_ALIAS)) {
    if (trimmed.toLowerCase().includes(alias.toLowerCase())) {
      return normalized;
    }
  }

  return null;
}

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

function resolveStarPositionBonus(value: unknown) {
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
      return { label, targetKey, value: parsedValue };
    }
  }

  return null;
}

function resolveStarAlignmentBonus(value: unknown) {
  if (isDisabledStarBonus(value)) {
    return null;
  }

  const label = String(value).trim();
  const parsedValue = parseStarBonusValue(label);
  if (parsedValue === null) {
    return null;
  }

  for (const [alias, targetKey] of STAR_ALIGNMENT_ATTR_ALIAS) {
    if (label.includes(alias)) {
      return { label, targetKey, value: parsedValue };
    }
  }

  return null;
}

function resolveStarBonuses(domain: SimulatorCharacterDomain): StarBonusResolution {
  const panelStatBonuses: Record<string, number> = {};
  const attributeSourceBonuses: Record<string, number> = {};
  const starPositionBonuses: StarBonusResolution['starPositionBonuses'] = [];
  const starAlignmentBonuses: StarBonusResolution['starAlignmentBonuses'] = [];
  const alignedPrimarySlots = new Set<string>();

  for (const equipment of domain.equipment) {
    if (!PRIMARY_EQUIPMENT_SLOTS.has(equipment.slot)) {
      continue;
    }

    const notes = equipment.build?.notes ?? {};
    const starPositionBonus = resolveStarPositionBonus(notes.starPosition);
    if (starPositionBonus) {
      panelStatBonuses[starPositionBonus.targetKey] =
        (panelStatBonuses[starPositionBonus.targetKey] ?? 0) +
        starPositionBonus.value;
      starPositionBonuses.push({
        equipmentId: equipment.id,
        slot: equipment.slot,
        ...starPositionBonus,
      });
    }

    const starAlignmentBonus = resolveStarAlignmentBonus(notes.starAlignment);
    if (starAlignmentBonus) {
      attributeSourceBonuses[starAlignmentBonus.targetKey] =
        (attributeSourceBonuses[starAlignmentBonus.targetKey] ?? 0) +
        starAlignmentBonus.value;
      starAlignmentBonuses.push({
        equipmentId: equipment.id,
        slot: equipment.slot,
        ...starAlignmentBonus,
      });
      alignedPrimarySlots.add(equipment.slot);
    }
  }

  const fullSetActive = PRIMARY_EQUIPMENT_SLOTS.size === alignedPrimarySlots.size;
  const fullSetAttributeBonus = fullSetActive ? 2 : 0;

  if (fullSetAttributeBonus > 0) {
    for (const [, targetKey] of STAR_ALIGNMENT_ATTR_ALIAS) {
      attributeSourceBonuses[targetKey] =
        (attributeSourceBonuses[targetKey] ?? 0) + fullSetAttributeBonus;
    }
  }

  return {
    panelStatBonuses,
    attributeSourceBonuses,
    fullSetActive,
    fullSetAttributeBonus,
    starPositionBonuses,
    starAlignmentBonuses,
  };
}

function extractActiveRuneColors(
  equipment: SimulatorCharacterDomain['equipment'][number]
) {
  const notes = equipment.build?.notes ?? {};
  const runeStoneSets = Array.isArray(notes.runeStoneSets)
    ? notes.runeStoneSets
    : [];
  if (runeStoneSets.length === 0) {
    return [] as string[];
  }

  const activeIndex = Math.max(
    0,
    Math.floor(toFiniteNumber(notes.activeRuneStoneSet, 0))
  );
  const activeSet = Array.isArray(runeStoneSets[activeIndex])
    ? runeStoneSets[activeIndex]
    : Array.isArray(runeStoneSets[0])
      ? runeStoneSets[0]
      : [];

  return activeSet
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === 'object'
    )
    .map((item) => normalizeRuneColor(item.type ?? item.color ?? item.name))
    .filter((item): item is string => Boolean(item));
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

  return Object.entries(slotColorMap as Record<string, unknown>).every(
    ([slot, expectedColor]) => {
      const normalizedExpected = normalizeRuneColor(expectedColor);
      return Boolean(normalizedExpected) && activeColorBySlot[slot] === normalizedExpected;
    }
  );
}

function deriveActiveBonusRuleCodes(params: {
  domain: SimulatorCharacterDomain;
  ruleSet: DamageRuleSet;
  school: string;
  roleType: string;
  explicitRuleCodes: string[];
}) {
  const derivedCodes = new Set(params.explicitRuleCodes);

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

    const matchedEquipment = params.domain.equipment.some((equipment) => {
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
    });

    if (matchedEquipment) {
      derivedCodes.add(rule.ruleCode);
    }
  }

  return Array.from(derivedCodes);
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
      activeBonusRuleCodes.includes(item.ruleCode)
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

function findSkillFormula(skillCode: string, ruleSet: DamageRuleSet) {
  return (
    ruleSet.skillFormulas.find((item) => item.skillCode === skillCode) ?? null
  );
}

function computeQuadraticBaseTerm(
  rule: DamageSkillFormulaRule,
  skillLevel: number
) {
  const baseTerm = rule.baseFormula.baseTerm as JsonObject | undefined;
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
    return request.targets;
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

  return Math.abs(value) > 1 ? value / 100 : value;
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

  const skillFormula = findSkillFormula(skill.skillCode, ruleSet);
  if (!skillFormula) {
    throw new Error(`skill formula not found for ${skill.skillCode}`);
  }
  const resolvedSchool = profile.school || character.school;
  const modifierScope = {
    ruleSet,
    school: resolvedSchool,
    roleType: domain.roleType,
    skillCode: skill.skillCode,
    domain,
  };
  const starBonuses = resolveStarBonuses(domain);
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
  const panelStatBonuses = {
    ...starBonuses.panelStatBonuses,
  };
  for (const [key, value] of Object.entries(rulePanelStatBonuses)) {
    panelStatBonuses[key] = (panelStatBonuses[key] ?? 0) + value;
  }

  const ruleInputValues = buildRuleInputValues(
    domain,
    ruleSet.attributeConversions
  );
  for (const [key, value] of Object.entries(starBonuses.attributeSourceBonuses)) {
    ruleInputValues[key] = (ruleInputValues[key] ?? 0) + value;
  }
  const derivedStats = computeAttributeConversions(
    ruleInputValues,
    ruleSet.attributeConversions
  );
  const equipmentTotals = domain.equipmentAttributeTotals;
  const activeBonusRuleCodes = request.activeBonusRuleCodes ?? [];
  const resolvedActiveBonusRuleCodes = deriveActiveBonusRuleCodes({
    domain,
    ruleSet,
    school: resolvedSchool,
    roleType: domain.roleType,
    explicitRuleCodes: activeBonusRuleCodes,
  });
  const skillBonus = resolveSkillBonus(
    skill.skillCode,
    ruleSet,
    resolvedActiveBonusRuleCodes
  );
  const finalSkillLevel =
    toFiniteNumber(skill.finalLevel || skill.baseLevel) + skillBonus.bonusLevel;
  const resolvedSkillManaCost = resolveSkillManaCost(skill);
  const baseTerm = computeQuadraticBaseTerm(skillFormula, finalSkillLevel);
  const targetCount = clampTargetCount(
    request.targetCount ?? domain.battleContext?.splitTargetCount
  );
  const splitFactor = resolveLookupValue(
    findScopedModifierByDomain({
      ...modifierScope,
      modifierDomain: 'split_factor',
    }),
    targetCount >= 5 ? '5+' : targetCount,
    Math.max(0.5, 1 - targetCount * 0.1)
  );
  const formationFactor = toFiniteNumber(
    request.formationFactor,
    DEFAULT_SELF_FORMATION_FACTOR
  );
  const formationCounterFactor = resolveLookupValue(
    findScopedModifierByDomain({
      ...modifierScope,
      modifierDomain: 'formation_counter',
    }),
    request.formationCounterState ||
      domain.battleContext?.formationCounterState ||
      DEFAULT_FORMATION_COUNTER_STATE,
    1
  );
  const elementFactor = resolveLookupValue(
    findScopedModifierByDomain({
      ...modifierScope,
      modifierDomain: 'element_relation',
    }),
    request.elementRelation ||
      domain.battleContext?.elementRelation ||
      '无克/普通',
    1
  );
  const transformCardFactor = resolveTransformCardFactor(request, ruleSet);
  const attackerMagicCultivation = getCultivationLevel(domain, 'magicAttack');
  const equipmentMagicResult = toFiniteNumber(equipmentTotals.magicResult);
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
  const equipmentMagicDamageFlat = toFiniteNumber(equipmentTotals.magicDamage);
  const panelMagicDamageBeforePercent =
    ruleDerivedMagicDamage +
    equipmentMagicDamageFlat +
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
    equipmentMagicDamageFlat: roundForBreakdown(equipmentMagicDamageFlat, 4),
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
  const resolvedHp = resolveRuleDerivedPanelStat(
    derivedStats.valueBag,
    equipmentTotals,
    'hp',
    profile.hp
  );
  const resolvedMp = resolveRuleDerivedPanelStat(
    derivedStats.valueBag,
    equipmentTotals,
    'mp',
    profile.mp
  );
  const resolvedMagicDefense = resolveRuleDerivedPanelStat(
    derivedStats.valueBag,
    equipmentTotals,
    'magicDefense',
    profile.magicDefense
  ) + toFiniteNumber(panelStatBonuses.magicDefense);
  const resolvedHit = resolveRuleDerivedPanelStat(
    derivedStats.valueBag,
    equipmentTotals,
    'hit',
    profile.hit
  );
  const resolvedDamage = resolveRuleDerivedPanelStat(
    derivedStats.valueBag,
    equipmentTotals,
    'damage',
    profile.damage
  );
  const resolvedDefense = resolveRuleDerivedPanelStat(
    derivedStats.valueBag,
    equipmentTotals,
    'defense',
    profile.defense
  );
  const resolvedSpeed = resolveRuleDerivedPanelStat(
    derivedStats.valueBag,
    equipmentTotals,
    'speed',
    profile.speed
  );
  const resolvedDodge = resolveRuleDerivedPanelStat(
    derivedStats.valueBag,
    equipmentTotals,
    'dodge',
    domain.profile.dodge
  );
  const activeSkillDamageAddendModifiers = findActiveScopedModifiersByDomain({
    ...modifierScope,
    modifierDomain: 'skill_damage_addend',
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
    const targetSpeed = toFiniteNumber(target.speed);
    const actualTargetMagicDefense = targetMagicDefense * (1 - spellIgnorePercent);
    const cultivationDiff =
      attackerMagicCultivation - targetMagicDefenseCultivation;
    const combinedFormationFactor = formationFactor * formationCounterFactor;
    const conditionalDamageAddends = activeSkillDamageAddendModifiers.map(
      (modifier) => {
        const sourceKey = modifier.sourceKey || modifier.modifierKey;
        const sourceValue =
          sourceKey === 'targetSpeed'
            ? targetSpeed
            : sourceKey === 'manaCost'
              ? resolvedSkillManaCost
              : 0;

        return {
          modifierId: modifier.id,
          modifierKey: modifier.modifierKey,
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
      }
    );
    const conditionalDamageAddend = conditionalDamageAddends.reduce(
      (sum, item) => sum + item.contribution,
      0
    );

    const rawDamage =
      (baseTerm + panelMagicDamage - actualTargetMagicDefense) *
        combinedFormationFactor *
        transformCardFactor *
        elementFactor *
        splitFactor *
        (1 + cultivationDiff * 0.02) +
      cultivationDiff * 5 +
      shenmuValue +
      magicResult +
      conditionalDamageAddend;

    const damage = Math.max(1, Math.round(rawDamage));
    const critDamage = Math.max(1, Math.round(damage * 1.5));

    return {
      targetName,
      damage,
      critDamage,
      totalDamage: damage * targetCount,
      totalCritDamage: critDamage * targetCount,
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
        targetSpeed,
        targetMagicDefenseCultivation,
        resolvedSkillManaCost,
        cultivationDiff,
        formationFactor,
        formationCounterFactor,
        combinedFormationFactor,
        transformCardFactor,
        elementFactor,
        splitFactor,
        shenmuValue,
        magicResult,
        conditionalDamageAddend: roundForBreakdown(conditionalDamageAddend, 4),
        conditionalDamageAddends,
        rawDamage: Number(rawDamage.toFixed(2)),
        finalDamage: damage,
        critDamage,
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
          mp: roundForBreakdown(resolvedMp),
          spirit: roundForBreakdown(spiritAfterRules, 4),
          hit: roundForBreakdown(resolvedHit),
          damage: roundForBreakdown(resolvedDamage),
          magicDamage: roundForBreakdown(panelMagicDamage, 4),
          defense: roundForBreakdown(resolvedDefense),
          magicDefense: roundForBreakdown(resolvedMagicDefense),
          speed: roundForBreakdown(resolvedSpeed),
          dodge: roundForBreakdown(resolvedDodge),
        },
        activePanelStatBonusModifiers: activePanelStatBonusModifiers.map(
          (modifier) => ({
            id: modifier.id,
            modifierKey: modifier.modifierKey,
            targetKey: modifier.targetKey,
            value: modifier.value,
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
          starPositionBonuses: starBonuses.starPositionBonuses.map((item) => ({
            ...item,
            value: roundForBreakdown(item.value, 4),
          })),
          starAlignmentBonuses: starBonuses.starAlignmentBonuses.map((item) => ({
            ...item,
            value: roundForBreakdown(item.value, 4),
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
      mp: resolvedMp,
      hit: resolvedHit,
      damage: resolvedDamage,
      magicDamage: panelMagicDamage,
      defense: resolvedDefense,
      magicDefense: resolvedMagicDefense,
      speed: resolvedSpeed,
      dodge: resolvedDodge,
      spirit: roundForBreakdown(spiritAfterRules, 4),
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
