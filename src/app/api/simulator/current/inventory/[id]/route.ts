import { respData, respErr } from '@/shared/lib/resp';
import { createPerfTimer } from '@/shared/lib/perf';
import { updateSimulatorInventoryLibraryEntry } from '@/shared/models/simulator-user';
import { getUserInfo } from '@/shared/models/user';

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const timer = createPerfTimer('PATCH /api/simulator/current/inventory/[id]', {
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

    const { id } = await context.params;
    const body = await req.json();
    timer.mark('body');

    const item = await updateSimulatorInventoryLibraryEntry({
      userId: user.id,
      id,
      status:
        body?.status === 'active' ||
        body?.status === 'sold' ||
        body?.status === 'discarded'
          ? body.status
          : undefined,
      price:
        body?.price === null || body?.price === undefined
          ? body?.price
          : Number(body.price),
    });

    if (!item) {
      logMeta = { status: 'missing_entry', id };
      return respErr('inventory entry not found');
    }

    logMeta = {
      status: 'ok',
      id,
      inventoryStatus: item.status,
    };
    timer.mark('update');
    return respData(item);
  } catch (error) {
    forceLog = true;
    logMeta = {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
    console.error('failed to update simulator inventory entry:', error);
    return respErr('failed to update simulator inventory entry');
  } finally {
    timer.finish(logMeta, { force: forceLog });
  }
}
