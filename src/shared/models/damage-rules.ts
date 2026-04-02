import { and, asc, eq } from 'drizzle-orm';

import { db } from '@/core/db';
import { initD1ContextForDev } from '@/core/db/d1';
import {
  ruleAttributeConversion,
  ruleDamageModifier,
  rulePublishLog,
  ruleSkillBonus,
  ruleSkillFormula,
  ruleVersion,
} from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';

export type DamageRuleVersion = typeof ruleVersion.$inferSelect;

type JsonObject = Record<string, unknown>;

type RuleAttributeConversionRow = typeof ruleAttributeConversion.$inferSelect;
type RuleSkillFormulaRow = typeof ruleSkillFormula.$inferSelect;
type RuleDamageModifierRow = typeof ruleDamageModifier.$inferSelect;
type RuleSkillBonusRow = typeof ruleSkillBonus.$inferSelect;

export type DamageAttributeConversionRule = RuleAttributeConversionRow & {
  condition: JsonObject;
};

export type DamageSkillFormulaRule = Omit<
  RuleSkillFormulaRow,
  'baseFormulaJson' | 'extraFormulaJson' | 'conditionJson'
> & {
  baseFormula: JsonObject;
  extraFormula: JsonObject;
  condition: JsonObject;
};

export type DamageModifierRule = Omit<
  RuleDamageModifierRow,
  'valueJson' | 'conditionJson'
> & {
  valueLookup: JsonObject;
  condition: JsonObject;
};

export type DamageSkillBonusRule = Omit<
  RuleSkillBonusRow,
  'conditionJson' | 'limitPolicyJson'
> & {
  condition: JsonObject;
  limitPolicy: JsonObject;
};

export type DamageRuleSet = {
  version: DamageRuleVersion;
  attributeConversions: DamageAttributeConversionRule[];
  skillFormulas: DamageSkillFormulaRule[];
  modifiers: DamageModifierRule[];
  skillBonuses: DamageSkillBonusRule[];
};

export type DamageRuleVersionListItem = DamageRuleVersion & {
  attributeRuleCount: number;
  skillFormulaCount: number;
  modifierCount: number;
  skillBonusCount: number;
};

export type DamageRuleVersionDetail = DamageRuleSet & {
  publishLogs: Array<typeof rulePublishLog.$inferSelect>;
};

type EditableModifierInput = {
  id?: string;
  modifierDomain: string;
  modifierKey: string;
  modifierType: string;
  sourceKey?: string;
  targetKey?: string;
  value?: number;
  valueLookup?: JsonObject;
  condition?: JsonObject;
  sort?: number;
  enabled?: boolean;
};

type EditableSkillBonusInput = {
  id?: string;
  bonusGroup: string;
  ruleCode: string;
  skillCode: string;
  skillName: string;
  bonusType?: string;
  bonusValue?: number;
  condition?: JsonObject;
  conflictPolicy?: string;
  limitPolicy?: JsonObject;
  sort?: number;
  enabled?: boolean;
};

function getErrorMessages(error: unknown): string[] {
  const messages: string[] = [];
  let current = error;
  let depth = 0;

  while (current && depth < 5) {
    if (current instanceof Error) {
      messages.push(current.message);
      current = (current as Error & { cause?: unknown }).cause;
      depth += 1;
      continue;
    }

    break;
  }

  return messages;
}

function isTransientD1Error(error: unknown): boolean {
  const combined = getErrorMessages(error).join(' | ').toLowerCase();

  return (
    combined.includes('network connection lost') ||
    combined.includes('failed to parse body as json') ||
    combined.includes('d1_error') ||
    combined.includes('internal_server_error')
  );
}

