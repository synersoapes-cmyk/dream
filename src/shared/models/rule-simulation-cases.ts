import { asc, desc, eq } from 'drizzle-orm';

import { db } from '@/core/db';
import { initD1ContextForDev } from '@/core/db/d1';
import { ruleSimulationCase } from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';

type JsonObject = Record<string, unknown>;

type RuleSimulationCaseRow = typeof ruleSimulationCase.$inferSelect;

export type RuleSimulationCase = Omit<
  RuleSimulationCaseRow,
  'inputJson' | 'expectedResultJson'
> & {
  input: JsonObject;
  expectedResult: JsonObject;
};

function parseJsonObject(value: string | null | undefined): JsonObject {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as JsonObject) : {};
  } catch {
    return {};
  }
}

function toSimulationCase(row: RuleSimulationCaseRow): RuleSimulationCase {
  return {
    ...row,
    input: parseJsonObject(row.inputJson),
    expectedResult: parseJsonObject(row.expectedResultJson),
  };
}

async function ensureSimulationCaseDbReady() {
  await initD1ContextForDev();
}

export async function listRuleSimulationCases(): Promise<RuleSimulationCase[]> {
  await ensureSimulationCaseDbReady();

  const rows = await db()
    .select()
    .from(ruleSimulationCase)
    .where(eq(ruleSimulationCase.enabled, true))
    .orderBy(desc(ruleSimulationCase.createdAt), asc(ruleSimulationCase.name));

  return rows.map(toSimulationCase);
}

export async function createRuleSimulationCase(params: {
  name: string;
  versionId?: string;
  input: JsonObject;
  expectedResult: JsonObject;
  notes?: string;
  createdBy: string;
}) {
  await ensureSimulationCaseDbReady();

  const now = new Date();
  const [inserted] = await db()
    .insert(ruleSimulationCase)
    .values({
      id: getUuid(),
      name: params.name,
      versionId: params.versionId || null,
      inputJson: JSON.stringify(params.input ?? {}),
      expectedResultJson: JSON.stringify(params.expectedResult ?? {}),
      notes: params.notes ?? '',
      enabled: true,
      createdBy: params.createdBy,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return toSimulationCase(inserted);
}

export async function deleteRuleSimulationCase(id: string) {
  await ensureSimulationCaseDbReady();

  await db()
    .update(ruleSimulationCase)
    .set({
      enabled: false,
      updatedAt: new Date(),
    })
    .where(eq(ruleSimulationCase.id, id));
}
