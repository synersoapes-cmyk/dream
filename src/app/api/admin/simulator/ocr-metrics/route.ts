import { PERMISSIONS } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import { getAdminSimulatorOcrMetrics } from '@/shared/models/simulator-admin';
import { getUserInfo } from '@/shared/models/user';
import { hasAllPermissions } from '@/shared/services/rbac';

export async function GET() {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth');
    }

    const allowed = await hasAllPermissions(user.id, [PERMISSIONS.SETTINGS_READ]);
    if (!allowed) {
      return respErr('no permission');
    }

    return respData(await getAdminSimulatorOcrMetrics());
  } catch (error) {
    console.error('failed to load admin simulator OCR metrics:', error);
    return respErr('failed to load admin simulator OCR metrics');
  }
}
