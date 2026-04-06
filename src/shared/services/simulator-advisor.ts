import { getAllConfigs } from '@/shared/models/config';

const DEFAULT_GEMINI_TEXT_MODEL = 'gemini-2.5-flash';
const LEGACY_GEMINI_TEXT_MODEL = 'gemini-2.0-flash';
const DEFAULT_ADVISOR_TEMPERATURE = 0.3;
const DEFAULT_ADVISOR_SYSTEM_PROMPT = [
  '你是《梦幻西游》龙宫数值实验室的配装顾问。',
  '你必须基于用户当前角色、战斗目标和实验室席位上下文回答。',
  '优先给出直接结论，再用 2-4 条说明原因。',
  '如果用户的问题涉及换装建议，请明确指出提升可能来自哪些属性或装备槽位。',
  '如果上下文不足，要直接说缺什么，不要编造。',
  '回答使用简洁中文，不要输出 Markdown 标题。',
].join('\n');

function parseBooleanConfig(value: unknown, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function parseNumberConfig(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeGeminiErrorMessage(status: number, detail: string) {
  const normalized = detail.toLowerCase();

  if (
    normalized.includes('user location is not supported for the api use') ||
    normalized.includes('failed_precondition')
  ) {
    return 'Gemini 当前不支持此服务器出口地区，请改用 Cloudflare 远端环境或受支持地区调用。';
  }

  return detail
    ? `AI 顾问请求失败: ${status} ${detail}`
    : `AI 顾问请求失败: ${status}`;
}

export async function getSimulatorAdvisorAdminConfig() {
  const configs = await getAllConfigs();

  return {
    enabled: parseBooleanConfig(configs.simulator_advisor_enabled, true),
    model:
      typeof configs.simulator_advisor_model === 'string' &&
      configs.simulator_advisor_model.trim()
        ? configs.simulator_advisor_model.trim()
        : DEFAULT_GEMINI_TEXT_MODEL,
    systemPrompt:
      typeof configs.simulator_advisor_system_prompt === 'string' &&
      configs.simulator_advisor_system_prompt.trim()
        ? configs.simulator_advisor_system_prompt
        : DEFAULT_ADVISOR_SYSTEM_PROMPT,
    temperature: parseNumberConfig(
      configs.simulator_advisor_temperature,
      DEFAULT_ADVISOR_TEMPERATURE
    ),
    hasGeminiKey: Boolean(configs.gemini_api_key),
  };
}

export async function getSimulatorAdvisorConfigStatus() {
  const config = await getSimulatorAdvisorAdminConfig();
  const missing = config.hasGeminiKey ? [] : ['gemini_api_key'];

  return {
    ready: config.enabled && missing.length === 0,
    missing: config.enabled ? missing : ['simulator_advisor_enabled'],
    checks: [
      {
        key: 'simulator_advisor_enabled',
        label: '顾问开关',
        configured: config.enabled,
      },
      {
        key: 'gemini_api_key',
        label: 'Gemini API Key',
        configured: config.hasGeminiKey,
      },
      {
        key: 'simulator_advisor_model',
        label: '顾问模型',
        configured: Boolean(config.model),
      },
      {
        key: 'simulator_advisor_system_prompt',
        label: '系统提示词',
        configured: Boolean(config.systemPrompt.trim()),
      },
    ],
    provider: 'Gemini',
    model: config.model,
    enabled: config.enabled,
  };
}

export async function generateSimulatorAdvisorReply(params: {
  userMessage: string;
  context: Record<string, unknown>;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}) {
  const configs = await getAllConfigs();
  const advisorConfig = await getSimulatorAdvisorAdminConfig();
  if (!advisorConfig.enabled) {
    throw new Error('AI 顾问当前已在后台停用');
  }

  if (!configs.gemini_api_key) {
    throw new Error('AI 顾问配置未完成：gemini_api_key');
  }

  const historyText = (params.history ?? [])
    .slice(-6)
    .map((message) => `${message.role === 'user' ? '用户' : '顾问'}：${message.content}`)
    .join('\n');

  const prompt = [
    advisorConfig.systemPrompt,
    historyText ? '' : '',
    historyText ? '最近对话：' : '',
    historyText || '',
    '',
    '当前上下文 JSON：',
    JSON.stringify(params.context, null, 2),
    '',
    '用户问题：',
    params.userMessage,
  ].join('\n');

  const candidateModels = Array.from(
    new Set([
      advisorConfig.model,
      DEFAULT_GEMINI_TEXT_MODEL,
      LEGACY_GEMINI_TEXT_MODEL,
    ].filter(Boolean))
  );

  let lastError: Error | null = null;

  for (const model of candidateModels) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${configs.gemini_api_key}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: advisorConfig.temperature,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      const detail = errorText.trim();
      lastError = new Error(normalizeGeminiErrorMessage(response.status, detail));

      if (response.status === 404 && model !== candidateModels.at(-1)) {
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
      return text;
    }

    lastError = new Error('AI 顾问没有返回内容');
  }

  throw lastError ?? new Error('AI 顾问没有返回内容');
}
