import type { SimulatorEquipmentType } from '@/shared/lib/simulator-equipment';

export type SimulatorEquipmentArtworkEntry = {
  type: SimulatorEquipmentType;
  canonicalName: string;
  assetPath: string;
  aliases?: string[];
};

// Generated from data/simulator-equipment-artwork-manifest.source.json
// Run `pnpm exec tsx scripts/build-simulator-equipment-artwork-manifest.ts`
// after updating the source JSON or importing new local artwork files.
export const SIMULATOR_EQUIPMENT_ARTWORK_ENTRIES: SimulatorEquipmentArtworkEntry[] =
  [];
