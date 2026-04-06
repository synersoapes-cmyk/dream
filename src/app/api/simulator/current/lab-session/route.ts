import { respData, respErr } from '@/shared/lib/resp';
import {
  getSimulatorLabSession,
  updateSimulatorLabSession,
} from '@/shared/models/simulator';
import { getUserInfo } from '@/shared/models/user';

export async function GET() {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const session = await getSimulatorLabSession(user.id);
    return respData(session);
  } catch (error) {
    console.error('failed to load simulator lab session:', error);
    return respErr('failed to load simulator lab session');
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const body = await req.json();
    const session = await updateSimulatorLabSession(user.id, {
      name: typeof body?.name === 'string' ? body.name : '当前实验室',
      seats: Array.isArray(body?.seats) ? body.seats : [],
    });

    if (!session) {
      return respErr('simulator character not found');
    }

    return respData(session);
  } catch (error) {
    console.error('failed to save simulator lab session:', error);
    return respErr('failed to save simulator lab session');
  }
}
