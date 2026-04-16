import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  applySimulatorArtworkAliasFile,
  buildSimulatorArtworkImportPlan,
  executeSimulatorArtworkImportPlan,
  inferFlatArtworkEquipmentType,
  mergeSimulatorArtworkAliases,
  parseSimulatorArtworkAliasFile,
  shouldIgnoreFlatArtworkFileName,
} from './import-simulator-equipment-artwork';

function makeTempDir() {
  return mkdtempSync(path.join(tmpdir(), 'sim-artwork-import-'));
}

test('buildSimulatorArtworkImportPlan reads typed directories', () => {
  const sourceRoot = makeTempDir();
  const targetRoot = makeTempDir();
  mkdirSync(path.join(sourceRoot, 'weapon'), { recursive: true });
  writeFileSync(path.join(sourceRoot, 'weapon', '沧海灵杖.webp'), 'fake');

  const plan = buildSimulatorArtworkImportPlan({ sourceRoot, targetRoot });

  assert.equal(plan.length, 1);
  assert.equal(plan[0]?.type, 'weapon');
  assert.equal(plan[0]?.canonicalName, '沧海灵杖');
  assert.equal(
    plan[0]?.targetPath,
    path.join(targetRoot, 'weapon', '沧海灵杖.webp')
  );
  assert.equal(plan[0]?.action, 'copy');
});

test('buildSimulatorArtworkImportPlan can import a flat directory with --type', () => {
  const sourceRoot = makeTempDir();
  const targetRoot = makeTempDir();
  writeFileSync(path.join(sourceRoot, '碧海项链.png'), 'fake');

  const plan = buildSimulatorArtworkImportPlan({
    sourceRoot,
    targetRoot,
    type: 'necklace',
  });

  assert.equal(plan.length, 1);
  assert.equal(plan[0]?.type, 'necklace');
  assert.equal(plan[0]?.canonicalName, '碧海项链');
});

test('buildSimulatorArtworkImportPlan infers type from flat file prefix', () => {
  const sourceRoot = makeTempDir();
  const targetRoot = makeTempDir();
  writeFileSync(path.join(sourceRoot, 'weapon-沧海灵杖.webp'), 'fake');
  writeFileSync(path.join(sourceRoot, '腰带 星河腰带.webp'), 'fake');

  const plan = buildSimulatorArtworkImportPlan({ sourceRoot, targetRoot });

  assert.deepEqual(
    plan.map((item) => `${item.type}:${item.canonicalName}`).sort(),
    ['weapon:沧海灵杖', 'belt:星河腰带'].sort()
  );
});

test('buildSimulatorArtworkImportPlan infers type from flat Chinese equipment names', () => {
  const sourceRoot = makeTempDir();
  const targetRoot = makeTempDir();
  writeFileSync(path.join(sourceRoot, '踏雪无痕.jpg'), 'fake');
  writeFileSync(path.join(sourceRoot, '水晶夔帽.jpg'), 'fake');
  writeFileSync(path.join(sourceRoot, '命魂之玉.png'), 'fake');

  const plan = buildSimulatorArtworkImportPlan({ sourceRoot, targetRoot });

  assert.deepEqual(
    plan.map((item) => `${item.type}:${item.canonicalName}`).sort(),
    ['helmet:水晶夔帽', 'jade:命魂之玉', 'shoes:踏雪无痕'].sort()
  );
});

test('buildSimulatorArtworkImportPlan skips property helper images in flat directories', () => {
  const sourceRoot = makeTempDir();
  const targetRoot = makeTempDir();
  writeFileSync(path.join(sourceRoot, '上古玉魄·阳（属性）.png'), 'fake');
  writeFileSync(path.join(sourceRoot, '上古玉魄·阳.jpg'), 'fake');

  const plan = buildSimulatorArtworkImportPlan({ sourceRoot, targetRoot });

  assert.equal(plan.length, 1);
  assert.equal(plan[0]?.canonicalName, '上古玉魄·阳');
  assert.equal(plan[0]?.type, 'jade');
});

test('inferFlatArtworkEquipmentType falls back to weapon for unresolved names', () => {
  assert.equal(inferFlatArtworkEquipmentType('非天（乾坤）'), 'weapon');
  assert.equal(inferFlatArtworkEquipmentType('乾元鸣凤冕'), 'helmet');
  assert.equal(inferFlatArtworkEquipmentType('凤翅金翎'), 'helmet');
  assert.equal(inferFlatArtworkEquipmentType('风月宝链'), 'necklace');
  assert.equal(inferFlatArtworkEquipmentType('琥珀腰链'), 'belt');
});

test('shouldIgnoreFlatArtworkFileName ignores property helper variants only', () => {
  assert.equal(shouldIgnoreFlatArtworkFileName('上古玉魄·阳（属性）.png'), true);
  assert.equal(shouldIgnoreFlatArtworkFileName('罗喉计都（乾坤）.png'), false);
});

