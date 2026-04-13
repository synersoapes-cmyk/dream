import type { ExperimentSeat } from '@/features/simulator/store/gameTypes';

export const LABORATORY_MAX_COMPARE_SEATS = 1;
export const LABORATORY_MAX_VISIBLE_SEATS = LABORATORY_MAX_COMPARE_SEATS + 1;

export function getVisibleExperimentSeats(
  experimentSeats: ExperimentSeat[]
): ExperimentSeat[] {
  const sampleSeat = experimentSeats.find((seat) => seat.isSample);
  const compareSeats = experimentSeats
    .filter((seat) => !seat.isSample)
    .slice(0, LABORATORY_MAX_COMPARE_SEATS);

  return sampleSeat ? [sampleSeat, ...compareSeats] : compareSeats;
}

export function getVisibleCompareExperimentSeats(
  experimentSeats: ExperimentSeat[]
): ExperimentSeat[] {
  return getVisibleExperimentSeats(experimentSeats).filter(
    (seat) => !seat.isSample
  );
}
