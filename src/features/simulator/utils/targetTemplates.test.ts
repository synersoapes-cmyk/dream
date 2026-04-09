import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDungeonDatabaseFromTemplates,
  buildManualTargetsFromTemplates,
} from '@/features/simulator/utils/targetTemplates';

test('buildDungeonDatabaseFromTemplates filters out manual templates', () => {
  const dungeons = buildDungeonDatabaseFromTemplates([
    {
      id: 'dungeon_target_1',
      sceneType: 'dungeon',
      name: '乌鸡树怪',
      dungeonName: '乌鸡国',
      targetType: 'mob',
      level: 109,
      hp: 50000,
      defense: 1300,
      magicDefense: 1200,
      magicDefenseCultivation: 10,
      speed: 600,
      element: '火',
      formation: '地载阵',
      notes: '',
      payload: {},
    },
    {
      id: 'dungeon_target_2',
      sceneType: 'dungeon',
      name: '乌鸡国王',
      dungeonName: '乌鸡国',
      targetType: 'boss',
      level: 60,
      hp: 25000,
      defense: 600,
      magicDefense: 450,
      magicDefenseCultivation: 10,
      speed: 650,
      element: '火',
      formation: '地载阵',
      notes: '',
      payload: {},
    },
    {
      id: 'manual_template_1',
      sceneType: 'manual',
      name: '手动模板',
      dungeonName: '',
      targetType: 'manual',
      level: 175,
      hp: 90000,
      defense: 1600,
      magicDefense: 1500,
      magicDefenseCultivation: 0,
      speed: 900,
      element: '土',
      formation: '鸟翔阵',
      notes: '',
      payload: {},
    },
  ]);

  assert.equal(dungeons.length, 1);
  assert.equal(dungeons[0]?.name, '乌鸡国');
  assert.equal(dungeons[0]?.targets.length, 2);
  assert.equal(dungeons[0]?.targets[0]?.name, '乌鸡树怪');
  assert.equal(dungeons[0]?.targets[1]?.isBoss, true);
});

test('buildDungeonDatabaseFromTemplates returns empty list without dungeon templates', () => {
  const dungeons = buildDungeonDatabaseFromTemplates([
    {
      id: 'manual_template_1',
      sceneType: 'manual',
      name: '手动模板',
      dungeonName: '',
      targetType: 'manual',
      level: 175,
      hp: 90000,
      defense: 1600,
      magicDefense: 1500,
      magicDefenseCultivation: 0,
      speed: 900,
      element: '土',
      formation: '鸟翔阵',
      notes: '',
      payload: {},
    },
  ]);

  assert.deepEqual(dungeons, []);
});

test('buildManualTargetsFromTemplates hydrates manual stats from payload', () => {
  const manualTargets = buildManualTargetsFromTemplates([
    {
      id: 'manual_template_1',
      sceneType: 'manual',
      name: '后台手动模板',
      dungeonName: '',
      targetType: 'manual',
      level: 175,
      hp: 77777,
      defense: 1888,
      magicDefense: 1666,
      magicDefenseCultivation: 0,
      speed: 888,
      element: '木',
      formation: '虎翼阵',
      notes: '',
      payload: {
        magicDamage: 1234,
        spiritualPower: 567,
        hit: 1499,
        elementalResistance: 177,
      },
    },
  ]);

  assert.equal(manualTargets.length, 1);
  assert.equal(manualTargets[0]?.id, 'manual_template_1');
  assert.equal(manualTargets[0]?.name, '后台手动模板');
  assert.equal(manualTargets[0]?.element, '木');
  assert.equal(manualTargets[0]?.formation, '虎翼阵');
  assert.equal(manualTargets[0]?.magicDamage, 1234);
  assert.equal(manualTargets[0]?.spiritualPower, 567);
  assert.equal(manualTargets[0]?.hp, 77777);
  assert.equal(manualTargets[0]?.defense, 1888);
  assert.equal(manualTargets[0]?.magicDefense, 1666);
  assert.equal(manualTargets[0]?.elementalResistance, 177);
});