test('executeSimulatorArtworkImportPlan copies files and skips existing targets', () => {
  const sourceRoot = makeTempDir();
  const targetRoot = makeTempDir();
  mkdirSync(path.join(sourceRoot, 'weapon'), { recursive: true });
  mkdirSync(path.join(targetRoot, 'weapon'), { recursive: true });
  writeFileSync(path.join(sourceRoot, 'weapon', '沧海灵杖.webp'), 'new');
  writeFileSync(path.join(targetRoot, 'weapon', '沧海灵杖.webp'), 'old');

  const plan = buildSimulatorArtworkImportPlan({ sourceRoot, targetRoot });
  assert.equal(plan[0]?.action, 'skip-existing');

  executeSimulatorArtworkImportPlan(plan);
  const overwritePlan = buildSimulatorArtworkImportPlan({
    sourceRoot,
    targetRoot,
    overwrite: true,
  });
  assert.equal(overwritePlan[0]?.action, 'overwrite');
});

test('parseSimulatorArtworkAliasFile supports array format', () => {
  const parsed = parseSimulatorArtworkAliasFile([
    {
      type: '武器',
      canonicalName: '沧海灵杖',
      aliases: ['珍品沧海灵杖', '沧海神杖', '沧海神杖'],
    },
  ]);

  assert.deepEqual(parsed, [
    {
      type: 'weapon',
      canonicalName: '沧海灵杖',
      aliases: ['沧海神杖', '珍品沧海灵杖'],
    },
  ]);
});

test('parseSimulatorArtworkAliasFile supports map format', () => {
  const parsed = parseSimulatorArtworkAliasFile({
    'weapon:沧海灵杖': ['沧海神杖', '珍品沧海灵杖'],
    '腰带:星河腰带': ['星河神带'],
  });

  assert.deepEqual(
    parsed.map((item) => `${item.type}:${item.canonicalName}:${item.aliases.join('|')}`),
    [
      'belt:星河腰带:星河神带',
      'weapon:沧海灵杖:沧海神杖|珍品沧海灵杖',
    ]
  );
});

test('mergeSimulatorArtworkAliases keeps existing aliases and reports unmatched entries', () => {
  const result = mergeSimulatorArtworkAliases({
    entries: [
      {
        type: 'weapon',
        canonicalName: '沧海灵杖',
        assetPath: '/simulator/equipment-art/weapon/沧海灵杖.webp',
        aliases: ['老版沧海灵杖'],
      },
    ],
    aliasEntries: [
      {
        type: 'weapon',
        canonicalName: '沧海灵杖',
        aliases: ['珍品沧海灵杖', '老版沧海灵杖'],
      },
      {
        type: 'weapon',
        canonicalName: '不存在的武器',
        aliases: ['未知别名'],
      },
    ],
  });

  assert.equal(result.matchedCount, 1);
  assert.deepEqual(result.unmatched, [
    {
      type: 'weapon',
      canonicalName: '不存在的武器',
      aliases: ['未知别名'],
    },
  ]);
  assert.deepEqual(result.entries, [
    {
      type: 'weapon',
      canonicalName: '沧海灵杖',
      assetPath: '/simulator/equipment-art/weapon/沧海灵杖.webp',
      aliases: ['老版沧海灵杖'],
    },
  ]);
});

test('applySimulatorArtworkAliasFile writes merged aliases back to source json', () => {
  const tempDir = makeTempDir();
  const sourceJsonPath = path.join(tempDir, 'source.json');
  const aliasFilePath = path.join(tempDir, 'aliases.json');

  writeFileSync(
    sourceJsonPath,
    JSON.stringify(
      [
        {
          type: 'weapon',
          canonicalName: '沧海灵杖',
          assetPath: '/simulator/equipment-art/weapon/沧海灵杖.webp',
        },
      ],
      null,
      2
    )
  );
  writeFileSync(
    aliasFilePath,
    JSON.stringify({
      'weapon:沧海灵杖': ['珍品沧海灵杖', '沧海神杖'],
      'weapon:未知武器': ['不会写入'],
    })
  );

  const result = applySimulatorArtworkAliasFile({
    sourceJsonPath,
    aliasFilePath,
  });

  assert.equal(result.matchedCount, 1);
  assert.equal(result.unmatched.length, 1);

  const written = JSON.parse(readFileSync(sourceJsonPath, 'utf8')) as Array<{
    type: string;
    canonicalName: string;
    assetPath: string;
    aliases?: string[];
  }>;

  assert.deepEqual(written, [
    {
      type: 'weapon',
      canonicalName: '沧海灵杖',
      assetPath: '/simulator/equipment-art/weapon/沧海灵杖.webp',
      aliases: ['沧海神杖'],
    },
  ]);
});
