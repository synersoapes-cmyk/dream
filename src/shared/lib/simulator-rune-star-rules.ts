import type {
  Equipment,
  RuneStone,
  StarPositionConfig,
} from '@/features/simulator/store/gameTypes';

import { normalizeRuneColor } from '@/shared/lib/simulator-equipment-meta';

type JsonRecord = Record<string, unknown>;

export type SimulatorRuneStoneRule = {
  id: string;
  name: string;
  color: string;
  level: number;
  stats: Record<string, number>;
};

export type SimulatorRuneComboTierRule = {
  tier: number;
  colors: string[];
  bonusValue?: number;
};

export type SimulatorRuneComboRule = {
  id: string;
  name: string;
  aliases?: string[];
  school?: string;
  targetSkillName?: string;
  description?: string;
  allowedSlots: Equipment['type'][];
  tiers: SimulatorRuneComboTierRule[];
  effectType?: 'skill_level' | 'panel_spirit' | 'panel_stat' | 'none';
  effectLabel?: string;
  targetKey?: string;
  maxActive?: number;
  optimizerEligible?: boolean;
};

export type SimulatorStarStoneRule = {
  id: string;
  name: string;
  starType: string;
  attrType: string;
  attrValue: number;
  colors: string[];
  yinYangState?: string;
};

export type SimulatorStarFullColorRule = {
  color: string;
  label: string;
  targetKey: string;
  value: number;
  bonusType: 'panel_stat' | 'attribute_source';
};

export type SimulatorRuneOptimizerProfile = {
  key: string;
  label: string;
  school: string;
  targetMetric: 'longgong_total_damage';
  defaultComboBySlot: Partial<Record<Equipment['type'], string>>;
  statWeights: Record<string, number>;
};

export type SimulatorRuneRecommendation = {
  comboName: string;
  tier: number | null;
  estimatedScore: number;
  expectedDeltaLabel: string;
  reason: string;
  runeStoneSet: RuneStone[];
  luckyHoles: string;
};

const PRIMARY_EQUIPMENT_SLOTS: Equipment['type'][] = [
  'weapon',
  'helmet',
  'necklace',
  'armor',
  'belt',
  'shoes',
];

const RUNE_TYPE_BY_COLOR: Record<string, RuneStone['type']> = {
  红: 'red',
  蓝: 'blue',
  黄: 'yellow',
  绿: 'green',
  紫: 'purple',
  黑: 'black',
  白: 'white',
};

const STAT_LABELS: Record<string, string> = {
  physique: '体质',
  magic: '魔力',
  strength: '力量',
  endurance: '耐力',
  agility: '敏捷',
  hp: '气血',
  magicPower: '灵力',
  spirit: '灵力',
  magicDamage: '法伤',
  spellDamageLevel: '法术伤害等级',
  magicDefense: '法防',
  damage: '伤害',
  defense: '防御',
  speed: '速度',
  hit: '命中',
  dodge: '躲避',
};

const STAT_KEY_ALIAS: Record<string, string> = {
  体质: 'physique',
  魔力: 'magic',
  力量: 'strength',
  耐力: 'endurance',
  敏捷: 'agility',
  气血: 'hp',
  魔法: 'magic',
  灵力: 'magicPower',
  法术伤害: 'magicDamage',
  法伤: 'magicDamage',
  法术伤害等级: 'spellDamageLevel',
  法伤等级: 'spellDamageLevel',
  法术防御: 'magicDefense',
  法防: 'magicDefense',
  伤害: 'damage',
  防御: 'defense',
  速度: 'speed',
  命中: 'hit',
  躲避: 'dodge',
};

const DEFAULT_STAR_COLORS = ['红', '黄', '蓝', '绿', '白', '黑', '紫'];
const LEGACY_RUNE_SET_OPTIONS = [
  '招云',
  '腾蛟',
  '全能',
  '法门',
  '逐兽',
  '聚焦',
  '仙骨',
  '药香',
  '心印',
];

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeStatPayload(value: unknown) {
  if (!isRecord(value)) {
    return {};
  }

  const entries = Object.entries(value)
    .map(([key, rawValue]) => [key, toFiniteNumber(rawValue, Number.NaN)] as const)
    .filter((entry): entry is [string, number] => Number.isFinite(entry[1]));

  return Object.fromEntries(entries);
}

function buildStatPayload(
  entries: Array<[string, number]>
): Record<string, number> {
  return Object.fromEntries(
    entries
      .map(([label, value]) => [STAT_KEY_ALIAS[label] ?? label, value] as const)
      .filter((entry) => Number.isFinite(entry[1]))
  );
}

function buildStatSummary(stats: Record<string, number>) {
  return Object.entries(stats)
    .map(([key, value]) => `${STAT_LABELS[key] ?? key} +${value}`)
    .join(' ');
}

function createRuneRule(params: {
  id: string;
  name?: string;
  color: string;
  level: number;
  stats: Array<[string, number]>;
}) {
  const payload = buildStatPayload(params.stats);
  return {
    id: params.id,
    name:
      params.name ||
      `${params.color}符石·${params.stats
        .map(([label, value]) => `${label}+${value}`)
        .join(' / ')}`,
    color: params.color,
    level: params.level,
    stats: payload,
  } satisfies SimulatorRuneStoneRule;
}

function createComboRule(
  rule: SimulatorRuneComboRule
): SimulatorRuneComboRule {
  return rule;
}

