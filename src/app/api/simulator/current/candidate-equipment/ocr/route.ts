import { respData, respErr } from '@/shared/lib/resp';
import { appendSimulatorCandidateEquipment } from '@/shared/models/simulator';
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

    if (!(file instanceof File)) {
      return respErr('缺少图片文件');
    }

    const validation = validateSimulatorOcrFile(file);
    if (!validation.valid) {
      return respErr(validation.error || '图片文件不合法');
    }

    const recognized = await recognizeSimulatorEquipmentFromImage(file);
    const items = await appendSimulatorCandidateEquipment(user.id, {
      equipment: recognized.equipment,
      imagePreview: recognized.url,
      rawText: JSON.stringify(recognized.raw),
      status: 'pending',
    });

    if (!items) {
      return respErr('simulator character not found');
    }

    return respData({
      item: items[items.length - 1] ?? null,
      items,
      upload: {
        key: recognized.key,
        url: recognized.url,
      },
    });
  } catch (error) {
    console.error('failed to OCR simulator candidate equipment:', error);
    return respErr(
      error instanceof Error ? error.message : '识图失败，请稍后重试'
    );
  }
}
