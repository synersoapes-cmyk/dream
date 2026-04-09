import { PERMISSIONS } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import {
  deleteAdminSimulatorOcrDictionary,
  updateAdminSimulatorOcrDictionary,
} from '@/shared/models/simulator';
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
    const item = await updateAdminSimulatorOcrDictionary(id, {
      dictType: body?.dictType,
      rawText: body?.rawText,
      normalizedText: body?.normalizedText,
      priority: Number(body?.priority) || 0,
      enabled: Boolean(body?.enabled),
    });

    if (!item) {
      return respErr('OCR dictionary not found');
    }

    return respData(item);
  } catch (error) {
    console.error('failed to update admin simulator OCR dictionary:', error);
    return respErr('failed to update admin simulator OCR dictionary');
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
    const deleted = await deleteAdminSimulatorOcrDictionary(id);
    if (!deleted) {
      return respErr('OCR dictionary not found');
    }

    return respData({ success: true });
  } catch (error) {
    console.error('failed to delete admin simulator OCR dictionary:', error);
    return respErr('failed to delete admin simulator OCR dictionary');
  }
}
