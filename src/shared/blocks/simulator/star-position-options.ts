import type { StarPositionConfig } from '@/features/simulator/store/gameTypes';
import {
  findStarPositionOptionByLabel as findPrdStarPositionOptionByLabel,
  getSimulatorStarPositionOptions,
} from '@/shared/lib/simulator-rune-star-rules';

export const STAR_POSITION_OPTIONS: StarPositionConfig[] =
  getSimulatorStarPositionOptions();

export function findStarPositionOptionByLabel(label: string | null | undefined) {
  return findPrdStarPositionOptionByLabel(label);
}
