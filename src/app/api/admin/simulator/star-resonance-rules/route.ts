import { PERMISSIONS } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import {
  createAdminSimulatorStarResonanceRule,
  listAdminSimulatorStarResonanceRules,
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

export async function GET(req: Request) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth');
    }

    const allowed = await hasAllPermissions(user.id, [PERMISSIONS.SETTINGS_READ]);
    if (!allowed) {
      return respErr('no permission');
    }

    const { searchParams } = new URL(req.url);
    const enabledParam = searchParams.get('enabled');
    const limitParam = searchParams.get('limit');

    const items = await listAdminSimulatorStarResonanceRules({
      enabled:
        enabledParam === 'true'
          ? true
          : enabledParam === 'false'
            ? false
            : undefined,
      limit: limitParam ? toNumber(limitParam, 100) : 100,
    });

    return respData(items);
  } catch (error) {
    console.error('failed to list admin simulator star resonance rules:', error);
    return respErr('failed to list admin simulator star resonance rules');
  }
}

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
    const slot = typeof body?.slot === 'string' ? body.slot.trim() : '';
    const comboName = typeof body?.comboName === 'string' ? body.comboName.trim() : '';

    if (!slot || !comboName) {
      return respErr('slot and comboName are required');
    }

    const item = await createAdminSimulatorStarResonanceRule({
      scope: typeof body?.scope === 'string' ? body.scope : 'system',
      slot,
      comboName,
      requiredColors: toStringArray(body?.requiredColors),
      bonusAttrType: typeof body?.bonusAttrType === 'string' ? body.bonusAttrType : '',
      bonusAttrValue: toNumber(body?.bonusAttrValue, 0),
      globalBonus:
        body?.globalBonus && typeof body.globalBonus === 'object' && !Array.isArray(body.globalBonus)
          ? body.globalBonus
          : {},
      sort: toNumber(body?.sort, 0),
      enabled: typeof body?.enabled === 'boolean' ? body.enabled : true,
      notes: typeof body?.notes === 'string' ? body.notes : '',
    });

    return respData(item);
  } catch (error) {
    console.error('failed to create admin simulator star resonance rule:', error);
    return respErr(
      error instanceof Error ? error.message : 'failed to create admin simulator star resonance rule'
    );
  }
}
