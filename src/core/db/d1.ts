import { readdirSync, statSync } from 'fs';
import { join } from 'path';

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createClient } from '@libsql/client';
import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql';

import { envConfigs } from '@/config';
import { isCloudflareWorker } from '@/shared/lib/env';

// Minimal D1Database type to avoid pulling in @cloudflare/workers-types globally,
// which overrides built-in types like Response.json() and breaks non-Workers code.
type D1Database = {
  prepare(query: string): any;
  batch(statements: any[]): Promise<any[]>;
  exec(query: string): Promise<any>;
  dump(): Promise<ArrayBuffer>;
};

// D1 singleton instance (reused across requests in the same isolate / process)
let d1DbInstance: ReturnType<typeof drizzleD1> | ReturnType<typeof drizzleLibsql> | null = null;
let d1ContextInitPromise: Promise<void> | null = null;
let resolvedD1Binding: D1Database | null = null;

function shouldCacheD1Instance() {
  if (envConfigs.db_singleton_enabled === 'true') {
    return true;
  }

  return isCloudflareWorker && process.env.NODE_ENV === 'production';
}

function isLocalD1FallbackEnabled() {
  return process.env.ALLOW_LOCAL_D1_FALLBACK === 'true';
}

function isD1Database(value: unknown): value is D1Database {
  return !!value
    && typeof value === 'object'
    && typeof (value as D1Database).prepare === 'function'
    && typeof (value as D1Database).batch === 'function';
}

/**
 * Get the D1 database binding from Cloudflare Workers environment.
 *
 * Uses `getCloudflareContext()` from @opennextjs/cloudflare.
 * During build/static rendering this will throw — callers should
 * handle the error gracefully (e.g. config.ts already catches it).
 */
function getD1Binding(): D1Database {
  if (shouldCacheD1Instance() && resolvedD1Binding) {
    return resolvedD1Binding;
  }

  const maybeGlobalBinding = (globalThis as { Cloudflare?: { env?: { DB?: unknown } } })
    .Cloudflare
    ?.env
    ?.DB;

  if (isD1Database(maybeGlobalBinding)) {
    if (shouldCacheD1Instance()) {
      resolvedD1Binding = maybeGlobalBinding;
    }
    return maybeGlobalBinding;
  }

  try {
    const cloudflareContextBinding = getCloudflareContext().env?.DB;
    if (isD1Database(cloudflareContextBinding)) {
      if (shouldCacheD1Instance()) {
        resolvedD1Binding = cloudflareContextBinding;
      }
      return cloudflareContextBinding;
    }
  } catch {
    // Ignore and continue to local fallback handling below.
  }

  throw new Error(
    'D1 database binding `DB` is unavailable. Ensure the app is running in Cloudflare Workers with a bound D1 database.'
  );
}

export async function initD1ContextForDev() {
  if (envConfigs.database_provider !== 'd1') {
    return;
  }

  if (!shouldCacheD1Instance()) {
    resolvedD1Binding = null;
    d1DbInstance = null;
  }

  const globalBinding = (globalThis as { Cloudflare?: { env?: { DB?: unknown } } }).Cloudflare?.env?.DB;
  if (isD1Database(globalBinding)) {
    if (shouldCacheD1Instance()) {
      resolvedD1Binding = globalBinding;
    }
    return;
  }

  try {
    const context = getCloudflareContext();
    if (isD1Database(context.env?.DB)) {
      if (shouldCacheD1Instance()) {
        resolvedD1Binding = context.env.DB;
      }
      return;
    }
  } catch {
    // Fall through to async initialization below.
  }

  if (!d1ContextInitPromise) {
    d1ContextInitPromise = getCloudflareContext({ async: true })
      .then((context) => {
        if (isD1Database(context.env?.DB)) {
          if (shouldCacheD1Instance()) {
            resolvedD1Binding = context.env.DB;
          }
        }
      })
      .catch(() => undefined);
  }

  await d1ContextInitPromise;
}

function getLocalD1DatabaseUrl(): string | null {
  if (envConfigs.database_url) {
    return envConfigs.database_url;
  }

  const d1StateDir = join(
    process.cwd(),
    '.wrangler',
    'state',
    'v3',
    'd1',
    'miniflare-D1DatabaseObject'
  );

  try {
    const sqliteFiles = readdirSync(d1StateDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.sqlite'))
      .map((entry) => join(d1StateDir, entry.name));

    if (sqliteFiles.length === 0) {
      return null;
    }

    const latestSqliteFile = sqliteFiles
      .map((filePath) => ({
        path: filePath,
        mtimeMs: statSync(filePath).mtimeMs,
      }))
      .sort((left, right) => right.mtimeMs - left.mtimeMs)[0];

    return `file:${latestSqliteFile.path.replace(/\\/g, '/')}`;
  } catch {
    return null;
  }
}

export function getD1Db() {
  if (shouldCacheD1Instance() && d1DbInstance) return d1DbInstance;

  try {
    const binding = getD1Binding();
    const instance = drizzleD1(binding);
    if (shouldCacheD1Instance()) {
      d1DbInstance = instance;
      return d1DbInstance;
    }
    return instance;
  } catch (workerBindingError) {
    if (!isLocalD1FallbackEnabled()) {
      throw new Error(
        'Remote D1 binding `DB` is unavailable and local fallback is disabled. Use `pnpm wrangler login` for remote D1 development, or set `ALLOW_LOCAL_D1_FALLBACK=true` only when you intentionally want local SQLite fallback.'
      );
    }

    const localD1Url = getLocalD1DatabaseUrl();
    if (!localD1Url) {
      throw workerBindingError;
    }

    const client = createClient({ url: localD1Url });
    const instance = drizzleLibsql({ client });
    if (shouldCacheD1Instance()) {
      d1DbInstance = instance;
      return d1DbInstance;
    }
    return instance;
  }
}
