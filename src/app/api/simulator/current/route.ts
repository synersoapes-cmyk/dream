import { respData, respErr } from '@/shared/lib/resp';
import {
  getSimulatorCharacterBundle,
  provisionDefaultSimulatorCharacterForUser,
} from '@/shared/models/simulator';
import { getUserInfo } from '@/shared/models/user';

export async function GET(req: Request) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const { searchParams } = new URL(req.url);
    const characterId = searchParams.get('characterId') || undefined;

    let bundle = await getSimulatorCharacterBundle(user.id, characterId);

    if (!bundle && !characterId) {
      bundle = await provisionDefaultSimulatorCharacterForUser({
        userId: user.id,
        userName: user.name,
      });
    }

    if (!bundle) {
      return respErr('simulator character not initialized');
    }

    return respData(bundle);
  } catch (e: any) {
    console.log('get simulator current bundle failed:', e);
    return respErr('failed to load simulator character data');
  }
}
