import {
  getSimulatorCharacterBundle,
  provisionDefaultSimulatorCharacterForUser,
  selectSimulatorCharacter,
} from './simulator-main';
import type { SimulatorCharacterBundle } from './simulator-types';

type GetCurrentSimulatorCharacterBundleParams = {
  userId: string;
  userName?: string | null;
  characterId?: string;
};

export async function getCurrentSimulatorCharacterBundle({
  userId,
  userName,
  characterId,
}: GetCurrentSimulatorCharacterBundleParams): Promise<SimulatorCharacterBundle | null> {
  let bundle = await getSimulatorCharacterBundle(userId, characterId);

  if (bundle && characterId) {
    await selectSimulatorCharacter(userId, characterId);
  }

  if (!bundle && !characterId) {
    bundle = await provisionDefaultSimulatorCharacterForUser({
      userId,
      userName,
    });
  }

  return bundle;
}
