import { respData, respErr } from '@/shared/lib/resp';
import { listSimulatorBattleTargetTemplates } from '@/shared/models/simulator';
import { getUserInfo } from '@/shared/models/user';

export async function GET() {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const items = await listSimulatorBattleTargetTemplates(user.id);
    return respData(items);
  } catch (error) {
    console.error('failed to load simulator target templates:', error);
    return respErr('failed to load simulator target templates');
  }
}
