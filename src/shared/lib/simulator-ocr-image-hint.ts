export const SIMULATOR_EQUIPMENT_OCR_IMAGE_HINT_OPTIONS = [
  {
    value: 'auto',
    label: '自动识别',
    description:
      '默认推荐，先让系统判断更像藏宝阁、聊天框预览还是普通装备图，再套对应识别重点。',
  },
  {
    value: 'general',
    label: '通用装备图',
    description: '默认口径，适合普通装备截图或裁切后的单件装备图。',
  },
  {
    value: 'cangbaoge',
    label: '藏宝阁截图',
    description: '更关注价格、跨服费、装备亮点与完整属性区。',
  },
  {
    value: 'chat_preview',
    label: '聊天框预览',
    description: '更关注小窗预览中的装备名、等级、主属性与特效。',
  },
] as const;

export type SimulatorEquipmentOcrImageHint =
  (typeof SIMULATOR_EQUIPMENT_OCR_IMAGE_HINT_OPTIONS)[number]['value'];

const HINT_SET = new Set<string>(
  SIMULATOR_EQUIPMENT_OCR_IMAGE_HINT_OPTIONS.map((item) => item.value)
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeSimulatorEquipmentOcrImageHint(
  value: unknown,
  fallback: SimulatorEquipmentOcrImageHint = 'auto'
): SimulatorEquipmentOcrImageHint {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return HINT_SET.has(normalized)
    ? (normalized as SimulatorEquipmentOcrImageHint)
    : fallback;
}

export function getSimulatorEquipmentOcrImageHintPrompt(
  hint: SimulatorEquipmentOcrImageHint
) {
  switch (hint) {
    case 'auto':
      return '请你先根据版式自行判断这张图更接近藏宝阁详情页、聊天框装备预览还是普通装备截图，再按最匹配的类型优先识别对应区域；如果判断不明显，就按普通装备图处理。';
    case 'cangbaoge':
      return '这张图更可能来自藏宝阁详情页，请优先识别售价、跨服费、装备图、黄字亮点、熔炼、开孔、修理失败、宝石、特技特效等区域；看不清的价格字段允许留空。';
    case 'chat_preview':
      return '这张图更可能来自聊天框装备预览，文字区域通常更小更密。请优先识别装备名、等级、部位、主属性、特技特效、宝石、开孔与双加；价格和跨服费通常不存在，可留空。';
    default:
      return '这是一张通用装备截图，请综合识别装备主体、属性、特效、套装、开孔、宝石和价格区。';
  }
}

export function buildSimulatorEquipmentOcrImageHintMeta(
  hint: SimulatorEquipmentOcrImageHint
) {
  return {
    imageHint: hint,
    routingMode: hint === 'auto' ? 'automatic' : 'manual',
  } as const;
}

export function getSimulatorEquipmentOcrImageHintLabel(
  hint: SimulatorEquipmentOcrImageHint
) {
  return (
    SIMULATOR_EQUIPMENT_OCR_IMAGE_HINT_OPTIONS.find(
      (item) => item.value === hint
    )?.label ?? hint
  );
}

export function attachSimulatorEquipmentOcrImageHintMeta(
  rawResult: Record<string, unknown>,
  hint: SimulatorEquipmentOcrImageHint
) {
  return {
    ...rawResult,
    _ocrMeta: buildSimulatorEquipmentOcrImageHintMeta(hint),
  };
}

export function readSimulatorEquipmentOcrImageHintMeta(rawResult: unknown): {
  imageHint: SimulatorEquipmentOcrImageHint;
  routingMode: 'automatic' | 'manual';
  label: string;
} | null {
  if (!isRecord(rawResult) || !isRecord(rawResult._ocrMeta)) {
    return null;
  }

  const imageHint = normalizeSimulatorEquipmentOcrImageHint(
    rawResult._ocrMeta.imageHint,
    'auto'
  );
  const routingMode =
    rawResult._ocrMeta.routingMode === 'manual' ? 'manual' : 'automatic';

  return {
    imageHint,
    routingMode,
    label: getSimulatorEquipmentOcrImageHintLabel(imageHint),
  };
}
