import { PERMISSIONS } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import {
  deleteAdminBattleTargetTemplate,
  updateAdminBattleTargetTemplate,
} from '@/shared/models/simulator';
import { getUserInfo } from '@/shared/models/user';
import { hasAllPermissions } from '@/shared/services/rbac';

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

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
    const item = await updateAdminBattleTargetTemplate(id, {
      name: typeof body?.name === 'string' ? body.name : undefined,
      dungeonName: typeof body?.dungeonName === 'string' ? body.dungeonName : undefined,
      targetType: typeof body?.targetType === 'string' ? body.targetType : undefined,
      school: typeof body?.school === 'string' ? body.school : undefined,
      level: body?.level === undefined ? undefined : toNumber(body.level, 0),
      hp: body?.hp === undefined ? undefined : toNumber(body.hp, 0),
      defense: body?.defense === undefined ? undefined : toNumber(body.defense, 0),
      magicDefense:
        body?.magicDefense === undefined
          ? undefined
          : toNumber(body.magicDefense, 0),
      magicDefenseCultivation:
        body?.magicDefenseCultivation === undefined
          ? undefined
          : toNumber(body.magicDefenseCultivation, 0),
      speed: body?.speed === undefined ? undefined : toNumber(body.speed, 0),
      element: typeof body?.element === 'string' ? body.element : undefined,
      formation: typeof body?.formation === 'string' ? body.formation : undefined,
      notes: typeof body?.notes === 'string' ? body.notes : undefined,
      payload:
        body?.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
          ? body.payload
          : undefined,
      enabled: typeof body?.enabled === 'boolean' ? body.enabled : undefined,
    });

    if (!item) {
      return respErr('battle target template not found');
    }

    return respData(item);
  } catch (error) {
    console.error('failed to update admin battle target template:', error);
    return respErr('failed to update admin battle target template');
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
    const deleted = await deleteAdminBattleTargetTemplate(id);
    if (!deleted) {
      return respErr('battle target template not found');
    }

    return respData({ success: true });
  } catch (error) {
    console.error('failed to delete admin battle target template:', error);
    return respErr('failed to delete admin battle target template');
  }
}
