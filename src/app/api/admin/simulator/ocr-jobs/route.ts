import { PERMISSIONS } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import { listAdminSimulatorOcrJobs } from '@/shared/models/simulator-admin';
import { getUserInfo } from '@/shared/models/user';
import { hasAllPermissions } from '@/shared/services/rbac';

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
    const status = searchParams.get('status') || 'all';
    const limit = Number(searchParams.get('limit') || 100);

    return respData(
      await listAdminSimulatorOcrJobs({
        status: status as 'all' | 'pending' | 'success' | 'failed' | 'reviewing',
        limit,
      })
    );
  } catch (error) {
    console.error('failed to load admin simulator OCR jobs:', error);
    return respErr('failed to load admin simulator OCR jobs');
  }
}
