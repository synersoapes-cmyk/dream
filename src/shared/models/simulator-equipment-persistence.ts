import {
  characterStarResonance,
  ornamentSetEffect,
  starStoneAttr,
  starStoneItem,
} from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';
import {
  toSimulatorJadeSlotKey,
  toSimulatorTrinketSlotKey,
} from '@/shared/lib/simulator-equipment';

import { parseJsonObject } from './simulator-core';
import type {
  SimulatorCharacterStarResonance,
  SimulatorEquipment,
  SimulatorEquipmentAttr,
  SimulatorEquipmentBuild,
  SimulatorJadeAttrRow,
  SimulatorJadeRow,
  SimulatorOrnamentRow,
  SimulatorOrnamentSubAttrRow,
  SimulatorStarResonanceRule,
  SimulatorStarStoneAttr,
  SimulatorStarStoneItem,
} from './simulator-types';

const ORNAMENT_SET_TIERS = [32, 28, 24, 16, 8] as const;
const STAR_POSITION_ATTR_ALIAS: Array<[string, string]> = [
  ['法术伤害', 'magicDamage'],
  ['法伤', 'magicDamage'],
  ['气血', 'hp'],
  ['速度', 'speed'],
  ['法术防御', 'magicDefense'],
  ['法防', 'magicDefense'],
  ['防御', 'defense'],
  ['伤害', 'damage'],
  ['命中', 'hit'],
  ['躲避', 'dodge'],
  ['灵力', 'spirit'],
];
const STAR_ALIGNMENT_ATTR_ALIAS: Array<[string, string]> = [
  ['体质', 'physique'],
  ['魔力', 'magic'],
  ['力量', 'strength'],
  ['耐力', 'endurance'],
  ['敏捷', 'agility'],
];
const RUNE_COLOR_ALIAS: Record<string, string> = {
  red: '红',
  blue: '蓝',
  green: '绿',
  yellow: '黄',
  white: '白',
  black: '黑',
  purple: '紫',
  orange: '橙',
  hong: '红',
  lan: '蓝',
  lv: '绿',
  huang: '黄',
  bai: '白',
  hei: '黑',
  zi: '紫',
  cheng: '橙',
  红: '红',
  蓝: '蓝',
  绿: '绿',
  黄: '黄',
  金: '黄',
  白: '白',
  黑: '黑',
  紫: '紫',
  橙: '橙',
};

export function isPrimaryEquipmentSlot(slot: string | null | undefined) {
  const normalized = String(slot ?? '')
    .trim()
    .toLowerCase();

  return ['weapon', 'helmet', 'necklace', 'armor', 'belt', 'shoes'].includes(
    normalized
  );
}

export function isOrnamentSlot(slot: string | null | undefined) {
  const normalized = String(slot ?? '')
    .trim()
    .toLowerCase();

  return [
    'trinket1',
    'trinket2',
    'trinket3',
    'trinket4',
    'ring',
    'earring',
    'bracelet',
    'amulet',
    'pendant',
  ].includes(normalized);
}

function isDisabledStarValue(value: unknown) {
  if (typeof value !== 'string') {
    return true;
  }

  const normalized = value.trim();
  return !normalized || normalized === '无';
}

