import { respData, respErr } from '@/shared/lib/resp';
import {
  getSimulatorCharacterBundle,
  updateSimulatorProfile,
} from '@/shared/models/simulator';
import { getUserInfo } from '@/shared/models/user';
import {
  mergeRecognizedProfileWithBundle,
  recognizeSimulatorProfileFromImage,
  validateSimulatorOcrFile,
} from '@/shared/services/simulator-ocr';

export async function POST(req: Request) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return respErr('缺少图片文件');
    }

    const validation = validateSimulatorOcrFile(file);
    if (!validation.valid) {
      return respErr(validation.error || '图片文件不合法');
    }

    const currentBundle = await getSimulatorCharacterBundle(user.id);
    if (!currentBundle) {
      return respErr('simulator character not found');
    }

    const recognized = await recognizeSimulatorProfileFromImage(file);
    const bundle = await updateSimulatorProfile(
      user.id,
      mergeRecognizedProfileWithBundle(currentBundle, recognized.profile)
    );

    if (!bundle) {
      return respErr('simulator character not found');
    }

    return respData({
      bundle,
      recognized: recognized.profile,
      raw: recognized.raw,
      upload: {
        key: recognized.key,
        url: recognized.url,
      },
    });
  } catch (error) {
    console.error('failed to OCR simulator profile:', error);
    return respErr(
      error instanceof Error ? error.message : '识图失败，请稍后重试'
    );
  }
}
