import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import { hasAllPermissions } from '@/shared/services/rbac';
import { saveConfigs } from '@/shared/models/config';
import {
  parseSimulatorSeedConfigInput,
  serializeSimulatorSeedConfig,
} from '@/shared/models/simulator-template';
import { PERMISSIONS } from '@/core/rbac';

export async function PATCH(req: Request) {
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
    const parsedConfig = parseSimulatorSeedConfigInput({
      characterMeta: String(body?.characterMeta || ''),
      profile: String(body?.profile || ''),
      skills: String(body?.skills || ''),
      cultivations: String(body?.cultivations || ''),
      equipments: String(body?.equipments || ''),
      battleContext: String(body?.battleContext || ''),
    });

    const serialized = serializeSimulatorSeedConfig(parsedConfig);
    await saveConfigs(serialized);

    return respData(serialized);
  } catch (error) {
    console.error('failed to save simulator defaults:', error);
    return respErr('failed to save simulator defaults');
  }
}
