import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSimulatorCharacterDomain } from '@/shared/models/simulator-domain';
import type { SimulatorCharacterBundle } from '@/shared/models/simulator';
import type { DamageRuleSet } from '@/shared/models/damage-rules';
import { calculateDamageFromRuleSet } from '@/shared/services/damage-engine';

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
        extraLevel: 0,
        finalLevel: 150,
        sourceDetailJson: '{}',
      },
    ],
    cultivations: [
      {
        id: 'cult_1',
        snapshotId: 'snapshot_1',
        cultivationType: 'magicAttack',
        level: 20,
      },
    ],
    battleContext: {
      snapshotId: 'snapshot_1',
      ruleVersionId: 'rule_v1',
      selfFormation: '天覆阵',
      selfElement: '水',
      formationCounterState: '小克',
      elementRelation: '克制',
      transformCardFactor: 1,
      splitTargetCount: 7,
      shenmuValue: 18,
      magicResult: 42,
      targetTemplateId: null,
      targetName: '默认目标',
      targetLevel: 175,
      targetHp: 50000,
      targetDefense: 1500,
      targetMagicDefense: 1250,
      targetMagicDefenseCultivation: 12,
      targetElement: '火',
      targetFormation: '普通阵',
      notesJson: '{}',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    battleTargetTemplate: null,
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
          notesJson: '{}',
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

function createRuleSet(): DamageRuleSet {
  return {
    version: {
      id: 'rule_v1',
      ruleDomain: 'damage',
      versionCode: 'damage_v1',
      versionName: '测试版本',
      status: 'published',
      isActive: true,
      sourceDocUrl: '',
      notes: '',
      createdBy: 'system',
      publishedBy: 'system',
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    attributeConversions: [],
    skillFormulas: [
      {
        id: 'formula_1',
        versionId: 'rule_v1',
        school: '龙宫',
        roleType: '法师',
        skillCode: 'dragon_roll',
        skillName: '龙卷雨击',
        formulaKey: 'dragon_roll_default',
        baseFormula: {
          baseTerm: {
            a: 1 / 145,
            b: 1.4,
            c: 39.5,
          },
        },
        extraFormula: {},
        condition: {},
        sort: 0,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    modifiers: [
      {
        id: 'mod_1',
        versionId: 'rule_v1',
        modifierDomain: 'split_factor',
        modifierKey: 'target_count',
        modifierType: 'lookup',
        sourceKey: '',
        targetKey: '',
        value: 0,
        valueLookup: {
          '1': 1,
          '7': 0.5,
          '5+': 0.5,
          default: 1,
        },
        condition: {},
        sort: 0,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'mod_2',
        versionId: 'rule_v1',
        modifierDomain: 'formation_counter',
        modifierKey: 'counter',
        modifierType: 'lookup',
        sourceKey: '',
        targetKey: '',
        value: 0,
        valueLookup: {
          '无克/普通': 1,
          小克: 1.1,
          大克: 1.3,
          被小克: 0.95,
          被大克: 0.75,
          default: 1,
        },
        condition: {},
        sort: 0,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'mod_3',
        versionId: 'rule_v1',
        modifierDomain: 'element_relation',
        modifierKey: 'element',
        modifierType: 'lookup',
        sourceKey: '',
        targetKey: '',
        value: 0,
        valueLookup: {
          克制: 1.05,
          '无克/普通': 1,
          被克制: 0.95,
          default: 1,
        },
        condition: {},
        sort: 0,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'mod_4',
        versionId: 'rule_v1',
        modifierDomain: 'transform_card',
        modifierKey: 'default',
        modifierType: 'lookup',
        sourceKey: '',
        targetKey: '',
        value: 0,
        valueLookup: {
          default: 1,
        },
        condition: {},
        sort: 0,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    skillBonuses: [],
  };
}

test('calculateDamageFromRuleSet falls back to persisted battle context defaults', () => {
  const bundle = createBundle();
  const domain = buildSimulatorCharacterDomain(bundle);

  assert.ok(domain);

  const result = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      skillCode: 'dragon_roll',
    },
  });

  assert.equal(result.skill.skillCode, 'dragon_roll');
  assert.equal(result.targets.length, 1);
  assert.equal(result.targets[0]?.targetName, '默认目标');
  assert.equal(result.targets[0]?.totalDamage, result.targets[0]!.damage * 7);
  assert.equal(
    (result.targets[0]?.breakdown as Record<string, unknown>).formationCounterFactor,
    1.1
  );
  assert.equal(
    (result.targets[0]?.breakdown as Record<string, unknown>).elementFactor,
    1.05
  );
  assert.equal(
    (result.targets[0]?.breakdown as Record<string, unknown>).magicResult,
    42
  );
  assert.equal(
    (result.targets[0]?.breakdown as Record<string, unknown>).targetMagicDefense,
    1250
  );
});

test('calculateDamageFromRuleSet prefers explicit request values over persisted battle context', () => {
  const bundle = createBundle();
  const domain = buildSimulatorCharacterDomain(bundle);

  assert.ok(domain);

  const result = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      skillCode: 'dragon_roll',
      targetCount: 1,
      formationCounterState: '被大克',
      elementRelation: '被克制',
      magicResult: 10,
      targetMagicDefense: 800,
      targets: [
        {
          name: '手动目标',
          magicDefense: 800,
        },
      ],
    },
  });

  assert.equal(result.targets[0]?.targetName, '手动目标');
  assert.equal(result.targets[0]?.totalDamage, result.targets[0]!.damage);
  assert.equal(
    (result.targets[0]?.breakdown as Record<string, unknown>).formationCounterFactor,
    0.75
  );
  assert.equal(
    (result.targets[0]?.breakdown as Record<string, unknown>).elementFactor,
    0.95
  );
  assert.equal(
    (result.targets[0]?.breakdown as Record<string, unknown>).magicResult,
    10
  );
  assert.equal(
    (result.targets[0]?.breakdown as Record<string, unknown>).targetMagicDefense,
    800
  );
});
