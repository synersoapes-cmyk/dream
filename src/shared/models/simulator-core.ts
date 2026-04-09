import { and, asc, desc, eq } from 'drizzle-orm';

import { db } from '@/core/db';
import { initD1ContextForDev, resetD1DevBindingCache } from '@/core/db/d1';
import {
  candidateEquipment,
  characterSnapshot,
  gameCharacter,
  labSession,
  ocrJob,
} from '@/config/db/schema';

import type { SimulatorCharacter } from './simulator-types';

export async function ensureSimulatorDbReady() {
  await initD1ContextForDev();
}

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

export async function withTransientD1Retry<T>(
  label: string,
  operation: () => Promise<T>,
  maxAttempts = 3
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
        `[simulator] transient D1 error during ${label}, retrying (${attempt}/${maxAttempts})`,
        error
      );

      await resetD1DevBindingCache();
      await new Promise((resolve) => setTimeout(resolve, attempt * 150));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Unknown simulator D1 error during ${label}`);
}

export function chunkArray<T>(items: T[], chunkSize = 8): T[][] {
  if (items.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseJsonObject(value: string | null | undefined) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function mapCandidateStatusToDraftReviewStatus(
  status: 'pending' | 'confirmed' | 'replaced'
) {
  if (status === 'confirmed') {
    return 'approved';
  }

  if (status === 'replaced') {
    return 'rejected';
  }

  return 'pending';
}

export function inferOcrDraftConfidence(rawResult: Record<string, unknown>) {
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

export function deriveInventoryFolderKey(equipment: Record<string, unknown>) {
  const type = String(equipment.type || 'equipment').trim() || 'equipment';
  const slot =
    equipment.slot === undefined || equipment.slot === null
      ? ''
      : String(equipment.slot).trim();

  return slot ? `${type}:${slot}` : type;
}

export function mapInventoryStatusToCandidateStatus(
  status: 'active' | 'sold' | 'discarded'
): 'confirmed' | 'replaced' {
  return status === 'active' ? 'confirmed' : 'replaced';
}

export async function insertValuesInChunks(
  database: ReturnType<typeof db>,
  table: any,
  values: any[],
  chunkSize = 8
) {
  const queries = chunkArray(values, chunkSize).map((chunk) =>
    database.insert(table).values(chunk)
  );

  if (queries.length === 0) {
    return;
  }

  if (typeof database.batch === 'function') {
    await database.batch(queries);
    return;
  }

  for (const query of queries) {
    await query;
  }
}

export async function findActiveCharacter(
  userId: string,
  characterId?: string
) {
  const where = characterId
    ? and(
        eq(gameCharacter.userId, userId),
        eq(gameCharacter.id, characterId),
        eq(gameCharacter.status, 'active')
      )
    : and(eq(gameCharacter.userId, userId), eq(gameCharacter.status, 'active'));

  const [character] = await db()
    .select()
    .from(gameCharacter)
    .where(where)
    .orderBy(desc(gameCharacter.updatedAt))
    .limit(1);

  return character ?? null;
}

export async function findCurrentSnapshot(character: SimulatorCharacter) {
  if (character.currentSnapshotId) {
    const [currentSnapshot] = await db()
      .select()
      .from(characterSnapshot)
      .where(eq(characterSnapshot.id, character.currentSnapshotId))
      .limit(1);

    if (currentSnapshot) {
      return currentSnapshot;
    }
  }

  const [typedSnapshot] = await db()
    .select()
    .from(characterSnapshot)
    .where(
      and(
        eq(characterSnapshot.characterId, character.id),
        eq(characterSnapshot.snapshotType, 'current')
      )
    )
    .orderBy(desc(characterSnapshot.createdAt))
    .limit(1);

  if (typedSnapshot) {
    return typedSnapshot;
  }

  const [latestSnapshot] = await db()
    .select()
    .from(characterSnapshot)
    .where(eq(characterSnapshot.characterId, character.id))
    .orderBy(desc(characterSnapshot.createdAt))
    .limit(1);

  return latestSnapshot ?? null;
}

export async function findActiveLabSession(characterId: string) {
  const [session] = await db()
    .select()
    .from(labSession)
    .where(
      and(
        eq(labSession.characterId, characterId),
        eq(labSession.status, 'active')
      )
    )
    .orderBy(desc(labSession.updatedAt))
    .limit(1);

  return session ?? null;
}

export async function findCandidateEquipmentRows(characterId: string) {
  return db()
    .select()
    .from(candidateEquipment)
    .where(eq(candidateEquipment.characterId, characterId))
    .orderBy(asc(candidateEquipment.sort), desc(candidateEquipment.updatedAt));
}

export async function findSimulatorOcrJobById(id: string) {
  const [job] = await db()
    .select()
    .from(ocrJob)
    .where(eq(ocrJob.id, id))
    .limit(1);

  return job ?? null;
}
