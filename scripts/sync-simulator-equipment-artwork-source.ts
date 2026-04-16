import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  SIMULATOR_EQUIPMENT_TYPES,
  type SimulatorEquipmentType,
} from '../src/shared/lib/simulator-equipment';
import { normalizeArtworkManifestEntries } from './build-simulator-equipment-artwork-manifest';

type SourceArtworkEntry = {
  type: SimulatorEquipmentType;
  canonicalName: string;
  assetPath: string;
  aliases?: string[];
};

const DEFAULT_ARTWORK_ROOT = path.resolve(
  process.cwd(),
  'public/simulator/equipment-art'
);
const DEFAULT_SOURCE_PATH = path.resolve(
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

function resolveCliArgument(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function ensureSimulatorEquipmentType(value: string): SimulatorEquipmentType {
  if (!(SIMULATOR_EQUIPMENT_TYPES as readonly string[]).includes(value)) {
    throw new Error(`Unsupported artwork directory type: ${value}`);
  }

  return value as SimulatorEquipmentType;
}

function readJsonFile(filePath: string) {
  return JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
}

function listArtworkFiles(rootDir: string): SourceArtworkEntry[] {
  if (!statSync(rootDir).isDirectory()) {
    throw new Error(`Artwork root is not a directory: ${rootDir}`);
  }

  const typeDirectories = readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const entries: SourceArtworkEntry[] = [];
  for (const typeDirectory of typeDirectories) {
    const type = ensureSimulatorEquipmentType(typeDirectory);
    const absoluteTypeDir = path.join(rootDir, typeDirectory);
    const files = readdirSync(absoluteTypeDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'));

    for (const fileName of files) {
      const ext = path.extname(fileName).toLowerCase();
      if (!VALID_IMAGE_EXTENSIONS.has(ext)) {
        continue;
      }

      const canonicalName = path.basename(fileName, ext).trim();
      if (!canonicalName) {
        continue;
      }

      entries.push({
        type,
        canonicalName,
        assetPath: `/simulator/equipment-art/${type}/${fileName}`,
      });
    }
  }

  return entries;
}

function buildEntryLookup(entries: SourceArtworkEntry[]) {
  return new Map(
    entries.map((entry) => [`${entry.type}:${entry.canonicalName}`, entry])
  );
}

export function mergeArtworkEntriesFromDirectory(
  scannedEntries: SourceArtworkEntry[],
  existingEntries: SourceArtworkEntry[]
) {
  const existingLookup = buildEntryLookup(existingEntries);

  return scannedEntries.map((entry) => {
    const existing = existingLookup.get(`${entry.type}:${entry.canonicalName}`);
    if (!existing) {
      return entry;
    }

    return {
      ...entry,
      aliases: existing.aliases,
    };
  });
}

export function buildArtworkSourceJson(entries: SourceArtworkEntry[]) {
  return `${JSON.stringify(entries, null, 2)}\n`;
}

async function main() {
  const artworkRoot = path.resolve(
    process.cwd(),
    resolveCliArgument('--root') ?? DEFAULT_ARTWORK_ROOT
  );
  const sourcePath = path.resolve(
    process.cwd(),
    resolveCliArgument('--source') ?? DEFAULT_SOURCE_PATH
  );
  const checkOnly = process.argv.includes('--check');
  const printOnly = process.argv.includes('--print');

  const scannedEntries = normalizeArtworkManifestEntries(
    listArtworkFiles(artworkRoot)
  );
  const existingEntries = normalizeArtworkManifestEntries(
    readJsonFile(sourcePath)
  );
  const mergedEntries = mergeArtworkEntriesFromDirectory(
    scannedEntries,
    existingEntries
  );
  const normalizedMergedEntries =
    normalizeArtworkManifestEntries(mergedEntries);
  const renderedJson = buildArtworkSourceJson(normalizedMergedEntries);

  if (printOnly) {
    process.stdout.write(renderedJson);
    return;
  }

  if (checkOnly) {
    const current = buildArtworkSourceJson(existingEntries);
    if (current !== renderedJson) {
      throw new Error(
        'Artwork source JSON is out of date. Re-run the sync script after importing local files.'
      );
    }
    console.log('Artwork source JSON is up to date.');
    return;
  }

  writeFileSync(sourcePath, renderedJson, 'utf8');
  console.log(
    `Synced artwork source JSON: ${path.relative(process.cwd(), sourcePath)}`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : 'Failed to sync artwork source JSON.'
    );
    process.exitCode = 1;
  });
}
