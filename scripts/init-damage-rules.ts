#!/usr/bin/env node
import { execFileSync, execSync } from 'child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

type CliOptions = {
  dbName: string;
  remote: boolean;
  wranglerFile?: string;
};

type WranglerDbConfig = {
  binding: string;
  databaseName: string;
};

type RuleSeedRow = {
  id: string;
  versionId?: string;
  school?: string;
  roleType?: string;
  sourceAttr?: string;
  targetAttr?: string;
  coefficient?: number;
  valueType?: string;
  conditionJson?: string;
  sort?: number;
  enabled?: boolean;
  skillCode?: string;
  skillName?: string;
  formulaKey?: string;
  baseFormulaJson?: string;
  extraFormulaJson?: string;
  modifierDomain?: string;
  modifierKey?: string;
  modifierType?: string;
  sourceKey?: string;
  targetKey?: string;
  value?: number;
  valueJson?: string;
  bonusGroup?: string;
  ruleCode?: string;
  bonusType?: string;
  bonusValue?: number;
  conflictPolicy?: string;
  limitPolicyJson?: string;
};

const RULE_VERSION_ID = 'rule_version_damage_v1';
const RULE_VERSION_CODE = 'damage_v1';
const SOURCE_DOC_URL =
  'https://csgy1xzrndus.sg.larksuite.com/wiki/EjSQwJe48i4dR8kJkCXlmb7vgyn';

function parseArgs(argv: string[]): CliOptions {
  let dbName = process.env.D1_DATABASE_NAME?.trim() || '';
  let remote = true;
  let wranglerFile: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--db' && argv[i + 1]) {
      dbName = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith('--db=')) {
      dbName = arg.slice('--db='.length);
      continue;
    }

    if (arg === '--local') {
      remote = false;
      continue;
    }

    if (arg === '--remote') {
      remote = true;
      continue;
    }

    if (arg === '--config' && argv[i + 1]) {
      wranglerFile = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith('--config=')) {
      wranglerFile = arg.slice('--config='.length);
    }
  }

  if (!dbName) {
    dbName = readDbNameFromWrangler() || '';
  }

  if (!dbName) {
    throw new Error(
      'Missing D1 database name. Pass --db <name> or set D1_DATABASE_NAME.'
    );
  }

  return { dbName, remote, wranglerFile };
}

function readDbNameFromWrangler(): string | null {
  const file = join(process.cwd(), 'wrangler.toml');
  if (!existsSync(file)) return null;

  const content = readFileSync(file, 'utf8');
  const match = content.match(/database_name\s*=\s*"([^"]+)"/);
  return match?.[1] ?? null;
}

