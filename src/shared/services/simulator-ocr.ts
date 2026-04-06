import { getUuid } from '@/shared/lib/hash';
import { getAllConfigs } from '@/shared/models/config';
import { getStorageService } from '@/shared/services/storage';

type SimulatorEquipmentLike = {
  id: string;
  name: string;
  type:
    | 'weapon'
    | 'helmet'
    | 'necklace'
    | 'armor'
    | 'belt'
    | 'shoes'
    | 'trinket'
    | 'jade';
  slot?: number;
  mainStat: string;
  extraStat?: string;
  highlights?: string[];
  baseStats: Record<string, number>;
  stats: Record<string, number>;
  price?: number;
  crossServerFee?: number;
  imageUrl?: string;
  level?: number;
  element?: string;
  durability?: number;
  forgeLevel?: number;
  gemstone?: string;
  luckyHoles?: string;
  starPosition?: string;
  starAlignment?: string;
  factionRequirement?: string;
  positionRequirement?: string;
  specialEffect?: string;
  manufacturer?: string;
  refinementEffect?: string;
  description?: string;
  equippableRoles?: string;
};

const GEMINI_VISION_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'] as const;
const SUPPORTED_TYPES = new Set([
  'weapon',
  'helmet',
  'necklace',
  'armor',
  'belt',
  'shoes',
  'trinket',
  'jade',
]);
const STAT_KEYS = new Set([
  'hp',
  'magic',
  'hit',
  'damage',
  'magicDamage',
  'defense',
  'magicDefense',
  'speed',
  'dodge',
  'physique',
  'magicPower',
  'strength',
  'endurance',
  'agility',
]);

const OCR_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const OCR_MAX_FILE_SIZE = 10 * 1024 * 1024;

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function extFromMime(mimeType: string) {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };

  return map[mimeType] || 'png';
}

function extractJsonText(text: string) {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text.trim();
}

function normalizeGeminiOcrErrorMessage(status: number, detail: string) {
  const normalized = detail.toLowerCase();

  if (
    normalized.includes('user location is not supported for the api use') ||
    normalized.includes('failed_precondition')
  ) {
    return 'Gemini 当前不支持此服务器出口地区，请改用 Cloudflare 远端环境或受支持地区调用。';
  }

  return detail
    ? `Gemini 识图失败: ${status} ${detail}`
    : `Gemini 识图失败: ${status}`;
}

function normalizeEquipmentType(value: unknown) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  const aliasMap: Record<string, SimulatorEquipmentLike['type']> = {
    weapon: 'weapon',
    helmet: 'helmet',
    necklace: 'necklace',
    armor: 'armor',
    belt: 'belt',
    shoes: 'shoes',
    trinket: 'trinket',
    jade: 'jade',
    武器: 'weapon',
    头盔: 'helmet',
    项链: 'necklace',
    衣服: 'armor',
    腰带: 'belt',
    鞋子: 'shoes',
    戒指: 'trinket',
    耳饰: 'trinket',
    手镯: 'trinket',
    佩饰: 'trinket',
    灵饰: 'trinket',
    玉魄: 'jade',
    阳玉: 'jade',
    阴玉: 'jade',
  };

  return aliasMap[normalized] ?? (SUPPORTED_TYPES.has(normalized) ? (normalized as SimulatorEquipmentLike['type']) : 'weapon');
}

function normalizeStats(value: unknown) {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => STAT_KEYS.has(key))
      .map(([key, statValue]) => [key, toFiniteNumber(statValue)])
      .filter(([, statValue]) => Number.isFinite(statValue))
  ) as Record<string, number>;
}

export function normalizeRecognizedEquipment(
  value: Record<string, unknown>,
  imageUrl?: string
): SimulatorEquipmentLike {
  const type = normalizeEquipmentType(value.type);
  const stats = normalizeStats(value.stats);
  let slot: number | undefined;

  if (type === 'trinket') {
    slot = Math.max(1, Math.min(4, Math.floor(toFiniteNumber(value.slot, 1))));
  } else if (type === 'jade') {
    slot = Math.max(1, Math.min(2, Math.floor(toFiniteNumber(value.slot, 1))));
  }

  return {
    id: String(value.id || getUuid()),
    name: String(value.name || '未命名装备'),
    type,
    slot,
    mainStat: String(value.mainStat || '待补充属性'),
    extraStat: value.extraStat ? String(value.extraStat) : undefined,
    highlights: Array.isArray(value.highlights)
      ? value.highlights
          .map((item) => String(item).trim())
          .filter((item) => item.length > 0)
      : undefined,
    baseStats: stats,
    stats,
    price: value.price !== undefined ? toFiniteNumber(value.price) : undefined,
    crossServerFee:
      value.crossServerFee !== undefined
        ? toFiniteNumber(value.crossServerFee)
        : undefined,
    imageUrl,
    level: value.level !== undefined ? toFiniteNumber(value.level) : undefined,
    element: value.element ? String(value.element) : undefined,
    durability:
      value.durability !== undefined
        ? toFiniteNumber(value.durability)
        : undefined,
    forgeLevel:
      value.forgeLevel !== undefined
        ? toFiniteNumber(value.forgeLevel)
        : undefined,
    gemstone: value.gemstone ? String(value.gemstone) : undefined,
    luckyHoles: value.luckyHoles ? String(value.luckyHoles) : undefined,
    starPosition: value.starPosition ? String(value.starPosition) : undefined,
    starAlignment: value.starAlignment ? String(value.starAlignment) : undefined,
    factionRequirement: value.factionRequirement
      ? String(value.factionRequirement)
      : undefined,
    positionRequirement: value.positionRequirement
      ? String(value.positionRequirement)
      : undefined,
    specialEffect: value.specialEffect ? String(value.specialEffect) : undefined,
    manufacturer: value.manufacturer ? String(value.manufacturer) : undefined,
    refinementEffect: value.refinementEffect
      ? String(value.refinementEffect)
      : undefined,
    description: value.description ? String(value.description) : undefined,
    equippableRoles: value.equippableRoles
      ? String(value.equippableRoles)
      : undefined,
  };
}

