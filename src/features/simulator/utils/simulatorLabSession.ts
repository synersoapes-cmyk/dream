import type {
  Equipment,
  ExperimentSeat,
  GameState,
} from '@/features/simulator/store/gameTypes';
import { useGameStore } from '@/features/simulator/store/gameStore';
import { LABORATORY_MAX_COMPARE_SEATS } from '@/features/simulator/utils/simulatorExperimentSeats';
import type { SimulatorLabSessionBundle } from '@/shared/models/simulator-types';

function cloneEquipmentItem(equipment: Equipment): Equipment {
  return {
    ...equipment,
    highlights: equipment.highlights ? [...equipment.highlights] : undefined,
    effectModifiers: equipment.effectModifiers?.map((modifier) => ({
      ...modifier,
    })),
    baseStats: { ...equipment.baseStats },
    stats: { ...equipment.stats },
    gemstones: equipment.gemstones?.map((gemstone) => ({
      ...gemstone,
      stats: gemstone.stats ? { ...gemstone.stats } : undefined,
    })),
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
    .slice(0, LABORATORY_MAX_COMPARE_SEATS)
    .map((seat, index) => ({
      id: seat.id || `comp_${index + 1}`,
      name: seat.name || `对比席位${index + 1}`,
      isSample: false,
      inheritGemstones: seat.inheritGemstones !== false,
      inheritRuneStones: seat.inheritRuneStones !== false,
      equipment: normalizeSeatEquipment(seat.equipment),
    }));

  return [
    {
      id: 'sample',
      name: '样本席位',
      isSample: true,
      inheritGemstones: false,
      inheritRuneStones: false,
      equipment: state.equipment.map(cloneEquipmentItem),
    },
    ...(compareSeats.length
      ? compareSeats
      : state.experimentSeats
          .filter((seat) => !seat.isSample)
          .slice(0, LABORATORY_MAX_COMPARE_SEATS)
          .map((seat) => ({
            ...seat,
            inheritGemstones: seat.inheritGemstones ?? true,
            inheritRuneStones: seat.inheritRuneStones ?? true,
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