export const DEFAULT_PRD_RUNE_STONE_RULES: SimulatorRuneStoneRule[] = [
  createRuneRule({ id: 'rune-red-ice', name: '冰符石', color: '红', level: 1, stats: [['体质', 1]] }),
  createRuneRule({ id: 'rune-red-fire', name: '火符石', color: '红', level: 1, stats: [['力量', 1]] }),
  createRuneRule({ id: 'rune-red-earth', name: '土符石', color: '红', level: 1, stats: [['耐力', 1]] }),
  createRuneRule({ id: 'rune-yellow-thunder', name: '雷符石', color: '黄', level: 1, stats: [['敏捷', 1]] }),
  createRuneRule({ id: 'rune-yellow-wind', name: '风符石', color: '黄', level: 1, stats: [['魔力', 1]] }),
  createRuneRule({ id: 'rune-yellow-cloud', name: '云符石', color: '黄', level: 1, stats: [['法术防御', 2]] }),
  createRuneRule({ id: 'rune-red-water', name: '水符石', color: '红', level: 1, stats: [['法术伤害', 2]] }),

  createRuneRule({ id: 'rune-blue-1', color: '蓝', level: 2, stats: [['体质', 1], ['躲避', 4]] }),
  createRuneRule({ id: 'rune-blue-2', color: '蓝', level: 2, stats: [['力量', 1], ['命中', 4]] }),
  createRuneRule({ id: 'rune-blue-3', color: '蓝', level: 2, stats: [['魔力', 1], ['灵力', 1.5]] }),
  createRuneRule({ id: 'rune-blue-4', color: '蓝', level: 2, stats: [['耐力', 1], ['防御', 3]] }),
  createRuneRule({ id: 'rune-blue-5', color: '蓝', level: 2, stats: [['敏捷', 1], ['速度', 1.5]] }),
  createRuneRule({ id: 'rune-blue-6', color: '蓝', level: 2, stats: [['法伤', 2], ['法防', 2]] }),
  createRuneRule({ id: 'rune-blue-7', color: '蓝', level: 2, stats: [['法防', 2], ['气血', 10]] }),

  createRuneRule({ id: 'rune-green-1', color: '绿', level: 2, stats: [['体质', 1], ['伤害', 1.5]] }),
  createRuneRule({ id: 'rune-green-2', color: '绿', level: 2, stats: [['力量', 1], ['气血', 10]] }),
  createRuneRule({ id: 'rune-green-3', color: '绿', level: 2, stats: [['魔力', 1], ['法伤', 2]] }),
  createRuneRule({ id: 'rune-green-4', color: '绿', level: 2, stats: [['耐力', 1], ['气血', 10]] }),
  createRuneRule({ id: 'rune-green-5', color: '绿', level: 2, stats: [['敏捷', 1], ['躲避', 6]] }),
  createRuneRule({ id: 'rune-green-6', color: '绿', level: 2, stats: [['法伤', 2], ['速度', 1.5]] }),
  createRuneRule({ id: 'rune-green-7', color: '绿', level: 2, stats: [['法伤', 2], ['魔法', 15]] }),

  createRuneRule({ id: 'rune-black-1', color: '黑', level: 2, stats: [['体质', 1], ['速度', 1.5]] }),
  createRuneRule({ id: 'rune-black-2', color: '黑', level: 2, stats: [['力量', 1], ['速度', 1.5]] }),
  createRuneRule({ id: 'rune-black-3', color: '黑', level: 2, stats: [['魔力', 1], ['速度', 1.5]] }),
  createRuneRule({ id: 'rune-black-4', color: '黑', level: 2, stats: [['耐力', 1], ['速度', 1.5]] }),
  createRuneRule({ id: 'rune-black-5', color: '黑', level: 2, stats: [['敏捷', 1], ['法防', 2]] }),
  createRuneRule({ id: 'rune-black-6', color: '黑', level: 2, stats: [['速度', 1.5], ['躲避', 4]] }),
  createRuneRule({ id: 'rune-black-7', color: '黑', level: 2, stats: [['速度', 1.5], ['命中', 4]] }),

  createRuneRule({ id: 'rune-white-1', color: '白', level: 3, stats: [['体质', 2], ['躲避', 6]] }),
  createRuneRule({ id: 'rune-white-2', color: '白', level: 3, stats: [['力量', 2], ['命中', 6]] }),
  createRuneRule({ id: 'rune-white-3', color: '白', level: 3, stats: [['魔力', 2], ['灵力', 2]] }),
  createRuneRule({ id: 'rune-white-4', color: '白', level: 3, stats: [['耐力', 2], ['防御', 4]] }),
  createRuneRule({ id: 'rune-white-5', color: '白', level: 3, stats: [['敏捷', 2], ['速度', 1.5]] }),
  createRuneRule({ id: 'rune-white-6', color: '白', level: 3, stats: [['气血', 15], ['速度', 1.5]] }),
  createRuneRule({ id: 'rune-white-7', color: '白', level: 3, stats: [['法伤', 2], ['法防', 3]] }),

  createRuneRule({ id: 'rune-purple-1', color: '紫', level: 3, stats: [['躲避', 6], ['气血', 15]] }),
  createRuneRule({ id: 'rune-purple-2', color: '紫', level: 3, stats: [['命中', 6], ['伤害', 2]] }),
  createRuneRule({ id: 'rune-purple-3', color: '紫', level: 3, stats: [['灵力', 2], ['魔法', 20]] }),
  createRuneRule({ id: 'rune-purple-4', color: '紫', level: 3, stats: [['防御', 4], ['气血', 15]] }),
  createRuneRule({ id: 'rune-purple-5', color: '紫', level: 3, stats: [['速度', 1.5], ['躲避', 6]] }),
  createRuneRule({ id: 'rune-purple-6', color: '紫', level: 3, stats: [['法防', 3], ['气血', 15]] }),
  createRuneRule({ id: 'rune-purple-7', color: '紫', level: 3, stats: [['气血', 15], ['魔法', 20]] }),
];

