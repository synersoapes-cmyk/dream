import type { Equipment, PendingEquipment } from '@/features/simulator/store/gameTypes';

import {
  getSimulatorEquipmentFieldLabel,
  SIMULATOR_EQUIPMENT_TYPE_STAT_HINTS,
} from '@/shared/lib/simulator-equipment-editor';
import { isSimulatorOcrEquipmentType } from '@/shared/lib/simulator-equipment';
import { getSimulatorStatLabel } from '@/shared/lib/simulator-stat-labels';

type OcrReviewFieldStatus = 'recognized' | 'missing';
type OcrReviewConfidenceTone = 'high' | 'medium' | 'low';

export type SimulatorEquipmentOcrReviewField = {
  key: string;
  label: string;
  status: OcrReviewFieldStatus;
  value?: string;
  reason?: string;
};

export type SimulatorEquipmentOcrReviewSummary = {
  confidenceScore: number;
  confidenceLabel: string;
  confidenceTone: OcrReviewConfidenceTone;
  recognizedFieldCount: number;
  recognizedCoreFieldCount: number;
  recognizedStatCount: number;
  recognizedFields: SimulatorEquipmentOcrReviewField[];
  recognizedCoreFields: SimulatorEquipmentOcrReviewField[];
  missingFields: SimulatorEquipmentOcrReviewField[];
  missingSuggestedStats: SimulatorEquipmentOcrReviewField[];
  summaryLines: string[];
  recommendedChecks: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseRawResult(rawText?: string) {
  if (!rawText?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawText) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getRecognizedRawRecord(rawResult: Record<string, unknown> | null) {
  if (!rawResult) {
    return null;
  }

  if (isRecord(rawResult.recognized)) {
    return rawResult.recognized;
  }

  return rawResult;
}

function inferConfidenceScore(rawResult: Record<string, unknown> | null) {
  if (!rawResult) {
    return 0.8;
  }

  const candidates = [
    rawResult.confidence,
    rawResult.confidenceScore,
    isRecord(rawResult.meta) ? rawResult.meta.confidence : undefined,
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(parsed, 1));
    }
  }

  return 0.8;
}

function formatValue(value: unknown) {
  if (typeof value === 'number') {
    return value.toLocaleString('zh-CN');
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? '').trim())
      .filter(Boolean)
      .join(' / ');
  }

  return String(value ?? '').trim();
}

function hasValue(value: unknown) {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) && value !== 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (isRecord(value)) {
    return Object.keys(value).length > 0;
  }

  return true;
}

function buildCoreFieldEntries(
  equipment: Equipment,
  rawRecord: Record<string, unknown> | null
) {
  const entries: SimulatorEquipmentOcrReviewField[] = [];
  const pushField = (
    key: keyof Equipment | 'slot',
    reason: string,
    value: unknown = equipment[key]
  ) => {
    const label = getSimulatorEquipmentFieldLabel(key);
    if (hasValue(value)) {
      entries.push({
        key,
        label,
        status: 'recognized',
        value: formatValue(value),
      });
      return;
    }

    const rawValue = rawRecord?.[key];
    if (hasValue(rawValue)) {
      entries.push({
        key,
        label,
        status: 'recognized',
        value: formatValue(rawValue),
      });
      return;
    }

    entries.push({
      key,
      label,
      status: 'missing',
      reason,
    });
  };

  pushField('name', '缺少装备名时，后续很难命中真实装备图和历史记录。');
  pushField('type', '缺少部位会影响挂载和规则判断。');
  pushField('level', '等级缺失时，底子判断和价格比较会不够稳。');
  pushField('mainStat', '主属性通常是第一轮人工核对重点。');
  pushField('price', '售价缺失时，实验室暂时无法做性价比分析。');

  if (equipment.type === 'trinket' || equipment.type === 'jade') {
    pushField('slot', '灵饰 / 玉魄缺少槽位时，后续无法稳定挂到正确位置。');
  }

  return entries;
}

function buildRecognizedStatFields(
  equipment: Equipment,
  rawRecord: Record<string, unknown> | null
) {
  const stats = isRecord(rawRecord?.stats)
    ? rawRecord.stats
    : isRecord(equipment.stats)
      ? equipment.stats
      : null;
  if (!stats) {
    return [];
  }

  return Object.entries(stats)
    .filter(([, value]) => hasValue(value))
    .sort(([left], [right]) =>
      getSimulatorStatLabel(left).localeCompare(getSimulatorStatLabel(right), 'zh-CN')
    )
    .map(([key, value]) => ({
      key: `stat:${key}`,
      label: getSimulatorStatLabel(key),
      status: 'recognized' as const,
      value: formatValue(value),
    }));
}

