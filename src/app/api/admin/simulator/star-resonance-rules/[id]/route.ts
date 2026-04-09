import { PERMISSIONS } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import {
  deleteAdminSimulatorStarResonanceRule,
  updateAdminSimulatorStarResonanceRule,
} from '@/shared/models/simulator-admin';
import { getUserInfo } from '@/shared/models/user';
import { hasAllPermissions } from '@/shared/services/rbac';

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
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
    const item = await updateAdminSimulatorStarResonanceRule(id, {
      scope: typeof body?.scope === 'string' ? body.scope : undefined,
      slot: typeof body?.slot === 'string' ? body.slot : undefined,
      comboName: typeof body?.comboName === 'string' ? body.comboName : undefined,
      requiredColors: body?.requiredColors === undefined ? undefined : toStringArray(body.requiredColors),
      bonusAttrType: typeof body?.bonusAttrType === 'string' ? body.bonusAttrType : undefined,
      bonusAttrValue:
        body?.bonusAttrValue === undefined ? undefined : toNumber(body.bonusAttrValue, 0),
      globalBonus:
        body?.globalBonus && typeof body.globalBonus === 'object' && !Array.isArray(body.globalBonus)
          ? body.globalBonus
          : body?.globalBonus === undefined
            ? undefined
            : {},
      sort: body?.sort === undefined ? undefined : toNumber(body.sort, 0),
      enabled: typeof body?.enabled === 'boolean' ? body.enabled : undefined,
      notes: typeof body?.notes === 'string' ? body.notes : undefined,
    });

    if (!item) {
      return respErr('star resonance rule not found');
    }

    return respData(item);
  } catch (error) {
    console.error('failed to update admin simulator star resonance rule:', error);
    return respErr(
      error instanceof Error ? error.message : 'failed to update admin simulator star resonance rule'
    );
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
    const deleted = await deleteAdminSimulatorStarResonanceRule(id);
    if (!deleted) {
      return respErr('star resonance rule not found');
    }

    return respData({ success: true });
  } catch (error) {
    console.error('failed to delete admin simulator star resonance rule:', error);
    return respErr('failed to delete admin simulator star resonance rule');
  }
}
