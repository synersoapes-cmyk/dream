import type { Equipment } from '@/features/simulator/store/gameTypes';

import type { SimulatorEquipmentType } from '@/shared/lib/simulator-equipment';
import { SIMULATOR_EQUIPMENT_ARTWORK_ENTRIES } from '@/shared/lib/simulator-equipment-artwork-manifest';

const EQUIPMENT_ARTWORK_CANONICAL_ALIASES: Record<string, string> = {
  灵符潮声: '灵符·潮声',
  灵石观澜: '灵石·观澜',
  灵佩追云: '灵佩·追云',
  灵玉映月: '灵玉·映月',
};

const QUALITY_PREFIX_PATTERN =
  /(珍品|稀有|极品|神品|白板|金色|紫色|蓝色|白色|红色|绿色|黄色|橙色)/g;
const DECORATION_PATTERN = /[【】\[\]（）()<>《》「」『』]/g;
const CONNECTOR_PATTERN = /[·•・‧]/g;

function buildEquipmentArtUrl(
  type: SimulatorEquipmentType,
  name?: string
): string {
  const search = new URLSearchParams({ type });
  if (name) {
    search.set('name', name);
  }

  return `/api/simulator/equipment-art?${search.toString()}`;
}

export function compactEquipmentArtworkName(name: string) {
  return name
    .replace(/\s+/g, '')
    .replace(DECORATION_PATTERN, '')
    .replace(CONNECTOR_PATTERN, '')
    .replace(QUALITY_PREFIX_PATTERN, '')
    .trim();
}

export function normalizeEquipmentArtworkName(name?: string) {
  if (!name) {
    return '';
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return '';
  }

  const compact = compactEquipmentArtworkName(trimmed);
  return (
    EQUIPMENT_ARTWORK_CANONICAL_ALIASES[compact] ??
    trimmed.replace(/\s+/g, '').trim()
  );
}

const STATIC_ARTWORK_REGISTRY = new Map<string, string>();
for (const entry of SIMULATOR_EQUIPMENT_ARTWORK_ENTRIES) {
  const baseKey = `${entry.type}:${compactEquipmentArtworkName(entry.canonicalName)}`;
  STATIC_ARTWORK_REGISTRY.set(baseKey, entry.assetPath);

  for (const alias of entry.aliases ?? []) {
    const aliasKey = `${entry.type}:${compactEquipmentArtworkName(alias)}`;
    STATIC_ARTWORK_REGISTRY.set(aliasKey, entry.assetPath);
  }
}

export function getSimulatorEquipmentArtworkAssetPath(
  type: SimulatorEquipmentType,
  name?: string
) {
  const normalized = normalizeEquipmentArtworkName(name);
  if (!normalized) {
    return undefined;
  }

  return STATIC_ARTWORK_REGISTRY.get(
    `${type}:${compactEquipmentArtworkName(normalized)}`
  );
}

export function getSimulatorEquipmentArtworkUrl(
  type: SimulatorEquipmentType,
  name?: string
) {
  const assetPath = getSimulatorEquipmentArtworkAssetPath(type, name);
  if (assetPath) {
    return assetPath;
  }

  const normalizedName = normalizeEquipmentArtworkName(name);
  if (normalizedName) {
    return buildEquipmentArtUrl(type, normalizedName);
  }

  return buildEquipmentArtUrl(type);
}

export function getSimulatorEquipmentDisplayImageUrl(equipment: Equipment) {
  return getSimulatorEquipmentArtworkUrl(equipment.type, equipment.name);
}
