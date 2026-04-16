import { respData, respErr } from '@/shared/lib/resp';
import { listSimulatorRecentOcrLogs } from '@/shared/models/simulator-user';
import { getUserInfo } from '@/shared/models/user';

export async function GET(req: Request) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const { searchParams } = new URL(req.url);
    const sceneType = searchParams.get('sceneType');
    const limit = Number(searchParams.get('limit') || 20);
    const rawCharacterId = searchParams.get('characterId');
    const characterId =
      typeof rawCharacterId === 'string' && rawCharacterId.trim().length > 0
        ? rawCharacterId.trim()
        : undefined;

    return respData(
      await listSimulatorRecentOcrLogs(user.id, {
        sceneType:
          sceneType === 'profile' ||
          sceneType === 'equipment' ||
          sceneType === 'ornament' ||
          sceneType === 'jade'
            ? sceneType
            : undefined,
        limit,
        characterId,
      })
    );
  } catch (error) {
    console.error('failed to load simulator OCR history:', error);
    return respErr('failed to load simulator OCR history');
  }
}
