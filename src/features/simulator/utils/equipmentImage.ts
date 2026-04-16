import type { SimulatorEquipmentType } from '@/shared/lib/simulator-equipment';
import { getSimulatorEquipmentArtworkUrl } from '@/shared/lib/simulator-equipment-artwork';

export function getEquipmentDefaultImage(
  type: SimulatorEquipmentType,
  name?: string
): string {
  return getSimulatorEquipmentArtworkUrl(type, name);
}
