import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import { hasAllPermissions } from '@/shared/services/rbac';
import { PERMISSIONS } from '@/core/rbac';
import { getDamageRuleVersionDetail } from '@/shared/models/damage-rules';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth');
    }

    const allowed = await hasAllPermissions(user.id, [PERMISSIONS.SETTINGS_READ]);
    if (!allowed) {
      return respErr('no permission');
    }

    const { id } = await params;
    const detail = await getDamageRuleVersionDetail({ versionId: id });
    if (!detail) {
      return respErr('damage rule version not found');
    }

    return respData(detail);
  } catch (error) {
    console.error('failed to get damage rule version detail:', error);
    return respErr('failed to get damage rule version detail');
  }
}
