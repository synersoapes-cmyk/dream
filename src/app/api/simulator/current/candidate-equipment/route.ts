import { respData, respErr } from '@/shared/lib/resp';
import {
  getSimulatorCandidateEquipment,
  updateSimulatorCandidateEquipment,
} from '@/shared/models/simulator';
import { getUserInfo } from '@/shared/models/user';

export async function GET() {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const items = await getSimulatorCandidateEquipment(user.id);
    return respData(items);
  } catch (error) {
    console.error('failed to load simulator candidate equipment:', error);
    return respErr('failed to load simulator candidate equipment');
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const body = await req.json();
    const items = await updateSimulatorCandidateEquipment(user.id, {
      items: Array.isArray(body?.items) ? body.items : [],
    });

    if (!items) {
      return respErr('simulator character not found');
    }

    return respData(items);
  } catch (error) {
    console.error('failed to save simulator candidate equipment:', error);
    return respErr('failed to save simulator candidate equipment');
  }
}
