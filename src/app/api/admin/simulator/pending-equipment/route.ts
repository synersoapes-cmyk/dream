import { PERMISSIONS } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import { listAdminSimulatorPendingEquipment } from '@/shared/models/simulator';
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
    const status = searchParams.get('status') || 'pending';
    const limit = Number(searchParams.get('limit') || 50);

    const items = await listAdminSimulatorPendingEquipment({
      status: status as 'pending' | 'confirmed' | 'replaced',
      limit,
    });

    return respData(items);
  } catch (error) {
    console.error('failed to load admin simulator pending equipment:', error);
    return respErr('failed to load admin simulator pending equipment');
  }
}
