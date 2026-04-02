import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import { hasAllPermissions } from '@/shared/services/rbac';
import { PERMISSIONS } from '@/core/rbac';
import { listDamageRuleVersions } from '@/shared/models/damage-rules';

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

    const versions = await listDamageRuleVersions();
    return respData(versions);
  } catch (error) {
    console.error('failed to list damage rule versions:', error);
    return respErr('failed to list damage rule versions');
  }
}
