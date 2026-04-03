import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle as drizzleD1 } from 'drizzle-orm/d1';

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
let d1DbInstance: ReturnType<typeof drizzleD1> | null = null;
let d1ContextInitPromise: Promise<void> | null = null;
let resolvedD1Binding: D1Database | null = null;

function shouldCacheD1Instance() {
  if (envConfigs.db_singleton_enabled === 'true') {
    return true;
  }

  return isCloudflareWorker && process.env.NODE_ENV === 'production';
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
    'D1 database binding `DB` is unavailable. Ensure the app is running in Cloudflare Workers with a bound D1 database, and that Wrangler authentication/bindings are configured correctly.'
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

export function getD1Db() {
  if (shouldCacheD1Instance() && d1DbInstance) return d1DbInstance;

  const binding = getD1Binding();
  const instance = drizzleD1(binding);
  if (shouldCacheD1Instance()) {
    d1DbInstance = instance;
    return d1DbInstance;
  }
  return instance;
}