export const DEFAULT_PRD_STAR_STONE_RULES: SimulatorStarStoneRule[] = [
  { id: 'star-sun-3', name: '太阳星石', starType: 'sun', attrType: 'damage', attrValue: 3, colors: DEFAULT_STAR_COLORS, yinYangState: 'yang' },
  { id: 'star-sun-4', name: '太阳星石', starType: 'sun', attrType: 'damage', attrValue: 4, colors: DEFAULT_STAR_COLORS, yinYangState: 'yang' },
  { id: 'star-lesser-sun-3', name: '少阳星石', starType: 'lesser_sun', attrType: 'defense', attrValue: 3, colors: DEFAULT_STAR_COLORS, yinYangState: 'yin' },
  { id: 'star-lesser-sun-4', name: '少阳星石', starType: 'lesser_sun', attrType: 'defense', attrValue: 4, colors: DEFAULT_STAR_COLORS, yinYangState: 'yin' },
  { id: 'star-moon-15', name: '太阴星石', starType: 'moon', attrType: 'hp', attrValue: 15, colors: DEFAULT_STAR_COLORS, yinYangState: 'yin' },
  { id: 'star-moon-20', name: '太阴星石', starType: 'moon', attrType: 'hp', attrValue: 20, colors: DEFAULT_STAR_COLORS, yinYangState: 'yin' },
  { id: 'star-lesser-moon-2', name: '少阴星石', starType: 'lesser_moon', attrType: 'magicDamage', attrValue: 2, colors: DEFAULT_STAR_COLORS, yinYangState: 'yang' },
  { id: 'star-lesser-moon-3', name: '少阴星石', starType: 'lesser_moon', attrType: 'magicDamage', attrValue: 3, colors: DEFAULT_STAR_COLORS, yinYangState: 'yang' },
  { id: 'star-taiji-2', name: '太极星石', starType: 'taiji', attrType: 'speed', attrValue: 2, colors: DEFAULT_STAR_COLORS, yinYangState: 'yang' },
  { id: 'star-taiji-3', name: '太极星石', starType: 'taiji', attrType: 'speed', attrValue: 3, colors: DEFAULT_STAR_COLORS, yinYangState: 'yang' },
];

export const DEFAULT_PRD_STAR_FULL_COLOR_RULES: SimulatorStarFullColorRule[] = [
  { color: '黑', label: '全套黑色', targetKey: 'speed', value: 10, bonusType: 'panel_stat' },
  { color: '白', label: '全套白色', targetKey: 'defense', value: 20, bonusType: 'panel_stat' },
  { color: '红', label: '全套红色', targetKey: 'physique', value: 10, bonusType: 'attribute_source' },
  { color: '黄', label: '全套黄色', targetKey: 'strength', value: 10, bonusType: 'attribute_source' },
  { color: '蓝', label: '全套蓝色', targetKey: 'magic', value: 10, bonusType: 'attribute_source' },
  { color: '绿', label: '全套绿色', targetKey: 'agility', value: 10, bonusType: 'attribute_source' },
  { color: '紫', label: '全套紫色', targetKey: 'hp', value: 150, bonusType: 'panel_stat' },
];