function parseStarValueNumber(value: string) {
  const matched = value.match(/([+-]?\d+(?:\.\d+)?)/);
  if (!matched) {
    return null;
  }

  const parsed = Number(matched[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseStarBonus(value: unknown, aliasMap: Array<[string, string]>) {
  if (isDisabledStarValue(value)) {
    return null;
  }

  const label = String(value).trim();
  const attrValue = parseStarValueNumber(label);
  if (attrValue === null) {
    return null;
  }

  for (const [alias, attrType] of aliasMap) {
    if (label.includes(alias)) {
      return {
        label,
        attrType,
        attrValue,
      };
    }
  }

  return null;
}

function parseStructuredStarPositionConfig(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id =
    typeof record.id === 'string' && record.id.trim().length > 0
      ? record.id.trim()
      : '';
  const label =
    typeof record.label === 'string' && record.label.trim().length > 0
      ? record.label.trim()
      : '';
  const attrType =
    typeof record.attrType === 'string' && record.attrType.trim().length > 0
      ? record.attrType.trim()
      : '';
  const attrValue = Number(record.attrValue);

  if (!id || !label || !attrType || !Number.isFinite(attrValue)) {
    return null;
  }

  return {
    id,
    label,
    attrType,
    attrValue,
    starType:
      typeof record.starType === 'string' ? record.starType.trim() : '',
    color: typeof record.color === 'string' ? record.color.trim() : '',
    yinYangState:
      typeof record.yinYangState === 'string'
        ? record.yinYangState.trim()
        : 'yang',
  };
}

function parseStructuredStarAlignmentConfig(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id =
    typeof record.id === 'string' && record.id.trim().length > 0
      ? record.id.trim()
      : '';
  const label =
    typeof record.label === 'string' && record.label.trim().length > 0
      ? record.label.trim()
      : '';
  const attrType =
    typeof record.attrType === 'string' && record.attrType.trim().length > 0
      ? record.attrType.trim()
      : '';
  const attrValue = Number(record.attrValue);

  if (!id || !label || !attrType || !Number.isFinite(attrValue)) {
    return null;
  }

  const colors = Array.isArray(record.colors)
    ? record.colors
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : undefined;

  return {
    id,
    label,
    attrType,
    attrValue,
    comboName:
      typeof record.comboName === 'string' && record.comboName.trim().length > 0
        ? record.comboName.trim()
        : undefined,
    colors: colors && colors.length > 0 ? colors : undefined,
  };
}

function normalizeRuneColor(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const exactMatch =
    RUNE_COLOR_ALIAS[trimmed.toLowerCase()] ?? RUNE_COLOR_ALIAS[trimmed];
  if (exactMatch) {
    return exactMatch;
  }

  for (const [alias, normalized] of Object.entries(RUNE_COLOR_ALIAS)) {
    if (trimmed.toLowerCase().includes(alias.toLowerCase())) {
      return normalized;
    }
  }

  return null;
}

function extractActiveRuneSetMeta(notesJson: string | null | undefined) {
  const notes = parseJsonObject(notesJson);
  const activeIndex = Math.max(
    0,
    Math.floor(Number(notes.activeRuneStoneSet ?? 0) || 0)
  );
  const runeSetNames = Array.isArray(notes.runeStoneSetsNames)
    ? notes.runeStoneSetsNames
    : [];
  const activeName =
    typeof runeSetNames[activeIndex] === 'string'
      ? String(runeSetNames[activeIndex]).trim()
      : typeof runeSetNames[0] === 'string'
        ? String(runeSetNames[0]).trim()
        : '';
  const runeStoneSets = Array.isArray(notes.runeStoneSets)
    ? notes.runeStoneSets
    : [];
  const activeSet = Array.isArray(runeStoneSets[activeIndex])
    ? runeStoneSets[activeIndex]
    : Array.isArray(runeStoneSets[0])
      ? runeStoneSets[0]
      : [];
  const activeColors = activeSet
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === 'object'
    )
    .map((item) => normalizeRuneColor(item.type ?? item.color ?? item.name))
    .filter((item): item is string => Boolean(item));

  return {
    activeName,
    activeColors,
  };
}

function requiredColorsFromRule(
  rule: Pick<SimulatorStarResonanceRule, 'requiredColorsJson'>
) {
  const parsed = parseJsonObject(rule.requiredColorsJson);
  const source: unknown[] = Array.isArray(parsed)
    ? (parsed as unknown[])
    : Array.isArray((parsed as Record<string, unknown>).colors)
      ? ((parsed as Record<string, unknown>).colors as unknown[])
      : [];

  return source
    .map((item) => normalizeRuneColor(item))
    .filter((item): item is string => Boolean(item));
}

function buildStarAlignmentLabelFromRule(rule: SimulatorStarResonanceRule) {
  const bonusType = String(rule.bonusAttrType || '').trim();
  const bonusValue = Number(rule.bonusAttrValue ?? 0);
  if (!bonusType || !Number.isFinite(bonusValue) || bonusValue === 0) {
    return '';
  }

  const attrLabelMap: Record<string, string> = {
    physique: '体质',
    magic: '魔力',
    strength: '力量',
    endurance: '耐力',
    agility: '敏捷',
    hp: '气血',
    speed: '速度',
    magicDamage: '法术伤害',
    magicDefense: '法术防御',
    defense: '防御',
    hit: '命中',
    dodge: '躲避',
    spirit: '灵力',
    allAttributes: '全属性',
  };

  return `${attrLabelMap[bonusType] ?? bonusType} +${bonusValue}`;
}

function colorsMatchIgnoringOrder(actual: string[], expected: string[]) {
  if (actual.length !== expected.length) {
    return false;
  }

  const normalizedActual = [...actual].sort();
  const normalizedExpected = [...expected].sort();

  return normalizedActual.every(
    (color, index) => color === normalizedExpected[index]
  );
}

function findMatchedStarResonanceRule(params: {
  slot: string;
  notesJson: string | null | undefined;
  availableRules: SimulatorStarResonanceRule[];
}) {
  const runeMeta = extractActiveRuneSetMeta(params.notesJson);
  if (!runeMeta.activeName || runeMeta.activeColors.length === 0) {
    return null;
  }

  return (
    params.availableRules.find((rule) => {
      if (rule.slot !== params.slot) {
        return false;
      }

      if (rule.comboName.trim() !== runeMeta.activeName) {
        return false;
      }

      const requiredColors = requiredColorsFromRule(rule);
      if (requiredColors.length === 0) {
        return false;
      }

      return colorsMatchIgnoringOrder(runeMeta.activeColors, requiredColors);
    }) ?? null
  );
}

export function mergeStarStateIntoNotesJson(params: {
  notesJson: string | null | undefined;
  starStoneRows: SimulatorStarStoneItem[];
  starStoneAttrRows: SimulatorStarStoneAttr[];
  resonanceRow: SimulatorCharacterStarResonance | null;
  resonanceRule?: SimulatorStarResonanceRule | null;
}) {
  const notes = parseJsonObject(params.notesJson);

  if (!notes.starPosition && params.starStoneRows.length > 0) {
    const preferredRow =
      params.starStoneRows.find((row) => {
        const parsed = parseJsonObject(row.notesJson);
        return (
          typeof parsed.label === 'string' && parsed.label.trim().length > 0
        );
      }) ?? params.starStoneRows[0];
    const preferredNotes = parseJsonObject(preferredRow?.notesJson);
    if (
      typeof preferredNotes.label === 'string' &&
      preferredNotes.label.trim()
    ) {
      notes.starPosition = preferredNotes.label.trim();
    } else {
      const preferredAttr = params.starStoneAttrRows[0];
      if (preferredAttr) {
        notes.starPosition = `${preferredAttr.attrType} +${preferredAttr.attrValue}`;
      }
    }
  }

  if (!notes.starPositionConfig && params.starStoneRows.length > 0) {
    const preferredRow =
      params.starStoneRows.find((row) => {
        const parsed = parseJsonObject(row.notesJson);
        return (
          typeof parsed.label === 'string' && parsed.label.trim().length > 0
        );
      }) ?? params.starStoneRows[0];
    const preferredNotes = parseJsonObject(preferredRow?.notesJson);
    const preferredAttr = params.starStoneAttrRows[0];
    if (
      preferredRow &&
      preferredAttr &&
      typeof preferredNotes.label === 'string' &&
      preferredNotes.label.trim()
    ) {
      notes.starPositionConfig = {
        id: preferredRow.id,
        label: preferredNotes.label.trim(),
        attrType: preferredAttr.attrType,
        attrValue: preferredAttr.attrValue,
        starType: preferredRow.starType,
        color: preferredRow.color,
        yinYangState: preferredRow.yinYangState,
      };
    }
  }

  if (!notes.starAlignment && params.resonanceRow) {
    const bonus = parseJsonObject(params.resonanceRow.bonusJson);
    if (typeof bonus.label === 'string' && bonus.label.trim()) {
      notes.starAlignment = bonus.label.trim();
    } else if (params.resonanceRule) {
      const derivedLabel = buildStarAlignmentLabelFromRule(
        params.resonanceRule
      );
      if (derivedLabel) {
        notes.starAlignment = derivedLabel;
      }
    }
  }

  if (!notes.starAlignmentConfig && params.resonanceRow) {
    const bonus = parseJsonObject(params.resonanceRow.bonusJson);
    if (params.resonanceRule) {
      notes.starAlignmentConfig = {
        id: params.resonanceRule.id,
        label:
          typeof bonus.label === 'string' && bonus.label.trim()
            ? bonus.label.trim()
            : buildStarAlignmentLabelFromRule(params.resonanceRule),
        attrType: params.resonanceRule.bonusAttrType,
        attrValue: Number(params.resonanceRule.bonusAttrValue ?? 0),
        comboName: params.resonanceRule.comboName,
        colors: requiredColorsFromRule(params.resonanceRule),
      };
    } else if (
      typeof bonus.label === 'string' &&
      bonus.label.trim() &&
      typeof bonus.attrType === 'string' &&
      bonus.attrType.trim()
    ) {
      notes.starAlignmentConfig = {
        id:
          typeof params.resonanceRow.ruleId === 'string' &&
          params.resonanceRow.ruleId.trim()
            ? params.resonanceRow.ruleId.trim()
            : params.resonanceRow.id,
        label: bonus.label.trim(),
        attrType: bonus.attrType.trim(),
        attrValue: Number(bonus.attrValue ?? 0),
        comboName:
          typeof bonus.comboName === 'string' && bonus.comboName.trim()
            ? bonus.comboName.trim()
            : undefined,
      };
    }
  }

  return JSON.stringify(notes);
}

export function buildStarStonePersistenceRows(params: {
  snapshotId: string;
  characterId: string;
  equipmentId: string;
  slot: string;
  notesJson: string | null | undefined;
  availableRules: SimulatorStarResonanceRule[];
  createdAt: Date;
  updatedAt: Date;
}) {
  const notes = parseJsonObject(params.notesJson);
  const structuredStarPosition = parseStructuredStarPositionConfig(
    notes.starPositionConfig
  );
  const structuredStarAlignment = parseStructuredStarAlignmentConfig(
    notes.starAlignmentConfig
  );
  const starPosition =
    structuredStarPosition ?? parseStarBonus(notes.starPosition, STAR_POSITION_ATTR_ALIAS);
  const starAlignment = parseStarBonus(
    notes.starAlignment,
    STAR_ALIGNMENT_ATTR_ALIAS
  );

  const starStoneRows: Array<typeof starStoneItem.$inferInsert> = [];
  const starStoneAttrRows: Array<typeof starStoneAttr.$inferInsert> = [];
  let resonanceRow: typeof characterStarResonance.$inferInsert | null = null;

  if (starPosition) {
    const starStoneId = getUuid();
    starStoneRows.push({
      id: starStoneId,
      characterId: params.characterId,
      equipmentId: params.equipmentId,
      slot: params.slot,
      name: `星石-${params.slot}`,
      starType:
        'starType' in starPosition && typeof starPosition.starType === 'string'
          ? starPosition.starType
          : params.slot,
      color:
        'color' in starPosition && typeof starPosition.color === 'string'
          ? starPosition.color
          : '',
      yinYangState:
        'yinYangState' in starPosition &&
        typeof starPosition.yinYangState === 'string'
          ? starPosition.yinYangState
          : 'yang',
      level: 0,
      notesJson: JSON.stringify({
        label: starPosition.label,
      }),
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
    });
    starStoneAttrRows.push({
      id: getUuid(),
      starStoneId,
      attrType: starPosition.attrType,
      attrValue: starPosition.attrValue,
      displayOrder: 0,
    });
  }

  if (structuredStarAlignment) {
    resonanceRow = {
      id: getUuid(),
      snapshotId: params.snapshotId,
      slot: params.slot,
      ruleId: structuredStarAlignment.id,
      matched: true,
      bonusJson: JSON.stringify({
        label: structuredStarAlignment.label,
        attrType: structuredStarAlignment.attrType,
        attrValue: structuredStarAlignment.attrValue,
        comboName: structuredStarAlignment.comboName,
        colors: structuredStarAlignment.colors,
      }),
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
    };
  } else if (starAlignment) {
    resonanceRow = {
      id: getUuid(),
      snapshotId: params.snapshotId,
      slot: params.slot,
      ruleId: null,
      matched: true,
      bonusJson: JSON.stringify({
        label: starAlignment.label,
        attrType: starAlignment.attrType,
        attrValue: starAlignment.attrValue,
      }),
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
    };
  }

  const matchedRule = findMatchedStarResonanceRule({
    slot: params.slot,
    notesJson: params.notesJson,
    availableRules: params.availableRules,
  });

  if (matchedRule) {
    resonanceRow = {
      id: getUuid(),
      snapshotId: params.snapshotId,
      slot: params.slot,
      ruleId: matchedRule.id,
      matched: true,
      bonusJson: JSON.stringify({
        label: buildStarAlignmentLabelFromRule(matchedRule),
        attrType: matchedRule.bonusAttrType,
        attrValue: matchedRule.bonusAttrValue,
        comboName: matchedRule.comboName,
      }),
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
    };
  }

  return {
    starStoneRows,
    starStoneAttrRows,
    resonanceRow,
  };
}

export function isJadeSlot(slot: string | null | undefined) {
  const normalized = String(slot ?? '')
    .trim()
    .toLowerCase();

  return ['jade1', 'jade2'].includes(normalized);
}

export function toPersistedOrnamentSlot(
  slot: string | number | null | undefined
) {
  return toSimulatorTrinketSlotKey(slot);
}

export function toPersistedJadeSlot(slot: string | number | null | undefined) {
  return toSimulatorJadeSlotKey(slot);
}

export function toGenericEquipmentBuild(params: {
  equipmentId: string;
  refineLevel?: number;
  specialEffectJson?: string | null;
  setEffectJson?: string | null;
  notesJson?: string | null;
}): SimulatorEquipmentBuild {
  return {
    equipmentId: params.equipmentId,
    holeCount: 0,
    gemLevelTotal: 0,
    refineLevel: params.refineLevel ?? 0,
    specialEffectJson: params.specialEffectJson ?? '{}',
    setEffectJson: params.setEffectJson ?? '{}',
    notesJson: params.notesJson ?? '{}',
  };
}

export function toGenericEquipmentRow(params: {
  id: string;
  characterId: string;
  slot: string;
  name: string;
  level: number;
  quality: string;
  price: number;
  source: string;
  status: string;
  isLocked?: boolean;
  createdAt: Date;
  updatedAt: Date;
  build: SimulatorEquipmentBuild | null;
  attrs: SimulatorEquipmentAttr[];
  snapshotSlot: string | null;
}): SimulatorEquipment {
  return {
    id: params.id,
    characterId: params.characterId,
    slot: params.slot,
    name: params.name,
    level: params.level,
    quality: params.quality,
    price: params.price,
    source: params.source,
    status: params.status,
    isLocked: params.isLocked ?? false,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
    build: params.build,
    attrs: params.attrs,
    snapshotSlot: params.snapshotSlot,
  };
}

export function buildOrnamentAttrRows(params: {
  ornament: Pick<SimulatorOrnamentRow, 'id' | 'mainAttrType' | 'mainAttrValue'>;
  subAttrs: Array<
    Pick<
      SimulatorOrnamentSubAttrRow,
      'id' | 'ornamentId' | 'attrType' | 'attrValue' | 'displayOrder'
    >
  >;
}): SimulatorEquipmentAttr[] {
  const rows: SimulatorEquipmentAttr[] = [];

  if (params.ornament.mainAttrType) {
    rows.push({
      id: `${params.ornament.id}:main`,
      equipmentId: params.ornament.id,
      attrGroup: 'main',
      attrType: params.ornament.mainAttrType,
      valueType: 'flat',
      attrValue: Number(params.ornament.mainAttrValue ?? 0),
      displayOrder: 0,
    });
  }

  rows.push(
    ...params.subAttrs.map((attr) => ({
      id: attr.id,
      equipmentId: params.ornament.id,
      attrGroup: 'extra',
      attrType: attr.attrType,
      valueType: 'flat',
      attrValue: Number(attr.attrValue ?? 0),
      displayOrder: Number(attr.displayOrder ?? 0) + 1,
    }))
  );

  return rows;
}

export function buildJadeAttrRows(params: {
  jade: Pick<SimulatorJadeRow, 'id'>;
  attrs: Array<
    Pick<
      SimulatorJadeAttrRow,
      'id' | 'jadeId' | 'attrType' | 'valueType' | 'attrValue' | 'displayOrder'
    >
  >;
}): SimulatorEquipmentAttr[] {
  return params.attrs.map((attr) => ({
    id: attr.id,
    equipmentId: params.jade.id,
    attrGroup: 'base',
    attrType: attr.attrType,
    valueType: attr.valueType,
    attrValue: Number(attr.attrValue ?? 0),
    displayOrder: Number(attr.displayOrder ?? 0),
  }));
}

export function resolveOrnamentMainAttr(
  attrRows: Array<{
    attrType: string;
    valueType: string;
    attrValue: number;
    displayOrder: number;
  }>
) {
  const sorted = [...attrRows].sort(
    (left, right) => left.displayOrder - right.displayOrder
  );
  const [mainAttr, ...subAttrs] = sorted;

  return {
    mainAttrType: mainAttr?.attrType ?? '',
    mainAttrValue: mainAttr?.attrValue ?? 0,
    subAttrs,
  };
}

function parseEquipmentSetName(setEffectJson: string | null | undefined) {
  const setName = parseJsonObject(setEffectJson).setName;
  return typeof setName === 'string' ? setName.trim() : '';
}

export function toOrnamentSetEffectSource(equipment: SimulatorEquipment) {
  const slot = equipment.snapshotSlot ?? equipment.slot;

  return {
    type: isOrnamentSlot(slot)
      ? 'trinket'
      : isJadeSlot(slot)
        ? 'jade'
        : 'equipment',
    setName: parseEquipmentSetName(equipment.build?.setEffectJson),
    level: equipment.level,
    slot,
  };
}

export function buildOrnamentSetEffectRows(params: {
  snapshotId: string;
  equipments: Array<Record<string, unknown>>;
}) {
  const grouped = new Map<
    string,
    { totalLevel: number; slotCount: number; slots: string[] }
  >();

  for (const item of params.equipments) {
    const type = String(item.type || '').trim();
    const setName =
      typeof item.setName === 'string' && item.setName.trim().length > 0
        ? item.setName.trim()
        : '';

    if (type !== 'trinket' || !setName) {
      continue;
    }

    const current = grouped.get(setName) ?? {
      totalLevel: 0,
      slotCount: 0,
      slots: [],
    };
    current.totalLevel += Number(item.level ?? 0) || 0;
    current.slotCount += 1;
    if (item.slot !== undefined && item.slot !== null) {
      current.slots.push(String(item.slot));
    }
    grouped.set(setName, current);
  }

  return Array.from(grouped.entries()).map(([setName, summary]) => ({
    id: getUuid(),
    snapshotId: params.snapshotId,
    setName,
    totalLevel: summary.totalLevel,
    tier: ORNAMENT_SET_TIERS.find((tier) => summary.totalLevel >= tier) ?? 0,
    effectJson: JSON.stringify({
      slotCount: summary.slotCount,
      slots: summary.slots,
    }),
  })) as Array<typeof ornamentSetEffect.$inferInsert>;
}
