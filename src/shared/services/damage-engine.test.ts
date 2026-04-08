import assert from 'node:assert/strict';
import test from 'node:test';

import type { DamageRuleSet } from '@/shared/models/damage-rules';
import type { SimulatorCharacterBundle } from '@/shared/models/simulator';
import { buildSimulatorCharacterDomain } from '@/shared/models/simulator-domain';
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
    attributeConversions: [
      {
        id: 'attr_rule_1',
        versionId: 'rule_v1',
        school: '龙宫',
        roleType: '法师',
        sourceAttr: 'baseHp',
        targetAttr: 'hp',
        coefficient: 5,
        valueType: 'linear',
        conditionJson: '{}',
        condition: {},
        sort: 10,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'attr_rule_2b',
        versionId: 'rule_v1',
        school: '龙宫',
        roleType: '法师',
        sourceAttr: 'physique',
        targetAttr: 'hp',
        coefficient: 12,
        valueType: 'linear',
        conditionJson: '{}',
        condition: {},
        sort: 20,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'attr_rule_2',
        versionId: 'rule_v1',
        school: '龙宫',
        roleType: '法师',
        sourceAttr: 'endurance',
        targetAttr: 'hp',
        coefficient: 4,
        valueType: 'linear',
        conditionJson: '{}',
        condition: {},
        sort: 30,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'attr_rule_3',
        versionId: 'rule_v1',
        school: '龙宫',
        roleType: '法师',
        sourceAttr: 'magic',
        targetAttr: 'mp',
        coefficient: 1.6,
        valueType: 'linear',
        conditionJson: '{}',
        condition: {},
        sort: 40,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'attr_rule_4',
        versionId: 'rule_v1',
        school: '龙宫',
        roleType: '法师',
        sourceAttr: 'spirit',
        targetAttr: 'mp',
        coefficient: 0.25,
        valueType: 'linear',
        conditionJson: '{}',
        condition: {},
        sort: 50,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'attr_rule_5',
        versionId: 'rule_v1',
        school: '龙宫',
        roleType: '法师',
        sourceAttr: 'magic',
        targetAttr: 'magicDamage',
        coefficient: 5,
        valueType: 'linear',
        conditionJson: '{}',
        condition: {},
        sort: 60,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'attr_rule_6',
        versionId: 'rule_v1',
        school: '龙宫',
        roleType: '法师',
        sourceAttr: 'spirit',
        targetAttr: 'magicDamage',
        coefficient: 1.2,
        valueType: 'linear',
        conditionJson: '{}',
        condition: {},
        sort: 70,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'attr_rule_7',
        versionId: 'rule_v1',
        school: '龙宫',
        roleType: '法师',
        sourceAttr: 'level',
        targetAttr: 'magicDamage',
        coefficient: 3,
        valueType: 'linear',
        conditionJson: '{}',
        condition: {},
        sort: 80,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'attr_rule_8',
        versionId: 'rule_v1',
        school: '龙宫',
        roleType: '法师',
        sourceAttr: 'spirit',
        targetAttr: 'magicDefense',
        coefficient: 0.6,
        valueType: 'linear',
        conditionJson: '{}',
        condition: {},
        sort: 90,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'attr_rule_9',
        versionId: 'rule_v1',
        school: '龙宫',
        roleType: '法师',
        sourceAttr: 'endurance',
        targetAttr: 'magicDefense',
        coefficient: 2,
        valueType: 'linear',
        conditionJson: '{}',
        condition: {},
        sort: 100,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'attr_rule_10',
        versionId: 'rule_v1',
        school: '龙宫',
        roleType: '法师',
        sourceAttr: 'level',
        targetAttr: 'magicDefense',
        coefficient: 2.6,
        valueType: 'linear',
        conditionJson: '{}',
        condition: {},
        sort: 110,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'attr_rule_11',
        versionId: 'rule_v1',
        school: '龙宫',
        roleType: '法师',
        sourceAttr: 'strength',
        targetAttr: 'hit',
        coefficient: 2,
        valueType: 'linear',
        conditionJson: '{}',
        condition: {},
        sort: 140,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'attr_rule_12',
        versionId: 'rule_v1',
        school: '龙宫',
        roleType: '法师',
        sourceAttr: 'level',
        targetAttr: 'hit',
        coefficient: 6,
        valueType: 'linear',
        conditionJson: '{}',
        condition: {},
        sort: 150,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'attr_rule_13',
        versionId: 'rule_v1',
        school: '龙宫',
        roleType: '法师',
        sourceAttr: 'strength',
        targetAttr: 'damage',
        coefficient: 8,
        valueType: 'linear',
        conditionJson: '{}',
        condition: {},
        sort: 160,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'attr_rule_14',
        versionId: 'rule_v1',
        school: '龙宫',
        roleType: '法师',
        sourceAttr: 'level',
        targetAttr: 'damage',
        coefficient: 6,
        valueType: 'linear',
        conditionJson: '{}',
        condition: {},
        sort: 170,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'attr_rule_15',
        versionId: 'rule_v1',
        school: '龙宫',
        roleType: '法师',
        sourceAttr: 'endurance',
        targetAttr: 'defense',
        coefficient: 4,
        valueType: 'linear',
        conditionJson: '{}',
        condition: {},
        sort: 180,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'attr_rule_16',
        versionId: 'rule_v1',
        school: '龙宫',
        roleType: '法师',
        sourceAttr: 'physique',
        targetAttr: 'defense',
        coefficient: 2,
        valueType: 'linear',
        conditionJson: '{}',
        condition: {},
        sort: 190,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'attr_rule_17',
        versionId: 'rule_v1',
        school: '龙宫',
        roleType: '法师',
        sourceAttr: 'level',
        targetAttr: 'defense',
        coefficient: 3,
        valueType: 'linear',
        conditionJson: '{}',
        condition: {},
        sort: 200,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'attr_rule_18',
        versionId: 'rule_v1',
        school: '龙宫',
        roleType: '法师',
        sourceAttr: 'agility',
        targetAttr: 'speed',
        coefficient: 4,
        valueType: 'linear',
        conditionJson: '{}',
        condition: {},
        sort: 120,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'attr_rule_19',
        versionId: 'rule_v1',
        school: '龙宫',
        roleType: '法师',
        sourceAttr: 'level',
        targetAttr: 'speed',
        coefficient: 2,
        valueType: 'linear',
        conditionJson: '{}',
        condition: {},
        sort: 130,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'attr_rule_20',
        versionId: 'rule_v1',
        school: '龙宫',
        roleType: '法师',
        sourceAttr: 'agility',
        targetAttr: 'dodge',
        coefficient: 2,
        valueType: 'linear',
        conditionJson: '{}',
        condition: {},
        sort: 210,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'attr_rule_21',
        versionId: 'rule_v1',
        school: '龙宫',
        roleType: '法师',
        sourceAttr: 'level',
        targetAttr: 'dodge',
        coefficient: 0.8,
        valueType: 'floor_linear',
        conditionJson: '{}',
        condition: {},
        sort: 220,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
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
    (result.targets[0]?.breakdown as Record<string, unknown>)
      .formationCounterFactor,
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
    (result.targets[0]?.breakdown as Record<string, unknown>)
      .targetMagicDefense,
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
    (result.targets[0]?.breakdown as Record<string, unknown>)
      .formationCounterFactor,
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
    (result.targets[0]?.breakdown as Record<string, unknown>)
      .targetMagicDefense,
    800
  );
});

