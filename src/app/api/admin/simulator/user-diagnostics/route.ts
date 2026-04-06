import { PERMISSIONS } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import { listAdminSimulatorUserDiagnostics } from '@/shared/models/simulator';
import { getUserInfo } from '@/shared/models/user';
import { hasAllPermissions } from '@/shared/services/rbac';

function toNumber(value: unknown, fallback = 30) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(req: Request) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth');
    }

    const allowed = await hasAllPermissions(user.id, [PERMISSIONS.SETTINGS_READ]);
    if (!allowed) {
      return respErr('no permission');
    }

    const { searchParams } = new URL(req.url);
    const keyword = searchParams.get('keyword') ?? '';
    const limit = toNumber(searchParams.get('limit'), 30);

    const items = await listAdminSimulatorUserDiagnostics({
      keyword,
      limit,
    });

    return respData(items);
  } catch (error) {
    console.error('failed to load simulator user diagnostics:', error);
    return respErr('failed to load simulator user diagnostics');
  }
}
