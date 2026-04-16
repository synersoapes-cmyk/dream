import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  SIMULATOR_EQUIPMENT_TYPES,
  type SimulatorEquipmentType,
} from '../src/shared/lib/simulator-equipment';
import {
  normalizeArtworkManifestEntries,
  type SimulatorEquipmentArtworkEntry,
} from './build-simulator-equipment-artwork-manifest';

const DEFAULT_TARGET_ROOT = path.resolve(
  process.cwd(),
  'public/simulator/equipment-art'
);
const DEFAULT_SOURCE_JSON_PATH = path.resolve(
  process.cwd(),
  'data/simulator-equipment-artwork-manifest.source.json'
);
const VALID_IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.avif',
  '.svg',
]);
const IMPORT_TYPE_ALIASES: Record<string, SimulatorEquipmentType> = {
  weapon: 'weapon',
  arms: 'weapon',
  武器: 'weapon',
  helmet: 'helmet',
  head: 'helmet',
  headwear: 'helmet',
  头盔: 'helmet',
  necklace: 'necklace',
  项链: 'necklace',
  armor: 'armor',
  cloth: 'armor',
  clothes: 'armor',
  衣服: 'armor',
  铠甲: 'armor',
  belt: 'belt',
  腰带: 'belt',
  shoes: 'shoes',
  鞋子: 'shoes',
  trinket: 'trinket',
  ring: 'trinket',
  earring: 'trinket',
  bracelet: 'trinket',
  amulet: 'trinket',
  灵饰: 'trinket',
  jade: 'jade',
  玉魄: 'jade',
  runeStone: 'runeStone',
  runestone: 'runeStone',
  rune_stone: 'runeStone',
  符石: 'runeStone',
  rune: 'rune',
};

export type SimulatorArtworkImportFile = {
  sourcePath: string;
  targetPath: string;
  type: SimulatorEquipmentType;
  canonicalName: string;
  action: 'copy' | 'overwrite' | 'skip-existing';
};

export type SimulatorArtworkAliasEntry = {
  type: SimulatorEquipmentType;
  canonicalName: string;
  aliases: string[];
};

export type MergeSimulatorArtworkAliasesResult = {
  entries: SimulatorEquipmentArtworkEntry[];
  matchedCount: number;
  unmatched: SimulatorArtworkAliasEntry[];
};

