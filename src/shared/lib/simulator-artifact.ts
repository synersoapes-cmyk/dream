import type { Treasure } from '@/features/simulator/store/gameTypes';

export const SIMULATOR_ARTIFACT_STAT_OPTIONS = [
  { key: 'damage', label: '伤害' },
  { key: 'magicDamage', label: '法术伤害' },
  { key: 'magicCritLevel', label: '法术暴击等级' },
  { key: 'speed', label: '速度' },
  { key: 'hit', label: '命中' },
  { key: 'fixedDamage', label: '法术伤害结果' },
  { key: 'pierceLevel', label: '穿刺等级' },
  { key: 'magicDefense', label: '法术防御' },
  { key: 'defense', label: '物理防御' },
  { key: 'hp', label: '气血' },
  { key: 'magic', label: '魔法' },
] as const;

export type SimulatorArtifactStatKey =
  (typeof SIMULATOR_ARTIFACT_STAT_OPTIONS)[number]['key'];

export type SimulatorArtifactConfig = {
  name: string;
  statKey: SimulatorArtifactStatKey;
  value: number;
  description?: string;
  isActive: boolean;
};

export const SIMULATOR_ARTIFACT_PRESETS: SimulatorArtifactConfig[] = [
  {
    name: '阳玉法伤',
    statKey: 'magicDamage',
    value: 24,
    description: '龙宫通用法伤模板，适合先看面板和总伤变化。',
    isActive: true,
  },
  {
    name: '阳玉法结',
    statKey: 'fixedDamage',
    value: 20,
    description: '偏稳定收益，分灵衰减下仍能保持结果加成。',
    isActive: true,
  },
  {
    name: '阳玉法暴',
    statKey: 'magicCritLevel',
    value: 38,
    description: '适合爆发向试伤，便于比较法暴档位收益。',
    isActive: true,
  },
  {
    name: '阳玉速度',
    statKey: 'speed',
    value: 26,
    description: '抢速度模板，便于比较先手线和面板波动。',
    isActive: true,
  },
  {
    name: '阳玉穿刺',
    statKey: 'pierceLevel',
    value: 18,
    description: '用于测试穿刺向收益和高法防目标表现。',
    isActive: true,
  },
] as const;

const ARTIFACT_RUNTIME_STAT_KEY_MAP: Record<
  SimulatorArtifactStatKey,
  string
> = {
  damage: 'damage',
  magicDamage: 'magicDamage',
  magicCritLevel: 'magicCritLevel',
  speed: 'speed',
  hit: 'hit',
  fixedDamage: 'magicResult',
  pierceLevel: 'pierceLevel',
  magicDefense: 'magicDefense',
  defense: 'defense',
  hp: 'hp',
  magic: 'magic',
};

const RUNTIME_STAT_TO_ARTIFACT_KEY = Object.fromEntries(
  Object.entries(ARTIFACT_RUNTIME_STAT_KEY_MAP).map(([artifactKey, runtimeKey]) => [
    runtimeKey,
    artifactKey,
  ])
) as Record<string, SimulatorArtifactStatKey>;

export function isSimulatorArtifactStatKey(
  value: unknown
): value is SimulatorArtifactStatKey {
  return SIMULATOR_ARTIFACT_STAT_OPTIONS.some((item) => item.key === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : fallback;
}

function sanitizeOptionalText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : undefined;
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getSimulatorArtifactStatLabel(
  value: SimulatorArtifactStatKey
) {
  return (
    SIMULATOR_ARTIFACT_STAT_OPTIONS.find((item) => item.key === value)?.label ??
    value
  );
}

export function getSimulatorArtifactRuntimeStatKey(
  value: SimulatorArtifactStatKey
) {
  return ARTIFACT_RUNTIME_STAT_KEY_MAP[value];
}

export function sanitizeSimulatorArtifactConfig(
  value: unknown
): SimulatorArtifactConfig | null {
  if (!isRecord(value)) {
    return null;
  }

  const statKey = isSimulatorArtifactStatKey(value.statKey)
    ? value.statKey
    : null;

  if (!statKey) {
    return null;
  }

  return {
    name: sanitizeText(value.name, '神器加成', 24),
    statKey,
    value: toFiniteNumber(value.value, 0),
    description: sanitizeOptionalText(value.description, 120),
    isActive: value.isActive !== false,
  };
}

export function buildSimulatorArtifactTreasure(
  value: SimulatorArtifactConfig | null
): Treasure | null {
  if (!value) {
    return null;
  }

  const runtimeKey = getSimulatorArtifactRuntimeStatKey(value.statKey);

  return {
    id: 'artifact_manual_bonus',
    name: value.name,
    type: '法宝',
    level: 0,
    tier: 1,
    stats: {
      [runtimeKey]: value.value,
    },
    description:
      value.description ??
      `${getSimulatorArtifactStatLabel(value.statKey)} ${
        value.value >= 0 ? '+' : ''
      }${value.value}`,
    isActive: value.isActive,
  };
}

export function buildSimulatorArtifactConfigFromTreasure(
  value: unknown
): SimulatorArtifactConfig | null {
  if (!isRecord(value)) {
    return null;
  }

  const stats = isRecord(value.stats) ? value.stats : {};
  const matchedEntry = Object.entries(stats).find(([key, rawValue]) => {
    const statKey = RUNTIME_STAT_TO_ARTIFACT_KEY[key];
    return Boolean(statKey) && Number.isFinite(Number(rawValue));
  });

  if (!matchedEntry) {
    return null;
  }

  const [runtimeKey, rawValue] = matchedEntry;
  const statKey = RUNTIME_STAT_TO_ARTIFACT_KEY[runtimeKey];

  if (!statKey) {
    return null;
  }

  return {
    name: sanitizeText(value.name, '神器加成', 24),
    statKey,
    value: toFiniteNumber(rawValue, 0),
    description: sanitizeOptionalText(value.description, 120),
    isActive: value.isActive !== false,
  };
}

export function buildSimulatorArtifactSummary(
  artifact: Pick<
    SimulatorArtifactConfig,
    'statKey' | 'value' | 'description' | 'isActive'
  > | null
) {
  if (!artifact) {
    return '未配置神器加成';
  }

  const label = getSimulatorArtifactStatLabel(artifact.statKey);
  const valueText = `${label} ${artifact.value >= 0 ? '+' : ''}${artifact.value}`;
  const statusText = artifact.isActive ? '已生效' : '未启用';

  if (artifact.description && artifact.description.trim().length > 0) {
    return `${valueText} · ${statusText} · ${artifact.description.trim()}`;
  }

  return `${valueText} · ${statusText}`;
}

export function buildSimulatorArtifactSpotlightTags(
  artifact: Pick<
    SimulatorArtifactConfig,
    'statKey' | 'value' | 'description' | 'isActive'
  > | null
) {
  if (!artifact) {
    return [];
  }

  const tags = [
    `${getSimulatorArtifactStatLabel(artifact.statKey)} ${
      artifact.value >= 0 ? '+' : ''
    }${artifact.value}`,
    artifact.isActive ? '当前已生效' : '当前未启用',
  ];

  if (artifact.description && artifact.description.trim().length > 0) {
    tags.push(artifact.description.trim());
  }

  return tags;
}
