import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import { getSimulatorOcrConfigStatus } from '@/shared/services/simulator-ocr';

export async function GET() {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const status = await getSimulatorOcrConfigStatus();
    return respData(status);
  } catch (error) {
    console.error('failed to load simulator OCR config status:', error);
    return respErr('failed to load simulator OCR config status');
  }
}
