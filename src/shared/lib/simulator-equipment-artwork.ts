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
const LEVEL_PREFIX_PATTERN =
  /(?:^|\s)(?:\d{1,3}\s*级|等级\s*\d{1,3}|Lv\.?\s*\d{1,3})/gi;
const GENERIC_LABEL_PATTERN =
  /(装备名称|角色装备|当前装备|藏宝阁|预览图|详情图|展示图)/g;
const DECORATION_PATTERN = /[【】\[\]（）()<>《》「」『』]/g;
const CONNECTOR_PATTERN = /[·•・‧]/g;
const TRAILING_VARIANT_PATTERN = /^(.+?)[（(][^()（）]+[）)]$/;

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

const LOCAL_ARTWORK_PREFIX = '/simulator/equipment-art/';

export function compactEquipmentArtworkName(name: string) {
  return name
    .replace(LEVEL_PREFIX_PATTERN, '')
    .replace(GENERIC_LABEL_PATTERN, '')
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
    compact
  );
}

const STATIC_ARTWORK_REGISTRY = new Map<string, string>();
const DEFAULT_ARTWORK_BY_TYPE: Partial<Record<SimulatorEquipmentType, string>> = {
  weapon: '/simulator/equipment-art/weapon/折扇.jpg',
  helmet: '/simulator/equipment-art/helmet/布帽.jpg',
  necklace: '/simulator/equipment-art/necklace/珍珠链.jpg',
  armor: '/simulator/equipment-art/armor/布衣.jpg',
  belt: '/simulator/equipment-art/belt/腰带.jpg',
  shoes: '/simulator/equipment-art/shoes/布鞋.jpg',
  trinket: '/simulator/equipment-art/trinket/碧木镯.jpg',
  jade: '/simulator/equipment-art/jade/上古玉魄·阳.jpg',
};

function registerArtworkRegistryKey(
  registry: Map<string, string>,
  type: SimulatorEquipmentType,
  name: string,
  assetPath: string
) {
  const compactName = compactEquipmentArtworkName(name);
  if (!compactName) {
    return;
  }

  const registryKey = `${type}:${compactName}`;
  if (!registry.has(registryKey)) {
    registry.set(registryKey, assetPath);
  }

  const strippedVariantName = name.replace(TRAILING_VARIANT_PATTERN, '$1').trim();
  if (!strippedVariantName || strippedVariantName === name) {
    return;
  }

  const strippedKey = `${type}:${compactEquipmentArtworkName(strippedVariantName)}`;
  if (!registry.has(strippedKey)) {
    registry.set(strippedKey, assetPath);
  }
}

for (const entry of SIMULATOR_EQUIPMENT_ARTWORK_ENTRIES) {
  registerArtworkRegistryKey(
    STATIC_ARTWORK_REGISTRY,
    entry.type,
    entry.canonicalName,
    entry.assetPath
  );

  for (const alias of entry.aliases ?? []) {
    registerArtworkRegistryKey(
      STATIC_ARTWORK_REGISTRY,
      entry.type,
      alias,
      entry.assetPath
    );
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

export function getSimulatorEquipmentDefaultArtworkAssetPath(
  type: SimulatorEquipmentType
) {
  return DEFAULT_ARTWORK_BY_TYPE[type];
}

export function getSimulatorEquipmentArtworkR2ObjectKeyFromAssetPath(
  assetPath?: string
) {
  if (!assetPath?.startsWith(LOCAL_ARTWORK_PREFIX)) {
    return null;
  }

  const relativePath = assetPath.slice(LOCAL_ARTWORK_PREFIX.length);
  if (!relativePath) {
    return null;
  }

  return `equipment-art/${relativePath}`;
}

export function getSimulatorEquipmentArtworkUrl(
  type: SimulatorEquipmentType,
  name?: string
) {
  const normalizedName = normalizeEquipmentArtworkName(name);
  return normalizedName
    ? buildEquipmentArtUrl(type, normalizedName)
    : buildEquipmentArtUrl(type);
}

export function getSimulatorEquipmentDisplayImageUrl(equipment: Equipment) {
  return getSimulatorEquipmentArtworkUrl(equipment.type, equipment.name);
}
