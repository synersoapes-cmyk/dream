import { respData, respErr } from '@/shared/lib/resp';
import { listSimulatorBattleTargetTemplates } from '@/shared/models/simulator-user';
import { getUserInfo } from '@/shared/models/user';

export async function GET(req: Request) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const { searchParams } = new URL(req.url);
    const sceneType = searchParams.get('scene');
    const items = await listSimulatorBattleTargetTemplates(user.id, {
      sceneType:
        sceneType === 'manual' || sceneType === 'dungeon'
          ? sceneType
          : 'dungeon',
    });
    return respData(items);
  } catch (error) {
    console.error('failed to load simulator target templates:', error);
    return respErr('failed to load simulator target templates');
  }
}
