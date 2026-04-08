import {
  getDamageRuleSet,
  type DamageAttributeConversionRule,
  type DamageModifierRule,
  type DamageRuleSet,
  type DamageSkillBonusRule,
  type DamageSkillFormulaRule,
} from '@/shared/models/damage-rules';
import type { SimulatorCharacterBundle } from '@/shared/models/simulator';
import {
  buildSimulatorCharacterDomain,
  type SimulatorCharacterDomain,
  type SimulatorNumericMap,
} from '@/shared/models/simulator-domain';

type JsonObject = Record<string, unknown>;

const DEFAULT_SELF_FORMATION_FACTOR = 1.2;
const DEFAULT_FORMATION_COUNTER_STATE = '无克/普通';

export type DamageEngineTargetInput = {
  name?: string;
  magicDefense: number;
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
      shenmuValue: request.shenmuValue ?? fallbackTarget?.shenmuValue,
      magicResult: request.magicResult ?? fallbackTarget?.magicResult,
    },
  ];
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

  const ruleInputValues = buildRuleInputValues(
    domain,
    ruleSet.attributeConversions
  );
  const derivedStats = computeAttributeConversions(
    ruleInputValues,
    ruleSet.attributeConversions
  );
  const equipmentTotals = domain.equipmentAttributeTotals;
  const activeBonusRuleCodes = request.activeBonusRuleCodes ?? [];
  const skillBonus = resolveSkillBonus(
    skill.skillCode,
    ruleSet,
    activeBonusRuleCodes
  );
  const finalSkillLevel =
    toFiniteNumber(skill.finalLevel || skill.baseLevel) + skillBonus.bonusLevel;
  const baseTerm = computeQuadraticBaseTerm(skillFormula, finalSkillLevel);
  const targetCount = clampTargetCount(
    request.targetCount ?? domain.battleContext?.splitTargetCount
  );
  const splitFactor = resolveLookupValue(
    findModifierByDomain(ruleSet, 'split_factor'),
    targetCount >= 5 ? '5+' : targetCount,
    Math.max(0.5, 1 - targetCount * 0.1)
  );
  const formationFactor = toFiniteNumber(
    request.formationFactor,
    DEFAULT_SELF_FORMATION_FACTOR
  );
  const formationCounterFactor = resolveLookupValue(
    findModifierByDomain(ruleSet, 'formation_counter'),
    request.formationCounterState ||
      domain.battleContext?.formationCounterState ||
      DEFAULT_FORMATION_COUNTER_STATE,
    1
  );
  const elementFactor = resolveLookupValue(
    findModifierByDomain(ruleSet, 'element_relation'),
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
  );
  const ruleDerivedMagicDamage = toFiniteNumber(
    derivedStats.valueBag.magicDamage
  );
  const equipmentMagicDamageFlat = toFiniteNumber(equipmentTotals.magicDamage);
  const panelMagicDamageFromRules =
    ruleDerivedMagicDamage + equipmentMagicDamageFlat;
  const panelMagicDamageBreakdown = {
    formula: '服务端规则转化法伤 + 装备法伤',
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
  );
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
    const cultivationDiff =
      attackerMagicCultivation - targetMagicDefenseCultivation;
    const combinedFormationFactor = formationFactor * formationCounterFactor;

    const rawDamage =
      (baseTerm + panelMagicDamage - targetMagicDefense) *
        combinedFormationFactor *
        transformCardFactor *
        elementFactor *
        splitFactor *
        (1 + cultivationDiff * 0.02) +
      cultivationDiff * 5 +
      shenmuValue +
      magicResult;

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
        school: profile.school || character.school,
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
        finalSkillLevel,
        baseTerm: Number(baseTerm.toFixed(2)),
        panelMagicDamage,
        panelMagicDamageBreakdown: {
          ...panelMagicDamageBreakdown,
          result: roundForBreakdown(panelMagicDamage, 4),
        },
        panelMagicDamageSource: hasPanelMagicDamageOverride
          ? 'request.panelMagicDamageOverride'
          : 'rule_attribute_conversion',
        targetMagicDefense,
        targetMagicDefenseCultivation,
        cultivationDiff,
        formationFactor,
        formationCounterFactor,
        combinedFormationFactor,
        transformCardFactor,
        elementFactor,
        splitFactor,
        shenmuValue,
        magicResult,
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