async function withTransientD1Retry<T>(
  label: string,
  operation: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isTransientD1Error(error) || attempt === maxAttempts) {
        throw error;
      }

      console.warn(
        `[damage-rules] transient D1 error during ${label}, retrying (${attempt}/${maxAttempts})`,
        error,
      );

      await new Promise((resolve) => setTimeout(resolve, attempt * 150));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Unknown damage rule D1 error during ${label}`);
}

function parseJsonObject<T extends JsonObject>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

async function ensureDamageRuleDbReady() {
  await initD1ContextForDev();
}

export async function getDamageRuleVersion(params?: {
  versionId?: string;
  versionCode?: string;
}): Promise<DamageRuleVersion | null> {
  await ensureDamageRuleDbReady();

  return withTransientD1Retry('getDamageRuleVersion', async () => {
    if (params?.versionId) {
      const [version] = await db()
        .select()
        .from(ruleVersion)
        .where(eq(ruleVersion.id, params.versionId))
        .limit(1);

      return version ?? null;
    }

    if (params?.versionCode) {
      const [version] = await db()
        .select()
        .from(ruleVersion)
        .where(eq(ruleVersion.versionCode, params.versionCode))
        .limit(1);

      return version ?? null;
    }

    const [activeVersion] = await db()
      .select()
      .from(ruleVersion)
      .where(
        and(
          eq(ruleVersion.ruleDomain, 'damage'),
          eq(ruleVersion.status, 'published'),
          eq(ruleVersion.isActive, true),
        ),
      )
      .orderBy(asc(ruleVersion.versionCode))
      .limit(1);

    return activeVersion ?? null;
  });
}

export async function getDamageRuleSet(params?: {
  versionId?: string;
  versionCode?: string;
}): Promise<DamageRuleSet | null> {
  return withTransientD1Retry('getDamageRuleSet', async () => {
    const version = await getDamageRuleVersion(params);
    if (!version) {
      return null;
    }

    const [attributeRows, skillFormulaRows, modifierRows, bonusRows] = await Promise.all([
      db()
        .select()
        .from(ruleAttributeConversion)
        .where(
          and(
            eq(ruleAttributeConversion.versionId, version.id),
            eq(ruleAttributeConversion.enabled, true),
          ),
        )
        .orderBy(asc(ruleAttributeConversion.sort), asc(ruleAttributeConversion.sourceAttr)),
      db()
        .select()
        .from(ruleSkillFormula)
        .where(
          and(
            eq(ruleSkillFormula.versionId, version.id),
            eq(ruleSkillFormula.enabled, true),
          ),
        )
        .orderBy(asc(ruleSkillFormula.sort), asc(ruleSkillFormula.skillCode)),
      db()
        .select()
        .from(ruleDamageModifier)
        .where(
          and(
            eq(ruleDamageModifier.versionId, version.id),
            eq(ruleDamageModifier.enabled, true),
          ),
        )
        .orderBy(asc(ruleDamageModifier.sort), asc(ruleDamageModifier.modifierDomain)),
      db()
        .select()
        .from(ruleSkillBonus)
        .where(
          and(eq(ruleSkillBonus.versionId, version.id), eq(ruleSkillBonus.enabled, true)),
        )
        .orderBy(asc(ruleSkillBonus.sort), asc(ruleSkillBonus.ruleCode)),
    ]);

    return {
      version,
      attributeConversions: attributeRows.map((row: RuleAttributeConversionRow) => ({
        ...row,
        condition: parseJsonObject(row.conditionJson, {}),
      })),
      skillFormulas: skillFormulaRows.map((row: RuleSkillFormulaRow) => ({
        ...row,
        baseFormula: parseJsonObject(row.baseFormulaJson, {}),
        extraFormula: parseJsonObject(row.extraFormulaJson, {}),
        condition: parseJsonObject(row.conditionJson, {}),
      })),
      modifiers: modifierRows.map((row: RuleDamageModifierRow) => ({
        ...row,
        valueLookup: parseJsonObject(row.valueJson, {}),
        condition: parseJsonObject(row.conditionJson, {}),
      })),
      skillBonuses: bonusRows.map((row: RuleSkillBonusRow) => ({
        ...row,
        condition: parseJsonObject(row.conditionJson, {}),
        limitPolicy: parseJsonObject(row.limitPolicyJson, {}),
      })),
    };
  });
}

export async function listDamageRuleVersions(): Promise<DamageRuleVersionListItem[]> {
  await ensureDamageRuleDbReady();

  const versions = await db()
    .select()
    .from(ruleVersion)
    .where(eq(ruleVersion.ruleDomain, 'damage'))
    .orderBy(asc(ruleVersion.versionCode));

  const versionIds = versions.map((item: DamageRuleVersion) => item.id);
  if (versionIds.length === 0) {
    return [];
  }

  const [attributeRows, skillFormulaRows, modifierRows, bonusRows] = await Promise.all([
    db().select().from(ruleAttributeConversion).where(eq(ruleAttributeConversion.enabled, true)),
    db().select().from(ruleSkillFormula).where(eq(ruleSkillFormula.enabled, true)),
    db().select().from(ruleDamageModifier).where(eq(ruleDamageModifier.enabled, true)),
    db().select().from(ruleSkillBonus).where(eq(ruleSkillBonus.enabled, true)),
  ]);

  const attributeCount = new Map<string, number>();
  const skillFormulaCount = new Map<string, number>();
  const modifierCount = new Map<string, number>();
  const bonusCount = new Map<string, number>();

  for (const row of attributeRows) {
    attributeCount.set(row.versionId, (attributeCount.get(row.versionId) ?? 0) + 1);
  }
  for (const row of skillFormulaRows) {
    skillFormulaCount.set(row.versionId, (skillFormulaCount.get(row.versionId) ?? 0) + 1);
  }
  for (const row of modifierRows) {
    modifierCount.set(row.versionId, (modifierCount.get(row.versionId) ?? 0) + 1);
  }
  for (const row of bonusRows) {
    bonusCount.set(row.versionId, (bonusCount.get(row.versionId) ?? 0) + 1);
  }

  return versions.map((version: DamageRuleVersion) => ({
    ...version,
    attributeRuleCount: attributeCount.get(version.id) ?? 0,
    skillFormulaCount: skillFormulaCount.get(version.id) ?? 0,
    modifierCount: modifierCount.get(version.id) ?? 0,
    skillBonusCount: bonusCount.get(version.id) ?? 0,
  }));
}

export async function getDamageRuleVersionDetail(params: {
  versionId?: string;
  versionCode?: string;
}): Promise<DamageRuleVersionDetail | null> {
  const ruleSet = await getDamageRuleSet(params);
  if (!ruleSet) {
    return null;
  }

  const publishLogs = await db()
    .select()
    .from(rulePublishLog)
    .where(eq(rulePublishLog.versionId, ruleSet.version.id))
    .orderBy(asc(rulePublishLog.createdAt));

  return {
    ...ruleSet,
    publishLogs,
  };
}

export async function publishDamageRuleVersion(params: {
  versionId: string;
  operatorId: string;
  notes?: string;
}) {
  await ensureDamageRuleDbReady();

  const version = await getDamageRuleVersion({ versionId: params.versionId });
  if (!version) {
    throw new Error('damage rule version not found');
  }

  const now = new Date();

  await db()
    .update(ruleVersion)
    .set({
      isActive: false,
      updatedAt: now,
    })
    .where(and(eq(ruleVersion.ruleDomain, 'damage'), eq(ruleVersion.isActive, true)));

  await db()
    .update(ruleVersion)
    .set({
      status: 'published',
      isActive: true,
      publishedBy: params.operatorId,
      publishedAt: now,
      updatedAt: now,
    })
    .where(eq(ruleVersion.id, version.id));

  await db().insert(rulePublishLog).values({
    id: getUuid(),
    versionId: version.id,
    action: 'publish',
    operatorId: params.operatorId,
    beforeSnapshotJson: '{}',
    afterSnapshotJson: JSON.stringify({
      status: 'published',
      isActive: true,
      publishedBy: params.operatorId,
      publishedAt: now.toISOString(),
    }),
    notes: params.notes ?? '',
    createdAt: now,
  });

  return getDamageRuleVersionDetail({ versionId: version.id });
}

export async function cloneDamageRuleVersion(params: {
  sourceVersionId: string;
  operatorId: string;
}) {
  await ensureDamageRuleDbReady();

  const source = await getDamageRuleVersionDetail({ versionId: params.sourceVersionId });
  if (!source) {
    throw new Error('source damage rule version not found');
  }

  const now = new Date();
  const nextVersionId = getUuid();
  const nextVersionCode = `${source.version.versionCode}_draft_${Date.now()}`;

  await db().insert(ruleVersion).values({
    id: nextVersionId,
    ruleDomain: source.version.ruleDomain,
    versionCode: nextVersionCode,
    versionName: `${source.version.versionName} Draft`,
    status: 'draft',
    isActive: false,
    sourceDocUrl: source.version.sourceDocUrl,
    notes: `Cloned from ${source.version.versionCode}`,
    createdBy: params.operatorId,
    publishedBy: '',
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  if (source.attributeConversions.length > 0) {
    await db().insert(ruleAttributeConversion).values(
      source.attributeConversions.map((item) => ({
        id: getUuid(),
        versionId: nextVersionId,
        school: item.school,
        roleType: item.roleType,
        sourceAttr: item.sourceAttr,
        targetAttr: item.targetAttr,
        coefficient: item.coefficient,
        valueType: item.valueType,
        conditionJson: JSON.stringify(item.condition ?? {}),
        sort: item.sort,
        enabled: item.enabled,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  if (source.skillFormulas.length > 0) {
    await db().insert(ruleSkillFormula).values(
      source.skillFormulas.map((item) => ({
        id: getUuid(),
        versionId: nextVersionId,
        school: item.school,
        roleType: item.roleType,
        skillCode: item.skillCode,
        skillName: item.skillName,
        formulaKey: item.formulaKey,
        baseFormulaJson: JSON.stringify(item.baseFormula ?? {}),
        extraFormulaJson: JSON.stringify(item.extraFormula ?? {}),
        conditionJson: JSON.stringify(item.condition ?? {}),
        sort: item.sort,
        enabled: item.enabled,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  if (source.modifiers.length > 0) {
    await db().insert(ruleDamageModifier).values(
      source.modifiers.map((item) => ({
        id: getUuid(),
        versionId: nextVersionId,
        modifierDomain: item.modifierDomain,
        modifierKey: item.modifierKey,
        modifierType: item.modifierType,
        sourceKey: item.sourceKey,
        targetKey: item.targetKey,
        value: item.value,
        valueJson: JSON.stringify(item.valueLookup ?? {}),
        conditionJson: JSON.stringify(item.condition ?? {}),
        sort: item.sort,
        enabled: item.enabled,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  if (source.skillBonuses.length > 0) {
    await db().insert(ruleSkillBonus).values(
      source.skillBonuses.map((item) => ({
        id: getUuid(),
        versionId: nextVersionId,
        bonusGroup: item.bonusGroup,
        ruleCode: item.ruleCode,
        skillCode: item.skillCode,
        skillName: item.skillName,
        bonusType: item.bonusType,
        bonusValue: item.bonusValue,
        conditionJson: JSON.stringify(item.condition ?? {}),
        conflictPolicy: item.conflictPolicy,
        limitPolicyJson: JSON.stringify(item.limitPolicy ?? {}),
        sort: item.sort,
        enabled: item.enabled,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  await db().insert(rulePublishLog).values({
    id: getUuid(),
    versionId: nextVersionId,
    action: 'clone',
    operatorId: params.operatorId,
    beforeSnapshotJson: JSON.stringify({ sourceVersionId: source.version.id }),
    afterSnapshotJson: JSON.stringify({ versionCode: nextVersionCode }),
    notes: `Cloned from ${source.version.versionCode}`,
    createdAt: now,
  });

  return getDamageRuleVersionDetail({ versionId: nextVersionId });
}

export async function updateDamageRuleVersionEditableSections(params: {
  versionId: string;
  operatorId: string;
  modifiers: EditableModifierInput[];
  skillBonuses: EditableSkillBonusInput[];
}) {
  await ensureDamageRuleDbReady();

  const version = await getDamageRuleVersion({ versionId: params.versionId });
  if (!version) {
    throw new Error('damage rule version not found');
  }

  const now = new Date();

  await db().delete(ruleDamageModifier).where(eq(ruleDamageModifier.versionId, version.id));
  await db().delete(ruleSkillBonus).where(eq(ruleSkillBonus.versionId, version.id));

  if (params.modifiers.length > 0) {
    await db().insert(ruleDamageModifier).values(
      params.modifiers.map((item, index) => ({
        id: item.id || getUuid(),
        versionId: version.id,
        modifierDomain: item.modifierDomain,
        modifierKey: item.modifierKey,
        modifierType: item.modifierType,
        sourceKey: item.sourceKey ?? '',
        targetKey: item.targetKey ?? '',
        value: item.value ?? 0,
        valueJson: JSON.stringify(item.valueLookup ?? {}),
        conditionJson: JSON.stringify(item.condition ?? {}),
        sort: item.sort ?? index,
        enabled: item.enabled ?? true,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  if (params.skillBonuses.length > 0) {
    await db().insert(ruleSkillBonus).values(
      params.skillBonuses.map((item, index) => ({
        id: item.id || getUuid(),
        versionId: version.id,
        bonusGroup: item.bonusGroup,
        ruleCode: item.ruleCode,
        skillCode: item.skillCode,
        skillName: item.skillName,
        bonusType: item.bonusType ?? 'skill_level',
        bonusValue: item.bonusValue ?? 0,
        conditionJson: JSON.stringify(item.condition ?? {}),
        conflictPolicy: item.conflictPolicy ?? 'take_max',
        limitPolicyJson: JSON.stringify(item.limitPolicy ?? {}),
        sort: item.sort ?? index,
        enabled: item.enabled ?? true,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  await db()
    .update(ruleVersion)
    .set({
      updatedAt: now,
    })
    .where(eq(ruleVersion.id, version.id));

  await db().insert(rulePublishLog).values({
    id: getUuid(),
    versionId: version.id,
    action: 'update',
    operatorId: params.operatorId,
    beforeSnapshotJson: '{}',
    afterSnapshotJson: JSON.stringify({
      modifierCount: params.modifiers.length,
      skillBonusCount: params.skillBonuses.length,
    }),
    notes: 'Updated editable rule sections.',
    createdAt: now,
  });

  return getDamageRuleVersionDetail({ versionId: version.id });
}
