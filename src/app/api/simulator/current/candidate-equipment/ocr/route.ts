import { respData, respErr } from '@/shared/lib/resp';
import {
  attachSimulatorEquipmentOcrImageHintMeta,
  normalizeSimulatorEquipmentOcrImageHint,
} from '@/shared/lib/simulator-ocr-image-hint';
import {
  createSimulatorOcrJob,
  finalizeSimulatorEquipmentOcrJob,
  markSimulatorOcrJobFailed,
} from '@/shared/models/simulator-user';
import { getUserInfo } from '@/shared/models/user';
import {
  recognizeSimulatorEquipmentFromImage,
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
    const rawCharacterId = formData.get('characterId');
    const rawImageHint = formData.get('imageHint');
    const characterId =
      typeof rawCharacterId === 'string' && rawCharacterId.trim().length > 0
        ? rawCharacterId.trim()
        : undefined;
    const imageHint = normalizeSimulatorEquipmentOcrImageHint(
      rawImageHint,
      'auto'
    );

    if (!(file instanceof File)) {
      return respErr('缺少图片文件');
    }

    const validation = validateSimulatorOcrFile(file);
    if (!validation.valid) {
      return respErr(validation.error || '图片文件不合法');
    }

    const job = await createSimulatorOcrJob(user.id, {
      sceneType: 'equipment',
      characterId,
    });

    if (!job) {
      return respErr('simulator character not found');
    }

    try {
      const recognized = await recognizeSimulatorEquipmentFromImage(file, {
        imageHint,
      });
      const rawResult = attachSimulatorEquipmentOcrImageHintMeta(
        recognized.raw,
        imageHint
      );
      const result = await finalizeSimulatorEquipmentOcrJob({
        ocrJobId: job.id,
        recognizedEquipment: recognized.equipment,
        rawResult,
        imageUrl: recognized.url,
        imageKey: recognized.key,
      });

      if (!result) {
        return respErr('simulator OCR job not found');
      }

      return respData({
        item: result.item,
        items: result.items,
        upload: {
          key: recognized.key,
          url: recognized.url,
        },
        ocrJobId: job.id,
        ocrDraftId: result.draftId,
      });
    } catch (error) {
      await markSimulatorOcrJobFailed({
        ocrJobId: job.id,
        errorMessage:
          error instanceof Error ? error.message : '识图失败，请稍后重试',
        rawResult: attachSimulatorEquipmentOcrImageHintMeta({}, imageHint),
      });
      throw error;
    }
  } catch (error) {
    console.error('failed to OCR simulator candidate equipment:', error);
    return respErr(
      error instanceof Error ? error.message : '识图失败，请稍后重试'
    );
  }
}
