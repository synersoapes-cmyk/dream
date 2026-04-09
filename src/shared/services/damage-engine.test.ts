import assert from 'node:assert/strict';
import test from 'node:test';

import type { DamageRuleSet } from '@/shared/models/damage-rules';
import { buildSimulatorCharacterDomain } from '@/shared/models/simulator-domain';
import type { SimulatorCharacterBundle } from '@/shared/models/simulator-types';
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
      {
        id: 'skill_2',
        snapshotId: 'snapshot_1',
        skillCode: 'dragon_teng',
        skillName: '龙腾',
        baseLevel: 140,
        extraLevel: 0,
        finalLevel: 140,
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
      targetSpeed: 760,
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
      {
        id: 'formula_2',
        versionId: 'rule_v1',
        school: '龙宫',
        roleType: '法师',
        skillCode: 'dragon_teng',
        skillName: '龙腾',
        formulaKey: 'dragon_teng_default',
        baseFormula: {
          baseTerm: {
            a: 1 / 145,
            b: 1.4,
            c: 39.5,
          },
        },
        extraFormula: {},
        condition: {},
        sort: 10,
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

function applyFullSetRuneColors(
  bundle: SimulatorCharacterBundle,
  colors: [string, string, string, string, string, string]
) {
  const slots = ['helmet', 'necklace', 'weapon', 'armor', 'belt', 'shoes'];

  bundle.equipments = slots.map((slot, index) => ({
    ...bundle.equipments[0]!,
    id: `eq_full_set_${index + 1}`,
    slot,
    snapshotSlot: slot,
    build: {
      ...bundle.equipments[0]!.build!,
      equipmentId: `eq_full_set_${index + 1}`,
      notesJson: JSON.stringify({
        activeRuneStoneSet: 0,
        runeStoneSets: [[{ id: `rune_${index + 1}`, type: colors[index], stats: {} }]],
      }),
    },
  }));
}

function createFullSetModifier(params: {
  id: string;
  modifierDomain: string;
  modifierKey: string;
  targetKey: string;
  value: number;
  skillCode?: string;
  sourceKey?: string;
  modifierType?: string;
  colors: Record<string, string>;
}) {
  return {
    id: params.id,
    versionId: 'rule_v1',
    modifierDomain: params.modifierDomain,
    modifierKey: params.modifierKey,
    modifierType: params.modifierType ?? 'addend',
    sourceKey: params.sourceKey ?? 'runeFullSet',
    targetKey: params.targetKey,
    value: params.value,
    valueLookup: {},
    condition: {
      triggerType: 'rune_full_set',
      school: ['龙宫'],
      roleType: ['法师'],
      ...(params.skillCode ? { skillCode: [params.skillCode] } : {}),
      slotColorMap: params.colors,
    },
    sort: 100,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
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

test('calculateDamageFromRuleSet supports dragon_teng formula from the service rule set', () => {
  const bundle = createBundle();
  const domain = buildSimulatorCharacterDomain(bundle);

  assert.ok(domain);

  const result = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      skillName: '龙腾',
      targetCount: 1,
    },
  });

  assert.equal(result.skill.skillCode, 'dragon_teng');
  assert.equal(result.skill.skillName, '龙腾');
  assert.equal(result.targets.length, 1);
  assert.equal(result.targets[0]?.totalDamage, result.targets[0]?.damage);
  assert.equal(
    (result.targets[0]?.breakdown as Record<string, unknown>).formulaKey,
    'dragon_teng_default'
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
  assert.equal(breakdown.panelMagicDamageSource, 'rule_attribute');
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

test('calculateDamageFromRuleSet derives active rune combo bonuses from persisted equipment metadata', () => {
  const bundle = createBundle();
  bundle.equipments[0]!.build!.notesJson = JSON.stringify({
    activeRuneStoneSet: 0,
    runeStoneSets: [
      [
        {
          id: 'rune_1',
          name: '黑符石',
          type: 'black',
          stats: { magicDamage: 12 },
        },
        {
          id: 'rune_2',
          name: '红符石',
          type: 'red',
          stats: { hit: 2 },
        },
        {
          id: 'rune_3',
          name: '白符石',
          type: 'white',
          stats: { magic: 2 },
        },
      ],
    ],
  });

  const domain = buildSimulatorCharacterDomain(bundle);
  assert.ok(domain);

  const ruleSet = createRuleSet();
  ruleSet.skillBonuses = [
    {
      id: 'bonus_1',
      versionId: 'rule_v1',
      bonusGroup: 'school_skill_rune',
      ruleCode: 'longteng_lv2',
      skillCode: 'dragon_teng',
      skillName: '龙腾',
      bonusType: 'skill_level',
      bonusValue: 2,
      condition: {
        triggerType: 'rune_combo',
        colorSequence: ['黑', '红', '白'],
        slotCount: 3,
        positionScope: [
          'weapon',
          'helmet',
          'necklace',
          'armor',
          'belt',
          'shoes',
        ],
        school: ['龙宫'],
        roleType: ['法师'],
      },
      conflictPolicy: 'take_max',
      limitPolicy: {},
      sort: 10,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const result = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet,
    request: {
      skillCode: 'dragon_teng',
      targetCount: 1,
    },
  });

  const breakdown = result.targets[0]?.breakdown as any;

  assert.equal(result.skill.finalLevel, 142);
  assert.deepEqual(breakdown.activeBonusRuleCodes, ['longteng_lv2']);
  assert.equal(breakdown.matchedBonusRules?.[0]?.ruleCode, 'longteng_lv2');
});

test('calculateDamageFromRuleSet applies 招云 full-set panel bonuses and target-speed addend', () => {
  const bundle = createBundle();
  applyFullSetRuneColors(bundle, [
    'white',
    'red',
    'yellow',
    'black',
    'blue',
    'red',
  ]);

  const domain = buildSimulatorCharacterDomain(bundle);
  assert.ok(domain);

  const ruleSet = createRuleSet();
  ruleSet.modifiers.push(
    createFullSetModifier({
      id: 'mod_zhaoyun_spirit',
      modifierDomain: 'panel_stat_bonus',
      modifierKey: 'zhaoyun_spirit',
      targetKey: 'spirit',
      value: 6,
      colors: {
        helmet: '白',
        necklace: '红',
        weapon: '黄',
        armor: '黑',
        belt: '蓝',
        shoes: '红',
      },
    }),
    createFullSetModifier({
      id: 'mod_zhaoyun_magic_damage',
      modifierDomain: 'panel_stat_bonus',
      modifierKey: 'zhaoyun_magic_damage',
      targetKey: 'magicDamage',
      value: 6,
      colors: {
        helmet: '白',
        necklace: '红',
        weapon: '黄',
        armor: '黑',
        belt: '蓝',
        shoes: '红',
      },
    }),
    createFullSetModifier({
      id: 'mod_zhaoyun_magic_defense',
      modifierDomain: 'panel_stat_bonus',
      modifierKey: 'zhaoyun_magic_defense',
      targetKey: 'magicDefense',
      value: 6,
      colors: {
        helmet: '白',
        necklace: '红',
        weapon: '黄',
        armor: '黑',
        belt: '蓝',
        shoes: '红',
      },
    }),
    createFullSetModifier({
      id: 'mod_zhaoyun_target_speed',
      modifierDomain: 'skill_damage_addend',
      modifierKey: 'zhaoyun_target_speed',
      modifierType: 'multiplier',
      sourceKey: 'targetSpeed',
      targetKey: 'finalDamage',
      value: 0.04,
      skillCode: 'dragon_roll',
      colors: {
        helmet: '白',
        necklace: '红',
        weapon: '黄',
        armor: '黑',
        belt: '蓝',
        shoes: '红',
      },
    })
  );

  const result = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet,
    request: {
      skillCode: 'dragon_roll',
      targetCount: 1,
    },
  });

  const breakdown = result.targets[0]?.breakdown as Record<string, any>;

  assert.equal(result.panelStats.spirit, 616);
  assert.equal(result.panelStats.magicDamage, 3535);
  assert.ok(Math.abs(result.panelStats.magicDefense - 725.4) < 1e-9);
  assert.equal(breakdown.targetSpeed, 760);
  assert.equal(breakdown.conditionalDamageAddend, 30.4);
  assert.equal(breakdown.panelMagicDamageBreakdown.panelStatBonuses.magicDamage, 6);
});

test('calculateDamageFromRuleSet applies 腾蛟 full-set mana-cost addend', () => {
  const bundle = createBundle();
  applyFullSetRuneColors(bundle, [
    'white',
    'red',
    'red',
    'black',
    'blue',
    'red',
  ]);

  const domain = buildSimulatorCharacterDomain(bundle);
  assert.ok(domain);

  const ruleSet = createRuleSet();
  ruleSet.modifiers.push(
    createFullSetModifier({
      id: 'mod_tengjiao_spirit',
      modifierDomain: 'panel_stat_bonus',
      modifierKey: 'tengjiao_spirit',
      targetKey: 'spirit',
      value: 6,
      colors: {
        helmet: '白',
        necklace: '红',
        weapon: '红',
        armor: '黑',
        belt: '蓝',
        shoes: '红',
      },
    }),
    createFullSetModifier({
      id: 'mod_tengjiao_magic_damage',
      modifierDomain: 'panel_stat_bonus',
      modifierKey: 'tengjiao_magic_damage',
      targetKey: 'magicDamage',
      value: 6,
      colors: {
        helmet: '白',
        necklace: '红',
        weapon: '红',
        armor: '黑',
        belt: '蓝',
        shoes: '红',
      },
    }),
    createFullSetModifier({
      id: 'mod_tengjiao_magic_defense',
      modifierDomain: 'panel_stat_bonus',
      modifierKey: 'tengjiao_magic_defense',
      targetKey: 'magicDefense',
      value: 6,
      colors: {
        helmet: '白',
        necklace: '红',
        weapon: '红',
        armor: '黑',
        belt: '蓝',
        shoes: '红',
      },
    }),
    createFullSetModifier({
      id: 'mod_tengjiao_mana_cost',
      modifierDomain: 'skill_damage_addend',
      modifierKey: 'tengjiao_mana_cost',
      modifierType: 'multiplier',
      sourceKey: 'manaCost',
      targetKey: 'finalDamage',
      value: 0.04,
      skillCode: 'dragon_teng',
      colors: {
        helmet: '白',
        necklace: '红',
        weapon: '红',
        armor: '黑',
        belt: '蓝',
        shoes: '红',
      },
    })
  );

  const result = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet,
    request: {
      skillCode: 'dragon_teng',
      targetCount: 1,
    },
  });

  const breakdown = result.targets[0]?.breakdown as Record<string, any>;

  assert.equal(result.panelStats.spirit, 616);
  assert.equal(result.panelStats.magicDamage, 3535);
  assert.ok(Math.abs(result.panelStats.magicDefense - 725.4) < 1e-9);
  assert.equal(breakdown.resolvedSkillManaCost, 30);
  assert.equal(breakdown.conditionalDamageAddend, 1.2);
  assert.equal(
    breakdown.conditionalDamageAddends?.[0]?.modifierKey,
    'tengjiao_mana_cost'
  );
});

