#!/usr/bin/env node

import { execFileSync, execSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

type CliOptions = {
  dbName: string;
  remote: boolean;
  wranglerFile?: string;
};

type WranglerDbConfig = {
  binding: string;
  databaseName: string;
};

function parseArgs(argv: string[]): CliOptions {
  let dbName = process.env.D1_DATABASE_NAME?.trim() || '';
  let remote = true;
  let wranglerFile: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--db' && argv[i + 1]) {
      dbName = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith('--db=')) {
      dbName = arg.slice('--db='.length);
      continue;
    }

    if (arg === '--local') {
      remote = false;
      continue;
    }

    if (arg === '--remote') {
      remote = true;
      continue;
    }

    if (arg === '--config' && argv[i + 1]) {
      wranglerFile = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith('--config=')) {
      wranglerFile = arg.slice('--config='.length);
    }
  }

  if (!dbName) {
    dbName = readDbNameFromWrangler() || '';
  }

  if (!dbName) {
    throw new Error(
      'Missing D1 database name. Pass --db <name> or set D1_DATABASE_NAME.'
    );
  }

  return { dbName, remote, wranglerFile };
}

function readDbNameFromWrangler(): string | null {
  const file = join(process.cwd(), 'wrangler.toml');
  if (!existsSync(file)) return null;

  const content = readFileSync(file, 'utf8');
  const match = content.match(/database_name\s*=\s*"([^"]+)"/);
  return match?.[1] ?? null;
}

function readWranglerD1Config(wranglerFile?: string): WranglerDbConfig | null {
  const file = wranglerFile
    ? join(process.cwd(), wranglerFile)
    : join(process.cwd(), 'wrangler.toml');

  if (!existsSync(file)) return null;

  const content = readFileSync(file, 'utf8');
  const d1BlockMatch = content.match(
    /\[\[d1_databases\]\]([\s\S]*?)(?=\n\[|\n\[\[|$)/
  );

  if (!d1BlockMatch) {
    return null;
  }

  const d1Block = d1BlockMatch[1];
  const binding = d1Block.match(/binding\s*=\s*"([^"]+)"/)?.[1];
  const databaseName = d1Block.match(/database_name\s*=\s*"([^"]+)"/)?.[1];

  if (!binding || !databaseName) {
    return null;
  }

  return { binding, databaseName };
}

function resolveExecuteTarget(options: CliOptions): string {
  if (options.remote) {
    return options.dbName;
  }

  const wranglerConfig = readWranglerD1Config(options.wranglerFile);
  if (!wranglerConfig) {
    return options.dbName;
  }

  if (
    options.dbName === wranglerConfig.binding
    || options.dbName === wranglerConfig.databaseName
  ) {
    return options.dbName;
  }

  console.log(
    `[D1 Test] Local mode uses wrangler binding/name. Falling back from "${options.dbName}" to "${wranglerConfig.binding}".`
  );

  return wranglerConfig.binding;
}

function runWranglerSql(sql: string, options: CliOptions): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'dream-d1-test-'));
  const sqlFile = join(tempDir, 'query.sql');
  writeFileSync(sqlFile, sql, 'utf8');

  const executeTarget = resolveExecuteTarget(options);
  const args = ['wrangler', 'd1', 'execute', executeTarget];

  if (options.remote) {
    args.push('--remote');
  } else {
    args.push('--local');
  }

  if (options.wranglerFile) {
    args.push('--config', options.wranglerFile);
  }

  args.push('--file', sqlFile, '--json');

  try {
    if (process.platform === 'win32') {
      const command = buildWindowsCommand(args);
      return execSync(command, {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    }

    return execFileSync('npx', args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function buildWindowsCommand(args: string[]): string {
  const escaped = args.map(quoteForCmd).join(' ');
  return `npx ${escaped}`;
}

function quoteForCmd(value: string): string {
  const normalized = value.replace(/"/g, '\\"');

  if (/[ \t\n\r"]/u.test(normalized)) {
    return `"${normalized}"`;
  }

  return normalized;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const now = Date.now();
  const rowId = `smoke-${now}`;
  const tableName = 'd1_smoke_test';

  const createTableSql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id TEXT PRIMARY KEY,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `;

  const insertSql = `
    INSERT INTO ${tableName} (id, message, created_at)
    VALUES ('${rowId}', 'd1 smoke test', ${now});
  `;

  const selectSql = `
    SELECT id, message, created_at
    FROM ${tableName}
    WHERE id = '${rowId}';
  `;

  const deleteSql = `
    DELETE FROM ${tableName}
    WHERE id = '${rowId}';
  `;

  console.log(
    `[D1 Test] Target database: ${options.dbName} (${options.remote ? 'remote' : 'local'})`
  );

  console.log('[D1 Test] Creating smoke test table...');
  runWranglerSql(createTableSql, options);

  console.log(`[D1 Test] Inserting row: ${rowId}`);
  runWranglerSql(insertSql, options);

  console.log('[D1 Test] Reading row back...');
  const selectOutput = runWranglerSql(selectSql, options);
  console.log(selectOutput);

  if (!selectOutput.includes(rowId)) {
    throw new Error(
      `Smoke test row ${rowId} was not returned by D1 select query.`
    );
  }

  console.log('[D1 Test] Cleaning up...');
  runWranglerSql(deleteSql, options);

  console.log('[D1 Test] Success: create/insert/select/delete all passed.');
}

main();
