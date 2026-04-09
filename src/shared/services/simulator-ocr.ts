import { getUuid } from '@/shared/lib/hash';
import {
  normalizeSimulatorOcrEquipmentType,
  type SimulatorOcrEquipmentType,
} from '@/shared/lib/simulator-equipment';
import { getAllConfigs } from '@/shared/models/config';
import {
  listEnabledSimulatorOcrDictionaryEntries,
  type SimulatorCharacterBundle,
  type SimulatorEquipment,
  type SimulatorOcrDictionary,
} from '@/shared/models/simulator';
import { getStorageService } from '@/shared/services/storage';

type SimulatorEquipmentLike = {
  id: string;
  name: string;
  type: SimulatorOcrEquipmentType;
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

type SimulatorProfileLike = {
  level?: number;
  faction?: string;
  physique?: number;
  magic?: number;
  strength?: number;
  endurance?: number;
  agility?: number;
  magicPower?: number;
  hp?: number;
  mp?: number;
  damage?: number;
  defense?: number;
  magicDamage?: number;
  magicDefense?: number;
  speed?: number;
  hit?: number;
  dodge?: number;
  sealHit?: number;
};

const GEMINI_VISION_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'] as const;
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
const PROFILE_FACTION_ALIASES: Record<string, string> = {
  龙宫: '龙宫',
  lg: '龙宫',
  大唐官府: '大唐官府',
  大唐: '大唐官府',
  dt: '大唐官府',
  狮驼岭: '狮驼岭',
  狮驼: '狮驼岭',
  stl: '狮驼岭',
  化生寺: '化生寺',
  化生: '化生寺',
  hs: '化生寺',
  方寸山: '方寸山',
  方寸: '方寸山',
  fc: '方寸山',
  普陀山: '普陀山',
  普陀: '普陀山',
  pt: '普陀山',
};

const OCR_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const OCR_MAX_FILE_SIZE = 10 * 1024 * 1024;

function toFiniteNumber(value: unknown, fallback: unknown = 0) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }

  const parsedFallback = Number(fallback);
  return Number.isFinite(parsedFallback) ? parsedFallback : 0;
}

function toOptionalFiniteNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.replace(/[,+，\s]/g, '').replace(/[^\d.-]/g, '');

  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
  return normalizeSimulatorOcrEquipmentType(String(value || ''));
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

function normalizeFaction(value: unknown) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return undefined;
  }

  return PROFILE_FACTION_ALIASES[normalized] ?? normalized;
}

function getFirstDefinedValue(
  sources: Array<Record<string, unknown>>,
  keys: string[]
) {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
  }

  return undefined;
}

export function normalizeRecognizedProfile(
  value: Record<string, unknown>
): SimulatorProfileLike {
  const sources = [
    value,
    isRecord(value.profile) ? value.profile : null,
    isRecord(value.attributes) ? value.attributes : null,
    isRecord(value.baseAttributes) ? value.baseAttributes : null,
    isRecord(value.combatStats) ? value.combatStats : null,
    isRecord(value.stats) ? value.stats : null,
  ].filter((source): source is Record<string, unknown> => Boolean(source));

  const normalizedProfile: SimulatorProfileLike = {
    level: toOptionalFiniteNumber(
      getFirstDefinedValue(sources, ['level', '等级'])
    ),
    faction: normalizeFaction(
      getFirstDefinedValue(sources, ['faction', 'school', '门派', '角色门派'])
    ),
    physique: toOptionalFiniteNumber(
      getFirstDefinedValue(sources, ['physique', '体质'])
    ),
    magic: toOptionalFiniteNumber(
      getFirstDefinedValue(sources, ['magic', '魔力'])
    ),
    strength: toOptionalFiniteNumber(
      getFirstDefinedValue(sources, ['strength', '力量'])
    ),
    endurance: toOptionalFiniteNumber(
      getFirstDefinedValue(sources, ['endurance', '耐力'])
    ),
    agility: toOptionalFiniteNumber(
      getFirstDefinedValue(sources, ['agility', '敏捷'])
    ),
    magicPower: toOptionalFiniteNumber(
      getFirstDefinedValue(sources, [
        'magicPower',
        'spirit',
        'spiritualPower',
        '灵力',
      ])
    ),
    hp: toOptionalFiniteNumber(getFirstDefinedValue(sources, ['hp', '气血'])),
    mp: toOptionalFiniteNumber(
      getFirstDefinedValue(sources, ['mp', 'mana', 'magicPoints', '魔法'])
    ),
    damage: toOptionalFiniteNumber(
      getFirstDefinedValue(sources, ['damage', '伤害'])
    ),
    defense: toOptionalFiniteNumber(
      getFirstDefinedValue(sources, ['defense', '防御'])
    ),
    magicDamage: toOptionalFiniteNumber(
      getFirstDefinedValue(sources, ['magicDamage', '法伤', '法术伤害'])
    ),
    magicDefense: toOptionalFiniteNumber(
      getFirstDefinedValue(sources, ['magicDefense', '法防', '法术防御'])
    ),
    speed: toOptionalFiniteNumber(
      getFirstDefinedValue(sources, ['speed', '速度'])
    ),
    hit: toOptionalFiniteNumber(getFirstDefinedValue(sources, ['hit', '命中'])),
    dodge: toOptionalFiniteNumber(
      getFirstDefinedValue(sources, ['dodge', '躲避'])
    ),
    sealHit: toOptionalFiniteNumber(
      getFirstDefinedValue(sources, ['sealHit', '封印命中'])
    ),
  };

  return Object.fromEntries(
    Object.entries(normalizedProfile).filter(
      ([, entryValue]) => entryValue !== undefined
    )
  ) as SimulatorProfileLike;
}

