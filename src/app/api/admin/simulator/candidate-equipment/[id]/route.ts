import { PERMISSIONS } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import {
  deleteAdminSimulatorCandidateEquipment,
  updateAdminSimulatorCandidateEquipment,
} from '@/shared/models/simulator-admin';
import { getUserInfo } from '@/shared/models/user';
import { hasAllPermissions } from '@/shared/services/rbac';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
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
    const item = await updateAdminSimulatorCandidateEquipment({
      id,
      status: body?.status || 'pending',
      equipment:
        body?.equipment && typeof body.equipment === 'object'
          ? body.equipment
          : {},
      rawText: typeof body?.rawText === 'string' ? body.rawText : undefined,
    });

    if (!item) {
      return respErr('candidate equipment not found');
    }

    return respData(item);
  } catch (error) {
    console.error(
      'failed to update admin simulator candidate equipment:',
      error
    );
    return respErr('failed to update admin simulator candidate equipment');
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
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
    const deleted = await deleteAdminSimulatorCandidateEquipment(id);

    if (!deleted) {
      return respErr('candidate equipment not found');
    }

    return respData({ success: true });
  } catch (error) {
    console.error(
      'failed to delete admin simulator candidate equipment:',
      error
    );
    return respErr('failed to delete admin simulator candidate equipment');
  }
}
