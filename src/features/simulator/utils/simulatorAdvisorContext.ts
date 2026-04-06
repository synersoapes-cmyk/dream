import type { Equipment, GameState } from '@/features/simulator/store/gameTypes';

function toFiniteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function summarizeEquipment(equipment: Equipment[]) {
  return equipment.slice(0, 12).map((item) => ({
    name: item.name,
    type: item.type,
    slot: item.slot,
    mainStat: item.mainStat,
    price: item.price ?? null,
    crossServerFee: item.crossServerFee ?? null,
    stats: item.stats ?? {},
    highlights: item.highlights ?? [],
  }));
}

function summarizeSeatDiff(baseEquipment: Equipment[], seatEquipment: Equipment[]) {
  const baseMap = new Map(
    baseEquipment.map((item) => [`${item.type}:${item.slot ?? 0}`, item])
  );

  return seatEquipment
    .map((item) => {
      const key = `${item.type}:${item.slot ?? 0}`;
      const base = baseMap.get(key);
      return {
        type: item.type,
        slot: item.slot ?? null,
        currentName: base?.name ?? null,
        nextName: item.name,
        nextMainStat: item.mainStat,
        nextPrice: item.price ?? null,
      };
    })
    .slice(0, 12);
}

export function buildSimulatorAdvisorContext(state: GameState) {
  const compareSeats = state.experimentSeats.filter((seat) => !seat.isSample);

  return {
    role: {
      level: state.baseAttributes.level,
      faction: state.baseAttributes.faction,
      baseAttributes: state.baseAttributes,
      combatStats: state.combatStats,
      cultivation: state.cultivation,
      skills: state.skills.map((skill) => ({
        name: skill.name,
        level: skill.level,
        type: skill.type,
        targets: skill.targets,
      })),
      formation: state.formation,
      element: state.playerSetup.element,
    },
    battle: {
      target: state.combatTarget,
      selectedSkill: state.selectedSkill
        ? {
            name: state.selectedSkill.name,
            level: state.selectedSkill.level,
            targets: state.selectedSkill.targets,
          }
        : null,
    },
    currentEquipment: summarizeEquipment(state.equipment),
    candidateEquipment: state.pendingEquipments
      .filter((item) => item.status !== 'replaced')
      .slice(0, 12)
      .map((item) => ({
        status: item.status,
        equipment: {
          name: item.equipment.name,
          type: item.equipment.type,
          slot: item.equipment.slot ?? null,
          mainStat: item.equipment.mainStat,
          price: item.equipment.price ?? null,
          crossServerFee: item.equipment.crossServerFee ?? null,
          stats: item.equipment.stats ?? {},
          highlights: item.equipment.highlights ?? [],
        },
      })),
    laboratory: compareSeats.slice(0, 3).map((seat) => ({
      id: seat.id,
      name: seat.name,
      equipmentCount: seat.equipment.length,
      totalPrice: seat.equipment.reduce(
        (sum, item) => sum + toFiniteNumber(item.price),
        0
      ),
      diffPreview: summarizeSeatDiff(state.equipment, seat.equipment),
    })),
  };
}
