import { createPerfTimer } from '@/shared/lib/perf';
import { respData } from '@/shared/lib/resp';
import {
  getLatestSimulatorEquipmentRollbackSnapshot,
  rollbackSimulatorEquipmentToLatestSnapshot,
} from '@/shared/models/simulator-user';
import { getUserInfo } from '@/shared/models/user';

function getErrorMessages(error: unknown): string[] {
  const messages: string[] = [];
  let current = error;
  let depth = 0;

  while (current && depth < 5) {
    if (current instanceof Error) {
      messages.push(current.message);
      current = (current as Error & { cause?: unknown }).cause;
      depth += 1;
      continue;
    }

    break;
  }

  return messages;
}

function isTransientRequestError(error: unknown) {
  const combined = getErrorMessages(error).join(' | ').toLowerCase();

  return (
    combined.includes('network connection lost') ||
    combined.includes('failed to get session') ||
    combined.includes('failed to parse body as json') ||
    combined.includes('d1_error') ||
    combined.includes('internal_server_error')
  );
}

async function withTransientRetry<T>(
  label: string,
  operation: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isTransientRequestError(error) || attempt === maxAttempts) {
        throw error;
      }

      console.warn(
        `[simulator-equipment-rollback-route] transient error during ${label}, retrying (${attempt}/${maxAttempts})`,
        error
      );

      await new Promise((resolve) => setTimeout(resolve, attempt * 150));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Unknown route error during ${label}`);
}

export async function GET() {
  const timer = createPerfTimer(
    'GET /api/simulator/current/equipment/rollback',
    {
      slowThresholdMs: 300,
    }
  );
  let logMeta: Record<string, unknown> = { status: 'ok' };
  let forceLog = false;

  try {
    const user = await withTransientRetry('getUserInfo', () => getUserInfo());
    timer.mark('user');
    if (!user) {
      logMeta = { status: 'unauthorized' };
      return Response.json(
        { code: -1, message: 'no auth, please sign in' },
        { status: 401 }
      );
    }

    const snapshot = await withTransientRetry(
      'getLatestSimulatorEquipmentRollbackSnapshot',
      () => getLatestSimulatorEquipmentRollbackSnapshot(user.id)
    );
    timer.mark('load');

    logMeta = {
      status: 'ok',
      hasSnapshot: Boolean(snapshot),
    };
    return Response.json({
      code: 0,
      message: 'ok',
      data: snapshot ?? null,
    });
  } catch (error) {
    forceLog = true;
    logMeta = {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
    console.error(
      'failed to load simulator equipment rollback snapshot:',
      error
    );
    return Response.json(
      {
        code: -1,
        message: 'failed to load simulator equipment rollback snapshot',
      },
      { status: 503 }
    );
  } finally {
    timer.finish(logMeta, { force: forceLog });
  }
}

export async function POST() {
  const timer = createPerfTimer(
    'POST /api/simulator/current/equipment/rollback',
    {
      slowThresholdMs: 400,
    }
  );
  let logMeta: Record<string, unknown> = { status: 'ok' };
  let forceLog = false;

  try {
    const user = await withTransientRetry('getUserInfo', () => getUserInfo());
    timer.mark('user');
    if (!user) {
      logMeta = { status: 'unauthorized' };
      return Response.json(
        { code: -1, message: 'no auth, please sign in' },
        { status: 401 }
      );
    }

    const bundle = await withTransientRetry(
      'rollbackSimulatorEquipmentToLatestSnapshot',
      () => rollbackSimulatorEquipmentToLatestSnapshot(user.id)
    );
    timer.mark('rollback');

    if (!bundle) {
      logMeta = { status: 'missing_snapshot' };
      return Response.json(
        { code: -1, message: 'rollback snapshot not found' },
        { status: 404 }
      );
    }

    logMeta = {
      status: 'ok',
      equipmentCount: bundle.equipments.length,
    };
    return respData(bundle);
  } catch (error) {
    forceLog = true;
    logMeta = {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
    console.error('failed to rollback simulator equipment:', error);
    return Response.json(
      { code: -1, message: 'failed to rollback simulator equipment' },
      { status: 503 }
    );
  } finally {
    timer.finish(logMeta, { force: forceLog });
  }
}
