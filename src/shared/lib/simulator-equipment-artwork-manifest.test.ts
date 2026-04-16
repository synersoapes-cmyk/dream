import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  compactEquipmentArtworkName,
  normalizeEquipmentArtworkName,
} from '@/shared/lib/simulator-equipment-artwork';
import { SIMULATOR_EQUIPMENT_ARTWORK_ENTRIES } from '@/shared/lib/simulator-equipment-artwork-manifest';

const VALID_ASSET_PATH_PATTERN =
  /^\/simulator\/equipment-art\/[^?#]+\.(png|jpg|jpeg|webp|avif|svg)$/i;

function listArtworkAssetPaths(
  rootDir: string,
  currentDir = rootDir
): string[] {
  const entries = readdirSync(currentDir, { withFileTypes: true });
  const assetPaths: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      assetPaths.push(...listArtworkAssetPaths(rootDir, absolutePath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const relativePath = path
      .relative(rootDir, absolutePath)
      .replace(/\\/g, '/');
    if (relativePath === '.gitkeep') {
      continue;
    }

    assetPaths.push(`/simulator/equipment-art/${relativePath}`);
  }

  return assetPaths.sort((left, right) => left.localeCompare(right));
}

test('equipment artwork manifest uses valid unique asset mappings', () => {
  const seenKeys = new Set<string>();
  const publicRoot = path.resolve(process.cwd(), 'public');

  for (const entry of SIMULATOR_EQUIPMENT_ARTWORK_ENTRIES) {
    assert.ok(entry.canonicalName.trim().length > 0);
    assert.match(entry.assetPath, VALID_ASSET_PATH_PATTERN);
    assert.equal(
      existsSync(path.join(publicRoot, entry.assetPath.replace(/^\//, ''))),
      true,
      `missing artwork asset file: ${entry.assetPath}`
    );

    const canonicalKey = `${entry.type}:${compactEquipmentArtworkName(
      normalizeEquipmentArtworkName(entry.canonicalName)
    )}`;
    assert.equal(
      seenKeys.has(canonicalKey),
      false,
      `duplicate canonical artwork mapping: ${canonicalKey}`
    );
    seenKeys.add(canonicalKey);

    for (const alias of entry.aliases ?? []) {
      assert.ok(alias.trim().length > 0);

      const aliasKey = `${entry.type}:${compactEquipmentArtworkName(
        normalizeEquipmentArtworkName(alias)
      )}`;
      assert.equal(
        seenKeys.has(aliasKey),
        false,
        `duplicate alias artwork mapping: ${aliasKey}`
      );
      seenKeys.add(aliasKey);
    }
  }
});

test('equipment artwork manifest references every local artwork asset file', () => {
  const artworkRoot = path.resolve(
    process.cwd(),
    'public/simulator/equipment-art'
  );
  assert.equal(statSync(artworkRoot).isDirectory(), true);

  const manifestAssetPaths = new Set(
    SIMULATOR_EQUIPMENT_ARTWORK_ENTRIES.map((entry) => entry.assetPath)
  );

  for (const assetPath of listArtworkAssetPaths(artworkRoot)) {
    assert.equal(
      manifestAssetPaths.has(assetPath),
      true,
      `unregistered artwork asset file: ${assetPath}`
    );
  }
});