export function validateSimulatorOcrFile(file: File): {
  valid: boolean;
  error?: string;
} {
  if (!OCR_ALLOWED_MIME_TYPES.has(file.type)) {
    return { valid: false, error: '仅支持 JPG、PNG、WEBP 格式图片' };
  }

  if (file.size <= 0) {
    return { valid: false, error: '图片文件不能为空' };
  }

  if (file.size > OCR_MAX_FILE_SIZE) {
    return { valid: false, error: '图片大小不能超过 10MB' };
  }

  return { valid: true };
}

async function uploadSimulatorImage(file: File) {
  const configs = await getAllConfigs();
  const storageService = await getStorageService(configs);
  const arrayBuffer = await file.arrayBuffer();
  const body = new Uint8Array(arrayBuffer);
  const ext = extFromMime(file.type);
  const key = `simulator/ocr/${getUuid()}.${ext}`;
  const uploadResult = await storageService.uploadFile({
    body,
    key,
    contentType: file.type,
    disposition: 'inline',
  });

  if (!uploadResult.success || !uploadResult.url) {
    throw new Error(uploadResult.error || '上传识别原图失败');
  }

  return {
    buffer: body,
    key: uploadResult.key || key,
    url: uploadResult.url,
  };
}

export async function getSimulatorOcrConfigStatus() {
  const configs = await getAllConfigs();
  const missing: string[] = [];
  const checks = [
    {
      key: 'gemini_api_key',
      label: 'Gemini API Key',
      configured: Boolean(configs.gemini_api_key),
    },
    {
      key: 'r2_account_id',
      label: 'R2 Account ID',
      configured: Boolean(configs.r2_account_id || configs.r2_endpoint),
    },
    {
      key: 'r2_access_key',
      label: 'R2 Access Key',
      configured: Boolean(configs.r2_access_key),
    },
    {
      key: 'r2_secret_key',
      label: 'R2 Secret Key',
      configured: Boolean(configs.r2_secret_key),
    },
    {
      key: 'r2_bucket_name',
      label: 'R2 Bucket Name',
      configured: Boolean(configs.r2_bucket_name),
    },
  ];

  if (!configs.gemini_api_key) {
    missing.push('gemini_api_key');
  }

  if (!configs.r2_access_key) {
    missing.push('r2_access_key');
  }

  if (!configs.r2_secret_key) {
    missing.push('r2_secret_key');
  }

  if (!configs.r2_bucket_name) {
    missing.push('r2_bucket_name');
  }

  if (!configs.r2_account_id && !configs.r2_endpoint) {
    missing.push('r2_account_id_or_r2_endpoint');
  }

  return {
    ready: missing.length === 0,
    missing,
    checks,
    providers: {
      ocr: 'Gemini',
      storage: 'Cloudflare R2',
    },
  };
}

async function callGeminiEquipmentOcr(params: {
  apiKey: string;
  mimeType: string;
  imageBytes: Uint8Array;
}) {
  const prompt = [
    '你正在识别中文游戏《梦幻西游》的装备截图。',
    '请只返回一个 JSON 对象，不要输出 markdown，不要解释。',
    '字段要求：',
    'type: weapon|helmet|necklace|armor|belt|shoes|trinket|jade',
    'slot: 灵饰或玉魄槽位数字，普通装备不要填',
    'name, mainStat, extraStat, level, element, durability, forgeLevel, gemstone, luckyHoles, starPosition, starAlignment, factionRequirement, positionRequirement, specialEffect, manufacturer, refinementEffect, description, equippableRoles',
    'highlights: string[]',
    'price, crossServerFee: number，可缺省',
    'stats: 对应数值对象，key 仅允许 hp, magic, hit, damage, magicDamage, defense, magicDefense, speed, dodge, physique, magicPower, strength, endurance, agility',
    '如果无法确认就留空，不要编造明显不在图中的字段。',
  ].join('\n');

  let lastError: Error | null = null;

  for (const model of GEMINI_VISION_MODELS) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${params.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: params.mimeType,
                    data: Buffer.from(params.imageBytes).toString('base64'),
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      const detail = errorText.trim();
      lastError = new Error(
        normalizeGeminiOcrErrorMessage(response.status, detail)
      );

      if (response.status === 404 && model !== GEMINI_VISION_MODELS.at(-1)) {
        continue;
      }

      throw lastError;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part: Record<string, unknown>) => String(part.text || ''))
      .join('\n')
      .trim();

    if (text) {
      return JSON.parse(extractJsonText(text)) as Record<string, unknown>;
    }

    lastError = new Error('Gemini 没有返回可解析内容');
  }

  throw lastError ?? new Error('Gemini 没有返回可解析内容');
}

export async function recognizeSimulatorEquipmentFromImage(file: File) {
  const configs = await getAllConfigs();
  const configStatus = await getSimulatorOcrConfigStatus();
  if (!configStatus.ready) {
    throw new Error(`识图配置未完成：${configStatus.missing.join(', ')}`);
  }

  const uploaded = await uploadSimulatorImage(file);
  const recognized = await callGeminiEquipmentOcr({
    apiKey: configs.gemini_api_key,
    mimeType: file.type,
    imageBytes: uploaded.buffer,
  });

  return {
    key: uploaded.key,
    url: uploaded.url,
    equipment: normalizeRecognizedEquipment(recognized, uploaded.url),
    raw: recognized,
  };
}
