import { and, desc, eq, inArray } from 'drizzle-orm';

import { db } from '@/core/db';
import { ensureLocalDevD1Table } from '@/core/db/d1';
import {
  gameCharacter,
  simulatorAdvisorAudit,
  user,
} from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';

import {
  ensureSimulatorDbReady,
  isRecord,
  parseJsonObject,
  withTransientD1Retry,
} from './simulator-core';
import type { AdminSimulatorAdvisorAuditItem } from './simulator-types';

type SimulatorAdvisorAuditRow = typeof simulatorAdvisorAudit.$inferSelect;
type AdvisorAuditUserLookupRow = Pick<typeof user.$inferSelect, 'id' | 'name' | 'email'>;
type AdvisorAuditCharacterLookupRow = Pick<
  typeof gameCharacter.$inferSelect,
  'id' | 'name'
>;

const SIMULATOR_ADVISOR_AUDIT_DEV_TABLE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "simulator_advisor_audit" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "user_id" TEXT NOT NULL,
    "character_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'success',
    "provider" TEXT NOT NULL DEFAULT 'gemini',
    "model" TEXT NOT NULL DEFAULT '',
    "question" TEXT NOT NULL DEFAULT '',
    "answer" TEXT NOT NULL DEFAULT '',
    "error_message" TEXT NOT NULL DEFAULT '',
    "context_summary_json" TEXT NOT NULL DEFAULT '{}',
    "history_json" TEXT NOT NULL DEFAULT '[]',
    "created_at" INTEGER NOT NULL DEFAULT (unixepoch('subsec') * 1000),
    "updated_at" INTEGER NOT NULL DEFAULT (unixepoch('subsec') * 1000),
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE,
    FOREIGN KEY ("character_id") REFERENCES "game_character"("id") ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "idx_simulator_advisor_audit_user_created"
    ON "simulator_advisor_audit" ("user_id", "created_at")`,
  `CREATE INDEX IF NOT EXISTS "idx_simulator_advisor_audit_character_created"
    ON "simulator_advisor_audit" ("character_id", "created_at")`,
  `CREATE INDEX IF NOT EXISTS "idx_simulator_advisor_audit_status_created"
    ON "simulator_advisor_audit" ("status", "created_at")`,
];

async function ensureSimulatorAdvisorAuditTableForDev() {
  await ensureLocalDevD1Table(
    'simulator_advisor_audit',
    SIMULATOR_ADVISOR_AUDIT_DEV_TABLE_STATEMENTS
  );
}

function parseHistoryJson(
  value: string | null | undefined
): Array<{ role: string; content: string }> {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (item): item is { role: string; content: string } =>
              isRecord(item) &&
              typeof item.role === 'string' &&
              typeof item.content === 'string'
          )
          .slice(-6)
      : [];
  } catch {
    return [];
  }
}

function toFiniteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildSimulatorAdvisorAuditContextSummary(
  context: Record<string, unknown>
) {
  const role = isRecord(context.role) ? context.role : {};
  const baseAttributes = isRecord(role.baseAttributes) ? role.baseAttributes : {};
  const combatStats = isRecord(role.combatStats) ? role.combatStats : {};
  const battle = isRecord(context.battle) ? context.battle : {};
  const target = isRecord(battle.target) ? battle.target : {};
  const selectedSkill = isRecord(battle.selectedSkill) ? battle.selectedSkill : {};
  const currentEquipment = Array.isArray(context.currentEquipment)
    ? context.currentEquipment
    : [];
  const candidateEquipment = Array.isArray(context.candidateEquipment)
    ? context.candidateEquipment
    : [];
  const laboratory = Array.isArray(context.laboratory) ? context.laboratory : [];

  return {
    role: {
      faction:
        typeof baseAttributes.faction === 'string' ? baseAttributes.faction : '',
      level: toFiniteNumber(baseAttributes.level),
      magicDamage: toFiniteNumber(combatStats.magicDamage),
      magicDefense: toFiniteNumber(combatStats.magicDefense),
      speed: toFiniteNumber(combatStats.speed),
    },
    battle: {
      targetName: typeof target.name === 'string' ? target.name : '',
      targetMagicDefense: toFiniteNumber(target.magicDefense),
      selectedSkillName:
        typeof selectedSkill.name === 'string' ? selectedSkill.name : '',
      selectedSkillLevel: toFiniteNumber(selectedSkill.level),
    },
    assets: {
      currentEquipmentCount: currentEquipment.length,
      candidateEquipmentCount: candidateEquipment.length,
      laboratorySeatCount: laboratory.length,
    },
  };
}

export async function createSimulatorAdvisorAudit(params: {
  userId: string;
  characterId?: string | null;
  provider?: string;
  model?: string;
  status: 'success' | 'failed';
  question: string;
  answer?: string;
  errorMessage?: string;
  contextSummary?: Record<string, unknown>;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}) {
  await ensureSimulatorDbReady();
  await ensureSimulatorAdvisorAuditTableForDev();

  return withTransientD1Retry('createSimulatorAdvisorAudit', async () => {
    const now = new Date();
    const id = getUuid();

    await db().insert(simulatorAdvisorAudit).values({
      id,
      userId: params.userId,
      characterId: params.characterId ?? null,
      provider: params.provider?.trim() || 'gemini',
      model: params.model?.trim() || '',
      status: params.status,
      question: params.question.trim(),
      answer: params.answer?.trim() || '',
      errorMessage: params.errorMessage?.trim() || '',
      contextSummaryJson: JSON.stringify(params.contextSummary ?? {}),
      historyJson: JSON.stringify(params.history ?? []),
      createdAt: now,
      updatedAt: now,
    });

    return id;
  });
}

export async function listAdminSimulatorAdvisorAudits(params?: {
  status?: 'all' | 'success' | 'failed';
  keyword?: string;
  limit?: number;
}): Promise<AdminSimulatorAdvisorAuditItem[]> {
  await ensureSimulatorDbReady();
  await ensureSimulatorAdvisorAuditTableForDev();

  return withTransientD1Retry('listAdminSimulatorAdvisorAudits', async () => {
    const status = params?.status ?? 'all';
    const keyword = params?.keyword?.trim() ?? '';
    const limit = Math.max(1, Math.min(params?.limit ?? 100, 200));
    const queryLimit = keyword ? 200 : limit;
    const conditions = [];

    if (status !== 'all') {
      conditions.push(eq(simulatorAdvisorAudit.status, status));
    }

    const auditRows = await db()
      .select()
      .from(simulatorAdvisorAudit)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        desc(simulatorAdvisorAudit.createdAt),
        desc(simulatorAdvisorAudit.updatedAt)
      )
      .limit(queryLimit);

    if (auditRows.length === 0) {
      return [];
    }

    const userIds: string[] = Array.from(
      new Set(auditRows.map((row: SimulatorAdvisorAuditRow) => row.userId))
    );
    const characterIds: string[] = Array.from(
      new Set(
        auditRows
          .map((row: SimulatorAdvisorAuditRow) => row.characterId)
          .filter((value: string | null): value is string => Boolean(value))
      )
    );

    const [userRows, characterRows] = await Promise.all([
      db()
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
        })
        .from(user)
        .where(inArray(user.id, userIds as string[])),
      characterIds.length > 0
        ? db()
            .select({
              id: gameCharacter.id,
              name: gameCharacter.name,
            })
            .from(gameCharacter)
            .where(inArray(gameCharacter.id, characterIds as string[]))
        : Promise.resolve([]),
    ]);

    const userMap = new Map(
      (userRows as AdvisorAuditUserLookupRow[]).map((row) => [row.id, row])
    );
    const characterMap = new Map(
      (characterRows as AdvisorAuditCharacterLookupRow[]).map((row) => [row.id, row])
    );
    const keywordLower = keyword.toLowerCase();

    const items = auditRows
      .map((row: SimulatorAdvisorAuditRow): AdminSimulatorAdvisorAuditItem | null => {
        const relatedUser = userMap.get(row.userId);
        if (!relatedUser) {
          return null;
        }

        const relatedCharacter = row.characterId
          ? characterMap.get(row.characterId) ?? null
          : null;

        return {
          id: row.id,
          userId: relatedUser.id,
          userName: relatedUser.name,
          userEmail: relatedUser.email,
          characterId: relatedCharacter?.id ?? row.characterId ?? null,
          characterName: relatedCharacter?.name ?? null,
          status: row.status,
          provider: row.provider,
          model: row.model,
          question: row.question,
          answer: row.answer,
          errorMessage: row.errorMessage,
          contextSummary: parseJsonObject(row.contextSummaryJson),
          history: parseHistoryJson(row.historyJson),
          createdAt: row.createdAt?.getTime?.() ?? 0,
          updatedAt: row.updatedAt?.getTime?.() ?? 0,
        };
      })
      .filter(
        (item: AdminSimulatorAdvisorAuditItem | null): item is AdminSimulatorAdvisorAuditItem =>
          Boolean(item)
      );

    if (!keywordLower) {
      return items;
    }

    return items
      .filter((item: AdminSimulatorAdvisorAuditItem) =>
        [
          item.userName,
          item.userEmail,
          item.characterName ?? '',
          item.question,
          item.answer,
          item.errorMessage,
          item.model,
        ].some((value) => value.toLowerCase().includes(keywordLower))
      )
      .slice(0, limit);
  });
}