function buildSuggestedMissingStatFields(
  equipment: Equipment,
  recognizedStatFields: SimulatorEquipmentOcrReviewField[]
) {
  if (!isSimulatorOcrEquipmentType(equipment.type)) {
    return [];
  }

  const recognizedKeys = new Set(
    recognizedStatFields.map((field) => field.key.replace(/^stat:/, ''))
  );

  return SIMULATOR_EQUIPMENT_TYPE_STAT_HINTS[equipment.type]
    .filter((key) => !recognizedKeys.has(key))
    .slice(0, 4)
    .map((key) => ({
      key: `suggested_stat:${key}`,
      label: getSimulatorStatLabel(key),
      status: 'missing' as const,
      reason: `${getSimulatorEquipmentFieldLabel('type')}为“${equipment.type}”时，这类属性通常值得回看截图数值区。`,
    }));
}

function resolveConfidenceMeta(score: number) {
  const percent = Math.round(score * 100);

  if (score >= 0.9) {
    return {
      confidenceLabel: `识别把握高 · ${percent}%`,
      confidenceTone: 'high' as const,
    };
  }

  if (score >= 0.7) {
    return {
      confidenceLabel: `识别把握中 · ${percent}%`,
      confidenceTone: 'medium' as const,
    };
  }

  return {
    confidenceLabel: `建议重点复核 · ${percent}%`,
    confidenceTone: 'low' as const,
  };
}

export function buildSimulatorEquipmentOcrReviewSummary(
  item: Pick<PendingEquipment, 'equipment' | 'rawText'>
): SimulatorEquipmentOcrReviewSummary {
  const rawResult = parseRawResult(item.rawText);
  const rawRecord = getRecognizedRawRecord(rawResult);
  const confidenceScore = inferConfidenceScore(rawResult);
  const coreFields = buildCoreFieldEntries(item.equipment, rawRecord);
  const recognizedCoreFields = coreFields.filter(
    (field) => field.status === 'recognized'
  );
  const missingFields = coreFields.filter(
    (field) => field.status === 'missing'
  );
  const recognizedStatFields = buildRecognizedStatFields(item.equipment, rawRecord);
  const missingSuggestedStats = buildSuggestedMissingStatFields(
    item.equipment,
    recognizedStatFields
  );
  const recognizedFieldCount =
    recognizedCoreFields.length + recognizedStatFields.length;
  const recognizedStatCount = recognizedStatFields.length;
  const confidenceMeta = resolveConfidenceMeta(confidenceScore);

  const summaryLines = [
    recognizedFieldCount > 0
      ? `本次共识别出 ${recognizedFieldCount} 个有效字段，其中数值属性 ${recognizedStatCount} 个。`
      : '当前还没有稳定识别出有效字段，建议直接进入待确认详情人工补录。',
    missingFields.length > 0
      ? `仍有 ${missingFields.length} 个关键字段缺失，建议先核对名称、部位、主属性和价格。`
      : '关键字段基本齐全，可以优先看亮点、双加和价格是否有识别偏差。',
    missingSuggestedStats.length > 0
      ? `按当前部位看，还有 ${missingSuggestedStats.length} 个常见属性可能漏识别，建议回看截图里的数值区。`
      : '当前常见核心属性基本已识别到，可以优先核对数值大小是否准确。',
  ];

  const recommendedChecks: string[] = [];
  if (!item.equipment.specialEffect?.trim()) {
    recommendedChecks.push('如果截图里有特技 / 特效，建议补到“特效”字段。');
  }
  if (
    item.equipment.repairFailCount === undefined ||
    item.equipment.repairFailCount === null
  ) {
    recommendedChecks.push('如果截图里看得到修理失败次数，建议补录，避免底子判断失真。');
  }
  if (!item.equipment.luckyHoles?.trim()) {
    recommendedChecks.push('如果有开孔信息，建议补录孔数，后续符石组合判断会更稳。');
  }
  if (missingSuggestedStats.length > 0) {
    recommendedChecks.push(
      `当前建议补看 ${missingSuggestedStats
        .map((field) => field.label)
        .join(' / ')} 这些常见属性，避免把好装备误判成白板。`
    );
  }
  if (recognizedStatCount === 0) {
    recommendedChecks.push('当前没有数值属性，建议优先核对主词条区和附加属性区。');
  }
  if (recommendedChecks.length === 0) {
    recommendedChecks.push('这轮识别结构比较完整，重点核对价格、红字双加和亮点标签即可。');
  }

  return {
    confidenceScore,
    confidenceLabel: confidenceMeta.confidenceLabel,
    confidenceTone: confidenceMeta.confidenceTone,
    recognizedFieldCount,
    recognizedCoreFieldCount: recognizedCoreFields.length,
    recognizedStatCount,
    recognizedFields: [...recognizedCoreFields, ...recognizedStatFields],
    recognizedCoreFields,
    missingFields,
    missingSuggestedStats,
    summaryLines,
    recommendedChecks,
  };
}