function resolveCliArgument(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function isValidEquipmentType(value: string): value is SimulatorEquipmentType {
  return (SIMULATOR_EQUIPMENT_TYPES as readonly string[]).includes(value);
}

function parseImportEquipmentType(value: string) {
  const raw = value.trim();
  const normalized = raw.toLowerCase();
  return IMPORT_TYPE_ALIASES[raw] ?? IMPORT_TYPE_ALIASES[normalized] ?? null;
}

function parseAliasMapKey(key: string) {
  const dividerIndex = key.indexOf(':');
  if (dividerIndex === -1) {
    throw new Error(`Invalid alias map key: ${key}`);
  }

  const rawType = key.slice(0, dividerIndex).trim();
  const canonicalName = key.slice(dividerIndex + 1).trim();
  const type = parseImportEquipmentType(rawType);

  if (!type || !canonicalName) {
    throw new Error(`Invalid alias map key: ${key}`);
  }

  return {
    type,
    canonicalName,
  };
}

function normalizeAliasList(value: unknown, context: string) {
  const rawList = Array.isArray(value) ? value : [value];
  const seen = new Set<string>();
  const aliases: string[] = [];

  for (const item of rawList) {
    const alias = String(item ?? '').trim();
    if (!alias || seen.has(alias)) {
      continue;
    }

    seen.add(alias);
    aliases.push(alias);
  }

  if (aliases.length === 0) {
    throw new Error(`${context} must contain at least one alias.`);
  }

  return aliases.sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'));
}

function readJsonFile(filePath: string) {
  return JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
}

export function parseSimulatorArtworkAliasFile(rawFile: unknown) {
  const entries: SimulatorArtworkAliasEntry[] = [];

  if (Array.isArray(rawFile)) {
    for (const [index, item] of rawFile.entries()) {
      if (!item || typeof item !== 'object') {
        throw new Error(`Alias entry ${index + 1} must be an object.`);
      }

      const record = item as Record<string, unknown>;
      const rawType = String(record.type ?? '').trim();
      const type = parseImportEquipmentType(rawType);
      const canonicalName = String(record.canonicalName ?? '').trim();

      if (!type) {
        throw new Error(
          `Alias entry ${index + 1} has unsupported type: ${rawType || '(empty)'}`
        );
      }
      if (!canonicalName) {
        throw new Error(
          `Alias entry ${index + 1} is missing canonicalName.`
        );
      }

      entries.push({
        type,
        canonicalName,
        aliases: normalizeAliasList(record.aliases, `Alias entry ${index + 1}`),
      });
    }

    return entries;
  }

  if (!rawFile || typeof rawFile !== 'object') {
    throw new Error('Alias file must be a JSON object or array.');
  }

  for (const [key, value] of Object.entries(rawFile)) {
    const parsed = parseAliasMapKey(key);

    entries.push({
      ...parsed,
      aliases: normalizeAliasList(value, `Alias map key ${key}`),
    });
  }

  return entries.sort((left, right) => {
    const typeDelta = left.type.localeCompare(right.type);
    if (typeDelta !== 0) {
      return typeDelta;
    }

    return left.canonicalName.localeCompare(right.canonicalName, 'zh-Hans-CN');
  });
}

export function mergeSimulatorArtworkAliases(params: {
  entries: SimulatorEquipmentArtworkEntry[];
  aliasEntries: SimulatorArtworkAliasEntry[];
}) {
  const entryLookup = new Map(
    params.entries.map((entry) => [`${entry.type}:${entry.canonicalName}`, entry])
  );
  const mergedEntries = params.entries.map((entry) => ({
    ...entry,
    aliases: entry.aliases ? [...entry.aliases] : undefined,
  }));
  const mergedLookup = new Map(
    mergedEntries.map((entry) => [`${entry.type}:${entry.canonicalName}`, entry])
  );
  const unmatched: SimulatorArtworkAliasEntry[] = [];
  let matchedCount = 0;

  for (const aliasEntry of params.aliasEntries) {
    if (!entryLookup.has(`${aliasEntry.type}:${aliasEntry.canonicalName}`)) {
      unmatched.push(aliasEntry);
      continue;
    }

    const target = mergedLookup.get(
      `${aliasEntry.type}:${aliasEntry.canonicalName}`
    );
    if (!target) {
      unmatched.push(aliasEntry);
      continue;
    }

    matchedCount += 1;
    target.aliases = normalizeAliasList(
      [...(target.aliases ?? []), ...aliasEntry.aliases],
      `${aliasEntry.type}:${aliasEntry.canonicalName}`
    );
  }

  return {
    entries: normalizeArtworkManifestEntries(mergedEntries),
    matchedCount,
    unmatched,
  } satisfies MergeSimulatorArtworkAliasesResult;
}

export function applySimulatorArtworkAliasFile(params: {
  sourceJsonPath?: string;
  aliasFilePath: string;
}) {
  const sourceJsonPath = path.resolve(
    params.sourceJsonPath ?? DEFAULT_SOURCE_JSON_PATH
  );
  const aliasFilePath = path.resolve(params.aliasFilePath);
  const currentEntries = normalizeArtworkManifestEntries(readJsonFile(sourceJsonPath));
  const aliasEntries = parseSimulatorArtworkAliasFile(readJsonFile(aliasFilePath));
  const result = mergeSimulatorArtworkAliases({
    entries: currentEntries,
    aliasEntries,
  });

  writeFileSync(
    sourceJsonPath,
    `${JSON.stringify(result.entries, null, 2)}\n`,
    'utf8'
  );

  return result;
}

function isImageFile(fileName: string) {
  return VALID_IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function ensureDirectory(dir: string) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new Error(`Directory does not exist: ${dir}`);
  }
}

