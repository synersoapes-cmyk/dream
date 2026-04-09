import { and, asc, desc, eq } from 'drizzle-orm';

import { db } from '@/core/db';
import { starResonanceRule } from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';

import {
  ensureSimulatorDbReady,
  parseJsonObject,
  withTransientD1Retry,
} from './simulator-core';
import type { AdminSimulatorStarResonanceRuleItem } from './simulator-types';

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonArray(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapStarResonanceRuleRow(
  row: typeof starResonanceRule.$inferSelect
): AdminSimulatorStarResonanceRuleItem {
  return {
    id: row.id,
    scope: row.scope,
    slot: row.slot,
    comboName: row.comboName,
    requiredColors: toStringArray(parseJsonArray(row.requiredColorsJson)),
    bonusAttrType: row.bonusAttrType,
    bonusAttrValue: toNumber(row.bonusAttrValue, 0),
    globalBonus: parseJsonObject(row.globalBonusJson),
    sort: row.sort ?? 0,
    enabled: Boolean(row.enabled),
    notes: row.notes ?? '',
    createdAt: row.createdAt?.getTime?.() ?? 0,
    updatedAt: row.updatedAt?.getTime?.() ?? 0,
  };
}

export async function listAdminSimulatorStarResonanceRules(params?: {
  enabled?: boolean;
  limit?: number;
}): Promise<AdminSimulatorStarResonanceRuleItem[]> {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('listAdminSimulatorStarResonanceRules', async () => {
    const conditions = [];
    if (typeof params?.enabled === 'boolean') {
      conditions.push(eq(starResonanceRule.enabled, params.enabled));
    }

    const rows = await db()
      .select()
      .from(starResonanceRule)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        desc(starResonanceRule.enabled),
        asc(starResonanceRule.sort),
        asc(starResonanceRule.slot),
        asc(starResonanceRule.comboName)
      )
      .limit(params?.limit ?? 100);

    return rows.map(mapStarResonanceRuleRow);
  });
}

export async function listSimulatorStarResonanceRules(params?: {
  slot?: string;
}) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('listSimulatorStarResonanceRules', async () => {
    const rows = await db()
      .select()
      .from(starResonanceRule)
      .where(
        and(
          eq(starResonanceRule.enabled, true),
          params?.slot ? eq(starResonanceRule.slot, params.slot) : undefined
        )
      )
      .orderBy(asc(starResonanceRule.sort), asc(starResonanceRule.comboName));

    return rows.map(mapStarResonanceRuleRow);
  });
}

export async function createAdminSimulatorStarResonanceRule(input: {
  scope?: string;
  slot: string;
  comboName: string;
  requiredColors?: string[];
  bonusAttrType?: string;
  bonusAttrValue?: number;
  globalBonus?: Record<string, unknown>;
  sort?: number;
  enabled?: boolean;
  notes?: string;
}): Promise<AdminSimulatorStarResonanceRuleItem> {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('createAdminSimulatorStarResonanceRule', async () => {
    const id = getUuid();

    await db().insert(starResonanceRule).values({
      id,
      scope: input.scope?.trim() || 'system',
      slot: input.slot.trim(),
      comboName: input.comboName.trim(),
      requiredColorsJson: JSON.stringify(input.requiredColors ?? []),
      bonusAttrType: input.bonusAttrType?.trim() ?? '',
      bonusAttrValue: input.bonusAttrValue ?? 0,
      globalBonusJson: JSON.stringify(input.globalBonus ?? {}),
      sort: input.sort ?? 0,
      enabled: input.enabled ?? true,
      notes: input.notes?.trim() ?? '',
    });

    const [saved] = await db()
      .select()
      .from(starResonanceRule)
      .where(eq(starResonanceRule.id, id))
      .limit(1);

    if (!saved) {
      throw new Error('failed to create star resonance rule');
    }

    return mapStarResonanceRuleRow(saved);
  });
}

export async function updateAdminSimulatorStarResonanceRule(
  id: string,
  input: {
    scope?: string;
    slot?: string;
    comboName?: string;
    requiredColors?: string[];
    bonusAttrType?: string;
    bonusAttrValue?: number;
    globalBonus?: Record<string, unknown>;
    sort?: number;
    enabled?: boolean;
    notes?: string;
  }
): Promise<AdminSimulatorStarResonanceRuleItem | null> {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('updateAdminSimulatorStarResonanceRule', async () => {
    const [existing] = await db()
      .select()
      .from(starResonanceRule)
      .where(eq(starResonanceRule.id, id))
      .limit(1);

    if (!existing) {
      return null;
    }

    await db()
      .update(starResonanceRule)
      .set({
        scope: input.scope === undefined ? undefined : input.scope.trim() || 'system',
        slot: input.slot === undefined ? undefined : input.slot.trim(),
        comboName:
          input.comboName === undefined ? undefined : input.comboName.trim(),
        requiredColorsJson:
          input.requiredColors === undefined
            ? undefined
            : JSON.stringify(input.requiredColors),
        bonusAttrType:
          input.bonusAttrType === undefined ? undefined : input.bonusAttrType.trim(),
        bonusAttrValue: input.bonusAttrValue,
        globalBonusJson:
          input.globalBonus === undefined
            ? undefined
            : JSON.stringify(input.globalBonus),
        sort: input.sort,
        enabled: input.enabled,
        notes: input.notes === undefined ? undefined : input.notes.trim(),
      })
      .where(eq(starResonanceRule.id, id));

    const [saved] = await db()
      .select()
      .from(starResonanceRule)
      .where(eq(starResonanceRule.id, id))
      .limit(1);

    return saved ? mapStarResonanceRuleRow(saved) : null;
  });
}

export async function deleteAdminSimulatorStarResonanceRule(id: string) {
  await ensureSimulatorDbReady();

  return withTransientD1Retry('deleteAdminSimulatorStarResonanceRule', async () => {
    const [existing] = await db()
      .select({ id: starResonanceRule.id })
      .from(starResonanceRule)
      .where(eq(starResonanceRule.id, id))
      .limit(1);

    if (!existing) {
      return false;
    }

    await db().delete(starResonanceRule).where(eq(starResonanceRule.id, id));
    return true;
  });
}
