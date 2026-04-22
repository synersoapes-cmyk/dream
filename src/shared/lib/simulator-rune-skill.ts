import type { Equipment, Skill } from '@/features/simulator/store/gameTypes';

import { resolveActiveRuneComboEffects } from '@/shared/lib/simulator-rune-bonus';

const SKILL_NAME_CANDIDATES_BY_COMBO: Record<string, string[]> = {
  海市蜃楼: ['九龙诀'],
  九龙诀: ['九龙诀'],
  呼风唤雨: ['龙卷雨击', '呼风唤雨'],
  破浪诀: ['破浪诀'],
  逆鳞: ['逆鳞'],
  龙腾: ['龙腾'],
};

function cloneSkill(skill: Skill): Skill {
  return { ...skill };
}

function findSkillByNames(skills: Skill[], names: string[]) {
  return skills.find((item) => names.includes(item.name)) ?? null;
}

function getRuneComboBonusValue(equipment: Equipment[], comboName: string) {
  return (
    resolveActiveRuneComboEffects(equipment).find(
      (item) => item.comboName === comboName
    )?.bonusValue ?? 0
  );
}

export function resolveLaboratorySkillLevels(
  skills: Skill[],
  equipment: Equipment[],
  options?: {
    baselineEquipment?: Equipment[];
  }
) {
  const nextSkills = skills.map(cloneSkill);
  const runeEffects = resolveActiveRuneComboEffects(equipment);
  const baselineEffects = resolveActiveRuneComboEffects(
    options?.baselineEquipment ?? []
  );
  const currentEffectMap = new Map(
    runeEffects.map((item) => [item.comboName, item])
  );
  const baselineEffectMap = new Map(
    baselineEffects.map((item) => [item.comboName, item])
  );
  const comboNames = Array.from(
    new Set([...currentEffectMap.keys(), ...baselineEffectMap.keys()])
  );

  for (const comboName of comboNames) {
    const effect = currentEffectMap.get(comboName);
    const baselineEffect = baselineEffectMap.get(comboName);
    const effectType =
      effect?.effectType ?? baselineEffect?.effectType ?? 'skill_level';

    if (effectType !== 'skill_level') {
      continue;
    }

    const candidateNames = SKILL_NAME_CANDIDATES_BY_COMBO[comboName];
    if (!candidateNames || candidateNames.length === 0) {
      continue;
    }

    const matchedSkill = findSkillByNames(nextSkills, candidateNames);
    if (!matchedSkill) {
      continue;
    }

    const currentBonus = effect?.bonusValue ?? 0;
    const baselineBonus = baselineEffect?.bonusValue ?? 0;
    const deltaBonus = currentBonus - baselineBonus;
    const storedExtraLevel = matchedSkill.extraLevel || 0;
    const storedFinalLevel =
      matchedSkill.finalLevel || matchedSkill.baseLevel || matchedSkill.level || 0;

    matchedSkill.extraLevel = Math.max(0, storedExtraLevel + deltaBonus);
    matchedSkill.finalLevel = Math.max(
      0,
      storedFinalLevel + deltaBonus
    );
    matchedSkill.level = matchedSkill.finalLevel;

    if (candidateNames.includes('龙卷雨击')) {
      matchedSkill.targets = matchedSkill.finalLevel >= 150 ? 7 : 6;
    }
  }

  const dragonRoll = findSkillByNames(nextSkills, ['龙卷雨击', '呼风唤雨']);
  if (dragonRoll && !runeEffects.some((item) => item.comboName === '呼风唤雨')) {
    dragonRoll.targets = dragonRoll.finalLevel >= 150 ? 7 : 6;
  }

  return nextSkills;
}

export function getSkillTargetCountOptions(
  skills: Skill[],
  selectedSkillName: string
) {
  const selectedSkill =
    skills.find((item) => item.name === selectedSkillName) ?? skills[0] ?? null;

  if (!selectedSkill) {
    return [1];
  }

  const maxTargets = Math.max(1, selectedSkill.targets || 1);
  return Array.from({ length: maxTargets }, (_, index) => index + 1);
}

export function resolveJiulongPanelSpiritDelta(
  equipment: Equipment[],
  baselineEquipment: Equipment[] = []
) {
  return (
    getRuneComboBonusValue(equipment, '海市蜃楼') -
    getRuneComboBonusValue(baselineEquipment, '海市蜃楼')
  );
}
