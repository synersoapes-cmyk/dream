import { getD1Db } from './d1';

const sqliteCompatProxyCache = new WeakMap<object, any>();

/**
 * D1/SQLite compatibility shim:
 * - SQLite doesn't support row-level locking; Drizzle's select builder may not implement `.for()`.
 *   We polyfill `.for(...)` as a no-op to keep call sites portable.
 */
function withSqliteCompat<T extends object>(dbInstance: T, provider = 'd1'): T {
  if (dbInstance && typeof dbInstance === 'object') {
    const cached = sqliteCompatProxyCache.get(dbInstance);
    if (cached) return cached as T;
  }

  const wrapQuery = (query: any) => {
    if (!query || typeof query !== 'object') return query;

    return new Proxy(query, {
      get(target, prop, receiver) {
        if (prop === 'for' && typeof (target as any).for !== 'function') {
          return (..._args: any[]) => receiver;
        }

        const value = Reflect.get(target, prop, receiver);
        if (typeof value !== 'function') return value;

        return (...args: any[]) => {
          const res = value.apply(target, args);
          return wrapQuery(res);
        };
      },
    });
  };

  const proxied = new Proxy(dbInstance, {
    get(target, prop, receiver) {
      if (prop === 'transaction') {
        if (provider === 'd1') {
          return (fn: any) => fn(proxied);
        }

        const original = Reflect.get(target, prop, receiver);
        if (typeof original !== 'function') return original;

        return (fn: any, ...rest: any[]) =>
          original.call(target, (tx: any) => fn(withSqliteCompat(tx, provider)), ...rest);
      }

      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;

      if (typeof prop === 'string' && prop.startsWith('select')) {
        return (...args: any[]) => wrapQuery(value.apply(target, args));
      }

      return value.bind(target);
    },
  }) as any as T;

  if (dbInstance && typeof dbInstance === 'object') {
    sqliteCompatProxyCache.set(dbInstance, proxied);
  }

  return proxied;
}

/**
 * Universal DB accessor for this project.
 *
 * This deployment target is Cloudflare Workers + D1 only, so we intentionally
 * avoid importing other SQL drivers here to keep the server bundle small.
 */
export function db(): any {
  return withSqliteCompat(getD1Db() as any, 'd1');
}

export function dbD1(): ReturnType<typeof getD1Db> {
  return getD1Db();
}

export async function closeDb() {
  // No-op: D1 does not require explicit connection teardown.
}
