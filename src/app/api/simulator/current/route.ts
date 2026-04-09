import { respData, respErr } from '@/shared/lib/resp';
import { createPerfTimer } from '@/shared/lib/perf';
import {
  getCurrentSimulatorCharacterBundle,
} from '@/shared/models/simulator-user';
import { getUserInfo } from '@/shared/models/user';

export async function GET(req: Request) {
  const timer = createPerfTimer('GET /api/simulator/current', {
    slowThresholdMs: 400,
  });
  let logMeta: Record<string, unknown> = { status: 'ok' };
  let forceLog = false;

  try {
    const user = await getUserInfo();
    timer.mark('user');
    if (!user) {
      logMeta = { status: 'unauthorized' };
      return respErr('no auth, please sign in');
    }

    const { searchParams } = new URL(req.url);
    const characterId = searchParams.get('characterId') || undefined;

    const bundle = await getCurrentSimulatorCharacterBundle({
      userId: user.id,
      userName: user.name,
      characterId,
    });
    timer.mark('bundle_lookup');

    if (!bundle) {
      logMeta = {
        status: 'missing_bundle',
        characterIdProvided: Boolean(characterId),
      };
      return respErr('simulator character not initialized');
    }

    logMeta = {
      status: 'ok',
      characterIdProvided: Boolean(characterId),
      equipmentCount: bundle.equipments.length,
    };
    timer.mark('bundle');
    return respData(bundle);
  } catch (e: any) {
    forceLog = true;
    logMeta = {
      status: 'error',
      error: e instanceof Error ? e.message : String(e),
    };
    console.log('get simulator current bundle failed:', e);
    return respErr('failed to load simulator character data');
  } finally {
    timer.finish(logMeta, { force: forceLog });
  }
}