function readWranglerD1Config(wranglerFile?: string): WranglerDbConfig | null {
  const file = wranglerFile
    ? join(process.cwd(), wranglerFile)
    : join(process.cwd(), 'wrangler.toml');

  if (!existsSync(file)) return null;

  const content = readFileSync(file, 'utf8');
  const d1BlockMatch = content.match(
    /\[\[d1_databases\]\]([\s\S]*?)(?=\n\[|\n\[\[|$)/
  );

  if (!d1BlockMatch) {
    return null;
  }

  const d1Block = d1BlockMatch[1];
  const binding = d1Block.match(/binding\s*=\s*"([^"]+)"/)?.[1];
  const databaseName = d1Block.match(/database_name\s*=\s*"([^"]+)"/)?.[1];

  if (!binding || !databaseName) {
    return null;
  }

  return { binding, databaseName };
}

function resolveExecuteTarget(options: CliOptions): string {
  if (options.remote) {
    return options.dbName;
  }

  const wranglerConfig = readWranglerD1Config(options.wranglerFile);
  if (!wranglerConfig) {
    return options.dbName;
  }

  if (
    options.dbName === wranglerConfig.binding ||
    options.dbName === wranglerConfig.databaseName
  ) {
    return options.dbName;
  }

  console.log(
    `[Init Damage Rules] Local mode uses wrangler binding/name. Falling back from "${options.dbName}" to "${wranglerConfig.binding}".`
  );

  return wranglerConfig.binding;
}

function buildWindowsCommand(args: string[]): string {
  const escaped = args.map(quoteForCmd).join(' ');
  return `npx ${escaped}`;
}

function quoteForCmd(value: string): string {
  const normalized = value.replace(/"/g, '\\"');

  if (/[ \t\n\r"]/u.test(normalized)) {
    return `"${normalized}"`;
  }

  return normalized;
}

function runWranglerSql(sql: string, options: CliOptions): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'dream-d1-rules-'));
  const sqlFile = join(tempDir, 'seed.sql');
  writeFileSync(sqlFile, sql, 'utf8');

  const executeTarget = resolveExecuteTarget(options);
  const args = ['wrangler', 'd1', 'execute', executeTarget];

  if (options.remote) {
    args.push('--remote');
  } else {
    args.push('--local');
  }

  if (options.wranglerFile) {
    args.push('--config', options.wranglerFile);
  }

  args.push('--file', sqlFile, '--json');

  try {
    if (process.platform === 'win32') {
      return execSync(buildWindowsCommand(args), {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    }

    return execFileSync('npx', args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

function sqlString(value: string) {
  return `'${escapeSqlString(value)}'`;
}

function sqlBool(value: boolean) {
  return value ? '1' : '0';
}

const attributeConversions: RuleSeedRow[] = [
  {
    id: 'rac_base_hp_hp',
    versionId: RULE_VERSION_ID,
    school: '龙宫',
    roleType: '法师',
    sourceAttr: 'baseHp',
    targetAttr: 'hp',
    coefficient: 5,
    valueType: 'linear',
    conditionJson: '{}',
    sort: 10,
    enabled: true,
  },
  {
    id: 'rac_physique_hp',
    versionId: RULE_VERSION_ID,
    school: '龙宫',
    roleType: '法师',
    sourceAttr: 'physique',
    targetAttr: 'hp',
    coefficient: 12,
    valueType: 'linear',
    conditionJson: '{}',
    sort: 20,
    enabled: true,
  },
  {
    id: 'rac_endurance_hp',
    versionId: RULE_VERSION_ID,
    school: '龙宫',
    roleType: '法师',
    sourceAttr: 'endurance',
    targetAttr: 'hp',
    coefficient: 4,
    valueType: 'linear',
    conditionJson: '{}',
    sort: 30,
    enabled: true,
  },
  {
    id: 'rac_magic_mp',
    versionId: RULE_VERSION_ID,
    school: '龙宫',
    roleType: '法师',
    sourceAttr: 'magic',
    targetAttr: 'mp',
    coefficient: 1.6,
    valueType: 'linear',
    conditionJson: '{}',
    sort: 40,
    enabled: true,
  },
  {
    id: 'rac_spirit_mp',
    versionId: RULE_VERSION_ID,
    school: '龙宫',
    roleType: '法师',
    sourceAttr: 'spirit',
    targetAttr: 'mp',
    coefficient: 0.25,
    valueType: 'linear',
    conditionJson: '{}',
    sort: 50,
    enabled: true,
  },
  {
    id: 'rac_magic_magic_damage',
    versionId: RULE_VERSION_ID,
    school: '龙宫',
    roleType: '法师',
    sourceAttr: 'magic',
    targetAttr: 'magicDamage',
    coefficient: 5,
    valueType: 'linear',
    conditionJson: '{}',
    sort: 60,
    enabled: true,
  },
  {
    id: 'rac_spirit_magic_damage',
    versionId: RULE_VERSION_ID,
    school: '龙宫',
    roleType: '法师',
    sourceAttr: 'spirit',
    targetAttr: 'magicDamage',
    coefficient: 1.2,
    valueType: 'linear',
    conditionJson: '{}',
    sort: 70,
    enabled: true,
  },
  {
    id: 'rac_level_magic_damage',
    versionId: RULE_VERSION_ID,
    school: '龙宫',
    roleType: '法师',
    sourceAttr: 'level',
    targetAttr: 'magicDamage',
    coefficient: 3,
    valueType: 'linear',
    conditionJson: '{}',
    sort: 80,
    enabled: true,
  },
  {
    id: 'rac_spirit_magic_defense',
    versionId: RULE_VERSION_ID,
    school: '龙宫',
    roleType: '法师',
    sourceAttr: 'spirit',
    targetAttr: 'magicDefense',
    coefficient: 0.6,
    valueType: 'linear',
    conditionJson: '{}',
    sort: 90,
    enabled: true,
  },
  {
    id: 'rac_endurance_magic_defense',
    versionId: RULE_VERSION_ID,
    school: '龙宫',
    roleType: '法师',
    sourceAttr: 'endurance',
    targetAttr: 'magicDefense',
    coefficient: 2,
    valueType: 'linear',
    conditionJson: '{}',
    sort: 100,
    enabled: true,
  },
  {
    id: 'rac_level_magic_defense',
    versionId: RULE_VERSION_ID,
    school: '龙宫',
    roleType: '法师',
    sourceAttr: 'level',
    targetAttr: 'magicDefense',
    coefficient: 2.6,
    valueType: 'linear',
    conditionJson: '{}',
    sort: 110,
    enabled: true,
  },
  {
    id: 'rac_agility_speed',
    versionId: RULE_VERSION_ID,
    school: '龙宫',
    roleType: '法师',
    sourceAttr: 'agility',
    targetAttr: 'speed',
    coefficient: 4,
    valueType: 'linear',
    conditionJson: '{}',
    sort: 120,
    enabled: true,
  },
  {
    id: 'rac_level_speed',
    versionId: RULE_VERSION_ID,
    school: '龙宫',
    roleType: '法师',
    sourceAttr: 'level',
    targetAttr: 'speed',
    coefficient: 2,
    valueType: 'linear',
    conditionJson: '{}',
    sort: 130,
    enabled: true,
  },
  {
    id: 'rac_strength_hit',
    versionId: RULE_VERSION_ID,
    school: '龙宫',
    roleType: '法师',
    sourceAttr: 'strength',
    targetAttr: 'hit',
    coefficient: 2,
    valueType: 'linear',
    conditionJson: '{}',
    sort: 140,
    enabled: true,
  },
  {
    id: 'rac_level_hit',
    versionId: RULE_VERSION_ID,
    school: '龙宫',
    roleType: '法师',
    sourceAttr: 'level',
    targetAttr: 'hit',
    coefficient: 6,
    valueType: 'linear',
    conditionJson: '{}',
    sort: 150,
    enabled: true,
  },
  {
    id: 'rac_strength_damage',
    versionId: RULE_VERSION_ID,
    school: '龙宫',
    roleType: '法师',
    sourceAttr: 'strength',
    targetAttr: 'damage',
    coefficient: 8,
    valueType: 'linear',
    conditionJson: '{}',
    sort: 160,
    enabled: true,
  },
  {
    id: 'rac_level_damage',
    versionId: RULE_VERSION_ID,
    school: '龙宫',
    roleType: '法师',
    sourceAttr: 'level',
    targetAttr: 'damage',
    coefficient: 6,
    valueType: 'linear',
    conditionJson: '{}',
    sort: 170,
    enabled: true,
  },
  {
    id: 'rac_endurance_defense',
    versionId: RULE_VERSION_ID,
    school: '龙宫',
    roleType: '法师',
    sourceAttr: 'endurance',
    targetAttr: 'defense',
    coefficient: 4,
    valueType: 'linear',
    conditionJson: '{}',
    sort: 180,
    enabled: true,
  },
  {
    id: 'rac_physique_defense',
    versionId: RULE_VERSION_ID,
    school: '龙宫',
    roleType: '法师',
    sourceAttr: 'physique',
    targetAttr: 'defense',
    coefficient: 2,
    valueType: 'linear',
    conditionJson: '{}',
    sort: 190,
    enabled: true,
  },
  {
    id: 'rac_level_defense',
    versionId: RULE_VERSION_ID,
    school: '龙宫',
    roleType: '法师',
    sourceAttr: 'level',
    targetAttr: 'defense',
    coefficient: 3,
    valueType: 'linear',
    conditionJson: '{}',
    sort: 200,
    enabled: true,
  },
  {
    id: 'rac_agility_dodge',
    versionId: RULE_VERSION_ID,
    school: '龙宫',
    roleType: '法师',
    sourceAttr: 'agility',
    targetAttr: 'dodge',
    coefficient: 2,
    valueType: 'linear',
    conditionJson: '{}',
    sort: 210,
    enabled: true,
  },
  {
    id: 'rac_level_dodge',
    versionId: RULE_VERSION_ID,
    school: '龙宫',
    roleType: '法师',
    sourceAttr: 'level',
    targetAttr: 'dodge',
    coefficient: 0.8,
    valueType: 'floor_linear',
    conditionJson: '{}',
    sort: 220,
    enabled: true,
  },
];

const skillFormulas: RuleSeedRow[] = [
  {
    id: 'rsf_dragon_roll',
    versionId: RULE_VERSION_ID,
    school: '龙宫',
    roleType: '法师',
    skillCode: 'dragon_roll',
    skillName: '龙卷雨击',
    formulaKey: 'lg_dragon_roll_v1',
    baseFormulaJson: JSON.stringify({
      baseTerm: {
        type: 'quadratic',
        a: 1 / 145,
        b: 1.4,
        c: 39.5,
      },
    }),
    extraFormulaJson: JSON.stringify({
      formula:
        '(base + panel_magic_damage - actual_target_magic_defense) * formation_factor * transform_card_factor * element_factor * split_factor * (1 + cult_diff * 0.02) + cult_diff * 5 + shenmu_value + magic_result',
    }),
    conditionJson: JSON.stringify({
      targetType: 'magic',
      school: ['龙宫'],
      roleType: ['法师'],
      skillCode: ['dragon_roll'],
    }),
    sort: 10,
    enabled: true,
  },
  {
    id: 'rsf_dragon_teng',
    versionId: RULE_VERSION_ID,
    school: '龙宫',
    roleType: '法师',
    skillCode: 'dragon_teng',
    skillName: '龙腾',
    formulaKey: 'lg_dragon_teng_v1',
    baseFormulaJson: JSON.stringify({
      baseTerm: {
        type: 'quadratic',
        a: 1 / 145,
        b: 1.4,
        c: 39.5,
      },
    }),
    extraFormulaJson: JSON.stringify({
      formula:
        '(base + panel_magic_damage - actual_target_magic_defense) * formation_factor * transform_card_factor * element_factor * split_factor * (1 + cult_diff * 0.02) + cult_diff * 5 + shenmu_value + magic_result',
    }),
    conditionJson: JSON.stringify({
      targetType: 'magic',
      school: ['龙宫'],
      roleType: ['法师'],
      skillCode: ['dragon_teng'],
    }),
    sort: 20,
    enabled: true,
  },
];

const damageModifiers: RuleSeedRow[] = [
  {
    id: 'rdm_split_factor_dragon_roll',
    versionId: RULE_VERSION_ID,
    modifierDomain: 'split_factor',
    modifierKey: 'dragon_roll_target_count',
    modifierType: 'lookup',
    sourceKey: 'targetCount',
    targetKey: 'splitFactor',
    value: 0,
    valueJson: JSON.stringify({
      '1': 0.9,
      '2': 0.8,
      '3': 0.7,
      '4': 0.6,
      '5': 0.5,
      '6': 0.5,
      '7': 0.5,
      '8': 0.5,
      '9': 0.5,
      '10': 0.5,
    }),
    conditionJson: JSON.stringify({
      skillCode: ['dragon_roll'],
      sourceField: 'targetCount',
    }),
    sort: 10,
    enabled: true,
  },
  {
    id: 'rdm_formation_counter',
    versionId: RULE_VERSION_ID,
    modifierDomain: 'formation_counter',
    modifierKey: 'counter_state',
    modifierType: 'lookup',
    sourceKey: 'formationCounterState',
    targetKey: 'formationCounterFactor',
    value: 0,
    valueJson: JSON.stringify({
      大克: 1.3,
      小克: 1.1,
      '无克/普通': 1.0,
      被小克: 0.95,
      被大克: 0.75,
    }),
    conditionJson: JSON.stringify({
      sourceField: 'formationCounterState',
    }),
    sort: 20,
    enabled: true,
  },
  {
    id: 'rdm_element_relation',
    versionId: RULE_VERSION_ID,
    modifierDomain: 'element_relation',
    modifierKey: 'element_state',
    modifierType: 'lookup',
    sourceKey: 'elementRelation',
    targetKey: 'elementFactor',
    value: 0,
    valueJson: JSON.stringify({
      克制: 1.1,
      '无克/普通': 1.0,
      被克制: 0.9,
    }),
    conditionJson: JSON.stringify({
      sourceField: 'elementRelation',
    }),
    sort: 30,
    enabled: true,
  },
  {
    id: 'rdm_transform_card_default',
    versionId: RULE_VERSION_ID,
    modifierDomain: 'transform_card',
    modifierKey: 'default',
    modifierType: 'lookup',
    sourceKey: 'transformCardState',
    targetKey: 'transformCardFactor',
    value: 0,
    valueJson: JSON.stringify({
      default: 1.0,
    }),
    conditionJson: JSON.stringify({
      sourceField: 'transformCardState',
    }),
    sort: 40,
    enabled: true,
  },
  {
    id: 'rdm_shenmu',
    versionId: RULE_VERSION_ID,
    modifierDomain: 'shenmu',
    modifierKey: 'flat_add',
    modifierType: 'addend',
    sourceKey: 'shenmuValue',
    targetKey: 'shenmuValue',
    value: 0,
    valueJson: '{}',
    conditionJson: JSON.stringify({
      sourceField: 'shenmuValue',
    }),
    sort: 50,
    enabled: true,
  },
  {
    id: 'rdm_magic_result',
    versionId: RULE_VERSION_ID,
    modifierDomain: 'magic_result',
    modifierKey: 'flat_add',
    modifierType: 'addend',
    sourceKey: 'magicResult',
    targetKey: 'magicResult',
    value: 0,
    valueJson: '{}',
    conditionJson: JSON.stringify({
      sourceField: 'magicResult',
    }),
    sort: 60,
    enabled: true,
  },
  {
    id: 'rdm_zhaoyun_spirit_bonus',
    versionId: RULE_VERSION_ID,
    modifierDomain: 'panel_stat_bonus',
    modifierKey: 'zhaoyun_spirit',
    modifierType: 'addend',
    sourceKey: 'runeFullSet',
    targetKey: 'spirit',
    value: 6,
    valueJson: '{}',
    conditionJson: JSON.stringify({
      triggerType: 'rune_full_set',
      school: ['龙宫'],
      roleType: ['法师'],
      slotColorMap: {
        helmet: '白',
        necklace: '红',
        weapon: '黄',
        armor: '黑',
        belt: '蓝',
        shoes: '红',
      },
    }),
    sort: 70,
    enabled: true,
  },
  {
    id: 'rdm_zhaoyun_magic_damage_bonus',
    versionId: RULE_VERSION_ID,
    modifierDomain: 'panel_stat_bonus',
    modifierKey: 'zhaoyun_magic_damage',
    modifierType: 'addend',
    sourceKey: 'runeFullSet',
    targetKey: 'magicDamage',
    value: 6,
    valueJson: '{}',
    conditionJson: JSON.stringify({
      triggerType: 'rune_full_set',
      school: ['龙宫'],
      roleType: ['法师'],
      slotColorMap: {
        helmet: '白',
        necklace: '红',
        weapon: '黄',
        armor: '黑',
        belt: '蓝',
        shoes: '红',
      },
    }),
    sort: 80,
    enabled: true,
  },
  {
    id: 'rdm_zhaoyun_magic_defense_bonus',
    versionId: RULE_VERSION_ID,
    modifierDomain: 'panel_stat_bonus',
    modifierKey: 'zhaoyun_magic_defense',
    modifierType: 'addend',
    sourceKey: 'runeFullSet',
    targetKey: 'magicDefense',
    value: 6,
    valueJson: '{}',
    conditionJson: JSON.stringify({
      triggerType: 'rune_full_set',
      school: ['龙宫'],
      roleType: ['法师'],
      slotColorMap: {
        helmet: '白',
        necklace: '红',
        weapon: '黄',
        armor: '黑',
        belt: '蓝',
        shoes: '红',
      },
    }),
    sort: 90,
    enabled: true,
  },
  {
    id: 'rdm_zhaoyun_dragon_roll_bonus',
    versionId: RULE_VERSION_ID,
    modifierDomain: 'skill_damage_addend',
    modifierKey: 'zhaoyun_target_speed',
    modifierType: 'multiplier',
    sourceKey: 'targetSpeed',
    targetKey: 'finalDamage',
    value: 0.04,
    valueJson: '{}',
    conditionJson: JSON.stringify({
      triggerType: 'rune_full_set',
      school: ['龙宫'],
      roleType: ['法师'],
      skillCode: ['dragon_roll'],
      slotColorMap: {
        helmet: '白',
        necklace: '红',
        weapon: '黄',
        armor: '黑',
        belt: '蓝',
        shoes: '红',
      },
    }),
    sort: 100,
    enabled: true,
  },
  {
    id: 'rdm_tengjiao_spirit_bonus',
    versionId: RULE_VERSION_ID,
    modifierDomain: 'panel_stat_bonus',
    modifierKey: 'tengjiao_spirit',
    modifierType: 'addend',
    sourceKey: 'runeFullSet',
    targetKey: 'spirit',
    value: 6,
    valueJson: '{}',
    conditionJson: JSON.stringify({
      triggerType: 'rune_full_set',
      school: ['龙宫'],
      roleType: ['法师'],
      slotColorMap: {
        helmet: '白',
        necklace: '红',
        weapon: '红',
        armor: '黑',
        belt: '蓝',
        shoes: '红',
      },
    }),
    sort: 110,
    enabled: true,
  },
  {
    id: 'rdm_tengjiao_magic_damage_bonus',
    versionId: RULE_VERSION_ID,
    modifierDomain: 'panel_stat_bonus',
    modifierKey: 'tengjiao_magic_damage',
    modifierType: 'addend',
    sourceKey: 'runeFullSet',
    targetKey: 'magicDamage',
    value: 6,
    valueJson: '{}',
    conditionJson: JSON.stringify({
      triggerType: 'rune_full_set',
      school: ['龙宫'],
      roleType: ['法师'],
      slotColorMap: {
        helmet: '白',
        necklace: '红',
        weapon: '红',
        armor: '黑',
        belt: '蓝',
        shoes: '红',
      },
    }),
    sort: 120,
    enabled: true,
  },
  {
    id: 'rdm_tengjiao_magic_defense_bonus',
    versionId: RULE_VERSION_ID,
    modifierDomain: 'panel_stat_bonus',
    modifierKey: 'tengjiao_magic_defense',
    modifierType: 'addend',
    sourceKey: 'runeFullSet',
    targetKey: 'magicDefense',
    value: 6,
    valueJson: '{}',
    conditionJson: JSON.stringify({
      triggerType: 'rune_full_set',
      school: ['龙宫'],
      roleType: ['法师'],
      slotColorMap: {
        helmet: '白',
        necklace: '红',
        weapon: '红',
        armor: '黑',
        belt: '蓝',
        shoes: '红',
      },
    }),
    sort: 130,
    enabled: true,
  },
  {
    id: 'rdm_tengjiao_dragon_teng_bonus',
    versionId: RULE_VERSION_ID,
    modifierDomain: 'skill_damage_addend',
    modifierKey: 'tengjiao_mana_cost',
    modifierType: 'multiplier',
    sourceKey: 'manaCost',
    targetKey: 'finalDamage',
    value: 0.04,
    valueJson: '{}',
    conditionJson: JSON.stringify({
      triggerType: 'rune_full_set',
      school: ['龙宫'],
      roleType: ['法师'],
      skillCode: ['dragon_teng'],
      slotColorMap: {
        helmet: '白',
        necklace: '红',
        weapon: '红',
        armor: '黑',
        belt: '蓝',
        shoes: '红',
      },
    }),
    sort: 140,
    enabled: true,
  },
];

const skillBonuses: RuleSeedRow[] = [
  {
    id: 'rsb_jiulongjue_2',
    versionId: RULE_VERSION_ID,
    bonusGroup: 'school_skill_rune',
    ruleCode: 'jiulongjue_lv2',
    skillCode: 'jiulongjue',
    skillName: '九龙诀',
    bonusType: 'skill_level',
    bonusValue: 2,
    conditionJson: JSON.stringify({
      triggerType: 'rune_combo',
      colorSequence: ['白', '红', '黄'],
      slotCount: 3,
      positionScope: ['helmet', 'necklace', 'weapon', 'armor', 'belt', 'shoes'],
      school: ['龙宫'],
      roleType: ['法师'],
    }),
    conflictPolicy: 'take_max',
    limitPolicyJson: JSON.stringify({
      globalMaxActive: 1,
      sameRuleConflict: 'take_max',
      sameSkillConflict: 'take_max',
    }),
    sort: 10,
    enabled: true,
  },
  {
    id: 'rsb_jiulongjue_4',
    versionId: RULE_VERSION_ID,
    bonusGroup: 'school_skill_rune',
    ruleCode: 'jiulongjue_lv4',
    skillCode: 'jiulongjue',
    skillName: '九龙诀',
    bonusType: 'skill_level',
    bonusValue: 4,
    conditionJson: JSON.stringify({
      triggerType: 'rune_combo',
      colorSequence: ['白', '红', '黄', '蓝'],
      slotCount: 4,
      positionScope: ['helmet', 'necklace', 'weapon', 'armor', 'belt', 'shoes'],
      school: ['龙宫'],
      roleType: ['法师'],
    }),
    conflictPolicy: 'take_max',
    limitPolicyJson: JSON.stringify({
      globalMaxActive: 1,
      sameRuleConflict: 'take_max',
      sameSkillConflict: 'take_max',
    }),
    sort: 20,
    enabled: true,
  },
  {
    id: 'rsb_jiulongjue_6',
    versionId: RULE_VERSION_ID,
    bonusGroup: 'school_skill_rune',
    ruleCode: 'jiulongjue_lv6',
    skillCode: 'jiulongjue',
    skillName: '九龙诀',
    bonusType: 'skill_level',
    bonusValue: 6,
    conditionJson: JSON.stringify({
      triggerType: 'rune_combo',
      colorSequence: ['白', '红', '黄', '蓝', '绿'],
      slotCount: 5,
      positionScope: ['helmet', 'necklace', 'weapon', 'armor', 'belt', 'shoes'],
      school: ['龙宫'],
      roleType: ['法师'],
    }),
    conflictPolicy: 'take_max',
    limitPolicyJson: JSON.stringify({
      globalMaxActive: 1,
      sameRuleConflict: 'take_max',
      sameSkillConflict: 'take_max',
    }),
    sort: 30,
    enabled: true,
  },
  {
    id: 'rsb_hufenghuanyu_6',
    versionId: RULE_VERSION_ID,
    bonusGroup: 'school_skill_rune',
    ruleCode: 'hufenghuanyu_lv6',
    skillCode: 'dragon_roll',
    skillName: '呼风唤雨',
    bonusType: 'skill_level',
    bonusValue: 6,
    conditionJson: JSON.stringify({
      triggerType: 'rune_combo',
      colorSequence: ['黑', '黄', '蓝', '绿', '白'],
      slotCount: 5,
      positionScope: ['helmet', 'necklace', 'weapon', 'armor', 'belt', 'shoes'],
      school: ['龙宫'],
      roleType: ['法师'],
    }),
    conflictPolicy: 'take_max',
    limitPolicyJson: JSON.stringify({
      globalMaxActive: 1,
      sameRuleConflict: 'take_max',
      sameSkillConflict: 'take_max',
    }),
    sort: 40,
    enabled: true,
  },
  {
    id: 'rsb_longteng_2',
    versionId: RULE_VERSION_ID,
    bonusGroup: 'school_skill_rune',
    ruleCode: 'longteng_lv2',
    skillCode: 'dragon_teng',
    skillName: '龙腾',
    bonusType: 'skill_level',
    bonusValue: 2,
    conditionJson: JSON.stringify({
      triggerType: 'rune_combo',
      colorSequence: ['黑', '红', '白'],
      slotCount: 3,
      positionScope: ['helmet', 'necklace', 'weapon', 'armor', 'belt', 'shoes'],
      school: ['龙宫'],
      roleType: ['法师'],
    }),
    conflictPolicy: 'take_max',
    limitPolicyJson: JSON.stringify({
      globalMaxActive: 1,
      sameRuleConflict: 'take_max',
      sameSkillConflict: 'take_max',
    }),
    sort: 50,
    enabled: true,
  },
  {
    id: 'rsb_longteng_4',
    versionId: RULE_VERSION_ID,
    bonusGroup: 'school_skill_rune',
    ruleCode: 'longteng_lv4',
    skillCode: 'dragon_teng',
    skillName: '龙腾',
    bonusType: 'skill_level',
    bonusValue: 4,
    conditionJson: JSON.stringify({
      triggerType: 'rune_combo',
      colorSequence: ['黑', '红', '白', '蓝'],
      slotCount: 4,
      positionScope: ['helmet', 'necklace', 'weapon', 'armor', 'belt', 'shoes'],
      school: ['龙宫'],
      roleType: ['法师'],
    }),
    conflictPolicy: 'take_max',
    limitPolicyJson: JSON.stringify({
      globalMaxActive: 1,
      sameRuleConflict: 'take_max',
      sameSkillConflict: 'take_max',
    }),
    sort: 60,
    enabled: true,
  },
  {
    id: 'rsb_longteng_6',
    versionId: RULE_VERSION_ID,
    bonusGroup: 'school_skill_rune',
    ruleCode: 'longteng_lv6',
    skillCode: 'dragon_teng',
    skillName: '龙腾',
    bonusType: 'skill_level',
    bonusValue: 6,
    conditionJson: JSON.stringify({
      triggerType: 'rune_combo',
      colorSequence: ['黑', '红', '白', '蓝', '紫'],
      slotCount: 5,
      positionScope: ['helmet', 'necklace', 'weapon', 'armor', 'belt', 'shoes'],
      school: ['龙宫'],
      roleType: ['法师'],
    }),
    conflictPolicy: 'take_max',
    limitPolicyJson: JSON.stringify({
      globalMaxActive: 1,
      sameRuleConflict: 'take_max',
      sameSkillConflict: 'take_max',
    }),
    sort: 70,
    enabled: true,
  },
];

function buildInsertRuleVersionSql() {
  return `
INSERT OR REPLACE INTO rule_version (
  id, rule_domain, version_code, version_name, status, is_active,
  source_doc_url, notes, created_by, published_by, published_at, created_at, updated_at
) VALUES (
  ${sqlString(RULE_VERSION_ID)},
  'damage',
  ${sqlString(RULE_VERSION_CODE)},
  ${sqlString('龙宫法师-龙卷雨击/龙腾-v1')},
  'published',
  1,
  ${sqlString(SOURCE_DOC_URL)},
  ${sqlString('Initial seeded damage rules for 龙宫法师 / 龙卷雨击 / 龙腾.')},
  'system',
  'system',
  CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER),
  CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER),
  CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
);
`.trim();
}

function buildInsertAttributeConversionSql() {
  const values = attributeConversions
    .map(
      (row) => `(
  ${sqlString(row.id)},
  ${sqlString(row.versionId!)},
  ${sqlString(row.school!)},
  ${sqlString(row.roleType!)},
  ${sqlString(row.sourceAttr!)},
  ${sqlString(row.targetAttr!)},
  ${row.coefficient},
  ${sqlString(row.valueType || 'linear')},
  ${sqlString(row.conditionJson || '{}')},
  ${row.sort || 0},
  ${sqlBool(row.enabled ?? true)},
  CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER),
  CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
)`
    )
    .join(',\n');

  return `
INSERT OR REPLACE INTO rule_attribute_conversion (
  id, version_id, school, role_type, source_attr, target_attr, coefficient,
  value_type, condition_json, sort, enabled, created_at, updated_at
) VALUES
${values};
`.trim();
}

function buildInsertSkillFormulaSql() {
  const values = skillFormulas
    .map(
      (row) => `(
  ${sqlString(row.id)},
  ${sqlString(row.versionId!)},
  ${sqlString(row.school!)},
  ${sqlString(row.roleType!)},
  ${sqlString(row.skillCode!)},
  ${sqlString(row.skillName!)},
  ${sqlString(row.formulaKey!)},
  ${sqlString(row.baseFormulaJson || '{}')},
  ${sqlString(row.extraFormulaJson || '{}')},
  ${sqlString(row.conditionJson || '{}')},
  ${row.sort || 0},
  ${sqlBool(row.enabled ?? true)},
  CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER),
  CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
)`
    )
    .join(',\n');

  return `
INSERT OR REPLACE INTO rule_skill_formula (
  id, version_id, school, role_type, skill_code, skill_name, formula_key,
  base_formula_json, extra_formula_json, condition_json, sort, enabled, created_at, updated_at
) VALUES
${values};
`.trim();
}

function buildInsertDamageModifierSql() {
  const values = damageModifiers
    .map(
      (row) => `(
  ${sqlString(row.id)},
  ${sqlString(row.versionId!)},
  ${sqlString(row.modifierDomain!)},
  ${sqlString(row.modifierKey!)},
  ${sqlString(row.modifierType!)},
  ${sqlString(row.sourceKey || '')},
  ${sqlString(row.targetKey || '')},
  ${row.value ?? 0},
  ${sqlString(row.valueJson || '{}')},
  ${sqlString(row.conditionJson || '{}')},
  ${row.sort || 0},
  ${sqlBool(row.enabled ?? true)},
  CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER),
  CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
)`
    )
    .join(',\n');

  return `
INSERT OR REPLACE INTO rule_damage_modifier (
  id, version_id, modifier_domain, modifier_key, modifier_type, source_key, target_key,
  value, value_json, condition_json, sort, enabled, created_at, updated_at
) VALUES
${values};
`.trim();
}

function buildInsertSkillBonusSql() {
  const values = skillBonuses
    .map(
      (row) => `(
  ${sqlString(row.id)},
  ${sqlString(row.versionId!)},
  ${sqlString(row.bonusGroup!)},
  ${sqlString(row.ruleCode!)},
  ${sqlString(row.skillCode!)},
  ${sqlString(row.skillName!)},
  ${sqlString(row.bonusType || 'skill_level')},
  ${row.bonusValue ?? 0},
  ${sqlString(row.conditionJson || '{}')},
  ${sqlString(row.conflictPolicy || 'take_max')},
  ${sqlString(row.limitPolicyJson || '{}')},
  ${row.sort || 0},
  ${sqlBool(row.enabled ?? true)},
  CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER),
  CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
)`
    )
    .join(',\n');

  return `
INSERT OR REPLACE INTO rule_skill_bonus (
  id, version_id, bonus_group, rule_code, skill_code, skill_name, bonus_type,
  bonus_value, condition_json, conflict_policy, limit_policy_json, sort, enabled, created_at, updated_at
) VALUES
${values};
`.trim();
}

function buildInsertPublishLogSql() {
  return `
INSERT OR REPLACE INTO rule_publish_log (
  id, version_id, action, operator_id, before_snapshot_json, after_snapshot_json, notes, created_at
) VALUES (
  ${sqlString('rpl_damage_v1_initial_publish')},
  ${sqlString(RULE_VERSION_ID)},
  'publish',
  'system',
  '{}',
  ${sqlString(
    JSON.stringify({
      versionCode: RULE_VERSION_CODE,
      seededAt: 'initial',
      counts: {
        attributeConversions: attributeConversions.length,
        skillFormulas: skillFormulas.length,
        damageModifiers: damageModifiers.length,
        skillBonuses: skillBonuses.length,
      },
    })
  )},
  ${sqlString('Initial publish of damage_v1 seed data with 龙卷雨击 / 龙腾.')},
  CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
);
`.trim();
}

function buildSeedSql() {
  return [
    buildInsertRuleVersionSql(),
    buildInsertAttributeConversionSql(),
    buildInsertSkillFormulaSql(),
    buildInsertDamageModifierSql(),
    buildInsertSkillBonusSql(),
    buildInsertPublishLogSql(),
  ].join('\n\n');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const sql = buildSeedSql();

  console.log(
    `[Init Damage Rules] Target database: ${options.dbName} (${options.remote ? 'remote' : 'local'})`
  );
  console.log(
    `[Init Damage Rules] Seeding rule version ${RULE_VERSION_CODE} into D1...`
  );

  const output = runWranglerSql(sql, options);
  console.log(output);

  console.log('[Init Damage Rules] Success.');
}

main();
