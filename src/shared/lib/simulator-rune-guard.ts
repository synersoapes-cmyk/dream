import type { Equipment } from '@/features/simulator/store/gameTypes';

import {
  buildRuneComboDropWarnings,
  diffActiveRuneComboEffects,
  type RuneComboEffectDiff,
} from '@/shared/lib/simulator-rune-bonus';
import { analyzeRuneComboConflict } from '@/shared/lib/simulator-rune-combo';
import {
  findSimulatorSlotDefinition,
  getSimulatorSlotLabel,
} from '@/shared/lib/simulator-slot-config';

export type RuneGuardConflictEntry = {
  equipmentId: string;
  equipmentName: string;
  slotLabel: string;
  message: string;
};

export type RuneGuardSkillChangeEntry = {
  comboName: string;
  effectLabel: string;
  deltaBonusValue: number;
  nextBonusValue: number;
};

export type LaboratoryRuneGuardSummary = {
  warnings: string[];
  conflicts: RuneGuardConflictEntry[];
  skillChanges: RuneGuardSkillChangeEntry[];
  diffs: RuneComboEffectDiff[];
  requiresAttention: boolean;
};

function getEquipmentSlotLabel(equipment: Equipment) {
  const slotDefinition = findSimulatorSlotDefinition(equipment.type, equipment.slot);
  return slotDefinition
    ? getSimulatorSlotLabel(slotDefinition, 'laboratory')
    : equipment.type;
}

export function buildLaboratoryRuneGuardSummary(
  sampleEquipment: Equipment[],
  seatEquipment: Equipment[]
): LaboratoryRuneGuardSummary {
  const diffs = diffActiveRuneComboEffects(sampleEquipment, seatEquipment);
  const warnings = buildRuneComboDropWarnings(diffs);
  const conflicts = seatEquipment
    .map((equipment) => {
      const conflict = analyzeRuneComboConflict(equipment);
      if (!conflict) {
        return null;
      }

      return {
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        slotLabel: getEquipmentSlotLabel(equipment),
        message: conflict.message,
      };
    })
    .filter((item): item is RuneGuardConflictEntry => Boolean(item));
  const skillChanges = diffs
    .filter((item) => item.effectType === 'skill_level' && item.deltaBonusValue !== 0)
    .map((item) => ({
      comboName: item.comboName,
      effectLabel: item.effectLabel,
      deltaBonusValue: item.deltaBonusValue,
      nextBonusValue: item.nextBonusValue,
    }));

  return {
    warnings,
    conflicts,
    skillChanges,
    diffs,
    requiresAttention: warnings.length > 0 || conflicts.length > 0,
  };
}
