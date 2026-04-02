import { PERMISSIONS } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import { updateDamageRuleVersionEditableSections } from '@/shared/models/damage-rules';
import { getUserInfo } from '@/shared/models/user';
import { hasAllPermissions } from '@/shared/services/rbac';

export async function PATCH(
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
    const body = await req.json();
    const detail = await updateDamageRuleVersionEditableSections({
      versionId: id,
      operatorId: user.id,
      modifiers: Array.isArray(body?.modifiers) ? body.modifiers : [],
      skillBonuses: Array.isArray(body?.skillBonuses) ? body.skillBonuses : [],
    });

    return respData(detail);
  } catch (error) {
    console.error('failed to update damage rule editable sections:', error);
    return respErr(
      error instanceof Error
        ? error.message
        : 'failed to update damage rule editable sections',
    );
  }
}
