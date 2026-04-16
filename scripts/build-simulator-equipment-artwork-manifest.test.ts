import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildArtworkManifestFileContent,
  normalizeArtworkManifestEntries,
} from './build-simulator-equipment-artwork-manifest';

test('normalizeArtworkManifestEntries sorts entries and deduplicates aliases', () => {
  const entries = normalizeArtworkManifestEntries([
    {
      type: 'trinket',
      canonicalName: '灵符·潮声',
      assetPath: '/simulator/equipment-art/trinket/lingfu-chaosheng.webp',
      aliases: ['潮声灵符', '潮声灵符', '【珍品】灵符 潮声'],
    },
    {
      type: 'weapon',
      canonicalName: '沧海灵杖',
      assetPath: '/simulator/equipment-art/weapon/canghai-lingzhang.webp',
    },
  ]);

  assert.deepEqual(
    entries.map((entry) => entry.type),
    ['weapon', 'trinket']
  );
  assert.deepEqual(entries[1]?.aliases, ['潮声灵符']);
});

test('normalizeArtworkManifestEntries rejects duplicate normalized mappings', () => {
  assert.throws(() =>
    normalizeArtworkManifestEntries([
      {
        type: 'trinket',
        canonicalName: '灵符·潮声',
        assetPath: '/simulator/equipment-art/trinket/a.webp',
      },
      {
        type: 'trinket',
        canonicalName: '灵符潮声',
        assetPath: '/simulator/equipment-art/trinket/b.webp',
      },
    ])
  );
});

test('buildArtworkManifestFileContent renders generated source header', () => {
  const content = buildArtworkManifestFileContent([
    {
      type: 'weapon',
      canonicalName: '沧海灵杖',
      assetPath: '/simulator/equipment-art/weapon/canghai-lingzhang.webp',
      aliases: ['沧海神杖'],
    },
  ]);

  assert.match(
    content,
    /Generated from data\/simulator-equipment-artwork-manifest\.source\.json/
  );
  assert.match(content, /canonicalName: '沧海灵杖'/);
  assert.match(content, /aliases: \[/);
});