test('calculateDamageFromRuleSet applies jade spell ignore percent from effect text', () => {
  const baselineBundle = createBundle();
  const baselineDomain = buildSimulatorCharacterDomain(baselineBundle);
  assert.ok(baselineDomain);

  const baselineResult = calculateDamageFromRuleSet({
    bundle: baselineBundle,
    domain: baselineDomain,
    ruleSet: createRuleSet(),
    request: {
      skillCode: 'dragon_roll',
      targetCount: 1,
    },
  });

  const bundle = createBundle();
  bundle.equipments.push({
    ...bundle.equipments[0]!,
    id: 'jade_1',
    slot: 'jade1',
    name: '阳玉·法穿',
    build: {
      ...bundle.equipments[0]!.build!,
      equipmentId: 'jade_1',
      specialEffectJson: JSON.stringify({
        specialEffect: '法术忽视 5%',
      }),
      setEffectJson: '{}',
      notesJson: '{}',
    },
    attrs: [],
    snapshotSlot: 'jade1',
  });

  const domain = buildSimulatorCharacterDomain(bundle);
  assert.ok(domain);

  const result = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      skillCode: 'dragon_roll',
      targetCount: 1,
    },
  });

  const breakdown = result.targets[0]?.breakdown as Record<string, any>;

  assert.equal(breakdown.spellIgnorePercent, 0.05);
  assert.equal(breakdown.actualTargetMagicDefense, 1187.5);
  assert.equal(
    breakdown.equipmentEffectModifiers?.[0]?.code,
    'spell_ignore_percent'
  );
  assert.ok(
    (result.targets[0]?.damage ?? 0) > (baselineResult.targets[0]?.damage ?? 0)
  );
});