function parseProfileRawBody(value: string | null | undefined) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function mergeRecognizedProfileWithBundle(
  bundle: SimulatorCharacterBundle,
  recognizedProfile: SimulatorProfileLike
) {
  const currentProfile = bundle.profile;
  const rawProfile = parseProfileRawBody(currentProfile?.rawBodyJson);

  return {
    level:
      recognizedProfile.level ??
      toFiniteNumber(currentProfile?.level, bundle.character.level ?? 0),
    faction:
      recognizedProfile.faction ??
      currentProfile?.school ??
      bundle.character.school ??
      '',
    physique:
      recognizedProfile.physique ??
      toFiniteNumber(currentProfile?.physique, rawProfile.physique),
    magic:
      recognizedProfile.magic ??
      toFiniteNumber(currentProfile?.magic, rawProfile.magic),
    strength:
      recognizedProfile.strength ??
      toFiniteNumber(currentProfile?.strength, rawProfile.strength),
    endurance:
      recognizedProfile.endurance ??
      toFiniteNumber(currentProfile?.endurance, rawProfile.endurance),
    agility:
      recognizedProfile.agility ??
      toFiniteNumber(currentProfile?.agility, rawProfile.agility),
    magicPower:
      recognizedProfile.magicPower ??
      toFiniteNumber(
        rawProfile.magicPower,
        toFiniteNumber(rawProfile.spiritualPower)
      ),
    hp:
      recognizedProfile.hp ??
      toFiniteNumber(currentProfile?.hp, toFiniteNumber(rawProfile.hp)),
    mp: recognizedProfile.mp ?? toFiniteNumber(currentProfile?.mp),
    damage: recognizedProfile.damage ?? toFiniteNumber(currentProfile?.damage),
    defense:
      recognizedProfile.defense ?? toFiniteNumber(currentProfile?.defense),
    magicDamage:
      recognizedProfile.magicDamage ??
      toFiniteNumber(currentProfile?.magicDamage),
    magicDefense:
      recognizedProfile.magicDefense ??
      toFiniteNumber(currentProfile?.magicDefense),
    speed: recognizedProfile.speed ?? toFiniteNumber(currentProfile?.speed),
    hit: recognizedProfile.hit ?? toFiniteNumber(currentProfile?.hit),
    dodge: recognizedProfile.dodge ?? toFiniteNumber(rawProfile.dodge),
    sealHit:
      recognizedProfile.sealHit ?? toFiniteNumber(currentProfile?.sealHit),
  };
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
    starAlignment: value.starAlignment
      ? String(value.starAlignment)
      : undefined,
    factionRequirement: value.factionRequirement
      ? String(value.factionRequirement)
      : undefined,
    positionRequirement: value.positionRequirement
      ? String(value.positionRequirement)
      : undefined,
    specialEffect: value.specialEffect
      ? String(value.specialEffect)
      : undefined,
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

function applyDictionaryToText(
  text: string | undefined,
  entries: SimulatorOcrDictionary[]
) {
  if (!text) {
    return text;
  }

  const normalized = text.trim();
  if (!normalized) {
    return text;
  }

  const matched = entries.find((entry) => entry.rawText.trim() === normalized);
  return matched?.normalizedText?.trim() || text;
}

export function applySimulatorOcrDictionaryToEquipment<
  T extends Pick<
    SimulatorEquipmentLike,
    | 'name'
    | 'mainStat'
    | 'extraStat'
    | 'specialEffect'
    | 'refinementEffect'
    | 'gemstone'
    | 'description'
    | 'highlights'
  >,
>(equipment: T, entries: SimulatorOcrDictionary[]) {
  const equipmentNameEntries = entries.filter(
    (entry) => entry.dictType === 'equipment_name'
  );
  const attrEntries = entries.filter((entry) => entry.dictType === 'attr_name');
  const setEntries = entries.filter((entry) => entry.dictType === 'set_name');

  return {
    ...equipment,
    name: applyDictionaryToText(equipment.name, equipmentNameEntries) || equipment.name,
    mainStat:
      applyDictionaryToText(equipment.mainStat, attrEntries) || equipment.mainStat,
    extraStat: applyDictionaryToText(equipment.extraStat, attrEntries),
    specialEffect: applyDictionaryToText(equipment.specialEffect, attrEntries),
    refinementEffect: applyDictionaryToText(
      equipment.refinementEffect,
      attrEntries
    ),
    gemstone: applyDictionaryToText(equipment.gemstone, attrEntries),
    description: applyDictionaryToText(equipment.description, attrEntries),
    highlights: equipment.highlights?.map(
      (item) => applyDictionaryToText(item, setEntries) || item
    ),
  };
}

async function normalizeRecognizedEquipmentWithDictionary(
  value: Record<string, unknown>,
  imageUrl?: string
) {
  const normalizedEquipment = normalizeRecognizedEquipment(value, imageUrl);
  const entries = await listEnabledSimulatorOcrDictionaryEntries();
  return applySimulatorOcrDictionaryToEquipment(normalizedEquipment, entries);
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

export async function getSimulatorOcrConfigStatus(
  configs?: Awaited<ReturnType<typeof getAllConfigs>>
) {
  const resolvedConfigs = configs ?? (await getAllConfigs());
  const missing: string[] = [];
  const checks = [
    {
      key: 'gemini_api_key',
      label: 'Gemini API Key',
      configured: Boolean(resolvedConfigs.gemini_api_key),
    },
    {
      key: 'r2_account_id',
      label: 'R2 Account ID',
      configured: Boolean(
        resolvedConfigs.r2_account_id || resolvedConfigs.r2_endpoint
      ),
    },
    {
      key: 'r2_access_key',
      label: 'R2 Access Key',
      configured: Boolean(resolvedConfigs.r2_access_key),
    },
    {
      key: 'r2_secret_key',
      label: 'R2 Secret Key',
      configured: Boolean(resolvedConfigs.r2_secret_key),
    },
    {
      key: 'r2_bucket_name',
      label: 'R2 Bucket Name',
      configured: Boolean(resolvedConfigs.r2_bucket_name),
    },
  ];

  if (!resolvedConfigs.gemini_api_key) {
    missing.push('gemini_api_key');
  }

  if (!resolvedConfigs.r2_access_key) {
    missing.push('r2_access_key');
  }

  if (!resolvedConfigs.r2_secret_key) {
    missing.push('r2_secret_key');
  }

  if (!resolvedConfigs.r2_bucket_name) {
    missing.push('r2_bucket_name');
  }

  if (!resolvedConfigs.r2_account_id && !resolvedConfigs.r2_endpoint) {
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

export async function getSimulatorOcrAdminConfig() {
  const configs = await getAllConfigs();
  const status = await getSimulatorOcrConfigStatus(configs);

  return {
    geminiApiKey: configs.gemini_api_key ?? '',
    r2AccountId: configs.r2_account_id ?? '',
    r2Endpoint: configs.r2_endpoint ?? '',
    r2AccessKey: configs.r2_access_key ?? '',
    r2SecretKey: configs.r2_secret_key ?? '',
    r2BucketName: configs.r2_bucket_name ?? '',
    r2UploadPath: configs.r2_upload_path ?? '',
    status,
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

  return callGeminiStructuredOcr({
    ...params,
    prompt,
  });
}

async function callGeminiStructuredOcr(params: {
  apiKey: string;
  mimeType: string;
  imageBytes: Uint8Array;
  prompt: string;
}) {
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
                { text: params.prompt },
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

async function callGeminiProfileOcr(params: {
  apiKey: string;
  mimeType: string;
  imageBytes: Uint8Array;
}) {
  const prompt = [
    '你正在识别中文游戏《梦幻西游》的人物属性面板截图。',
    '请只返回一个 JSON 对象，不要输出 markdown，不要解释。',
    '只提取图片中明确可见的人物基础属性和面板数值；无法确认的字段请返回 null 或留空，不要猜。',
    '字段仅允许：level, faction, physique, magic, strength, endurance, agility, magicPower, hp, mp, damage, defense, magicDamage, magicDefense, speed, hit, dodge, sealHit。',
    '其中 faction 使用中文门派名，例如 龙宫、大唐官府、狮驼岭、化生寺、方寸山、普陀山。',
    'magic 表示基础加点里的“魔力”，mp 表示面板里的“魔法”，magicPower 表示“灵力”。',
    '如果图片里同时出现多个区域，只以主角色当前属性面板为准。',
  ].join('\n');

  return callGeminiStructuredOcr({
    ...params,
    prompt,
  });
}

export async function recognizeSimulatorEquipmentFromImage(file: File) {
  const configs = await getAllConfigs();
  const configStatus = await getSimulatorOcrConfigStatus(configs);
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
    equipment: await normalizeRecognizedEquipmentWithDictionary(
      recognized,
      uploaded.url
    ),
    raw: recognized,
  };
}

export async function recognizeSimulatorProfileFromImage(file: File) {
  const configs = await getAllConfigs();
  const configStatus = await getSimulatorOcrConfigStatus(configs);
  if (!configStatus.ready) {
    throw new Error(`识图配置未完成：${configStatus.missing.join(', ')}`);
  }

  const uploaded = await uploadSimulatorImage(file);
  const recognized = await callGeminiProfileOcr({
    apiKey: configs.gemini_api_key,
    mimeType: file.type,
    imageBytes: uploaded.buffer,
  });

  return {
    key: uploaded.key,
    url: uploaded.url,
    profile: normalizeRecognizedProfile(recognized),
    raw: recognized,
  };
}
