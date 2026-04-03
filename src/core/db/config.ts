import { defineConfig } from 'drizzle-kit';

import { envConfigs } from '@/config';

export default defineConfig({
  out: envConfigs.db_migrations_out,
  schema: envConfigs.db_schema_file,
  dialect: 'sqlite',
  dbCredentials: {
    url: envConfigs.database_url ?? '',
    ...(envConfigs.database_auth_token
      ? { authToken: envConfigs.database_auth_token }
      : {}),
  },
});
