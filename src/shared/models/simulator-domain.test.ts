import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveLabSessionEquipmentReferenceId,
} from '@/shared/models/simulator-payload';
import { buildSimulatorCharacterDomain } from '@/shared/models/simulator-domain';
import type { SimulatorCharacterBundle } from '@/shared/models/simulator-types';

function createBundle(): SimulatorCharacterBundle {
  return {
    character: {
      id: 'char_1',
      userId: 'user_1',
      name: '测试龙宫',
      serverName: '测试服',
      school: '龙宫',
      roleType: '法师',
      level: 109,
      race: '仙族',
      status: 'active',
      currentSnapshotId: 'snapshot_1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    snapshot: {
      id: 'snapshot_1',
      characterId: 'char_1',
      snapshotType: 'current',
      name: '当前状态',
      versionNo: 1,
      source: 'manual',
      notes: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    profile: {
      snapshotId: 'snapshot_1',
      school: '龙宫',
      level: 109,
      physique: 40,
      magic: 230,
      strength: 15,
      endurance: 35,
      agility: 20,
      potentialPoints: 0,
      hp: 4200,
      mp: 2100,
      damage: 900,
      defense: 1100,
      magicDamage: 1800,
      magicDefense: 1350,
      speed: 520,
      hit: 980,
      sealHit: 0,
      rawBodyJson: JSON.stringify({
        magicPower: 610,
        dodge: 205,
      }),
    },
    skills: [
      {
        id: 'skill_1',
        snapshotId: 'snapshot_1',
        skillCode: 'dragon_roll',
        skillName: '龙卷雨击',
        baseLevel: 150,
        extraLevel: 2,
        finalLevel: 152,
        sourceDetailJson: '{"source":"rune"}',
      },
    ],
    cultivations: [
      {
        id: 'cult_1',
        snapshotId: 'snapshot_1',
        cultivationType: 'magicAttack',
        level: 23,
      },
    ],
    battleContext: {
      snapshotId: 'snapshot_1',
      ruleVersionId: 'rule_v1',
      selfFormation: '天覆阵',
      selfElement: '水',
      formationCounterState: '无克/普通',
      elementRelation: '克制',
      transformCardFactor: 1,
      splitTargetCount: 7,
      shenmuValue: 12,
      magicResult: 38,
      targetTemplateId: 'target_1',
      targetName: '乌鸡国树怪',
      targetLevel: 175,
      targetHp: 50000,
      targetDefense: 1500,
      targetMagicDefense: 1200,
      targetSpeed: 720,
      targetMagicDefenseCultivation: 12,
      targetElement: '火',
      targetFormation: '普通阵',
      notesJson: '{}',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    battleTargetTemplate: {
      id: 'target_1',
      userId: null,
      scope: 'system',
      sceneType: 'dungeon',
      name: '乌鸡国树怪',
      dungeonName: '乌鸡国',
      targetType: 'mob',
      school: '',
      level: 175,
      hp: 50000,
      defense: 1500,
      magicDefense: 1200,
      magicDefenseCultivation: 12,
      speed: 500,
      element: '火',
      formation: '普通阵',
      notes: '',
      payloadJson: '{}',
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    rules: [],
    equipments: [
      {
        id: 'eq_1',
        characterId: 'char_1',
        slot: 'weapon',
        name: '沧海灵杖',
        level: 90,
        quality: '稀有',
        price: 1000,
        source: 'manual',
        status: 'equipped',
        isLocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        build: {
          equipmentId: 'eq_1',
          holeCount: 4,
          gemLevelTotal: 8,
          refineLevel: 7,
          specialEffectJson: '{}',
          setEffectJson: '{}',
          notesJson: JSON.stringify({
            activeRuneStoneSet: 0,
            runeStoneSets: [
              [
                {
                  id: 'rune_1',
                  name: '黑符石',
                  type: 'black',
                  stats: {
                    magicDamage: 12,
                  },
                },
                {
                  id: 'rune_2',
                  name: '白符石',
                  type: 'white',
                  stats: {
                    magic: 8,
                  },
                },
              ],
            ],
          }),
        },
        attrs: [
          {
            id: 'attr_1',
            equipmentId: 'eq_1',
            attrGroup: 'base',
            attrType: 'magicDamage',
            valueType: 'flat',
            attrValue: 220,
            displayOrder: 0,
          },
          {
            id: 'attr_2',
            equipmentId: 'eq_1',
            attrGroup: 'extra',
            attrType: 'magicResult',
            valueType: 'flat',
            attrValue: 35,
            displayOrder: 1,
          },
        ],
        snapshotSlot: 'weapon',
      },
    ],
  };
}

test('buildSimulatorCharacterDomain maps profile, battle context, and equipment totals', () => {
  const domain = buildSimulatorCharacterDomain(createBundle());

  assert.ok(domain);
  assert.equal(domain.school, '龙宫');
  assert.equal(domain.attributeSources.baseHp, 716);
  assert.equal(domain.profile.spirit, 610);
  assert.equal(domain.profile.dodge, 205);
  assert.equal(domain.cultivationLevels.magicAttack, 23);
  assert.equal(domain.equipmentAttributeTotals.magicDamage, 232);
  assert.equal(domain.equipmentAttributeTotals.magic, 8);
  assert.equal(domain.equipmentAttributeTotals.magicResult, 35);
  assert.equal(domain.battleContext?.selfElement, '水');
  assert.equal(domain.battleContext?.targetName, '乌鸡国树怪');
  assert.equal(domain.battleContext?.targetSpeed, 720);
  assert.equal(domain.skills[0]?.finalLevel, 152);
});

test('resolveLabSessionEquipmentReferenceId only keeps persisted equipment ids', () => {
  const persistedEquipmentIds = new Set(['eq_1', 'eq_2']);

  assert.equal(
    resolveLabSessionEquipmentReferenceId('eq_1', persistedEquipmentIds),
    'eq_1'
  );
  assert.equal(
    resolveLabSessionEquipmentReferenceId('lib_eq1', persistedEquipmentIds),
    null
  );
  assert.equal(
    resolveLabSessionEquipmentReferenceId(undefined, persistedEquipmentIds),
    null
  );
});
