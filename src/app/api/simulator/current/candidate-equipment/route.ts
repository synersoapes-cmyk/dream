import { respData, respErr } from '@/shared/lib/resp';
import { createPerfTimer } from '@/shared/lib/perf';
import {
  getSimulatorCandidateEquipment,
  updateSimulatorCandidateEquipment,
} from '@/shared/models/simulator';
import { getUserInfo } from '@/shared/models/user';

export async function GET() {
  const timer = createPerfTimer(
    'GET /api/simulator/current/candidate-equipment',
    {
      slowThresholdMs: 300,
    }
  );
  let logMeta: Record<string, unknown> = { status: 'ok' };
  let forceLog = false;

  try {
    const user = await getUserInfo();
    timer.mark('user');
    if (!user) {
      logMeta = { status: 'unauthorized' };
      return respErr('no auth, please sign in');
    }

    const items = await getSimulatorCandidateEquipment(user.id);
    logMeta = {
      status: 'ok',
      itemCount: items?.length ?? 0,
    };
    timer.mark('items');
    return respData(items);
  } catch (error) {
    forceLog = true;
    logMeta = {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
    console.error('failed to load simulator candidate equipment:', error);
    return respErr('failed to load simulator candidate equipment');
  } finally {
    timer.finish(logMeta, { force: forceLog });
  }
}

export async function PATCH(req: Request) {
  const timer = createPerfTimer(
    'PATCH /api/simulator/current/candidate-equipment',
    {
      slowThresholdMs: 300,
    }
  );
  let logMeta: Record<string, unknown> = { status: 'ok' };
  let forceLog = false;

  try {
    const user = await getUserInfo();
    timer.mark('user');
    if (!user) {
      logMeta = { status: 'unauthorized' };
      return respErr('no auth, please sign in');
    }

    const body = await req.json();
    timer.mark('body');
    const items = await updateSimulatorCandidateEquipment(user.id, {
      items: Array.isArray(body?.items) ? body.items : [],
    });

    if (!items) {
      logMeta = { status: 'missing_character' };
      return respErr('simulator character not found');
    }

    logMeta = {
      status: 'ok',
      itemCount: items.length,
    };
    timer.mark('update');
    return respData(items);
  } catch (error) {
    forceLog = true;
    logMeta = {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
    console.error('failed to save simulator candidate equipment:', error);
    return respErr('failed to save simulator candidate equipment');
  } finally {
    timer.finish(logMeta, { force: forceLog });
  }
}
