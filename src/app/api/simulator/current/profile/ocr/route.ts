import { respData, respErr } from '@/shared/lib/resp';
import {
  createSimulatorOcrJob,
  finalizeSimulatorProfileOcrJob,
  getSimulatorCharacterBundle,
  markSimulatorOcrJobFailed,
  updateSimulatorProfile,
} from '@/shared/models/simulator-user';
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

    const job = await createSimulatorOcrJob(user.id, {
      sceneType: 'profile',
    });

    if (!job) {
      return respErr('simulator character not found');
    }

    try {
      const recognized = await recognizeSimulatorProfileFromImage(file);
      const bundle = await updateSimulatorProfile(
        user.id,
        mergeRecognizedProfileWithBundle(currentBundle, recognized.profile)
      );

      if (!bundle) {
        return respErr('simulator character not found');
      }

      const finalized = await finalizeSimulatorProfileOcrJob({
        ocrJobId: job.id,
        recognizedProfile: recognized.profile as Record<string, unknown>,
        rawResult: recognized.raw,
        imageUrl: recognized.url,
      });

      return respData({
        bundle,
        recognized: recognized.profile,
        raw: recognized.raw,
        upload: {
          key: recognized.key,
          url: recognized.url,
        },
        ocrJobId: job.id,
        ocrDraftId: finalized?.draftId ?? null,
      });
    } catch (error) {
      await markSimulatorOcrJobFailed({
        ocrJobId: job.id,
        errorMessage:
          error instanceof Error ? error.message : '识图失败，请稍后重试',
      });
      throw error;
    }
  } catch (error) {
    console.error('failed to OCR simulator profile:', error);
    return respErr(
      error instanceof Error ? error.message : '识图失败，请稍后重试'
    );
  }
}
