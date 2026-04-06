import { PERMISSIONS } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import { saveConfigs } from '@/shared/models/config';
import { getUserInfo } from '@/shared/models/user';
import { hasAllPermissions } from '@/shared/services/rbac';
import { getSimulatorAdvisorAdminConfig } from '@/shared/services/simulator-advisor';

function toNumber(value: unknown, fallback = 0.3) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET() {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth');
    }

    const allowed = await hasAllPermissions(user.id, [PERMISSIONS.SETTINGS_READ]);
    if (!allowed) {
      return respErr('no permission');
    }

    return respData(await getSimulatorAdvisorAdminConfig());
  } catch (error) {
    console.error('failed to load simulator advisor config:', error);
    return respErr('failed to load simulator advisor config');
  }
}

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
    await saveConfigs({
      simulator_advisor_enabled: String(Boolean(body?.enabled)),
      simulator_advisor_model:
        typeof body?.model === 'string' && body.model.trim()
          ? body.model.trim()
          : 'gemini-2.5-flash',
      simulator_advisor_system_prompt:
        typeof body?.systemPrompt === 'string' && body.systemPrompt.trim()
          ? body.systemPrompt
          : '',
      simulator_advisor_temperature: String(toNumber(body?.temperature, 0.3)),
    });

    return respData(await getSimulatorAdvisorAdminConfig());
  } catch (error) {
    console.error('failed to update simulator advisor config:', error);
    return respErr('failed to update simulator advisor config');
  }
}
