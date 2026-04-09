import { PERMISSIONS } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import {
  createAdminBattleTargetTemplate,
  listAdminBattleTargetTemplates,
} from '@/shared/models/simulator-admin';
import { getUserInfo } from '@/shared/models/user';
import { hasAllPermissions } from '@/shared/services/rbac';

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
    const sceneTypeParam = searchParams.get('sceneType');
    const limitParam = searchParams.get('limit');

    const items = await listAdminBattleTargetTemplates({
      enabled:
        enabledParam === 'true'
          ? true
          : enabledParam === 'false'
            ? false
            : undefined,
      sceneType:
        sceneTypeParam === 'manual' || sceneTypeParam === 'dungeon'
          ? sceneTypeParam
          : undefined,
      limit: limitParam ? toNumber(limitParam, 100) : 100,
    });

    return respData(items);
  } catch (error) {
    console.error('failed to list admin battle target templates:', error);
    return respErr('failed to list admin battle target templates');
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
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return respErr('name is required');
    }

    const item = await createAdminBattleTargetTemplate({
      sceneType:
        body?.sceneType === 'manual' || body?.sceneType === 'dungeon'
          ? body.sceneType
          : 'dungeon',
      name,
      dungeonName: typeof body?.dungeonName === 'string' ? body.dungeonName : '',
      targetType: typeof body?.targetType === 'string' ? body.targetType : 'mob',
      school: typeof body?.school === 'string' ? body.school : '',
      level: toNumber(body?.level, 0),
      hp: toNumber(body?.hp, 0),
      defense: toNumber(body?.defense, 0),
      magicDefense: toNumber(body?.magicDefense, 0),
      magicDefenseCultivation: toNumber(body?.magicDefenseCultivation, 0),
      speed: toNumber(body?.speed, 0),
      element: typeof body?.element === 'string' ? body.element : '',
      formation: typeof body?.formation === 'string' ? body.formation : '普通阵',
      notes: typeof body?.notes === 'string' ? body.notes : '',
      payload:
        body?.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
          ? body.payload
          : {},
      enabled: typeof body?.enabled === 'boolean' ? body.enabled : true,
    });

    return respData(item);
  } catch (error) {
    console.error('failed to create admin battle target template:', error);
    return respErr('failed to create admin battle target template');
  }
}
