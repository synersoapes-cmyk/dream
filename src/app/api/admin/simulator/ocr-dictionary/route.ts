import { PERMISSIONS } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import {
  createAdminSimulatorOcrDictionary,
  listAdminSimulatorOcrDictionary,
} from '@/shared/models/simulator';
import { getUserInfo } from '@/shared/models/user';
import { hasAllPermissions } from '@/shared/services/rbac';

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
    const dictType = searchParams.get('dictType') || 'all';
    const enabledParam = searchParams.get('enabled');
    const limit = Number(searchParams.get('limit') || 200);

    return respData(
      await listAdminSimulatorOcrDictionary({
        dictType: dictType as
          | 'all'
          | 'equipment_name'
          | 'skill_name'
          | 'attr_name'
          | 'set_name',
        enabled:
          enabledParam === null
            ? undefined
            : enabledParam === 'true' || enabledParam === '1',
        limit,
      })
    );
  } catch (error) {
    console.error('failed to load admin simulator OCR dictionary:', error);
    return respErr('failed to load admin simulator OCR dictionary');
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
    return respData(
      await createAdminSimulatorOcrDictionary({
        dictType: body?.dictType || 'equipment_name',
        rawText: typeof body?.rawText === 'string' ? body.rawText : '',
        normalizedText:
          typeof body?.normalizedText === 'string' ? body.normalizedText : '',
        priority: Number(body?.priority) || 0,
        enabled: Boolean(body?.enabled ?? true),
        createdBy: user.email || user.name || user.id,
      })
    );
  } catch (error) {
    console.error('failed to create admin simulator OCR dictionary:', error);
    return respErr('failed to create admin simulator OCR dictionary');
  }
}
