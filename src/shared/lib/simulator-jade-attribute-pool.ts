import { toSimulatorJadeSlotKey } from '@/shared/lib/simulator-equipment';

type JsonObject = Record<string, unknown>;

export type JadeAttributePoolRule = {
  slotKeys: string[];
  label?: string;
  description?: string;
  allowedStatKeys: string[];
  allowedModifierCodes: string[];
};

export type JadeAttributePoolResolved = {
  label?: string;
  description?: string;
  allowedStatKeys: string[];
  allowedModifierCodes: string[];
};

function parseJsonObject(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as JsonObject;
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSlotKey(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return '';
  }

  if (normalized === 'all' || normalized === 'default') {
    return normalized;
  }

  return toSimulatorJadeSlotKey(normalized);
}

export function parseJadeAttributePoolConfig(
  value: unknown
): JadeAttributePoolRule[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const record = parseJsonObject(item);
      const rawSlots = [
        ...toStringArray(record.slotKeys),
        ...toStringArray(record.slots),
      ];
      const singleSlot =
        typeof record.slot === 'string' && record.slot.trim().length > 0
          ? record.slot.trim()
          : typeof record.slotKey === 'string' && record.slotKey.trim().length > 0
            ? record.slotKey.trim()
            : '';
      if (singleSlot) {
        rawSlots.push(singleSlot);
      }

      const slotKeys = Array.from(
        new Set(
          rawSlots.map((slot) => normalizeSlotKey(slot)).filter(Boolean)
        )
      );

      const allowedStatKeys = Array.from(
        new Set([
          ...toStringArray(record.allowedStatKeys),
          ...toStringArray(record.statKeys),
          ...toStringArray(record.attrTypes),
          ...toStringArray(record.fixedAttrTypes),
        ])
      );
      const allowedModifierCodes = Array.from(
        new Set([
          ...toStringArray(record.allowedModifierCodes),
          ...toStringArray(record.effectModifierCodes),
          ...toStringArray(record.modifierCodes),
          ...toStringArray(record.percentCodes),
        ])
      );

      if (
        slotKeys.length === 0 ||
        (allowedStatKeys.length === 0 && allowedModifierCodes.length === 0)
      ) {
        return null;
      }

      return {
        slotKeys,
        label:
          typeof record.label === 'string' && record.label.trim().length > 0
            ? record.label.trim()
            : undefined,
        description:
          typeof record.description === 'string' &&
          record.description.trim().length > 0
            ? record.description.trim()
            : undefined,
        allowedStatKeys,
        allowedModifierCodes,
      } satisfies JadeAttributePoolRule;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export function resolveJadeAttributePoolForSlot(params: {
  value: unknown;
  slot: number | string | null | undefined;
}): JadeAttributePoolResolved | null {
  const rules = parseJadeAttributePoolConfig(params.value);
  if (rules.length === 0) {
    return null;
  }

  const slotKey = toSimulatorJadeSlotKey(params.slot);
  const matchedRules = rules.filter(
    (rule) =>
      rule.slotKeys.includes(slotKey) ||
      rule.slotKeys.includes('all') ||
      rule.slotKeys.includes('default')
  );

  if (matchedRules.length === 0) {
    return null;
  }

  return {
    label: matchedRules.map((item) => item.label).find(Boolean),
    description: matchedRules.map((item) => item.description).find(Boolean),
    allowedStatKeys: Array.from(
      new Set(matchedRules.flatMap((item) => item.allowedStatKeys))
    ),
    allowedModifierCodes: Array.from(
      new Set(matchedRules.flatMap((item) => item.allowedModifierCodes))
    ),
  };
}
