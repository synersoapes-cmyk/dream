type EquipmentSlotLike = {
  type: string;
  slot?: number;
};

type EquipmentStatsLike = {
  stats?: Record<string, unknown>;
  baseStats?: Record<string, unknown>;
};

type EquipmentMetadataLike = Record<string, unknown>;

export type NormalizedLabSeatPayload = {
  id: string;
  name: string;
  isSample: boolean;
  equipment: Array<Record<string, unknown>>;
};

function cloneEquipmentJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toOptionalEquipmentNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toOptionalEquipmentString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function toOptionalEquipmentStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return values.length > 0 ? values : undefined;
}

function buildLabSeatDefaultName(seatId: string, index: number) {
  if (seatId === 'sample') {
    return '样本席位';
  }

  return `对比席位${index + 1}`;
}

export function toEquipmentSlotValue(item: EquipmentSlotLike) {
  if (item.type === 'trinket') {
    return `trinket${item.slot ?? 1}`;
  }

  if (item.type === 'jade') {
    return `jade${item.slot ?? 1}`;
  }

  if (item.type === 'runeStone' || item.type === 'rune') {
    return item.slot ? `${item.type}${item.slot}` : item.type;
  }

  return item.type;
}

export function normalizeEquipmentPayload<T extends EquipmentSlotLike>(
  equipment: T[]
): T[] {
  const deduped = new Map<string, T>();

  for (const item of equipment) {
    const slotKey = toEquipmentSlotValue(item);
    deduped.set(slotKey, item);
  }

  return Array.from(deduped.values());
}

export function toEquipmentAttrRows(item: EquipmentStatsLike) {
  const mergedStats = {
    ...(item.baseStats ?? {}),
    ...(item.stats ?? {}),
  };

  return Object.entries(mergedStats)
    .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
    .map(([attrType, attrValue], index) => ({
      attrGroup: 'base' as const,
      attrType,
      valueType: 'flat' as const,
      attrValue: Number(attrValue),
      displayOrder: index,
    }));
}

export function buildEquipmentSpecialEffectMeta(item: EquipmentMetadataLike) {
  const meta: Record<string, unknown> = {};
  const highlights = toOptionalEquipmentStringArray(item.highlights);
  const specialEffect = toOptionalEquipmentString(item.specialEffect);
  const refinementEffect = toOptionalEquipmentString(item.refinementEffect);

  if (highlights) {
    meta.highlights = highlights;
  }
  if (specialEffect) {
    meta.specialEffect = specialEffect;
  }
  if (refinementEffect) {
    meta.refinementEffect = refinementEffect;
  }

  return meta;
}

export function buildEquipmentSetEffectMeta(item: EquipmentMetadataLike) {
  const meta: Record<string, unknown> = {};
  const runeSetEffect = toOptionalEquipmentString(item.runeSetEffect);
  const setName = toOptionalEquipmentString(item.setName);

  if (runeSetEffect) {
    meta.runeSetEffect = runeSetEffect;
  }
  if (setName) {
    meta.setName = setName;
  }

  return meta;
}

export function buildEquipmentNotesMeta(item: EquipmentMetadataLike) {
  const meta: Record<string, unknown> = {};
  const crossServerFee = toOptionalEquipmentNumber(item.crossServerFee);
  const runeStoneSetsNames = toOptionalEquipmentStringArray(
    item.runeStoneSetsNames
  );
  const activeRuneStoneSet = toOptionalEquipmentNumber(item.activeRuneStoneSet);

  if (crossServerFee !== undefined) {
    meta.crossServerFee = crossServerFee;
  }
  if (Array.isArray(item.runeStoneSets)) {
    meta.runeStoneSets = cloneEquipmentJsonValue(item.runeStoneSets);
  }
  if (runeStoneSetsNames) {
    meta.runeStoneSetsNames = runeStoneSetsNames;
  }
  if (activeRuneStoneSet !== undefined) {
    meta.activeRuneStoneSet = Math.max(0, Math.floor(activeRuneStoneSet));
  }
  if (Array.isArray(item.effectModifiers)) {
    meta.effectModifiers = cloneEquipmentJsonValue(item.effectModifiers);
  }

  for (const key of [
    'extraStat',
    'description',
    'equippableRoles',
    'element',
    'luckyHoles',
    'starPosition',
    'starAlignment',
    'factionRequirement',
    'positionRequirement',
    'manufacturer',
    'imageUrl',
    'gemstone',
    'quality',
  ] as const) {
    const value = toOptionalEquipmentString(item[key]);
    if (value) {
      meta[key] = value;
    }
  }

  const durability = toOptionalEquipmentNumber(item.durability);
  if (durability !== undefined) {
    meta.durability = durability;
  }

  return meta;
}

export function normalizeLabSeatPayload(
  seats: Array<{
    id?: string;
    name?: string;
    isSample?: boolean;
    equipment?: Array<Record<string, unknown>>;
  }>
): NormalizedLabSeatPayload[] {
  const compareSeats: NormalizedLabSeatPayload[] = [];

  for (const seat of seats) {
    const normalizedId = String(seat?.id || '');
    const isSample = Boolean(seat?.isSample) || normalizedId === 'sample';
    const seatId = isSample
      ? 'sample'
      : normalizedId || `comp_${compareSeats.length + 1}`;

    const equipment = Array.isArray(seat?.equipment)
      ? normalizeEquipmentPayload(
          seat.equipment as Array<{
            type: string;
            slot?: number;
          }>
        )
      : [];

    const normalizedSeat: NormalizedLabSeatPayload = {
      id: seatId,
      name: String(
        seat?.name ||
          (isSample
            ? '样本席位'
            : buildLabSeatDefaultName(seatId, compareSeats.length))
      ),
      isSample,
      equipment: equipment as Array<Record<string, unknown>>,
    };

    if (isSample) {
      continue;
    }

    compareSeats.push(normalizedSeat);
  }

  return [
    {
      id: 'sample',
      name: '样本席位',
      isSample: true,
      equipment: [],
    },
    ...compareSeats.slice(0, 5),
  ];
}

export function resolveLabSessionEquipmentReferenceId(
  equipmentId: unknown,
  persistedEquipmentIds: Set<string>
) {
  return typeof equipmentId === 'string' &&
    equipmentId.length > 0 &&
    persistedEquipmentIds.has(equipmentId)
    ? equipmentId
    : null;
}