test('calculateDamageFromRuleSet applies jade spell damage percent from effect text', () => {
  const baselineBundle = createBundle();
  const baselineDomain = buildSimulatorCharacterDomain(baselineBundle);
  assert.ok(baselineDomain);

  const baselineResult = calculateDamageFromRuleSet({
    bundle: baselineBundle,
    domain: baselineDomain,
    ruleSet: createRuleSet(),
    request: {
      skillCode: 'dragon_roll',
      targetCount: 1,
    },
  });

  const bundle = createBundle();
  bundle.equipments.push({
    ...bundle.equipments[0]!,
    id: 'jade_spell_damage_text',
    slot: 'jade1',
    name: '阳玉·法伤',
    build: {
      ...bundle.equipments[0]!.build!,
      equipmentId: 'jade_spell_damage_text',
      specialEffectJson: JSON.stringify({
        specialEffect: '基础法术伤害 +1.5%',
      }),
      setEffectJson: '{}',
      notesJson: '{}',
    },
    attrs: [],
    snapshotSlot: 'jade1',
  });

  const domain = buildSimulatorCharacterDomain(bundle);
  assert.ok(domain);

  const result = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      skillCode: 'dragon_roll',
      targetCount: 1,
    },
  });

  const breakdown = result.targets[0]?.breakdown as Record<string, any>;

  assert.equal(breakdown.spellDamagePercent, 0.015);
  assert.equal(
    breakdown.panelMagicDamageBreakdown.panelMagicDamageBeforePercent,
    2429
  );
  assert.equal(
    breakdown.panelMagicDamageBreakdown.panelMagicDamageAfterPercent,
    2465.435
  );
  assert.equal(breakdown.panelMagicDamage, 2465.435);
  assert.equal(
    breakdown.equipmentEffectModifiers?.[0]?.code,
    'spell_damage_percent'
  );
  assert.ok(
    (result.targets[0]?.damage ?? 0) > (baselineResult.targets[0]?.damage ?? 0)
  );
});

