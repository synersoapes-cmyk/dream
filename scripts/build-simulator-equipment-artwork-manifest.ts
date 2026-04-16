import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  SIMULATOR_EQUIPMENT_TYPES,
  type SimulatorEquipmentType,
} from '../src/shared/lib/simulator-equipment';
import {
  compactEquipmentArtworkName,
  normalizeEquipmentArtworkName,
} from '../src/shared/lib/simulator-equipment-artwork';

export type SimulatorEquipmentArtworkEntry = {
  type: SimulatorEquipmentType;
  canonicalName: string;
  assetPath: string;
  aliases?: string[];
};

const DEFAULT_SOURCE_PATH = path.resolve(
  process.cwd(),
  'data/simulator-equipment-artwork-manifest.source.json'
);
const DEFAULT_OUTPUT_PATH = path.resolve(
  process.cwd(),
  'src/shared/lib/simulator-equipment-artwork-manifest.ts'
);
const VALID_ASSET_PATH_PATTERN =
  /^\/simulator\/equipment-art\/[^?#]+\.(png|jpg|jpeg|webp|avif|svg)$/i;

const TYPE_ORDER = new Map(
  SIMULATOR_EQUIPMENT_TYPES.map((type, index) => [type, index])
);

function ensureArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error('Artwork manifest source must be a JSON array.');
  }
  return value;
}

function quoteString(value: string) {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function buildNormalizedArtworkKey(type: SimulatorEquipmentType, name: string) {
  return `${type}:${compactEquipmentArtworkName(
    normalizeEquipmentArtworkName(name)
  )}`;
}

export function normalizeArtworkManifestEntries(
  rawEntries: unknown
): SimulatorEquipmentArtworkEntry[] {
  const entries = ensureArray(rawEntries);
  const seenKeys = new Set<string>();

  return entries
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') {
        throw new Error(
          `Artwork manifest entry ${index + 1} must be an object.`
        );
      }

      const record = entry as Record<string, unknown>;
      const rawType = String(record.type ?? '').trim();
      const rawCanonicalName = String(record.canonicalName ?? '').trim();
      const rawAssetPath = String(record.assetPath ?? '').trim();
      const rawAliases = Array.isArray(record.aliases) ? record.aliases : [];

      if (
        !rawType ||
        !(SIMULATOR_EQUIPMENT_TYPES as readonly string[]).includes(rawType)
      ) {
        throw new Error(
          `Artwork manifest entry ${index + 1} has invalid type: ${rawType || '(empty)'}`
        );
      }
      if (!rawCanonicalName) {
        throw new Error(
          `Artwork manifest entry ${index + 1} is missing canonicalName.`
        );
      }
      if (!VALID_ASSET_PATH_PATTERN.test(rawAssetPath)) {
        throw new Error(
          `Artwork manifest entry ${index + 1} has invalid assetPath: ${rawAssetPath || '(empty)'}`
        );
      }

      const canonicalKey = buildNormalizedArtworkKey(
        rawType as SimulatorEquipmentType,
        rawCanonicalName
      );
      if (seenKeys.has(canonicalKey)) {
        throw new Error(
          `Artwork manifest contains duplicate canonical mapping: ${canonicalKey}`
        );
      }
      seenKeys.add(canonicalKey);

      const aliasBuckets = new Map<string, string>();
      for (const item of rawAliases) {
        const alias = String(item ?? '').trim();
        if (!alias) {
          continue;
        }

        const aliasKey = buildNormalizedArtworkKey(
          rawType as SimulatorEquipmentType,
          alias
        );
        if (aliasKey === canonicalKey || aliasBuckets.has(aliasKey)) {
          continue;
        }
        aliasBuckets.set(aliasKey, alias);
      }

      const aliases = Array.from(aliasBuckets.values()).sort((left, right) =>
        left.localeCompare(right, 'zh-Hans-CN')
      );

      for (const alias of aliases) {
        const aliasKey = buildNormalizedArtworkKey(
          rawType as SimulatorEquipmentType,
          alias
        );
        if (seenKeys.has(aliasKey)) {
          throw new Error(
            `Artwork manifest contains duplicate alias mapping: ${aliasKey}`
          );
        }
        seenKeys.add(aliasKey);
      }

      return {
        type: rawType as SimulatorEquipmentType,
        canonicalName: rawCanonicalName,
        assetPath: rawAssetPath,
        aliases: aliases.length > 0 ? aliases : undefined,
      };
    })
    .sort((left, right) => {
      const typeDelta =
        (TYPE_ORDER.get(left.type) ?? Number.MAX_SAFE_INTEGER) -
        (TYPE_ORDER.get(right.type) ?? Number.MAX_SAFE_INTEGER);
      if (typeDelta !== 0) {
        return typeDelta;
      }

      return left.canonicalName.localeCompare(
        right.canonicalName,
        'zh-Hans-CN'
      );
    });
}