export const DEFAULT_PRD_RUNE_COMBO_RULES: SimulatorRuneComboRule[] = [
  createComboRule({
    id: 'combo-haishishenlou',
    name: '海市蜃楼',
    aliases: ['九龙诀'],
    school: '龙宫',
    targetSkillName: '九龙诀',
    description: '增加九龙诀技能等级',
    allowedSlots: ['helmet'],
    tiers: [
      { tier: 4, colors: ['白', '红', '黑', '蓝', '黄'], bonusValue: 6 },
      { tier: 4, colors: ['白', '红', '黄', '蓝', '绿'], bonusValue: 6 },
      { tier: 3, colors: ['白', '红', '黑', '蓝'], bonusValue: 4 },
      { tier: 3, colors: ['白', '红', '黄', '蓝'], bonusValue: 4 },
      { tier: 2, colors: ['白', '红', '黑'], bonusValue: 2 },
      { tier: 2, colors: ['白', '红', '黄'], bonusValue: 2 },
    ],
    effectType: 'skill_level',
    effectLabel: '九龙诀技能等级',
    maxActive: 1,
    optimizerEligible: true,
  }),
  createComboRule({
    id: 'combo-hufenghuanyu',
    name: '呼风唤雨',
    school: '龙宫',
    targetSkillName: '呼风唤雨',
    description: '增加呼风唤雨技能等级',
    allowedSlots: ['armor'],
    tiers: [
      { tier: 4, colors: ['黑', '黄', '蓝', '绿', '白'], bonusValue: 6 },
      { tier: 3, colors: ['黑', '黄', '蓝', '绿'], bonusValue: 4 },
      { tier: 2, colors: ['黑', '黄', '蓝'], bonusValue: 2 },
    ],
    effectType: 'skill_level',
    effectLabel: '呼风唤雨技能等级',
    maxActive: 1,
    optimizerEligible: true,
  }),
  createComboRule({
    id: 'combo-geshandaniu',
    name: '隔山打牛',
    description: '法术攻击时有概率临时提升灵力',
    allowedSlots: PRIMARY_EQUIPMENT_SLOTS,
    tiers: [
      { tier: 5, colors: ['白', '红', '紫', '蓝', '黄'], bonusValue: 70 },
      { tier: 4, colors: ['白', '红', '紫', '蓝'], bonusValue: 50 },
      { tier: 3, colors: ['白', '红', '紫'], bonusValue: 30 },
      { tier: 2, colors: ['白', '红'], bonusValue: 20 },
    ],
    effectType: 'panel_spirit',
    effectLabel: '隔山打牛灵力加成',
    maxActive: 2,
    optimizerEligible: true,
  }),
  createComboRule({
    id: 'combo-baibuchuanyang',
    name: '百步穿杨',
    description: '物理攻击时概率追加伤害',
    allowedSlots: PRIMARY_EQUIPMENT_SLOTS,
    tiers: [{ tier: 4, colors: ['黑', '紫', '蓝', '黄', '绿'] }],
    effectType: 'none',
    maxActive: 1,
  }),
  createComboRule({
    id: 'combo-gaoshanliushui',
    name: '高山流水',
    description: '对召唤兽增加法术伤害',
    allowedSlots: PRIMARY_EQUIPMENT_SLOTS,
    tiers: [{ tier: 4, colors: ['白', '紫', '蓝', '白', '红'] }],
    effectType: 'none',
    maxActive: 1,
  }),
  createComboRule({
    id: 'combo-wuxiekeji',
    name: '无懈可击',
    description: '防御增加 18',
    allowedSlots: PRIMARY_EQUIPMENT_SLOTS,
    tiers: [{ tier: 4, colors: ['蓝', '红', '黄', '黑', '紫'], bonusValue: 18 }],
    effectType: 'panel_stat',
    effectLabel: '无懈可击防御加成',
    targetKey: 'defense',
    maxActive: 1,
  }),
  createComboRule({
    id: 'combo-xinsuiwodong',
    name: '心随我动',
    description: '遭受物理攻击时概率减伤',
    allowedSlots: PRIMARY_EQUIPMENT_SLOTS,
    tiers: [{ tier: 4, colors: ['黑', '蓝', '红', '绿', '白'] }],
    effectType: 'none',
    maxActive: 1,
  }),
  createComboRule({
    id: 'combo-tianjiangdaren',
    name: '天降大任',
    description: '无视召唤兽物理防御',
    allowedSlots: PRIMARY_EQUIPMENT_SLOTS,
    tiers: [{ tier: 4, colors: ['黑', '黄', '红', '绿', '紫'] }],
    effectType: 'none',
    maxActive: 1,
  }),
  createComboRule({
    id: 'combo-riluoxishan',
    name: '日落西山',
    description: '提高躲避力',
    allowedSlots: PRIMARY_EQUIPMENT_SLOTS,
    tiers: [{ tier: 4, colors: ['红', '紫', '黄', '黑', '蓝'] }],
    effectType: 'none',
    maxActive: 1,
  }),
  createComboRule({
    id: 'combo-fengjuancanyun',
    name: '风卷残云',
    description: '击杀目标后恢复自身一定气血',
    allowedSlots: PRIMARY_EQUIPMENT_SLOTS,
    tiers: [{ tier: 4, colors: ['黄', '蓝', '白', '黑', '紫'] }],
    effectType: 'none',
    maxActive: 1,
  }),
  createComboRule({
    id: 'combo-polangjue-legacy',
    name: '破浪诀',
    description: '兼容旧数据：增加破浪诀技能等级',
    allowedSlots: ['weapon'],
    tiers: [
      { tier: 4, colors: ['白', '红', '蓝', '黑', '绿'], bonusValue: 6 },
      { tier: 3, colors: ['白', '红', '蓝', '黑'], bonusValue: 4 },
      { tier: 2, colors: ['白', '红', '蓝'], bonusValue: 2 },
    ],
    effectType: 'skill_level',
    effectLabel: '破浪诀技能等级',
    maxActive: 1,
  }),
  createComboRule({
    id: 'combo-nilin-legacy',
    name: '逆鳞',
    description: '兼容旧数据：增加逆鳞技能等级',
    allowedSlots: ['belt'],
    tiers: [
      { tier: 4, colors: ['白', '红', '绿', '紫', '蓝'], bonusValue: 6 },
      { tier: 3, colors: ['白', '红', '绿', '紫'], bonusValue: 4 },
      { tier: 2, colors: ['白', '红', '绿'], bonusValue: 2 },
    ],
    effectType: 'skill_level',
    effectLabel: '逆鳞技能等级',
    maxActive: 1,
  }),
  createComboRule({
    id: 'combo-longteng-legacy',
    name: '龙腾',
    description: '兼容旧数据：增加龙腾技能等级',
    allowedSlots: ['necklace'],
    tiers: [
      { tier: 4, colors: ['黑', '红', '白', '蓝', '紫'], bonusValue: 6 },
      { tier: 3, colors: ['黑', '红', '白', '蓝'], bonusValue: 4 },
      { tier: 2, colors: ['黑', '红', '白'], bonusValue: 2 },
    ],
    effectType: 'skill_level',
    effectLabel: '龙腾技能等级',
    maxActive: 1,
  }),
];

