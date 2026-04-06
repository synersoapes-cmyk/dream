import { PERMISSIONS } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import {
  cloneDamageRuleVersion,
  listDamageRuleVersions,
} from '@/shared/models/damage-rules';
import { getUserInfo } from '@/shared/models/user';
import { hasAllPermissions } from '@/shared/services/rbac';

export async function POST(req: Request) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth');
    }

    const allowed = await hasAllPermissions(user.id, [
      PERMISSIONS.SETTINGS_READ,
      PERMISSIONS.SETTINGS_WRITE,
    ]);
    if (!allowed) {
      return respErr('no permission');
    }

    const body = await req.json();
    const sourceVersionId =
      typeof body?.sourceVersionId === 'string' ? body.sourceVersionId : '';
    if (!sourceVersionId) {
      return respErr('sourceVersionId is required');
    }

    const detail = await cloneDamageRuleVersion({
      sourceVersionId,
      operatorId: user.id,
    });
    const versions = await listDamageRuleVersions();

    return respData({
      detail,
      versions,
    });
  } catch (error) {
    console.error('failed to clone damage rule version:', error);
    return respErr(
      error instanceof Error ? error.message : 'failed to clone damage rule version',
    );
  }
}