export function renderArtworkManifestSource(
  entries: SimulatorEquipmentArtworkEntry[]
) {
  const lines = [
    "import type { SimulatorEquipmentType } from '@/shared/lib/simulator-equipment';",
    '',
    'export type SimulatorEquipmentArtworkEntry = {',
    '  type: SimulatorEquipmentType;',
    '  canonicalName: string;',
    '  assetPath: string;',
    '  aliases?: string[];',
    '};',
    '',
    '// Generated from data/simulator-equipment-artwork-manifest.source.json',
    '// Run `pnpm exec tsx scripts/build-simulator-equipment-artwork-manifest.ts`',
    '// after updating the source JSON or importing new local artwork files.',
    'export const SIMULATOR_EQUIPMENT_ARTWORK_ENTRIES: SimulatorEquipmentArtworkEntry[] =',
  ];

  if (entries.length === 0) {
    lines.push('  [];');
    return `${lines.join('\n')}\n`;
  }

  lines.push('  [');
  for (const entry of entries) {
    lines.push('    {');
    lines.push(`      type: ${quoteString(entry.type)},`);
    lines.push(`      canonicalName: ${quoteString(entry.canonicalName)},`);
    lines.push(`      assetPath: ${quoteString(entry.assetPath)},`);
    if (entry.aliases && entry.aliases.length > 0) {
      lines.push('      aliases: [');
      for (const alias of entry.aliases) {
        lines.push(`        ${quoteString(alias)},`);
      }
      lines.push('      ],');
    }
    lines.push('    },');
  }
  lines.push('  ];');

  return `${lines.join('\n')}\n`;
}

export function buildArtworkManifestFileContent(rawEntries: unknown) {
  return renderArtworkManifestSource(
    normalizeArtworkManifestEntries(rawEntries)
  );
}

export function loadArtworkManifestSourceFile(filePath = DEFAULT_SOURCE_PATH) {
  return JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
}

function resolveCliArgument(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

async function main() {
  const sourcePath = path.resolve(
    process.cwd(),
    resolveCliArgument('--source') ?? DEFAULT_SOURCE_PATH
  );
  const outputPath = path.resolve(
    process.cwd(),
    resolveCliArgument('--output') ?? DEFAULT_OUTPUT_PATH
  );
  const checkOnly = process.argv.includes('--check');

  const source = loadArtworkManifestSourceFile(sourcePath);
  const rendered = buildArtworkManifestFileContent(source);

  if (checkOnly) {
    const current = readFileSync(outputPath, 'utf8');
    if (current !== rendered) {
      throw new Error(
        'Artwork manifest is out of date. Re-run the build script to regenerate it.'
      );
    }
    console.log('Artwork manifest is up to date.');
    return;
  }

  writeFileSync(outputPath, rendered, 'utf8');
  console.log(
    `Generated artwork manifest: ${path.relative(process.cwd(), outputPath)}`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : 'Failed to build artwork manifest.'
    );
    process.exitCode = 1;
  });
}
