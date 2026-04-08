import { respData, respErr } from '@/shared/lib/resp';
import { createPerfTimer } from '@/shared/lib/perf';
import { updateSimulatorEquipment } from '@/shared/models/simulator';
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

function isTransientRequestError(error: unknown): boolean {
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
        `[simulator-equipment-route] transient error during ${label}, retrying (${attempt}/${maxAttempts})`,
        error
      );

      await new Promise((resolve) => setTimeout(resolve, attempt * 150));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Unknown route error during ${label}`);
}

export async function PATCH(req: Request) {
  const timer = createPerfTimer('PATCH /api/simulator/current/equipment', {
    slowThresholdMs: 400,
  });
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

    const body = await req.json();
    timer.mark('body');
    const equipment = Array.isArray(body?.equipment) ? body.equipment : [];
    const equipmentSets = Array.isArray(body?.equipmentSets)
      ? body.equipmentSets
      : undefined;
    const activeSetIndex = Number.isInteger(body?.activeSetIndex)
      ? Number(body.activeSetIndex)
      : undefined;
    const bundle = await withTransientRetry('updateSimulatorEquipment', () =>
      updateSimulatorEquipment(user.id, {
        equipment,
        equipmentSets,
        activeSetIndex,
      })
    );
    timer.mark('update');

    if (!bundle) {
      logMeta = { status: 'missing_character' };
      return Response.json(
        { code: -1, message: 'simulator character not found' },
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
    console.error('failed to update simulator equipment:', error);
    return Response.json(
      { code: -1, message: 'failed to save simulator equipment' },
      { status: 503 }
    );
  } finally {
    timer.finish(logMeta, { force: forceLog });
  }
}