export const DEFAULT_PRD_RUNE_OPTIMIZER_PROFILES: SimulatorRuneOptimizerProfile[] = [
  {
    key: 'longgong_total_damage',
    label: '龙宫总伤',
    school: '龙宫',
    targetMetric: 'longgong_total_damage',
    defaultComboBySlot: {
      helmet: '海市蜃楼',
      armor: '呼风唤雨',
      weapon: '隔山打牛',
      necklace: '隔山打牛',
      belt: '隔山打牛',
      shoes: '隔山打牛',
    },
    statWeights: {
      magicDamage: 100,
      magicPower: 92,
      spirit: 92,
      magic: 45,
      speed: 18,
      magicDefense: 8,
      hp: 0.5,
      damage: 0.2,
      defense: 0.2,
      hit: 0.1,
      dodge: 0.1,
      physique: 10,
      endurance: 6,
      agility: 18,
      strength: 4,
    },
  },
];

function parseRuneStoneRule(value: unknown): SimulatorRuneStoneRule | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const color = normalizeRuneColor(value.color);
  const level = Math.max(1, Math.floor(toFiniteNumber(value.level, 1)));
  const stats = normalizeStatPayload(value.stats);

  if (!id || !name || !color || Object.keys(stats).length === 0) {
    return null;
  }

  return { id, name, color, level, stats };
}

function parseRuneComboTier(value: unknown): SimulatorRuneComboTierRule | null {
  if (!isRecord(value)) {
    return null;
  }

  const tier = Math.max(1, Math.floor(toFiniteNumber(value.tier, 0)));
  const colors = Array.isArray(value.colors)
    ? value.colors
        .map((item) => normalizeRuneColor(item))
        .filter((item): item is string => Boolean(item))
    : [];

  if (!tier || colors.length === 0) {
    return null;
  }

  const bonusValue = Number.isFinite(Number(value.bonusValue))
    ? Number(value.bonusValue)
    : undefined;

  return {
    tier,
    colors,
    ...(bonusValue !== undefined ? { bonusValue } : {}),
  };
}

function parseRuneComboRule(value: unknown): SimulatorRuneComboRule | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const allowedSlots = Array.isArray(value.allowedSlots)
    ? value.allowedSlots.filter(
        (item): item is Equipment['type'] => typeof item === 'string'
      )
    : [];
  const tiers = Array.isArray(value.tiers)
    ? value.tiers
        .map(parseRuneComboTier)
        .filter((item): item is SimulatorRuneComboTierRule => Boolean(item))
        .sort((left, right) => right.colors.length - left.colors.length)
    : [];

  if (!id || !name || allowedSlots.length === 0 || tiers.length === 0) {
    return null;
  }

  return {
    id,
    name,
    aliases: Array.isArray(value.aliases)
      ? value.aliases.filter((item): item is string => typeof item === 'string')
      : undefined,
    school: typeof value.school === 'string' ? value.school.trim() : undefined,
    targetSkillName:
      typeof value.targetSkillName === 'string'
        ? value.targetSkillName.trim()
        : undefined,
    description:
      typeof value.description === 'string' ? value.description.trim() : undefined,
    allowedSlots,
    tiers,
    effectType:
      typeof value.effectType === 'string'
        ? (value.effectType as SimulatorRuneComboRule['effectType'])
        : undefined,
    effectLabel:
      typeof value.effectLabel === 'string'
        ? value.effectLabel.trim()
        : undefined,
    targetKey:
      typeof value.targetKey === 'string' ? value.targetKey.trim() : undefined,
    maxActive: Math.max(1, Math.floor(toFiniteNumber(value.maxActive, 1))),
    optimizerEligible: value.optimizerEligible === true,
  };
}

function parseStarStoneRule(value: unknown): SimulatorStarStoneRule | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const starType =
    typeof value.starType === 'string' ? value.starType.trim() : '';
  const attrType =
    typeof value.attrType === 'string' ? value.attrType.trim() : '';
  const attrValue = toFiniteNumber(value.attrValue, Number.NaN);
  const colors = Array.isArray(value.colors)
    ? value.colors
        .map((item) => normalizeRuneColor(item))
        .filter((item): item is string => Boolean(item))
    : [];

  if (!id || !name || !starType || !attrType || !Number.isFinite(attrValue)) {
    return null;
  }

  return {
    id,
    name,
    starType,
    attrType,
    attrValue,
    colors: colors.length > 0 ? colors : DEFAULT_STAR_COLORS,
    yinYangState:
      typeof value.yinYangState === 'string'
        ? value.yinYangState.trim()
        : undefined,
  };
}

function parseStarFullColorRule(value: unknown): SimulatorStarFullColorRule | null {
  if (!isRecord(value)) {
    return null;
  }

  const color = normalizeRuneColor(value.color);
  const label = typeof value.label === 'string' ? value.label.trim() : '';
  const targetKey =
    typeof value.targetKey === 'string' ? value.targetKey.trim() : '';
  const bonusType =
    value.bonusType === 'attribute_source' ? 'attribute_source' : 'panel_stat';
  const valueNumber = toFiniteNumber(value.value, Number.NaN);

  if (!color || !label || !targetKey || !Number.isFinite(valueNumber)) {
    return null;
  }

  return {
    color,
    label,
    targetKey,
    value: valueNumber,
    bonusType,
  };
}

function parseOptimizerProfile(value: unknown): SimulatorRuneOptimizerProfile | null {
  if (!isRecord(value)) {
    return null;
  }

  const key = typeof value.key === 'string' ? value.key.trim() : '';
  const label = typeof value.label === 'string' ? value.label.trim() : '';
  const school = typeof value.school === 'string' ? value.school.trim() : '';
  const defaultComboBySlot = isRecord(value.defaultComboBySlot)
    ? Object.fromEntries(
        Object.entries(value.defaultComboBySlot)
          .filter((entry): entry is [Equipment['type'], string] => typeof entry[0] === 'string' && typeof entry[1] === 'string')
          .map(([slot, comboName]) => [slot, comboName.trim()])
      )
    : {};
  const statWeights = isRecord(value.statWeights)
    ? Object.fromEntries(
        Object.entries(value.statWeights)
          .map(([statKey, rawValue]) => [statKey, toFiniteNumber(rawValue, Number.NaN)] as const)
          .filter((entry): entry is [string, number] => Number.isFinite(entry[1]))
      )
    : {};

  if (!key || !label || !school) {
    return null;
  }

  return {
    key,
    label,
    school,
    targetMetric: 'longgong_total_damage',
    defaultComboBySlot,
    statWeights,
  };
}

