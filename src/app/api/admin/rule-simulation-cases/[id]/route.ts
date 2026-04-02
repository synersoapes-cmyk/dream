import { PERMISSIONS } from '@/core/rbac';
import { respOk, respErr } from '@/shared/lib/resp';
import { deleteRuleSimulationCase } from '@/shared/models/rule-simulation-cases';
import { getUserInfo } from '@/shared/models/user';
import { hasAllPermissions } from '@/shared/services/rbac';

export async function DELETE(
  _req: Request,
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
    await deleteRuleSimulationCase(id);
    return respOk();
  } catch (error) {
    console.error('failed to delete rule simulation case:', error);
    return respErr(
      error instanceof Error ? error.message : 'failed to delete rule simulation case',
    );
  }
}
