type DamageBreakdownRecord = Record<string, unknown>;

export type DamageExplanationStage = {
  key: string;
  label: string;
  value: number;
  note?: string;
  tone?: 'neutral' | 'positive' | 'warning';
};

export type DamageExplanationChip = {
  key: string;
  label: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'warning';
};

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toDisplayNumber(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function formatPercentValue(value: number) {
  return `${toDisplayNumber(value * 100, 2)}%`;
}

function normalizeModifierSourceLabel(sourceKey?: string) {
  if (sourceKey === 'targetSpeed') {
    return '目标速度';
  }
  if (sourceKey === 'manaCost') {
    return '魔法消耗';
  }
  return '固定值';
}

function normalizeEffectModifierLabel(code?: string) {
  switch (code) {
    case 'spell_ignore_percent':
      return '法术忽视';
    case 'spell_damage_percent':
      return '基础法伤%';
    case 'magic_upper_percent':
      return '魔法上限%';
    case 'element_overcome_percent':
      return '五行克制增强';
    default:
      return code || '未知词条';
  }
}

export function buildDamageExplanationStages(
  breakdown: DamageBreakdownRecord | null | undefined
): DamageExplanationStage[] {
  if (!breakdown) {
    return [];
  }

  const stages: DamageExplanationStage[] = [
    {
      key: 'main_formula',
      label: '主公式结果',
      value: toFiniteNumber(breakdown.nonResultDamageBeforeMitigation),
      note: '基础项、面板法伤、目标法防、阵法、五行、分灵、修炼差、神木符与额外追加项合并后的结果',
      tone: 'neutral',
    },
    {
      key: 'environment_after',
      label: '环境修正后',
      value: toFiniteNumber(breakdown.nonResultDamageBeforeLuohan),
      note: `天气 x ${toFiniteNumber(breakdown.weatherFactor, 1)} / 目标状态 x ${toFiniteNumber(
        breakdown.targetDefenseFactor,
        1
      )} / 特殊减伤 x ${toFiniteNumber(
        breakdown.specialMagicDamageReductionFactor,
        1
      )}`,
      tone: 'neutral',
    },
    {
      key: 'luohan_after',
      label: '罗汉修正后',
      value: toFiniteNumber(breakdown.nonResultDamage),
      note: `罗汉系数 x ${toFiniteNumber(breakdown.luohanFactor, 1)}`,
      tone:
        toFiniteNumber(breakdown.luohanFactor, 1) < 1 ? 'warning' : 'neutral',
    },
    {
      key: 'result_add',
      label: '加法伤结果后',
      value: toFiniteNumber(breakdown.rawDamageBeforeVariance),
      note: `法伤结果 +${toFiniteNumber(breakdown.magicResult)}`,
      tone: toFiniteNumber(breakdown.magicResult) > 0 ? 'positive' : 'neutral',
    },
    {
      key: 'variance_after',
      label: '波动后',
      value: toFiniteNumber(breakdown.rawDamageAfterVariance),
      note: `波动系数 x ${toFiniteNumber(breakdown.damageVarianceFactor, 1)}`,
      tone: 'neutral',
    },
    {
      key: 'target_result_after',
      label: '扣法防结果后',
      value: toFiniteNumber(breakdown.rawDamage),
      note: `目标法防结果 -${toFiniteNumber(
        breakdown.targetMagicDefenseResult
      )}`,
      tone:
        toFiniteNumber(breakdown.targetMagicDefenseResult) > 0
          ? 'warning'
          : 'neutral',
    },
    {
      key: 'final_damage',
      label: '最终取整伤害',
      value: toFiniteNumber(breakdown.finalDamage),
      note: '向最近整数取整，并保证最低为 1',
      tone: 'positive',
    },
  ];

  return stages.filter((stage) => Number.isFinite(stage.value));
}

export function buildDamageExplanationChips(
  breakdown: DamageBreakdownRecord | null | undefined
): DamageExplanationChip[] {
  if (!breakdown) {
    return [];
  }

  const matchedBonusRules = Array.isArray(breakdown.matchedBonusRules)
    ? breakdown.matchedBonusRules
    : [];
  const ignoredBonusRules = Array.isArray(breakdown.ignoredBonusRules)
    ? breakdown.ignoredBonusRules
    : [];
  const conditionalDamageAddends = Array.isArray(
    breakdown.conditionalDamageAddends
  )
    ? breakdown.conditionalDamageAddends
    : [];
  const equipmentEffectModifiers = Array.isArray(
    breakdown.equipmentEffectModifiers
  )
    ? breakdown.equipmentEffectModifiers
    : [];
  const ornamentSetActive = Array.isArray(
    (breakdown.ornamentSetBonuses as { activeSets?: unknown[] } | undefined)
      ?.activeSets
  )
    ? ((
        breakdown.ornamentSetBonuses as {
          activeSets?: Array<Record<string, unknown>>;
        }
      ).activeSets ?? [])
    : [];
  const regularSetActive = Array.isArray(
    (breakdown.regularSetBonuses as { activeSets?: unknown[] } | undefined)
      ?.activeSets
  )
    ? ((
        breakdown.regularSetBonuses as {
          activeSets?: Array<Record<string, unknown>>;
        }
      ).activeSets ?? [])
    : [];

  const chips: DamageExplanationChip[] = [];

  for (const rule of matchedBonusRules) {
    const record = rule as Record<string, unknown>;
    chips.push({
      key: `matched:${String(record.ruleCode ?? record.skillName ?? chips.length)}`,
      label: '技能加成',
      value: `${String(record.skillName ?? record.ruleCode ?? '规则')} +${toFiniteNumber(record.bonusValue)}`,
      tone: 'positive',
    });
  }

  for (const rule of ignoredBonusRules) {
    const record = rule as Record<string, unknown>;
    chips.push({
      key: `ignored:${String(record.ruleCode ?? chips.length)}`,
      label: '未生效规则',
      value: `${String(record.skillName ?? record.ruleCode ?? '规则')} x${toFiniteNumber(
        record.ignoredCount,
        1
      )} ${String(record.reasonLabel ?? '未生效')}`,
      tone: 'warning',
    });
  }

  for (const addend of conditionalDamageAddends) {
    const record = addend as Record<string, unknown>;
    const contribution = toFiniteNumber(record.contribution);
    if (contribution === 0) {
      continue;
    }

    const sourceLabel = normalizeModifierSourceLabel(
      typeof record.sourceKey === 'string' ? record.sourceKey : undefined
    );
    const prefix =
      record.sourceType === 'ornament_set'
        ? `${String(record.setName ?? '套装')} ${toFiniteNumber(record.tier, 0)}级`
        : String(record.modifierKey ?? '追加项');
    chips.push({
      key: `conditional:${String(record.modifierId ?? record.modifierKey ?? chips.length)}`,
      label: '追加伤害',
      value: `${prefix} ${sourceLabel} +${toDisplayNumber(contribution, 2)}`,
      tone: contribution > 0 ? 'positive' : 'neutral',
    });
  }

  for (const modifier of equipmentEffectModifiers) {
    const record = modifier as Record<string, unknown>;
    const value = toFiniteNumber(record.value);
    const label = normalizeEffectModifierLabel(
      typeof record.code === 'string' ? record.code : undefined
    );
    const source =
      typeof record.label === 'string' && record.label.trim().length > 0
        ? record.label.trim()
        : String(record.equipmentName ?? '装备词条');
    chips.push({
      key: `effect:${String(record.equipmentId ?? chips.length)}:${String(record.code ?? '')}`,
      label,
      value:
        label === '五行克制增强'
          ? `${source} ${formatPercentValue(value)}`
          : `${source} ${formatPercentValue(value)}`,
      tone: value > 0 ? 'positive' : 'neutral',
    });
  }

  for (const activeSet of ornamentSetActive) {
    chips.push({
      key: `ornament:${String(activeSet.setName ?? chips.length)}`,
      label: '灵饰套装',
      value: `${String(activeSet.setName ?? '套装')} ${toFiniteNumber(
        activeSet.tier,
        0
      )}级`,
      tone: 'positive',
    });
  }

  for (const activeSet of regularSetActive) {
    chips.push({
      key: `regular:${String(activeSet.setName ?? chips.length)}`,
      label: '装备套装',
      value: `${String(activeSet.setName ?? '套装')} ${toFiniteNumber(
        activeSet.tier,
        0
      )}件`,
      tone: 'positive',
    });
  }

  return chips;
}
