import type {
  Equipment,
  ExperimentSeat,
  GameState,
} from '@/features/simulator/store/gameTypes';
import { useGameStore } from '@/features/simulator/store/gameStore';
import type { SimulatorLabSessionBundle } from '@/shared/models/simulator';

function cloneEquipmentItem(equipment: Equipment): Equipment {
  return {
    ...equipment,
    highlights: equipment.highlights ? [...equipment.highlights] : undefined,
    baseStats: { ...equipment.baseStats },
    stats: { ...equipment.stats },
    runeStoneSets: equipment.runeStoneSets?.map((set) =>
      set.map((runeStone) => ({
        ...runeStone,
        stats: { ...runeStone.stats },
      }))
    ),
    runeStoneSetsNames: equipment.runeStoneSetsNames
      ? [...equipment.runeStoneSetsNames]
      : undefined,
  };
}

function normalizeSeatEquipment(equipment: Array<Record<string, unknown>>) {
  return equipment.map((item) => cloneEquipmentItem(item as unknown as Equipment));
}

function buildExperimentSeats(
  state: GameState,
  session: SimulatorLabSessionBundle
): ExperimentSeat[] {
  const compareSeats = session.seats
    .filter((seat) => !seat.isSample)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((seat, index) => ({
      id: seat.id || `comp_${index + 1}`,
      name: seat.name || `对比席位${index + 1}`,
      isSample: false,
      equipment: normalizeSeatEquipment(seat.equipment),
    }));

  return [
    {
      id: 'sample',
      name: '样本席位',
      isSample: true,
      equipment: state.equipment.map(cloneEquipmentItem),
    },
    ...(compareSeats.length
      ? compareSeats
      : state.experimentSeats
          .filter((seat) => !seat.isSample)
          .map((seat) => ({
            ...seat,
            equipment: seat.equipment.map(cloneEquipmentItem),
          }))),
  ];
}

export function applySimulatorLabSessionToStore(
  session: SimulatorLabSessionBundle
) {
  useGameStore.setState((state) => ({
    ...state,
    experimentSeats: buildExperimentSeats(state, session),
  }));
}
