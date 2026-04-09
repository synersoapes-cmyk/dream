import { PERMISSIONS } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import { listAdminSimulatorCandidateEquipment } from '@/shared/models/simulator-admin';
import { getUserInfo } from '@/shared/models/user';
import { hasAllPermissions } from '@/shared/services/rbac';

export async function GET(req: Request) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth');
    }

    const allowed = await hasAllPermissions(user.id, [
      PERMISSIONS.SETTINGS_READ,
    ]);
    if (!allowed) {
      return respErr('no permission');
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';
    const keyword = searchParams.get('keyword') || '';
    const limit = Number(searchParams.get('limit') || 100);

    const items = await listAdminSimulatorCandidateEquipment({
      status: status as 'all' | 'pending' | 'confirmed' | 'replaced',
      keyword,
      limit,
    });

    return respData(items);
  } catch (error) {
    console.error('failed to load admin simulator candidate equipment:', error);
    return respErr('failed to load admin simulator candidate equipment');
  }
}
