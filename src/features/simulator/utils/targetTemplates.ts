import { createInitialManualTargets } from '@/features/simulator/store/gameRuntimeSeeds';
import type {
  Dungeon,
  EnemyTarget,
} from '@/features/simulator/store/gameTypes';

export type SimulatorTargetTemplate = {
  id: string;
  sceneType?: string;
  name: string;
  dungeonName: string;
  targetType: string;
  level: number;
  hp: number;
  defense: number;
  magicDefense: number;
  magicDefenseCultivation: number;
  speed: number;
  element: string;
  formation: string;
  notes: string;
  payload?: Record<string, unknown>;
};

const MANUAL_TARGET_DEFAULTS = createInitialManualTargets()[0];

function toNumber(value: unknown, fallback = 0) {
  const parsed =
    typeof value === 'number' && Number.isFinite(value) ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isManualTemplate(template: SimulatorTargetTemplate) {
  return (
    template.sceneType === 'manual' ||
    template.targetType === 'manual'
  );
}

function isBossTemplate(template: SimulatorTargetTemplate) {
  return template.targetType.trim().toLowerCase() === 'boss';
}

function mapDifficulty(level: number): Dungeon['difficulty'] {
  if (level >= 110) return 'nightmare';
  if (level >= 90) return 'hard';
  if (level >= 70) return 'normal';
  return 'easy';
}

export function buildDungeonDatabaseFromTemplates(
  templates: SimulatorTargetTemplate[]
): Dungeon[] {
  const dungeonTemplates = templates.filter(
    (template) => !isManualTemplate(template)
  );

  if (dungeonTemplates.length === 0) {
    return [];
  }

  const groupMap = new Map<string, Dungeon>();

  for (const template of dungeonTemplates) {
    const dungeonName = template.dungeonName || '目标模板';
    const key = dungeonName;
    const existing =
      groupMap.get(key) ??
      {
        id: `tmpl_${groupMap.size + 1}`,
        name: dungeonName,
        level: template.level || 0,
        difficulty: mapDifficulty(template.level || 0),
        description: template.notes || '后台目标模板',
        targets: [],
      };

    existing.level = Math.max(existing.level, template.level || 0);
    existing.targets.push({
      id: template.id,
      name: template.name,
      level: template.level,
      hp: template.hp,
      defense: template.defense,
      magicDefense: template.magicDefense,
      speed: template.speed,
      isBoss: isBossTemplate(template),
      element: (template.element || undefined) as any,
      formation: template.formation || undefined,
      description: template.notes || undefined,
      templateId: template.id,
      dungeonName,
    } as Dungeon['targets'][0] & { templateId: string });

    groupMap.set(key, existing);
  }

  return Array.from(groupMap.values()).sort((left, right) =>
    left.name.localeCompare(right.name, 'zh-CN')
  );
}

export function buildManualTargetsFromTemplates(
  templates: SimulatorTargetTemplate[]
): EnemyTarget[] {
  const manualTemplates = templates.filter(isManualTemplate);

  return manualTemplates.map((template, index) => {
    const payload = template.payload ?? {};

    return {
      ...MANUAL_TARGET_DEFAULTS,
      id: template.id,
      name: template.name || `手动目标${index + 1}`,
      element: (template.element || MANUAL_TARGET_DEFAULTS.element) as EnemyTarget['element'],
      formation: template.formation || MANUAL_TARGET_DEFAULTS.formation,
      speed: toNumber(template.speed, MANUAL_TARGET_DEFAULTS.speed),
      hp: toNumber(template.hp, MANUAL_TARGET_DEFAULTS.hp),
      defense: toNumber(template.defense, MANUAL_TARGET_DEFAULTS.defense),
      magicDefense: toNumber(
        template.magicDefense,
        MANUAL_TARGET_DEFAULTS.magicDefense
      ),
      magicDamage: toNumber(
        payload.magicDamage,
        MANUAL_TARGET_DEFAULTS.magicDamage
      ),
      spiritualPower: toNumber(
        payload.spiritualPower,
        MANUAL_TARGET_DEFAULTS.spiritualPower
      ),
      magicCritLevel: toNumber(
        payload.magicCritLevel,
        MANUAL_TARGET_DEFAULTS.magicCritLevel
      ),
      hit: toNumber(payload.hit, MANUAL_TARGET_DEFAULTS.hit),
      fixedDamage: toNumber(
        payload.fixedDamage,
        MANUAL_TARGET_DEFAULTS.fixedDamage
      ),
      pierceLevel: toNumber(
        payload.pierceLevel,
        MANUAL_TARGET_DEFAULTS.pierceLevel
      ),
      elementalMastery: toNumber(
        payload.elementalMastery,
        MANUAL_TARGET_DEFAULTS.elementalMastery
      ),
      block: toNumber(payload.block, MANUAL_TARGET_DEFAULTS.block),
      antiCritLevel: toNumber(
        payload.antiCritLevel,
        MANUAL_TARGET_DEFAULTS.antiCritLevel
      ),
      sealResistLevel: toNumber(
        payload.sealResistLevel,
        MANUAL_TARGET_DEFAULTS.sealResistLevel
      ),
      dodge: toNumber(payload.dodge, MANUAL_TARGET_DEFAULTS.dodge),
      elementalResistance: toNumber(
        payload.elementalResistance,
        MANUAL_TARGET_DEFAULTS.elementalResistance
      ),
    };
  });
}
