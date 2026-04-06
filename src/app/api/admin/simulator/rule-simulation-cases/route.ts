import { PERMISSIONS } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import {
  createRuleSimulationCase,
  listRuleSimulationCases,
} from '@/shared/models/rule-simulation-cases';
import { getUserInfo } from '@/shared/models/user';
import { hasAllPermissions } from '@/shared/services/rbac';

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

    const cases = await listRuleSimulationCases();
    return respData(cases);
  } catch (error) {
    console.error('failed to list rule simulation cases:', error);
    return respErr('failed to list rule simulation cases');
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

    const savedCase = await createRuleSimulationCase({
      name,
      versionId: typeof body?.versionId === 'string' ? body.versionId : undefined,
      input:
        body?.input && typeof body.input === 'object' && !Array.isArray(body.input)
          ? body.input
          : {},
      expectedResult:
        body?.expectedResult &&
        typeof body.expectedResult === 'object' &&
        !Array.isArray(body.expectedResult)
          ? body.expectedResult
          : {},
      notes: typeof body?.notes === 'string' ? body.notes : '',
      createdBy: user.id,
    });

    return respData(savedCase);
  } catch (error) {
    console.error('failed to create rule simulation case:', error);
    return respErr(
      error instanceof Error ? error.message : 'failed to create rule simulation case',
    );
  }
}
