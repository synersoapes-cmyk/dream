import { PERMISSIONS } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import { saveConfigs } from '@/shared/models/config';
import { getUserInfo } from '@/shared/models/user';
import { getSimulatorOcrAdminConfig } from '@/shared/services/simulator-ocr';
import { hasAllPermissions } from '@/shared/services/rbac';

function toConfigValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET() {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth');
    }

    const allowed = await hasAllPermissions(user.id, [
      PERMISSIONS.SETTINGS_READ,
    ]);
    if (!allowed) {
      return respErr('no permission');
    }

    return respData(await getSimulatorOcrAdminConfig());
  } catch (error) {
    console.error('failed to load admin simulator OCR config status:', error);
    return respErr('failed to load admin simulator OCR config status');
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
      gemini_api_key: toConfigValue(body?.geminiApiKey),
      r2_account_id: toConfigValue(body?.r2AccountId),
      r2_endpoint: toConfigValue(body?.r2Endpoint),
      r2_access_key: toConfigValue(body?.r2AccessKey),
      r2_secret_key: toConfigValue(body?.r2SecretKey),
      r2_bucket_name: toConfigValue(body?.r2BucketName),
      r2_upload_path: toConfigValue(body?.r2UploadPath),
    });

    return respData(await getSimulatorOcrAdminConfig());
  } catch (error) {
    console.error('failed to update admin simulator OCR config:', error);
    return respErr('failed to update admin simulator OCR config');
  }
}
