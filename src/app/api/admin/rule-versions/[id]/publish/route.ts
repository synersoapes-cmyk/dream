import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import { hasAllPermissions } from '@/shared/services/rbac';
import { PERMISSIONS } from '@/core/rbac';
import { publishDamageRuleVersion } from '@/shared/models/damage-rules';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const detail = await publishDamageRuleVersion({
      versionId: id,
      operatorId: user.id,
      notes: typeof body?.notes === 'string' ? body.notes : '',
    });

    return respData(detail);
  } catch (error) {
    console.error('failed to publish damage rule version:', error);
    return respErr(
      error instanceof Error ? error.message : 'failed to publish damage rule version',
    );
  }
}