function sanitizeArtworkFileName(fileName: string) {
  return fileName
    .replace(/[\\/]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildTargetPath(params: {
  targetRoot: string;
  type: SimulatorEquipmentType;
  fileName: string;
}) {
  return path.join(
    params.targetRoot,
    params.type,
    sanitizeArtworkFileName(params.fileName)
  );
}

function parseFlatTypedFileName(fileName: string) {
  const ext = path.extname(fileName);
  const baseName = path.basename(fileName, ext).trim();
  const match = baseName.match(/^([a-zA-Z_]+|武器|头盔|项链|衣服|铠甲|腰带|鞋子|灵饰|玉魄)[-_ ]+(.+)$/);
  if (!match) {
    return null;
  }

  const maybeType = parseImportEquipmentType(match[1]);
  if (!maybeType) {
    return null;
  }

  const canonicalName = match[2]?.trim();
  if (!canonicalName) {
    return null;
  }

  return {
    type: maybeType,
    fileName: `${canonicalName}${ext}`,
  };
}

function collectFilesFromTypedDirectory(params: {
  sourceDir: string;
  targetRoot: string;
  type: SimulatorEquipmentType;
  overwrite: boolean;
}) {
  const files = readdirSync(params.sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isImageFile(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'));

  return files.map((fileName) => {
    const targetPath = buildTargetPath({
      targetRoot: params.targetRoot,
      type: params.type,
      fileName,
    });
    const ext = path.extname(fileName);

    return {
      sourcePath: path.join(params.sourceDir, fileName),
      targetPath,
      type: params.type,
      canonicalName: path.basename(fileName, ext),
      action: existsSync(targetPath)
        ? params.overwrite
          ? 'overwrite'
          : 'skip-existing'
        : 'copy',
    } satisfies SimulatorArtworkImportFile;
  });
}

export function buildSimulatorArtworkImportPlan(params: {
  sourceRoot: string;
  targetRoot?: string;
  type?: SimulatorEquipmentType;
  overwrite?: boolean;
}) {
  const sourceRoot = path.resolve(params.sourceRoot);
  const targetRoot = path.resolve(params.targetRoot ?? DEFAULT_TARGET_ROOT);
  const overwrite = params.overwrite ?? false;
  ensureDirectory(sourceRoot);

  if (params.type) {
    return collectFilesFromTypedDirectory({
      sourceDir: sourceRoot,
      targetRoot,
      type: params.type,
      overwrite,
    });
  }

  const entries = readdirSync(sourceRoot, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name, 'zh-Hans-CN')
  );
  const planned: SimulatorArtworkImportFile[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!isValidEquipmentType(entry.name)) {
        continue;
      }

      planned.push(
        ...collectFilesFromTypedDirectory({
          sourceDir: path.join(sourceRoot, entry.name),
          targetRoot,
          type: entry.name,
          overwrite,
        })
      );
      continue;
    }

    if (!entry.isFile() || !isImageFile(entry.name)) {
      continue;
    }

    const parsed = parseFlatTypedFileName(entry.name);
    if (!parsed) {
      continue;
    }

    const targetPath = buildTargetPath({
      targetRoot,
      type: parsed.type,
      fileName: parsed.fileName,
    });
    const ext = path.extname(parsed.fileName);

    planned.push({
      sourcePath: path.join(sourceRoot, entry.name),
      targetPath,
      type: parsed.type,
      canonicalName: path.basename(parsed.fileName, ext),
      action: existsSync(targetPath)
        ? overwrite
          ? 'overwrite'
          : 'skip-existing'
        : 'copy',
    });
  }

  return planned;
}

export function executeSimulatorArtworkImportPlan(
  plan: SimulatorArtworkImportFile[],
  params: {
    dryRun?: boolean;
  } = {}
) {
  if (params.dryRun) {
    return;
  }

  for (const item of plan) {
    if (item.action === 'skip-existing') {
      continue;
    }

    mkdirSync(path.dirname(item.targetPath), { recursive: true });
    copyFileSync(item.sourcePath, item.targetPath);
  }
}

function printPlanSummary(plan: SimulatorArtworkImportFile[]) {
  const copied = plan.filter((item) => item.action === 'copy').length;
  const overwritten = plan.filter((item) => item.action === 'overwrite').length;
  const skipped = plan.filter((item) => item.action === 'skip-existing').length;

  console.log(
    `Artwork import plan: ${copied} new, ${overwritten} overwrite, ${skipped} skipped.`
  );

  for (const item of plan) {
    console.log(
      `- ${item.action}: ${item.type}/${path.basename(item.targetPath)}`
    );
  }
}

async function main() {
  const source = resolveCliArgument('--source');
  if (!source) {
    throw new Error(
      'Missing --source. Example: pnpm simulator:artwork:import -- --source /path/to/cc-artwork'
    );
  }

  const targetRoot = path.resolve(
    process.cwd(),
    resolveCliArgument('--target') ?? DEFAULT_TARGET_ROOT
  );
  const rawType = resolveCliArgument('--type');
  const type = rawType ? parseImportEquipmentType(rawType) : undefined;
  if (rawType && !type) {
    throw new Error(`Unsupported --type value: ${rawType}`);
  }
  const overwrite = process.argv.includes('--overwrite');
  const dryRun = process.argv.includes('--dry-run');
  const skipRebuild = process.argv.includes('--skip-rebuild');
  const aliasFile = resolveCliArgument('--alias-file');
  const sourceJsonPath = path.resolve(
    process.cwd(),
    resolveCliArgument('--source-json') ?? DEFAULT_SOURCE_JSON_PATH
  );

  const plan = buildSimulatorArtworkImportPlan({
    sourceRoot: source,
    targetRoot,
    type,
    overwrite,
  });

  printPlanSummary(plan);
  executeSimulatorArtworkImportPlan(plan, { dryRun });

  if (!dryRun && !skipRebuild) {
    execFileSync(
      'pnpm',
      ['simulator:artwork:sync-source', '--', '--source', sourceJsonPath],
      {
        cwd: process.cwd(),
        stdio: 'inherit',
      }
    );

    if (aliasFile) {
      const aliasResult = applySimulatorArtworkAliasFile({
        sourceJsonPath,
        aliasFilePath: aliasFile,
      });

      console.log(
        `Artwork aliases merged: ${aliasResult.matchedCount} matched, ${aliasResult.unmatched.length} skipped.`
      );
      for (const item of aliasResult.unmatched) {
        console.warn(
          `- skipped alias entry: ${item.type}/${item.canonicalName}`
        );
      }
    }

    execFileSync(
      'pnpm',
      ['simulator:artwork:build', '--', '--source', sourceJsonPath],
      {
        cwd: process.cwd(),
        stdio: 'inherit',
      }
    );
  } else if (!dryRun && aliasFile) {
    const aliasResult = applySimulatorArtworkAliasFile({
      sourceJsonPath,
      aliasFilePath: aliasFile,
    });

    console.log(
      `Artwork aliases merged without rebuild: ${aliasResult.matchedCount} matched, ${aliasResult.unmatched.length} skipped.`
    );
    for (const item of aliasResult.unmatched) {
      console.warn(`- skipped alias entry: ${item.type}/${item.canonicalName}`);
    }
  } else if (dryRun && aliasFile) {
    const aliasEntries = parseSimulatorArtworkAliasFile(readJsonFile(aliasFile));
    console.log(
      `Alias dry-run: ${aliasEntries.length} alias entries will be merged after import.`
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : 'Failed to import simulator equipment artwork.'
    );
    process.exitCode = 1;
  });
}
