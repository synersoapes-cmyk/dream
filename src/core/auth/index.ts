import { betterAuth, BetterAuthOptions } from 'better-auth';

import { getAllConfigs } from '@/shared/models/config';

import { getAuthOptions } from './config';

// get auth instance in server side
export async function getAuth() {
  const startedAt = Date.now();
  // get configs from db and env
  const configs = await getAllConfigs();
  const configsLoadedAt = Date.now();

  const authOptions = await getAuthOptions(configs);
  const optionsBuiltAt = Date.now();

  if (process.env.NODE_ENV !== 'production') {
    console.log('[auth] getAuth timings', {
      getAllConfigsMs: configsLoadedAt - startedAt,
      getAuthOptionsMs: optionsBuiltAt - configsLoadedAt,
      totalMs: optionsBuiltAt - startedAt,
    });
  }

  return betterAuth(authOptions as BetterAuthOptions);
}