function parseArrayConfig<T>(
  value: unknown,
  parser: (item: unknown) => T | null,
  fallback: T[]
) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const parsed = value.map(parser).filter((item): item is T => Boolean(item));
  return parsed.length > 0 ? parsed : fallback;
}

export function parseRuneStoneRulesConfig(value: unknown) {
  return parseArrayConfig(
    value,
    parseRuneStoneRule,
    DEFAULT_PRD_RUNE_STONE_RULES
  );
}

export function parseRuneComboRulesConfig(value: unknown) {
  return parseArrayConfig(
    value,
    parseRuneComboRule,
    DEFAULT_PRD_RUNE_COMBO_RULES
  );
}

export function parseStarStoneRulesConfig(value: unknown) {
  return parseArrayConfig(
    value,
    parseStarStoneRule,
    DEFAULT_PRD_STAR_STONE_RULES
  );
}

export function parseStarFullColorRulesConfig(value: unknown) {
  return parseArrayConfig(
    value,
    parseStarFullColorRule,
    DEFAULT_PRD_STAR_FULL_COLOR_RULES
  );
}

export function parseRuneOptimizerProfilesConfig(value: unknown) {
  return parseArrayConfig(
    value,
    parseOptimizerProfile,
    DEFAULT_PRD_RUNE_OPTIMIZER_PROFILES
  );
}

function normalizeComboName(value: unknown) {
  return typeof value === 'string'
    ? value.split(/[:：]/)[0]?.trim() ?? ''
    : '';
}

export function findRuneComboRuleByName(
  value: unknown,
  rules = DEFAULT_PRD_RUNE_COMBO_RULES
) {
  const normalized = normalizeComboName(value);
  if (!normalized) {
    return null;
  }

  return (
    rules.find((rule) => {
      if (rule.name === normalized) {
        return true;
      }

      return rule.aliases?.includes(normalized) ?? false;
    }) ?? null
  );
}

export function getRuneComboDisplayName(
  value: unknown,
  rules = DEFAULT_PRD_RUNE_COMBO_RULES
) {
  return findRuneComboRuleByName(value, rules)?.name ?? normalizeComboName(value);
}

function buildRuneStoneFromRule(
  rule: SimulatorRuneStoneRule,
  index: number
): RuneStone {
  return {
    id: `${rule.id}-${index + 1}`,
    name: rule.name,
    type: RUNE_TYPE_BY_COLOR[rule.color] ?? String(rule.color),
    color: rule.color,
    level: rule.level,
    stats: { ...rule.stats },
    description: buildStatSummary(rule.stats),
  };
}

export function getSimulatorRuneStoneOptions(rules = DEFAULT_PRD_RUNE_STONE_RULES) {
  return rules.map((rule, index) => buildRuneStoneFromRule(rule, index));
}

export function getSimulatorStarPositionOptions(
  rules = DEFAULT_PRD_STAR_STONE_RULES
): StarPositionConfig[] {
  const baseOption: StarPositionConfig = {
    id: 'none',
    label: '无',
    attrType: '',
    attrValue: 0,
  };

  return [
    baseOption,
    ...rules.flatMap((rule) =>
      rule.colors.map((color) => ({
        id: `${rule.id}-${color}`,
        label: `${rule.name} · ${color} · ${STAT_LABELS[rule.attrType] ?? rule.attrType} +${rule.attrValue}`,
        attrType: rule.attrType,
        attrValue: rule.attrValue,
        starType: rule.starType,
        color,
        yinYangState: rule.yinYangState,
      }))
    ),
  ];
}

export function getSimulatorRuneSetOptions(
  equipment: Equipment,
  rules = DEFAULT_PRD_RUNE_COMBO_RULES
) {
  const slotOptions = rules
    .filter((rule) => rule.allowedSlots.includes(equipment.type))
    .map((rule) => rule.name);
  const currentNames =
    equipment.runeStoneSetsNames
      ?.filter((item): item is string => typeof item === 'string')
      .map((item) => getRuneComboDisplayName(item, rules))
      .filter(Boolean) ?? [];

  return Array.from(
    new Set([...currentNames, ...slotOptions, ...LEGACY_RUNE_SET_OPTIONS])
  );
}

function scoreStats(
  stats: Record<string, number>,
  profile: SimulatorRuneOptimizerProfile
) {
  return Object.entries(stats).reduce((sum, [statKey, value]) => {
    const weight = profile.statWeights[statKey] ?? 0;
    return sum + weight * value;
  }, 0);
}

function getDefaultOptimizerProfile(
  profiles = DEFAULT_PRD_RUNE_OPTIMIZER_PROFILES
) {
  return (
    profiles.find((profile) => profile.key === 'longgong_total_damage') ??
    profiles[0] ??
    DEFAULT_PRD_RUNE_OPTIMIZER_PROFILES[0]
  );
}

