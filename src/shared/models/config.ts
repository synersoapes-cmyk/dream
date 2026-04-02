import { revalidateTag, unstable_cache } from 'next/cache';

import { db } from '@/core/db';
import { initD1ContextForDev } from '@/core/db/d1';
import { envConfigs } from '@/config';
import { config } from '@/config/db/schema';
import {
  getAllSettingNames,
  publicSettingNames,
} from '@/shared/services/settings';

export type Config = typeof config.$inferSelect;
export type NewConfig = typeof config.$inferInsert;
export type UpdateConfig = Partial<Omit<NewConfig, 'name'>>;

export type Configs = Record<string, string>;

export const CACHE_TAG_CONFIGS = 'configs';

export async function saveConfigs(configs: Record<string, string>) {
  if (envConfigs.database_provider === 'd1') {
    await initD1ContextForDev();
  }

  const database = db();
  const configEntries = Object.entries(configs);

  // D1: use batch() to send all upserts in a single round-trip
  if (envConfigs.database_provider === 'd1') {
    const queries = configEntries.map(([name, configValue]) =>
      database
        .insert(config)
        .values({ name, value: configValue })
        .onConflictDoUpdate({
          target: config.name,
          set: { value: configValue },
        })
        .returning()
    );

    const batchResults = queries.length > 0 ? await database.batch(queries) : [];
    revalidateTag(CACHE_TAG_CONFIGS, 'max');
    return batchResults.flat();
  }

  // Other databases: use transaction for atomicity
  const result = await database.transaction(async (tx: any) => {
    const results: any[] = [];

    for (const [name, configValue] of configEntries) {
      const [upsertResult] = await tx
        .insert(config)
        .values({ name, value: configValue })
        .onConflictDoUpdate({
          target: config.name,
          set: { value: configValue },
        })
        .returning();

      results.push(upsertResult);
    }

    return results;
  });

  revalidateTag(CACHE_TAG_CONFIGS, 'max');

  return result;
}

export async function addConfig(newConfig: NewConfig) {
  if (envConfigs.database_provider === 'd1') {
    await initD1ContextForDev();
  }

  const [result] = await db().insert(config).values(newConfig).returning();
  revalidateTag(CACHE_TAG_CONFIGS, 'max');

  return result;
}

export const getConfigs = unstable_cache(
  async (): Promise<Configs> => {
    const startedAt = Date.now();
    const configs: Record<string, string> = {};

    if (envConfigs.database_provider === 'd1') {
      await initD1ContextForDev();
    }
    if (!envConfigs.database_url && envConfigs.database_provider !== 'd1') {
      return configs;
    }

    const result = await db().select().from(config);
    if (!result) {
      return configs;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[config] getConfigs db timings', {
        rows: result.length,
        elapsedMs: Date.now() - startedAt,
      });
    }

    for (const config of result) {
      configs[config.name] = config.value ?? '';
    }

    return configs;
  },
  ['configs'],
  {
    revalidate: 3600,
    tags: [CACHE_TAG_CONFIGS],
  }
);

export async function getAllConfigs(): Promise<Configs> {
  let dbConfigs: Configs = {};

  // only get configs from db in server side
  const hasDb = envConfigs.database_url || envConfigs.database_provider === 'd1';
  if (typeof window === 'undefined' && hasDb) {
    try {
      dbConfigs = await getConfigs();
    } catch (e) {
      console.log(`get configs from db failed:`, e);
      dbConfigs = {};
    }
  }

  const settingNames = await getAllSettingNames();
  settingNames.forEach((key) => {
    const upperKey = key.toUpperCase();
    // use env configs if available
    if (process.env[upperKey]) {
      dbConfigs[key] = process.env[upperKey] ?? '';
    } else if (process.env[key]) {
      dbConfigs[key] = process.env[key] ?? '';
    }
  });

  const configs = {
    ...envConfigs,
    ...dbConfigs,
  };

  return configs;
}

export async function getPublicConfigs(): Promise<Configs> {
  let allConfigs = await getAllConfigs();

  const publicConfigs: Record<string, string> = {};

  // get public configs
  for (const key in allConfigs) {
    if (publicSettingNames.includes(key)) {
      publicConfigs[key] = String(allConfigs[key]);
    }
  }

  const configs = {
    ...publicConfigs,
  };

  return configs;
}
