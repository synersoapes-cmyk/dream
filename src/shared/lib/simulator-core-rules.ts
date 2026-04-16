type SimulatorRace = '人族' | '仙族' | '魔族';

type PanelConversionProfile = {
  race: SimulatorRace;
  hpPerPhysique: number;
  mpPerMagic: number;
  damagePerStrength: number;
  defensePerEndurance: number;
  hitPerStrength: number;
};

export type PassiveCultivationLevels = {
  bodyStrength: number;
  meditation: number;
  physicalFitness: number;
  divineSpeed: number;
  physicalAttack: number;
  physicalDefense: number;
  magicAttack: number;
  magicDefense: number;
};

const PRD_PANEL_BASE_CONSTANTS = {
  hp: 100,
  mp: 80,
} as const;

const SCHOOL_RACE_MAP: Record<string, SimulatorRace> = {
  大唐官府: '人族',
  化生寺: '人族',
  方寸山: '人族',
  龙宫: '仙族',
  普陀山: '仙族',
  狮驼岭: '魔族',
};

const PANEL_CONVERSION_BY_RACE: Record<SimulatorRace, PanelConversionProfile> = {
  人族: {
    race: '人族',
    hpPerPhysique: 5,
    mpPerMagic: 3,
    damagePerStrength: 0.66,
    defensePerEndurance: 1.5,
    hitPerStrength: 2,
  },
  仙族: {
    race: '仙族',
    hpPerPhysique: 4.5,
    mpPerMagic: 3.5,
    damagePerStrength: 0.56,
    defensePerEndurance: 1.6,
    hitPerStrength: 1.7,
  },
  魔族: {
    race: '魔族',
    hpPerPhysique: 6,
    mpPerMagic: 2.5,
    damagePerStrength: 0.76,
    defensePerEndurance: 1.4,
    hitPerStrength: 2.3,
  },
};

const PASSIVE_CULTIVATION_ALIASES: Record<string, keyof PassiveCultivationLevels> =
  {
    bodyStrength: 'bodyStrength',
    body_strength: 'bodyStrength',
    fitness: 'bodyStrength',
    qiangshen: 'bodyStrength',
    强身: 'bodyStrength',
    强身术: 'bodyStrength',
    meditation: 'meditation',
    mingxiang: 'meditation',
    冥想: 'meditation',
    physicalFitness: 'physicalFitness',
    physical_fitness: 'physicalFitness',
    qiangzhuang: 'physicalFitness',
    强壮: 'physicalFitness',
    divineSpeed: 'divineSpeed',
    divine_speed: 'divineSpeed',
    shensu: 'divineSpeed',
    神速: 'divineSpeed',
    physicalAttack: 'physicalAttack',
    physical_attack: 'physicalAttack',
    attack: 'physicalAttack',
    攻击修炼: 'physicalAttack',
    physicalDefense: 'physicalDefense',
    physical_defense: 'physicalDefense',
    defense: 'physicalDefense',
    防御修炼: 'physicalDefense',
    magicAttack: 'magicAttack',
    magic_attack: 'magicAttack',
    spellAttack: 'magicAttack',
    法攻修炼: 'magicAttack',
    法术修炼: 'magicAttack',
    magicDefense: 'magicDefense',
    magic_defense: 'magicDefense',
    spellDefense: 'magicDefense',
    法防修炼: 'magicDefense',
    抗法修炼: 'magicDefense',
  };

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function resolveSimulatorRace(params: {
  school?: string | null;
  race?: string | null;
  fallback?: SimulatorRace;
}) {
  const explicitRace =
    params.race === '人族' || params.race === '仙族' || params.race === '魔族'
      ? params.race
      : null;

  if (explicitRace) {
    return explicitRace;
  }

  if (params.school && SCHOOL_RACE_MAP[params.school]) {
    return SCHOOL_RACE_MAP[params.school];
  }

  return params.fallback ?? '仙族';
}

export function getPanelConversionProfile(params: {
  school?: string | null;
  race?: string | null;
  fallback?: SimulatorRace;
}) {
  const race = resolveSimulatorRace(params);
  return PANEL_CONVERSION_BY_RACE[race];
}

export function getPrdPanelBaseConstant(key: keyof typeof PRD_PANEL_BASE_CONSTANTS) {
  return PRD_PANEL_BASE_CONSTANTS[key];
}

export function resolveTrustedBasePanelConstant(
  value: unknown,
  fallback: number
) {
  const parsed = toFiniteNumber(value, Number.NaN);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 200) {
    return fallback;
  }

  return parsed;
}

export function resolvePassiveCultivationLevels(
  source: Record<string, unknown> | undefined | null
): PassiveCultivationLevels {
  const resolved: PassiveCultivationLevels = {
    bodyStrength: 0,
    meditation: 0,
    physicalFitness: 0,
    divineSpeed: 0,
    physicalAttack: 0,
    physicalDefense: 0,
    magicAttack: 0,
    magicDefense: 0,
  };

  if (!source) {
    return resolved;
  }

  for (const [key, value] of Object.entries(source)) {
    const normalizedKey = PASSIVE_CULTIVATION_ALIASES[key];
    if (!normalizedKey) {
      continue;
    }

    resolved[normalizedKey] = toFiniteNumber(value);
  }

  return resolved;
}

export function computeMagicSkillBaseTerm(params: {
  skillCode?: string;
  skillLevel: number;
}) {
  const skillLevel = toFiniteNumber(params.skillLevel);

  if (params.skillCode === 'dragon_roll') {
    return skillLevel * 2.5;
  }

  if (params.skillCode === 'dragon_teng') {
    return skillLevel * skillLevel / 120 + skillLevel * 1.5 + 55;
  }

  return skillLevel;
}

export function computeWeaponDamageToMagicDamageBonus(value: unknown) {
  return toFiniteNumber(value) / 4;
}