test('calculateDamageFromRuleSet applies persisted spell damage percent modifiers from equipment metadata', () => {
  const baselineBundle = createBundle();
  const baselineDomain = buildSimulatorCharacterDomain(baselineBundle);
  assert.ok(baselineDomain);

  const baselineResult = calculateDamageFromRuleSet({
    bundle: baselineBundle,
    domain: baselineDomain,
    ruleSet: createRuleSet(),
    request: {
      skillCode: 'dragon_roll',
      targetCount: 1,
    },
  });

  const bundle = createBundle();
  bundle.equipments.push({
    ...bundle.equipments[0]!,
    id: 'jade_spell_damage_meta',
    slot: 'jade1',
    name: '阳玉·法伤元数据',
    build: {
      ...bundle.equipments[0]!.build!,
      equipmentId: 'jade_spell_damage_meta',
      specialEffectJson: '{}',
      setEffectJson: '{}',
      notesJson: JSON.stringify({
        effectModifiers: [
          {
            code: 'spell_damage_percent',
            value: 0.015,
            label: '基础法术伤害 +1.5%',
          },
        ],
      }),
    },
    attrs: [],
    snapshotSlot: 'jade1',
  });

  const domain = buildSimulatorCharacterDomain(bundle);
  assert.ok(domain);

  const result = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      skillCode: 'dragon_roll',
      targetCount: 1,
    },
  });

  const breakdown = result.targets[0]?.breakdown as Record<string, any>;

  assert.equal(breakdown.spellDamagePercent, 0.015);
  assert.equal(
    breakdown.equipmentEffectModifiers?.[0]?.source,
    'persisted_modifier'
  );
  assert.equal(breakdown.panelMagicDamage, 2465.435);
  assert.ok(
    (result.targets[0]?.damage ?? 0) > (baselineResult.targets[0]?.damage ?? 0)
  );
});

test('calculateDamageFromRuleSet applies star position panel bonuses from persisted notes', () => {
  const baselineBundle = createBundle();
  const baselineDomain = buildSimulatorCharacterDomain(baselineBundle);
  assert.ok(baselineDomain);

  const baselineResult = calculateDamageFromRuleSet({
    bundle: baselineBundle,
    domain: baselineDomain,
    ruleSet: createRuleSet(),
    request: {
      skillCode: 'dragon_roll',
      targetCount: 1,
    },
  });

  const bundle = createBundle();
  bundle.equipments[0] = {
    ...bundle.equipments[0]!,
    build: {
      ...bundle.equipments[0]!.build!,
      notesJson: JSON.stringify({
        starPosition: '法伤 +2.5',
      }),
    },
  };

  const domain = buildSimulatorCharacterDomain(bundle);
  assert.ok(domain);

  const result = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      skillCode: 'dragon_roll',
      targetCount: 1,
    },
  });

  const breakdown = result.targets[0]?.breakdown as Record<string, any>;

  assert.equal(result.panelStats.magicDamage, (baselineResult.panelStats.magicDamage ?? 0) + 2.5);
  assert.equal(breakdown.starBonuses.panelStatBonuses.magicDamage, 2.5);
  assert.equal(breakdown.starBonuses.starPositionBonuses[0]?.targetKey, 'magicDamage');
});