function pickBestRuneRuleByColor(
  color: string,
  rules: SimulatorRuneStoneRule[],
  profile: SimulatorRuneOptimizerProfile
) {
  const candidates = rules.filter((rule) => rule.color === color);
  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((left, right) => {
    const scoreDiff =
      scoreStats(right.stats, profile) - scoreStats(left.stats, profile);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return right.level - left.level;
  })[0] ?? null;
}

function getRecommendedComboRule(
  equipment: Equipment,
  rules: SimulatorRuneComboRule[],
  profiles: SimulatorRuneOptimizerProfile[]
) {
  const profile = getDefaultOptimizerProfile(profiles);
  const explicitComboName =
    typeof equipment.runeStoneSetsNames?.[0] === 'string'
      ? equipment.runeStoneSetsNames[0]
      : '';
  const comboName =
    getRuneComboDisplayName(explicitComboName, rules) ||
    (profile.defaultComboBySlot[equipment.type] ??
      getSimulatorRuneSetOptions(equipment, rules)[0]);

  return findRuneComboRuleByName(comboName, rules);
}

function getRecommendedTier(
  rule: SimulatorRuneComboRule,
  holeCount: number
) {
  return (
    rule.tiers.find((tier) => tier.colors.length <= holeCount) ??
    rule.tiers[rule.tiers.length - 1] ??
    null
  );
}

function toPositiveHoleCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

export function buildSimulatorRecommendedRunePlan(
  equipment: Equipment,
  options?: {
    runeStoneRules?: SimulatorRuneStoneRule[];
    runeComboRules?: SimulatorRuneComboRule[];
    optimizerProfiles?: SimulatorRuneOptimizerProfile[];
  }
): SimulatorRuneRecommendation | null {
  if (!PRIMARY_EQUIPMENT_SLOTS.includes(equipment.type)) {
    return null;
  }

  const runeStoneRules = options?.runeStoneRules ?? DEFAULT_PRD_RUNE_STONE_RULES;
  const runeComboRules = options?.runeComboRules ?? DEFAULT_PRD_RUNE_COMBO_RULES;
  const optimizerProfiles =
    options?.optimizerProfiles ?? DEFAULT_PRD_RUNE_OPTIMIZER_PROFILES;
  const profile = getDefaultOptimizerProfile(optimizerProfiles);
  const comboRule = getRecommendedComboRule(equipment, runeComboRules, optimizerProfiles);

  if (!comboRule) {
    return null;
  }

  const holeCount = Math.max(1, toPositiveHoleCount(equipment.luckyHoles) || 5);
  const recommendedTier = getRecommendedTier(comboRule, holeCount);
  if (!recommendedTier) {
    return null;
  }

  const runeStoneSet = recommendedTier.colors.map((color, index) => {
    const matchedRule =
      pickBestRuneRuleByColor(color, runeStoneRules, profile) ??
      DEFAULT_PRD_RUNE_STONE_RULES.find((rule) => rule.color === color) ??
      DEFAULT_PRD_RUNE_STONE_RULES[0];

    return buildRuneStoneFromRule(matchedRule, index);
  });

  const estimatedScore =
    runeStoneSet.reduce(
      (sum, runeStone) =>
        sum + scoreStats((runeStone.stats ?? {}) as Record<string, number>, profile),
      0
    ) + Number(recommendedTier.bonusValue ?? 0) * 120;

  const tierLabel =
    comboRule.effectType === 'panel_spirit'
      ? `${recommendedTier.tier}级`
      : `${recommendedTier.tier}级`;

  return {
    comboName: comboRule.name,
    tier: recommendedTier.tier,
    estimatedScore,
    expectedDeltaLabel:
      comboRule.effectType === 'skill_level'
        ? `${comboRule.effectLabel || comboRule.name} +${recommendedTier.bonusValue ?? 0}`
        : comboRule.effectType === 'panel_spirit'
          ? `战中灵力期望 +${recommendedTier.bonusValue ?? 0}`
          : '按当前龙宫总伤口径最优',
    reason:
      comboRule.effectType === 'skill_level'
        ? `${comboRule.name} 更直接提升龙宫主链技能收益，优先级高于纯面板增量。`
        : `${comboRule.name} 在当前部位更接近龙宫总伤收益最优解。`,
    runeStoneSet,
    luckyHoles: String(Math.max(holeCount, runeStoneSet.length)),
  };
}

export function applySimulatorRecommendedRunePlan(
  equipment: Equipment,
  recommendation: SimulatorRuneRecommendation
) {
  const next: Equipment = {
    ...equipment,
    luckyHoles: recommendation.luckyHoles,
    runeStoneSets: [
      recommendation.runeStoneSet.map((stone) => ({
        ...stone,
        stats: { ...(stone.stats ?? {}) },
      })),
    ],
    runeStoneSetsNames: [recommendation.comboName],
    activeRuneStoneSet: 0,
  };

  return next;
}

export function shouldAutoApplySimulatorRecommendedRunePlan(equipment: Equipment) {
  const comboName = normalizeComboName(equipment.runeStoneSetsNames?.[0]);
  const activeSet = equipment.runeStoneSets?.[equipment.activeRuneStoneSet ?? 0] ??
    equipment.runeStoneSets?.[0] ??
    [];
  const hasConfiguredRune = activeSet.some(
    (stone) =>
      stone &&
      stone.type !== 'empty' &&
      (Object.keys(stone.stats ?? {}).length > 0 || normalizeRuneColor(stone.type))
  );

  return !comboName && !hasConfiguredRune;
}

