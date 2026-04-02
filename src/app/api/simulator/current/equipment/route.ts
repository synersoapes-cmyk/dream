import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import { updateSimulatorEquipment } from '@/shared/models/simulator';

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
  maxAttempts = 3,
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
        error,
      );

      await new Promise((resolve) => setTimeout(resolve, attempt * 150));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Unknown route error during ${label}`);
}

export async function PATCH(req: Request) {
  try {
    const user = await withTransientRetry('getUserInfo', () => getUserInfo());
    if (!user) {
      return Response.json(
        { code: -1, message: 'no auth, please sign in' },
        { status: 401 },
      );
    }

    const body = await req.json();
    const equipment = Array.isArray(body?.equipment) ? body.equipment : [];
    const bundle = await withTransientRetry('updateSimulatorEquipment', () =>
      updateSimulatorEquipment(user.id, { equipment }),
    );

    if (!bundle) {
      return Response.json(
        { code: -1, message: 'simulator character not found' },
        { status: 404 },
      );
    }

    return respData(bundle);
  } catch (error) {
    console.error('failed to update simulator equipment:', error);
    return Response.json(
      { code: -1, message: 'failed to save simulator equipment' },
      { status: 503 },
    );
  }
}