test('calculateDamageFromRuleSet applies full star alignment attribute bonus when six primary slots are active', () => {
  const createPrimaryPlaceholder = (
    id: string,
    slot: string,
    starAlignment?: string
  ) => ({
    id,
    characterId: 'char_1',
    slot,
    name: `主装备-${slot}`,
    level: 90,
    quality: '普通',
    price: 0,
    source: 'manual',
    status: 'equipped',
    isLocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    build: {
      equipmentId: id,
      holeCount: 0,
      gemLevelTotal: 0,
      refineLevel: 0,
      specialEffectJson: '{}',
      setEffectJson: '{}',
      notesJson: JSON.stringify(
        starAlignment
          ? {
              starAlignment,
            }
          : {}
      ),
    },
    attrs: [],
    snapshotSlot: slot,
  });

  const baselineBundle = createBundle();
  baselineBundle.equipments = [
    createPrimaryPlaceholder('eq_weapon', 'weapon'),
    createPrimaryPlaceholder('eq_helmet', 'helmet'),
    createPrimaryPlaceholder('eq_necklace', 'necklace'),
    createPrimaryPlaceholder('eq_armor', 'armor'),
    createPrimaryPlaceholder('eq_belt', 'belt'),
    createPrimaryPlaceholder('eq_shoes', 'shoes'),
  ];
  const baselineDomain = buildSimulatorCharacterDomain(baselineBundle);
  assert.ok(baselineDomain);

  const baselineResult = calculateDamageFromRuleSet({
    bundle: baselineBundle,
    domain: baselineDomain,
    ruleSet: createRuleSet(),
    request: {
      skillCode: 'dragon_roll',
      targetCount: 1,
    },
  });

  const bundle = createBundle();
  bundle.equipments = [
    createPrimaryPlaceholder('eq_weapon', 'weapon', '力量 +2'),
    createPrimaryPlaceholder('eq_helmet', 'helmet', '体质 +2'),
    createPrimaryPlaceholder('eq_necklace', 'necklace', '魔力 +2'),
    createPrimaryPlaceholder('eq_armor', 'armor', '耐力 +2'),
    createPrimaryPlaceholder('eq_belt', 'belt', '敏捷 +2'),
    createPrimaryPlaceholder('eq_shoes', 'shoes', '力量 +2'),
  ];
  const domain = buildSimulatorCharacterDomain(bundle);
  assert.ok(domain);

  const result = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      skillCode: 'dragon_roll',
      targetCount: 1,
    },
  });

  const breakdown = result.targets[0]?.breakdown as Record<string, any>;

  assert.equal(result.panelStats.magicDamage, (baselineResult.panelStats.magicDamage ?? 0) + 20);
  assert.equal(result.panelStats.hp, (baselineResult.panelStats.hp ?? 0) + 64);
  assert.equal(result.panelStats.speed, (baselineResult.panelStats.speed ?? 0) + 16);
  assert.equal(result.panelStats.damage, (baselineResult.panelStats.damage ?? 0) + 48);
  assert.equal(result.panelStats.defense, (baselineResult.panelStats.defense ?? 0) + 24);
  assert.equal(result.panelStats.hit, (baselineResult.panelStats.hit ?? 0) + 12);
  assert.equal(result.panelStats.dodge, (baselineResult.panelStats.dodge ?? 0) + 8);
  assert.equal(result.panelStats.magicDefense, (baselineResult.panelStats.magicDefense ?? 0) + 8);
  assert.ok(
    Math.abs(result.panelStats.mp - ((baselineResult.panelStats.mp ?? 0) + 6.4)) < 1e-9
  );
  assert.equal(breakdown.starBonuses.fullSetActive, true);
  assert.equal(breakdown.starBonuses.fullSetAttributeBonus, 2);
  assert.equal(breakdown.starBonuses.attributeSourceBonuses.strength, 6);
  assert.equal(breakdown.starBonuses.attributeSourceBonuses.magic, 4);
  assert.equal(breakdown.starBonuses.attributeSourceBonuses.physique, 4);
  assert.equal(breakdown.starBonuses.attributeSourceBonuses.endurance, 4);
  assert.equal(breakdown.starBonuses.attributeSourceBonuses.agility, 4);
});