test('calculateDamageFromRuleSet derives panel magic damage from attribute rules instead of profile snapshot value', () => {
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

  const breakdown = result.targets[0]?.breakdown as Record<string, any>;

  assert.equal(breakdown.panelMagicDamage, 2429);
  assert.equal(breakdown.panelMagicDamageSource, 'rule_attribute_conversion');
  assert.equal(
    breakdown.panelMagicDamageBreakdown.ruleDerivedMagicDamage,
    2209
  );
  assert.equal(
    breakdown.panelMagicDamageBreakdown.equipmentMagicDamageFlat,
    220
  );
  assert.equal(result.panelStats.hp, 4200);
  assert.equal(result.panelStats.mp, 520.5);
  assert.equal(result.panelStats.hit, 684);
  assert.equal(result.panelStats.damage, 774);
  assert.equal(result.panelStats.defense, 547);
  assert.ok(Math.abs(result.panelStats.magicDefense - 719.4) < 1e-9);
  assert.equal(result.panelStats.speed, 298);
  assert.equal(result.panelStats.dodge, 127);
  assert.equal(breakdown.ruleResolvedPanelStats.hp, 4200);
  assert.equal(breakdown.ruleResolvedPanelStats.hit, 684);
  assert.equal(breakdown.ruleResolvedPanelStats.damage, 774);
  assert.equal(breakdown.ruleResolvedPanelStats.defense, 547);
  assert.equal(breakdown.ruleResolvedPanelStats.dodge, 127);
});

test('calculateDamageFromRuleSet keeps explicit panel magic damage override for rule playground debugging', () => {
  const bundle = createBundle();
  const domain = buildSimulatorCharacterDomain(bundle);

  assert.ok(domain);

  const result = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      skillCode: 'dragon_roll',
      panelMagicDamageOverride: 1500,
    },
  });

  const breakdown = result.targets[0]?.breakdown as Record<string, any>;

  assert.equal(breakdown.panelMagicDamage, 1500);
  assert.equal(
    breakdown.panelMagicDamageSource,
    'request.panelMagicDamageOverride'
  );
  assert.equal(breakdown.panelMagicDamageBreakdown.overrideApplied, true);
  assert.equal(breakdown.panelMagicDamageBreakdown.overrideValue, 1500);
});
