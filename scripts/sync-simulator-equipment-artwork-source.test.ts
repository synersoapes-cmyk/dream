import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildArtworkSourceJson,
  mergeArtworkEntriesFromDirectory,
} from './sync-simulator-equipment-artwork-source';

test('mergeArtworkEntriesFromDirectory preserves aliases from existing source', () => {
  const merged = mergeArtworkEntriesFromDirectory(
    [
      {
        type: 'weapon',
        canonicalName: '沧海灵杖',
        assetPath: '/simulator/equipment-art/weapon/沧海灵杖.webp',
      },
      {
        type: 'trinket',
        canonicalName: '灵符·潮声',
        assetPath: '/simulator/equipment-art/trinket/灵符·潮声.webp',
      },
    ],
    [
      {
        type: 'trinket',
        canonicalName: '灵符·潮声',
        assetPath: '/simulator/equipment-art/trinket/旧图.webp',
        aliases: ['灵符潮声', '【珍品】灵符 潮声'],
      },
    ]
  );

  assert.deepEqual(merged[0], {
    type: 'weapon',
    canonicalName: '沧海灵杖',
    assetPath: '/simulator/equipment-art/weapon/沧海灵杖.webp',
  });
  assert.deepEqual(merged[1], {
    type: 'trinket',
    canonicalName: '灵符·潮声',
    assetPath: '/simulator/equipment-art/trinket/灵符·潮声.webp',
    aliases: ['灵符潮声', '【珍品】灵符 潮声'],
  });
});

test('buildArtworkSourceJson serializes entries with trailing newline', () => {
  const json = buildArtworkSourceJson([
    {
      type: 'weapon',
      canonicalName: '沧海灵杖',
      assetPath: '/simulator/equipment-art/weapon/沧海灵杖.webp',
    },
  ]);

  assert.equal(json.endsWith('\n'), true);
  assert.match(json, /"canonicalName": "沧海灵杖"/);
});
