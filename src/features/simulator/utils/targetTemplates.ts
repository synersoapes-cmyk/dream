import { DUNGEON_DATABASE } from '@/features/simulator/store/gameData';
import type { Dungeon } from '@/features/simulator/store/gameTypes';

export type SimulatorTargetTemplate = {
  id: string;
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
};

function mapDifficulty(level: number): Dungeon['difficulty'] {
  if (level >= 110) return 'nightmare';
  if (level >= 90) return 'hard';
  if (level >= 70) return 'normal';
  return 'easy';
}

export function buildDungeonDatabaseFromTemplates(
  templates: SimulatorTargetTemplate[]
): Dungeon[] {
  if (templates.length === 0) {
    return DUNGEON_DATABASE;
  }

  const groupMap = new Map<string, Dungeon>();

  for (const template of templates) {
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
