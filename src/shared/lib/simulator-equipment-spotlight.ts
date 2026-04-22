import type { Equipment } from '@/features/simulator/store/gameTypes';

type SpotlightTag = {
  label: string;
  priority: number;
};

const HIGH_VALUE_KEYWORDS = [
  '无级别',
  '简易',
  '愤怒',
  '永不磨损',
  '神佑',
  '精致',
  '罗汉',
  '晶清',
  '四海',
  '慈航',
  '琴音',
  '流云',
  '凝滞',
  '笑里',
  '野兽',
  '放下',
  '破血',
  '破碎',
];

const STAT_SPOTLIGHT_ORDER: Array<{
  key: keyof Equipment['stats'];
  label: string;
  priority: number;
}> = [
  { key: 'magicDamage', label: '法伤', priority: 82 },
  { key: 'damage', label: '伤害', priority: 80 },
  { key: 'speed', label: '速度', priority: 78 },
  { key: 'magicResult', label: '法结', priority: 76 },
  { key: 'magicCritLevel', label: '法暴', priority: 74 },
  { key: 'magicDefense', label: '法防', priority: 68 },
  { key: 'defense', label: '防御', priority: 66 },
  { key: 'hp', label: '气血', priority: 64 },
  { key: 'hit', label: '命中', priority: 62 },
];

const BASE_ATTRIBUTE_LABELS = [
  { key: 'magicPower', label: '魔力' },
  { key: 'endurance', label: '耐力' },
  { key: 'agility', label: '敏捷' },
  { key: 'physique', label: '体质' },
  { key: 'strength', label: '力量' },
] as const;

function normalizeText(value?: string) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getKeywordPriority(value: string, fallback: number) {
  return HIGH_VALUE_KEYWORDS.some((keyword) => value.includes(keyword))
    ? 100
    : fallback;
}

function pushTag(
  tags: SpotlightTag[],
  seen: Set<string>,
  value: string | undefined,
  priority: number
) {
  const normalized = normalizeText(value);
  if (!normalized || seen.has(normalized)) {
    return;
  }

  seen.add(normalized);
  tags.push({
    label: normalized,
    priority: getKeywordPriority(normalized, priority),
  });
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function pushStructuredStatTags(
  tags: SpotlightTag[],
  seen: Set<string>,
  stats: Equipment['stats'] | undefined
) {
  if (!stats) {
    return;
  }

  for (const rule of STAT_SPOTLIGHT_ORDER) {
    const value = stats[rule.key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) {
      continue;
    }

    pushTag(tags, seen, `${rule.label} +${formatNumber(value)}`, rule.priority);
  }
}

function parseBaseAttributeTotals(text?: string) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return [] as Array<{ label: string; value: number }>;
  }

  return BASE_ATTRIBUTE_LABELS.map((attr) => {
    const pattern = new RegExp(
      `(?:${attr.label}\\s*([+-]?\\d+(?:\\.\\d+)?))|(?:([+-]?\\d+(?:\\.\\d+)?)${attr.label})`,
      'g'
    );
    let total = 0;

    for (const match of normalized.matchAll(pattern)) {
      const value = Number(match[1] ?? match[2]);
      if (Number.isFinite(value) && value !== 0) {
        total += value;
      }
    }

    return total !== 0
      ? {
          label: attr.label,
          value: total,
        }
      : null;
  }).filter((item): item is NonNullable<typeof item> => item !== null);
}

function pushExtraAttributeTag(
  tags: SpotlightTag[],
  seen: Set<string>,
  text?: string,
  priorityOffset = 0
) {
  const attrs = parseBaseAttributeTotals(text);
  if (attrs.length === 0) {
    return;
  }

  const label =
    attrs.length >= 2
      ? `双加 ${attrs
          .slice(0, 2)
          .map((item) => `${item.label}${item.value > 0 ? '+' : ''}${formatNumber(item.value)}`)
          .join(' ')}`
      : `单加 ${attrs[0].label}${attrs[0].value > 0 ? '+' : ''}${formatNumber(
          attrs[0].value
        )}`;

  pushTag(
    tags,
    seen,
    label,
    (attrs.length >= 2 ? 88 : 58) + priorityOffset
  );
}

function pushTextStatTags(
  tags: SpotlightTag[],
  seen: Set<string>,
  text?: string
) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return;
  }

  const rules = [
    { label: '法伤', pattern: /(?:法术伤害|法伤)\s*[+＋]?\s*(\d+(?:\.\d+)?)/, priority: 82 },
    { label: '伤害', pattern: /(?<!法术)伤害\s*[+＋]?\s*(\d+(?:\.\d+)?)/, priority: 80 },
    { label: '速度', pattern: /速度\s*[+＋]?\s*(\d+(?:\.\d+)?)/, priority: 78 },
    { label: '法结', pattern: /(?:法术伤害结果|法结)\s*[+＋]?\s*(\d+(?:\.\d+)?)/, priority: 76 },
    { label: '法暴', pattern: /(?:法术暴击等级|法暴)\s*[+＋]?\s*(\d+(?:\.\d+)?)/, priority: 74 },
    { label: '防御', pattern: /防御\s*[+＋]?\s*(\d+(?:\.\d+)?)/, priority: 66 },
    { label: '气血', pattern: /气血\s*[+＋]?\s*(\d+(?:\.\d+)?)/, priority: 64 },
  ];

  for (const rule of rules) {
    const match = normalized.match(rule.pattern);
    if (!match?.[1]) {
      continue;
    }

    pushTag(tags, seen, `${rule.label} +${match[1]}`, rule.priority);
  }
}

export function getEquipmentSpotlightTags(equipment: Equipment): string[] {
  const tags: SpotlightTag[] = [];
  const seen = new Set<string>();

  equipment.highlights?.forEach((item) =>
    pushTag(tags, seen, item, getKeywordPriority(item, 72))
  );

  pushTextStatTags(tags, seen, equipment.mainStat);
  pushStructuredStatTags(tags, seen, equipment.stats);
  pushStructuredStatTags(tags, seen, equipment.baseStats);
  pushExtraAttributeTag(tags, seen, equipment.extraStat, 0);
  pushExtraAttributeTag(tags, seen, equipment.refinementEffect, -30);

  pushTag(
    tags,
    seen,
    equipment.specialEffect ? `特效 ${equipment.specialEffect}` : undefined,
    96
  );
  pushTag(
    tags,
    seen,
    equipment.runeSetEffect ? `符石套装 ${equipment.runeSetEffect}` : undefined,
    70
  );
  pushTag(
    tags,
    seen,
    equipment.setName ? `套装 ${equipment.setName}` : undefined,
    69
  );
  pushTag(
    tags,
    seen,
    equipment.luckyHoles ? `开孔 ${equipment.luckyHoles}` : undefined,
    52
  );
  pushTag(
    tags,
    seen,
    equipment.repairFailCount !== undefined
      ? `修理失败 ${equipment.repairFailCount}`
      : undefined,
    equipment.repairFailCount === 0 ? 54 : 46
  );
  pushTag(
    tags,
    seen,
    equipment.gemstone ? `宝石 ${equipment.gemstone}` : undefined,
    56
  );
  pushTag(
    tags,
    seen,
    equipment.element ? `五行 ${equipment.element}` : undefined,
    32
  );

  return tags
    .sort((left, right) => right.priority - left.priority)
    .map((item) => item.label);
}
