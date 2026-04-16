import { respData, respErr } from '@/shared/lib/resp';
import { createPerfTimer } from '@/shared/lib/perf';
import { listSimulatorInventoryLibraryItems } from '@/shared/models/simulator-user';
import { getUserInfo } from '@/shared/models/user';

export async function GET(req: Request) {
  const timer = createPerfTimer('GET /api/simulator/current/inventory', {
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

    const url = new URL(req.url);
    const rawStatus = url.searchParams.get('status');
    const status =
      rawStatus === 'all' ||
      rawStatus === 'active' ||
      rawStatus === 'sold' ||
      rawStatus === 'discarded'
        ? rawStatus
        : 'active';
    const items = await listSimulatorInventoryLibraryItems({
      userId: user.id,
      status,
    });
    logMeta = {
      status: 'ok',
      inventoryStatusFilter: status,
      itemCount: items.length,
    };
    timer.mark('items');
    return respData(items);
  } catch (error) {
    forceLog = true;
    logMeta = {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
    console.error('failed to load simulator inventory library items:', error);
    return respErr('failed to load simulator inventory library items');
  } finally {
    timer.finish(logMeta, { force: forceLog });
  }
}
