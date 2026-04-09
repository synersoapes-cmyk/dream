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

type CloudflareEnvLike = {
  DB?: unknown;
};

// D1 singleton instance (reused across requests in the same isolate / process)
let d1DbInstance: ReturnType<typeof drizzleD1> | null = null;
let d1ContextInitPromise: Promise<void> | null = null;
let resolvedD1Binding: D1Database | null = null;
let wranglerProxyInitPromise: Promise<void> | null = null;
let wranglerProxyForDev: { dispose?: () => Promise<void> } | null = null;

type WranglerModule = {
  getPlatformProxy: (options: {
    configPath: string;
    envFiles: string[];
    remoteBindings: boolean;
  }) => Promise<{
    env?: CloudflareEnvLike;
    dispose?: () => Promise<void>;
  }>;
};

function isRemoteProxyAuthError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('failed to start the remote proxy session')
    || message.includes('failed to create a preview token')
    || message.includes('authentication error')
  );
}

export async function resetD1DevBindingCache() {
  d1DbInstance = null;
  d1ContextInitPromise = null;
  resolvedD1Binding = null;
  wranglerProxyInitPromise = null;

  if (wranglerProxyForDev?.dispose) {
    await wranglerProxyForDev.dispose().catch(() => undefined);
  }

  wranglerProxyForDev = null;
}

function shouldCacheD1Instance() {
  if (envConfigs.db_singleton_enabled === 'true') {
    return true;
  }

  return isCloudflareWorker && process.env.NODE_ENV === 'production';
}

function shouldUseWranglerProxyForDev() {
  return (
    envConfigs.database_provider === 'd1' &&
    !isCloudflareWorker &&
    process.env.NODE_ENV !== 'production'
  );
}

function isD1Database(value: unknown): value is D1Database {
  return !!value
    && typeof value === 'object'
    && typeof (value as D1Database).prepare === 'function'
    && typeof (value as D1Database).batch === 'function';
}

async function initD1BindingFromWranglerForDev() {
  if (!shouldUseWranglerProxyForDev()) {
    return;
  }

  if (resolvedD1Binding) {
    return;
  }

  if (!wranglerProxyInitPromise) {
    wranglerProxyInitPromise = (async () => {
      const dynamicImport = new Function(
        'specifier',
        'return import(specifier);'
      ) as (specifier: string) => Promise<WranglerModule>;
      const { getPlatformProxy } = await dynamicImport('wrangler');

      let proxy: Awaited<ReturnType<WranglerModule['getPlatformProxy']>> | null = null;
      try {
        proxy = await getPlatformProxy({
          configPath: 'wrangler.toml',
          envFiles: [],
          remoteBindings: true,
        });
      } catch (error) {
        if (!isRemoteProxyAuthError(error)) {
          throw error;
        }

        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            '[d1] failed to initialize remote Wrangler D1 binding, falling back to local binding:',
            error
          );
        }

        proxy = await getPlatformProxy({
          configPath: 'wrangler.toml',
          envFiles: [],
          remoteBindings: false,
        });
      }

      const binding = (proxy.env as CloudflareEnvLike | undefined)?.DB;
      if (!isD1Database(binding)) {
        await proxy.dispose?.();
        throw new Error(
          'Wrangler platform proxy did not provide a valid D1 binding for `DB`.'
        );
      }

      wranglerProxyForDev = proxy;
      resolvedD1Binding = binding;
    })().catch(async (error) => {
      if (wranglerProxyForDev?.dispose) {
        await wranglerProxyForDev.dispose().catch(() => undefined);
      }
      wranglerProxyForDev = null;
      resolvedD1Binding = null;
      throw error;
    });
  }

  await wranglerProxyInitPromise;
}

/**
 * Get the D1 database binding from Cloudflare Workers environment.
 *
 * Uses `getCloudflareContext()` from @opennextjs/cloudflare.
 * During build/static rendering this will throw — callers should
 * handle the error gracefully (e.g. config.ts already catches it).
 */
function getD1Binding(): D1Database {
  if (resolvedD1Binding && (shouldCacheD1Instance() || shouldUseWranglerProxyForDev())) {
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
    const cloudflareContextBinding = (getCloudflareContext().env as CloudflareEnvLike | undefined)?.DB;
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

  if (!shouldCacheD1Instance() && !shouldUseWranglerProxyForDev()) {
    resolvedD1Binding = null;
    d1DbInstance = null;
  } else if (!shouldCacheD1Instance()) {
    d1DbInstance = null;
  }

  if (shouldUseWranglerProxyForDev()) {
    await initD1BindingFromWranglerForDev();
    return;
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
    const contextBinding = (context.env as CloudflareEnvLike | undefined)?.DB;
    if (isD1Database(contextBinding)) {
      if (shouldCacheD1Instance()) {
        resolvedD1Binding = contextBinding;
      }
      return;
    }
  } catch {
    // Fall through to async initialization below.
  }

  if (!d1ContextInitPromise) {
    d1ContextInitPromise = getCloudflareContext({ async: true })
      .then((context) => {
        const contextBinding = (context.env as CloudflareEnvLike | undefined)?.DB;
        if (isD1Database(contextBinding)) {
          if (shouldCacheD1Instance()) {
            resolvedD1Binding = contextBinding;
          }
        }
      })
      .catch(() => undefined);
  }

  await d1ContextInitPromise;

  if (!resolvedD1Binding) {
    await initD1BindingFromWranglerForDev();
  }
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
