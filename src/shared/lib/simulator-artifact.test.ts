import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSimulatorArtifactSpotlightTags,
  buildSimulatorArtifactConfigFromTreasure,
  buildSimulatorArtifactTreasure,
  SIMULATOR_ARTIFACT_PRESETS,
  sanitizeSimulatorArtifactConfig,
} from '@/shared/lib/simulator-artifact';

test('artifact config converts fixed damage into runtime magicResult stat', () => {
  const config = sanitizeSimulatorArtifactConfig({
    name: '阳玉',
    statKey: 'fixedDamage',
    value: 24,
    description: '法结神器',
    isActive: true,
  });

  const treasure = buildSimulatorArtifactTreasure(config);

  assert.ok(treasure);
  assert.equal(treasure.name, '阳玉');
  assert.equal(treasure.stats.magicResult, 24);
  assert.equal(treasure.isActive, true);
});

test('artifact config can be restored from treasure payload', () => {
  const config = buildSimulatorArtifactConfigFromTreasure({
    name: '试剑石',
    description: '速度神器',
    isActive: false,
    stats: {
      speed: 29,
    },
  });

  assert.deepEqual(config, {
    name: '试剑石',
    statKey: 'speed',
    value: 29,
    description: '速度神器',
    isActive: false,
  });
});

test('artifact presets provide ready-to-use default templates', () => {
  assert.equal(SIMULATOR_ARTIFACT_PRESETS.length >= 5, true);
  assert.equal(SIMULATOR_ARTIFACT_PRESETS[0]?.isActive, true);
});

test('artifact spotlight tags summarize active value and status', () => {
  const tags = buildSimulatorArtifactSpotlightTags({
    statKey: 'magicDamage',
    value: 24,
    description: '法伤模板',
    isActive: true,
  });

  assert.deepEqual(tags, ['法术伤害 +24', '当前已生效', '法伤模板']);
});
