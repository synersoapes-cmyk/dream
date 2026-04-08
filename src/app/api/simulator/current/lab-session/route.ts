import { respData, respErr } from '@/shared/lib/resp';
import { createPerfTimer } from '@/shared/lib/perf';
import {
  getSimulatorLabSession,
  updateSimulatorLabSession,
} from '@/shared/models/simulator';
import { getUserInfo } from '@/shared/models/user';

export async function GET() {
  const timer = createPerfTimer('GET /api/simulator/current/lab-session', {
    slowThresholdMs: 300,
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

    const session = await getSimulatorLabSession(user.id);
    logMeta = {
      status: 'ok',
      hasSession: Boolean(session?.session),
      seatCount: session?.seats.length ?? 0,
    };
    timer.mark('session');
    return respData(session);
  } catch (error) {
    forceLog = true;
    logMeta = {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
    console.error('failed to load simulator lab session:', error);
    return respErr('failed to load simulator lab session');
  } finally {
    timer.finish(logMeta, { force: forceLog });
  }
}

export async function PATCH(req: Request) {
  const timer = createPerfTimer('PATCH /api/simulator/current/lab-session', {
    slowThresholdMs: 300,
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

    const body = await req.json();
    timer.mark('body');
    const session = await updateSimulatorLabSession(user.id, {
      name: typeof body?.name === 'string' ? body.name : '当前实验室',
      seats: Array.isArray(body?.seats) ? body.seats : [],
    });

    if (!session) {
      logMeta = { status: 'missing_session' };
      return respErr('simulator character not found');
    }

    logMeta = {
      status: 'ok',
      hasSession: Boolean(session.session),
      seatCount: session.seats.length,
    };
    timer.mark('update');
    return respData(session);
  } catch (error) {
    forceLog = true;
    logMeta = {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
    console.error('failed to save simulator lab session:', error);
    return respErr('failed to save simulator lab session');
  } finally {
    timer.finish(logMeta, { force: forceLog });
  }
}
