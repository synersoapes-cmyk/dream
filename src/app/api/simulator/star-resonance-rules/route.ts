import { respData, respErr } from '@/shared/lib/resp';
import { listSimulatorStarResonanceRules } from '@/shared/models/simulator-user';
import { getUserInfo } from '@/shared/models/user';

export async function GET(req: Request) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const { searchParams } = new URL(req.url);
    const slot = searchParams.get('slot') || undefined;
    const items = await listSimulatorStarResonanceRules({
      slot: slot && slot.trim().length > 0 ? slot.trim() : undefined,
    });

    return respData(items);
  } catch (error) {
    console.error('failed to list simulator star resonance rules:', error);
    return respErr('failed to load simulator star resonance rules');
  }
}
