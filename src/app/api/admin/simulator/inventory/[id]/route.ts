import { PERMISSIONS } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import { updateAdminSimulatorInventoryEntry } from '@/shared/models/simulator';
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
    const item = await updateAdminSimulatorInventoryEntry(id, {
      folderKey: typeof body?.folderKey === 'string' ? body.folderKey : undefined,
      price:
        body?.price === null || body?.price === ''
          ? null
          : Number.isFinite(Number(body?.price))
            ? Number(body.price)
            : undefined,
      status:
        body?.status === 'active' ||
        body?.status === 'sold' ||
        body?.status === 'discarded'
          ? body.status
          : undefined,
    });

    if (!item) {
      return respErr('inventory entry not found');
    }

    return respData(item);
  } catch (error) {
    console.error('failed to update admin simulator inventory entry:', error);
    return respErr('failed to update admin simulator inventory entry');
  }
}