export function applySimulatorRuneSetSelection(
  equipment: Equipment,
  setName: string,
  options?: {
    runeStoneRules?: SimulatorRuneStoneRule[];
    runeComboRules?: SimulatorRuneComboRule[];
    optimizerProfiles?: SimulatorRuneOptimizerProfile[];
  }
) {
  const recommendation = buildSimulatorRecommendedRunePlan(
    {
      ...equipment,
      runeStoneSetsNames: [setName],
    },
    options
  );

  if (
    recommendation &&
    getRuneComboDisplayName(setName, options?.runeComboRules) === recommendation.comboName
  ) {
    return applySimulatorRecommendedRunePlan(equipment, recommendation);
  }

  return {
    ...equipment,
    runeStoneSetsNames: [getRuneComboDisplayName(setName, options?.runeComboRules)],
    activeRuneStoneSet: 0,
  };
}

export function findStarPositionOptionByLabel(
  label: string | null | undefined,
  rules = DEFAULT_PRD_STAR_STONE_RULES
) {
  const normalized = String(label || '').trim();
  return (
    getSimulatorStarPositionOptions(rules).find((item) => item.label === normalized) ??
    null
  );
}

export function resolveStarPositionBonusFromConfig(
  config: StarPositionConfig | null | undefined
) {
  if (!config || !config.attrType || !Number.isFinite(Number(config.attrValue))) {
    return null;
  }

  return {
    label: config.label || `${STAT_LABELS[config.attrType] ?? config.attrType} +${config.attrValue}`,
    targetKey: config.attrType,
    value: Number(config.attrValue),
    color: normalizeRuneColor(config.color),
  };
}

function getPrimaryEquipmentForStarBonuses(equipment: Equipment[]) {
  return equipment.filter((item) => PRIMARY_EQUIPMENT_SLOTS.includes(item.type));
}

export function resolveSimulatorStarRuntimeBonuses(
  equipment: Equipment[],
  options?: {
    starFullColorRules?: SimulatorStarFullColorRule[];
  }
) {
  const panelStatBonuses: Record<string, number> = {};
  const attributeSourceBonuses: Record<string, number> = {};
  const starPositionBonuses: Array<{
    equipmentId: string;
    slot: Equipment['type'];
    label: string;
    targetKey: string;
    value: number;
    color: string;
  }> = [];

  const primaryEquipment = getPrimaryEquipmentForStarBonuses(equipment);
  const colors: string[] = [];

  for (const item of primaryEquipment) {
    const starBonus = resolveStarPositionBonusFromConfig(item.starPositionConfig);
    if (!starBonus) {
      continue;
    }

    panelStatBonuses[starBonus.targetKey] =
      (panelStatBonuses[starBonus.targetKey] ?? 0) + starBonus.value;
    starPositionBonuses.push({
      equipmentId: item.id,
      slot: item.type,
      ...starBonus,
      color: starBonus.color ?? '',
    });
    if (starBonus.color) {
      colors.push(starBonus.color);
    }
  }

  const fullColorRules =
    options?.starFullColorRules ?? DEFAULT_PRD_STAR_FULL_COLOR_RULES;
  const fullColorActive =
    primaryEquipment.length === PRIMARY_EQUIPMENT_SLOTS.length &&
    colors.length === PRIMARY_EQUIPMENT_SLOTS.length &&
    colors.every((color) => color === colors[0]);
  const matchedFullColorRule = fullColorActive
    ? fullColorRules.find((rule) => rule.color === colors[0]) ?? null
    : null;

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
    starPositionBonuses,
    fullColorSetRule: matchedFullColorRule,
    fullColorSetActive: Boolean(matchedFullColorRule),
  };
}

export function getTrackedStatContributionFromBonuses(
  key: string,
  bonuses: {
    panelStatBonuses?: Record<string, number>;
    attributeSourceBonuses?: Record<string, number>;
  }
) {
  const panel = bonuses.panelStatBonuses ?? {};
  const attr = bonuses.attributeSourceBonuses ?? {};
  const spiritFromAttributes =
    Number(attr.physique ?? 0) * 0.3 +
    Number(attr.magic ?? 0) * 0.7 +
    Number(attr.strength ?? 0) * 0.4 +
    Number(attr.endurance ?? 0) * 0.2 +
    Number(attr.magicPower ?? 0) +
    Number(attr.spirit ?? 0);

  if (key === 'magicDamage') {
    return (
      spiritFromAttributes +
      Number(panel.magicDamage ?? 0) +
      Number(panel.magicPower ?? 0) +
      Number(panel.spirit ?? 0)
    );
  }

  if (key === 'spiritualPower' || key === 'magicDefense') {
    return (
      spiritFromAttributes +
      Number(panel.magicDefense ?? 0) +
      Number(panel.magicPower ?? 0) +
      Number(panel.spirit ?? 0)
    );
  }

  if (key === 'speed') {
    return (
      Number(attr.physique ?? 0) * 0.1 +
      Number(attr.strength ?? 0) * 0.1 +
      Number(attr.endurance ?? 0) * 0.1 +
      Number(attr.agility ?? 0) * 0.7 +
      Number(panel.speed ?? 0)
    );
  }

  if (key === 'hp') {
    return Number(attr.physique ?? 0) * 4.5 + Number(panel.hp ?? 0);
  }

  if (key === 'hit') {
    return Number(attr.strength ?? 0) * 1.7 + Number(panel.hit ?? 0);
  }

  if (key === 'defense') {
    return Number(panel.defense ?? 0);
  }

  if (key === 'damage') {
    return Number(panel.damage ?? 0);
  }

  if (key === 'dodge') {
    return Number(panel.dodge ?? 0);
  }

  return Number(panel[key] ?? 0);
}
