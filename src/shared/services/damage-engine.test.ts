import assert from 'node:assert/strict';
import test from 'node:test';

import type { DamageRuleSet } from '@/shared/models/damage-rules';
import { buildSimulatorCharacterDomain } from '@/shared/models/simulator-domain';
import type { SimulatorCharacterBundle } from '@/shared/models/simulator-types';
import { calculateDamageFromRuleSet } from '@/shared/services/damage-engine';

const attributeConversionSeeds: Array<{
  sourceAttr: string;
  targetAttr: string;
  coefficient: number;
  valueType: string;
  sort: number;
}> = [
  { sourceAttr: 'baseHp', targetAttr: 'hp', coefficient: 1, valueType: 'linear', sort: 10 },
  { sourceAttr: 'baseMp', targetAttr: 'mp', coefficient: 1, valueType: 'linear', sort: 15 },
  { sourceAttr: 'physique', targetAttr: 'hp', coefficient: 4.5, valueType: 'linear', sort: 20 },
  { sourceAttr: 'physique', targetAttr: 'spirit', coefficient: 0.3, valueType: 'linear', sort: 30 },
  { sourceAttr: 'physique', targetAttr: 'speed', coefficient: 0.1, valueType: 'linear', sort: 35 },
  { sourceAttr: 'magic', targetAttr: 'mp', coefficient: 3.5, valueType: 'linear', sort: 40 },
  { sourceAttr: 'magic', targetAttr: 'spirit', coefficient: 0.7, valueType: 'linear', sort: 50 },
  { sourceAttr: 'spirit', targetAttr: 'magicDamage', coefficient: 1, valueType: 'linear', sort: 60 },
  { sourceAttr: 'spirit', targetAttr: 'magicDefense', coefficient: 1, valueType: 'linear', sort: 70 },
  { sourceAttr: 'strength', targetAttr: 'damage', coefficient: 0.56, valueType: 'linear', sort: 80 },
  { sourceAttr: 'strength', targetAttr: 'hit', coefficient: 1.7, valueType: 'linear', sort: 90 },
  { sourceAttr: 'strength', targetAttr: 'spirit', coefficient: 0.4, valueType: 'linear', sort: 100 },
  { sourceAttr: 'strength', targetAttr: 'speed', coefficient: 0.1, valueType: 'linear', sort: 110 },
  { sourceAttr: 'endurance', targetAttr: 'defense', coefficient: 1.6, valueType: 'linear', sort: 120 },
  { sourceAttr: 'endurance', targetAttr: 'spirit', coefficient: 0.2, valueType: 'linear', sort: 130 },
  { sourceAttr: 'endurance', targetAttr: 'speed', coefficient: 0.1, valueType: 'linear', sort: 140 },
  { sourceAttr: 'agility', targetAttr: 'speed', coefficient: 0.7, valueType: 'linear', sort: 150 },
  { sourceAttr: 'agility', targetAttr: 'dodge', coefficient: 1, valueType: 'linear', sort: 160 },
];

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
    attributeConversions: attributeConversionSeeds.map((item, index) => ({
      id: `attr_rule_${index + 1}`,
      versionId: 'rule_v1',
      school: '龙宫',
      roleType: '法师',
      sourceAttr: item.sourceAttr,
      targetAttr: item.targetAttr,
      coefficient: item.coefficient,
      valueType: item.valueType,
      conditionJson: '{}',
      condition: {},
      sort: item.sort,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
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
            type: 'linear',
            multiplier: 2.5,
            addend: 0,
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
            a: 1 / 120,
            b: 1.5,
            c: 55,
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
    equipmentExtensionConfigs: [],
  };
}

function applyFullSetRuneColors(
  bundle: SimulatorCharacterBundle,
  colors: [string, string, string, string, string, string]
) {
  const slots = ['helmet', 'necklace', 'weapon', 'armor', 'belt', 'shoes'];
  const comboNames: Record<string, string> = {
    helmet: '九龙诀',
    necklace: '龙腾',
    weapon: '破浪诀',
    armor: '呼风唤雨',
    belt: '逆鳞',
    shoes: '百步穿杨',
  };

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
        runeStoneSetsNames: [comboNames[slot]!],
        runeStoneSets: [[{ id: `rune_${index + 1}`, type: colors[index], stats: {} }]],
      }),
    },
  }));
}

function applyStrictStarAlignmentConfigs(bundle: SimulatorCharacterBundle) {
  const colorMap: Record<string, string[]> = {
    helmet: ['白', '红', '黄', '蓝', '绿'],
    necklace: ['黑', '红', '白', '蓝', '紫'],
    weapon: ['白', '红', '蓝', '黑', '绿'],
    armor: ['黑', '黄', '蓝', '绿', '白'],
    belt: ['白', '红', '绿', '紫', '蓝'],
    shoes: ['蓝', '白', '绿', '黑', '红'],
  };

  bundle.equipments = bundle.equipments.map((equipment) => {
    const notes = JSON.parse(equipment.build?.notesJson ?? '{}') as Record<
      string,
      unknown
    >;
    const comboName =
      Array.isArray(notes.runeStoneSetsNames) &&
      typeof notes.runeStoneSetsNames[0] === 'string'
        ? notes.runeStoneSetsNames[0]
        : undefined;

    return {
      ...equipment,
      build: {
        ...equipment.build!,
        notesJson: JSON.stringify({
          ...notes,
          starAlignmentConfig: {
            id: `star_alignment_${equipment.slot}`,
            label: '体质 +1',
            attrType: 'physique',
            attrValue: 1,
            comboName,
            colors: colorMap[equipment.slot] ?? [],
          },
        }),
      },
    };
  });
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
  requireStarResonance?: boolean;
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
      ...(params.requireStarResonance ? { requireStarResonance: true } : {}),
      ...(params.skillCode ? { skillCode: [params.skillCode] } : {}),
      slotColorMap: params.colors,
    },
    sort: 100,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createPrimaryPlaceholderEquipment(
  id: string,
  slot: string,
  setName?: string
) {
  return {
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
      setEffectJson: setName ? JSON.stringify({ setName }) : '{}',
      notesJson: '{}',
    },
    attrs: [],
    snapshotSlot: slot,
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

  assert.equal(breakdown.panelMagicDamage, 1003);
  assert.equal(breakdown.panelMagicDamageSource, 'rule_attribute');
  assert.equal(breakdown.panelMagicDamageBreakdown.ruleDerivedMagicDamage, 783);
  assert.equal(
    breakdown.panelMagicDamageBreakdown.equipmentMagicDamageFlat,
    220
  );
  assert.equal(result.panelStats.hp, 280);
  assert.equal(result.panelStats.mp, 885);
  assert.equal(result.panelStats.hit, 25.5);
  assert.equal(result.panelStats.damage, 8.4);
  assert.equal(result.panelStats.defense, 56);
  assert.ok(Math.abs(result.panelStats.magicDefense - 783) < 1e-9);
  assert.ok(Math.abs(result.panelStats.speed - 20.7) < 1e-9);
  assert.equal(result.panelStats.dodge, 20);
  assert.equal(breakdown.ruleResolvedPanelStats.hp, 280);
  assert.equal(breakdown.ruleResolvedPanelStats.hit, 25.5);
  assert.equal(breakdown.ruleResolvedPanelStats.damage, 8.4);
  assert.equal(breakdown.ruleResolvedPanelStats.defense, 56);
  assert.ok(Math.abs(breakdown.ruleResolvedPanelStats.speed - 20.7) < 1e-9);
  assert.ok(
    Math.abs(breakdown.ruleResolvedPanelStats.speedBeforeFormation - 23) < 1e-9
  );
  assert.equal(breakdown.ruleResolvedPanelStats.dodge, 20);
});

test('calculateDamageFromRuleSet applies PRD passive cultivations to hp mp defense and speed base portions', () => {
  const bundle = createBundle();
  bundle.cultivations = [
    ...bundle.cultivations,
    {
      id: 'cult_body_strength',
      snapshotId: 'snapshot_1',
      cultivationType: '强身术',
      level: 20,
    },
    {
      id: 'cult_meditation',
      snapshotId: 'snapshot_1',
      cultivationType: '冥想',
      level: 10,
    },
    {
      id: 'cult_physical_fitness',
      snapshotId: 'snapshot_1',
      cultivationType: '强壮',
      level: 25,
    },
    {
      id: 'cult_divine_speed',
      snapshotId: 'snapshot_1',
      cultivationType: '神速',
      level: 4,
    },
  ];

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

  assert.equal(result.panelStats.hp, 336);
  assert.ok(Math.abs(result.panelStats.mp - 973.5) < 1e-9);
  assert.equal(result.panelStats.defense, 70);
  assert.ok(Math.abs(result.panelStats.speed - 26.1) < 1e-9);
});

test('calculateDamageFromRuleSet derives formation and element factors from request formations and elements', () => {
  const bundle = createBundle();
  bundle.battleContext = null;
  const domain = buildSimulatorCharacterDomain(bundle);

  assert.ok(domain);

  const result = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      skillCode: 'dragon_roll',
      targetCount: 1,
      selfFormation: '天覆阵',
      targetFormation: '龙飞阵',
      selfElement: '水',
      targetElement: '火',
    },
  });

  const breakdown = result.targets[0]?.breakdown as Record<string, any>;

  assert.equal(breakdown.formationFactor, 1.2);
  assert.equal(breakdown.formationCounterFactor, 1.3);
  assert.equal(breakdown.combinedFormationFactor, 1.56);
  assert.equal(breakdown.elementFactor, 1.05);
});

test('calculateDamageFromRuleSet derives small formation counter factor against 普通阵', () => {
  const bundle = createBundle();
  bundle.battleContext = null;
  const domain = buildSimulatorCharacterDomain(bundle);

  assert.ok(domain);

  const result = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      skillCode: 'dragon_roll',
      targetCount: 1,
      selfFormation: '天覆阵',
      targetFormation: '普通阵',
      selfElement: '水',
      targetElement: '火',
    },
  });

  const breakdown = result.targets[0]?.breakdown as Record<string, any>;

  assert.equal(breakdown.formationFactor, 1.2);
  assert.equal(breakdown.formationCounterFactor, 1.1);
  assert.ok(Math.abs(breakdown.combinedFormationFactor - 1.32) < 1e-9);
  assert.equal(breakdown.elementFactor, 1.05);
});

test('calculateDamageFromRuleSet derives reverse formation counter factor when target formation counters self', () => {
  const bundle = createBundle();
  bundle.battleContext = null;
  const domain = buildSimulatorCharacterDomain(bundle);

  assert.ok(domain);

  const result = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      skillCode: 'dragon_roll',
      targetCount: 1,
      selfFormation: '天覆阵',
      targetFormation: '风扬阵',
      selfElement: '火',
      targetElement: '水',
    },
  });

  const breakdown = result.targets[0]?.breakdown as Record<string, any>;

  assert.equal(breakdown.formationFactor, 1.2);
  assert.equal(breakdown.formationCounterFactor, 0.75);
  assert.ok(Math.abs(breakdown.combinedFormationFactor - 0.9) < 1e-9);
  assert.equal(breakdown.elementFactor, 0.95);
});

test('calculateDamageFromRuleSet derives small reverse formation counter factor from full matrix', () => {
  const bundle = createBundle();
  bundle.battleContext = null;
  const domain = buildSimulatorCharacterDomain(bundle);

  assert.ok(domain);

  const result = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      skillCode: 'dragon_roll',
      targetCount: 1,
      selfFormation: '龙飞阵',
      targetFormation: '虎翼阵',
      selfElement: '水',
      targetElement: '火',
    },
  });

  const breakdown = result.targets[0]?.breakdown as Record<string, any>;

  assert.equal(breakdown.formationFactor, 1);
  assert.equal(breakdown.formationCounterFactor, 0.95);
  assert.ok(Math.abs(breakdown.combinedFormationFactor - 0.95) < 1e-9);
  assert.equal(breakdown.elementFactor, 1.05);
});

test('M8-01 基础对冲公式在法伤被完全对冲时仍保留 1 点伤害', () => {
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
      panelMagicDamageOverride: 0,
      formationFactor: 1,
      formationCounterState: '无克/普通',
      elementRelation: '无克/普通',
      transformCardFactor: 1,
      shenmuValue: 0,
      magicResult: 0,
      targets: [
        {
          name: '高法防木桩',
          magicDefense: 100000,
          magicDefenseCultivation: 20,
        },
      ],
    },
  });

  const breakdown = result.targets[0]?.breakdown as Record<string, number>;

  assert.equal(result.targets[0]?.damage, 1);
  assert.ok((breakdown.rawDamage ?? 0) < 0);
});

test('M8-02 分灵系数可按 1.0 到 0.54 的阶梯曲线消费规则表', () => {
  const bundle = createBundle();
  const domain = buildSimulatorCharacterDomain(bundle);
  const ruleSet = createRuleSet();
  const splitRule = ruleSet.modifiers.find(
    (item) => item.modifierDomain === 'split_factor'
  );

  assert.ok(domain);
  assert.ok(splitRule);

  splitRule.valueLookup = {
    '1': 1,
    '2': 0.88,
    '3': 0.78,
    '4': 0.69,
    '5': 0.62,
    '6': 0.57,
    '7': 0.54,
    default: 0.54,
  };

  const factors = [1, 2, 3, 4, 5, 6, 7].map((targetCount) => {
    const result = calculateDamageFromRuleSet({
      bundle,
      domain,
      ruleSet,
      request: {
        skillCode: 'dragon_roll',
        targetCount,
        formationFactor: 1,
        formationCounterState: '无克/普通',
        elementRelation: '无克/普通',
        transformCardFactor: 1,
        shenmuValue: 0,
        magicResult: 0,
        targets: [
          {
            name: `目标-${targetCount}`,
            magicDefense: 1200,
            magicDefenseCultivation: 20,
          },
        ],
      },
    });

    return Number(
      ((result.targets[0]?.breakdown as Record<string, number>).splitFactor ?? 0).toFixed(2)
    );
  });

  assert.deepEqual(factors, [1, 0.88, 0.78, 0.69, 0.62, 0.57, 0.54]);
});

test('M8-03 修炼压制可命中 25 修对 10 抗时 35% 的放大量级', () => {
  const bundle = createBundle();
  bundle.cultivations = [
    {
      id: 'cult_1',
      snapshotId: 'snapshot_1',
      cultivationType: 'magicAttack',
      level: 25,
    },
  ];
  const domain = buildSimulatorCharacterDomain(bundle);

  assert.ok(domain);

  const baseRequest = {
    skillCode: 'dragon_roll' as const,
    targetCount: 1,
    panelMagicDamageOverride: 2000,
    formationFactor: 1,
    formationCounterState: '无克/普通' as const,
    elementRelation: '无克/普通' as const,
    transformCardFactor: 1,
    shenmuValue: 0,
    magicResult: 0,
  };

  const baseline = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      ...baseRequest,
      targets: [
        {
          name: '同修木桩',
          magicDefense: 904.6724,
          magicDefenseCultivation: 25,
        },
      ],
    },
  });
  const pressured = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      ...baseRequest,
      targets: [
        {
          name: '低抗木桩',
          magicDefense: 904.6724,
          magicDefenseCultivation: 10,
        },
      ],
    },
  });

  const baselineRaw = (baseline.targets[0]?.breakdown as Record<string, number>)
    .rawDamageBeforeVariance;
  const pressuredRaw = (pressured.targets[0]?.breakdown as Record<string, number>)
    .rawDamageBeforeVariance;

  assert.ok(pressuredRaw > baselineRaw);
  assert.equal(Number((pressuredRaw / baselineRaw).toFixed(2)), 1.35);
});

test('M8-04 阵法增益可按 1.3 倍放大非结果部分', () => {
  const bundle = createBundle();
  const domain = buildSimulatorCharacterDomain(bundle);

  assert.ok(domain);

  const baseline = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      skillCode: 'dragon_roll',
      targetCount: 1,
      formationFactor: 1,
      formationCounterState: '无克/普通',
      elementRelation: '无克/普通',
      transformCardFactor: 1,
      shenmuValue: 0,
      magicResult: 0,
      targets: [{ name: '阵法木桩', magicDefense: 1200, magicDefenseCultivation: 20 }],
    },
  });
  const boosted = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      skillCode: 'dragon_roll',
      targetCount: 1,
      formationFactor: 1.3,
      formationCounterState: '无克/普通',
      elementRelation: '无克/普通',
      transformCardFactor: 1,
      shenmuValue: 0,
      magicResult: 0,
      targets: [{ name: '龙三位木桩', magicDefense: 1200, magicDefenseCultivation: 20 }],
    },
  });

  const baselineRaw = (baseline.targets[0]?.breakdown as Record<string, number>)
    .rawDamageBeforeVariance;
  const boostedRaw = (boosted.targets[0]?.breakdown as Record<string, number>)
    .rawDamageBeforeVariance;

  assert.equal(Number((boostedRaw / baselineRaw).toFixed(2)), 1.3);
});

test('M8-05 魔之心卡 1.2 倍只放大非结果部分', () => {
  const bundle = createBundle();
  const domain = buildSimulatorCharacterDomain(bundle);

  assert.ok(domain);

  const baseline = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      skillCode: 'dragon_roll',
      targetCount: 1,
      formationFactor: 1,
      formationCounterState: '无克/普通',
      elementRelation: '无克/普通',
      transformCardFactor: 1,
      shenmuValue: 0,
      magicResult: 50,
      targets: [{ name: '卡片木桩', magicDefense: 1200, magicDefenseCultivation: 20 }],
    },
  });
  const boosted = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      skillCode: 'dragon_roll',
      targetCount: 1,
      formationFactor: 1,
      formationCounterState: '无克/普通',
      elementRelation: '无克/普通',
      transformCardFactor: 1.2,
      shenmuValue: 0,
      magicResult: 50,
      targets: [{ name: '魔之心木桩', magicDefense: 1200, magicDefenseCultivation: 20 }],
    },
  });

  const baselineBreakdown = baseline.targets[0]?.breakdown as Record<string, number>;
  const boostedBreakdown = boosted.targets[0]?.breakdown as Record<string, number>;

  assert.equal(
    Number(
      (boostedBreakdown.nonResultDamageBeforeMitigation /
        baselineBreakdown.nonResultDamageBeforeMitigation).toFixed(2)
    ),
    1.2
  );
  assert.equal(
    boostedBreakdown.rawDamageBeforeVariance,
    Number((baselineBreakdown.nonResultDamageBeforeMitigation * 1.2 + 50).toFixed(4))
  );
});

test('M8-06 10% 法爆可输出 10% 的长期期望伤害', () => {
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
      formationFactor: 1,
      formationCounterState: '无克/普通',
      elementRelation: '无克/普通',
      transformCardFactor: 1,
      shenmuValue: 0,
      magicResult: 0,
      criticalChance: 0.1,
      criticalExpectationMultiplier: 2,
      targets: [{ name: '法爆木桩', magicDefense: 1200, magicDefenseCultivation: 20 }],
    },
  });

  assert.equal(
    result.targets[0]?.expectedDamage,
    Number((result.targets[0]!.damage * 1.1).toFixed(2))
  );
});

test('法术伤害等级会并入面板法伤，法暴等级会默认换算期望伤害', () => {
  const bundle = createBundle();
  bundle.profile = {
    ...bundle.profile!,
    rawBodyJson: JSON.stringify({
      magicPower: 610,
      dodge: 205,
      magicCritLevel: 175,
      spellDamageLevel: 48,
    }),
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
      formationFactor: 1,
      formationCounterState: '无克/普通',
      elementRelation: '无克/普通',
      transformCardFactor: 1,
      shenmuValue: 0,
      magicResult: 0,
      targets: [
        { name: '法系木桩', magicDefense: 1200, magicDefenseCultivation: 20 },
      ],
    },
  });

  assert.equal(result.panelStats.spellDamageLevel, 48);
  assert.equal(result.panelStats.magicCritLevel, 175);
  assert.equal(
    result.targets[0]?.expectedDamage,
    Number((result.targets[0]!.damage * 1.1).toFixed(2))
  );
});

test('M8-07 随机波动模拟可在 95% 到 105% 区间内采样 10 次', () => {
  const bundle = createBundle();
  const domain = buildSimulatorCharacterDomain(bundle);

  assert.ok(domain);

  const baseline = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      skillCode: 'dragon_roll',
      targetCount: 1,
      formationFactor: 1,
      formationCounterState: '无克/普通',
      elementRelation: '无克/普通',
      transformCardFactor: 1,
      shenmuValue: 0,
      magicResult: 0,
      targets: [{ name: '波动木桩', magicDefense: 1200, magicDefenseCultivation: 20 }],
    },
  });

  const baselineRaw = (baseline.targets[0]?.breakdown as Record<string, number>)
    .rawDamageBeforeVariance;
  const varianceFactors = [0.95, 0.96, 0.97, 0.98, 0.99, 1.01, 1.02, 1.03, 1.04, 1.05];

  const sampledRatios = varianceFactors.map((damageVarianceFactor) => {
    const result = calculateDamageFromRuleSet({
      bundle,
      domain,
      ruleSet: createRuleSet(),
      request: {
        skillCode: 'dragon_roll',
        targetCount: 1,
        formationFactor: 1,
        formationCounterState: '无克/普通',
        elementRelation: '无克/普通',
        transformCardFactor: 1,
        shenmuValue: 0,
        magicResult: 0,
        damageVarianceFactor,
        targets: [{ name: '波动样本', magicDefense: 1200, magicDefenseCultivation: 20 }],
      },
    });

    const breakdown = result.targets[0]?.breakdown as Record<string, number>;
    return Number((breakdown.rawDamage / baselineRaw).toFixed(2));
  });

  assert.deepEqual(sampledRatios, varianceFactors);
});

test('M8-08 罗汉强制减伤时只缩小非结果部分到 0.5', () => {
  const bundle = createBundle();
  const domain = buildSimulatorCharacterDomain(bundle);

  assert.ok(domain);

  const baseline = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      skillCode: 'dragon_roll',
      targetCount: 1,
      formationFactor: 1,
      formationCounterState: '无克/普通',
      elementRelation: '无克/普通',
      transformCardFactor: 1,
      shenmuValue: 0,
      magicResult: 60,
      targets: [{ name: '罗汉木桩', magicDefense: 1200, magicDefenseCultivation: 20 }],
    },
  });
  const reduced = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      skillCode: 'dragon_roll',
      targetCount: 1,
      formationFactor: 1,
      formationCounterState: '无克/普通',
      elementRelation: '无克/普通',
      transformCardFactor: 1,
      luohanFactor: 0.5,
      shenmuValue: 0,
      magicResult: 60,
      targets: [{ name: '罗汉木桩', magicDefense: 1200, magicDefenseCultivation: 20 }],
    },
  });

  const baselineBreakdown = baseline.targets[0]?.breakdown as Record<string, number>;
  const reducedBreakdown = reduced.targets[0]?.breakdown as Record<string, number>;

  assert.equal(
    reducedBreakdown.nonResultDamage,
    Number((baselineBreakdown.nonResultDamageBeforeMitigation * 0.5).toFixed(4))
  );
  assert.equal(
    reducedBreakdown.rawDamageBeforeVariance,
    Number((baselineBreakdown.nonResultDamageBeforeMitigation * 0.5 + 60).toFixed(4))
  );
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

test('calculateDamageFromRuleSet only keeps the highest school rune tier for one skill chain', () => {
  const bundle = createBundle();
  bundle.equipments[0]!.slot = 'necklace';
  bundle.equipments[0]!.snapshotSlot = 'necklace';
  bundle.equipments[0]!.build!.notesJson = JSON.stringify({
    activeRuneStoneSet: 0,
    runeStoneSetsNames: ['龙腾'],
    runeStoneSets: [
      [
        { id: 'rune_1', type: 'black', stats: {} },
        { id: 'rune_2', type: 'red', stats: {} },
        { id: 'rune_3', type: 'white', stats: {} },
        { id: 'rune_4', type: 'blue', stats: {} },
      ],
    ],
  });

  const domain = buildSimulatorCharacterDomain(bundle);
  assert.ok(domain);

  const ruleSet = createRuleSet();
  ruleSet.skillBonuses = [
    {
      id: 'bonus_lv2',
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
        positionScope: ['necklace'],
        school: ['龙宫'],
        roleType: ['法师'],
      },
      conflictPolicy: 'take_max',
      limitPolicy: {
        globalMaxActive: 1,
      },
      sort: 10,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'bonus_lv4',
      versionId: 'rule_v1',
      bonusGroup: 'school_skill_rune',
      ruleCode: 'longteng_lv4',
      skillCode: 'dragon_teng',
      skillName: '龙腾',
      bonusType: 'skill_level',
      bonusValue: 4,
      condition: {
        triggerType: 'rune_combo',
        colorSequence: ['黑', '红', '白', '蓝'],
        slotCount: 4,
        positionScope: ['necklace'],
        school: ['龙宫'],
        roleType: ['法师'],
      },
      conflictPolicy: 'take_max',
      limitPolicy: {
        globalMaxActive: 1,
      },
      sort: 20,
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

  const breakdown = result.targets[0]?.breakdown as Record<string, any>;

  assert.equal(result.skill.finalLevel, 144);
  assert.deepEqual(breakdown.activeBonusRuleCodes, ['longteng_lv4']);
  assert.equal(breakdown.matchedBonusRules?.length, 1);
  assert.equal(breakdown.matchedBonusRules?.[0]?.ruleCode, 'longteng_lv4');
});

test('M4-01 门派组合唯一性：两件九龙诀装备仅生效等级最高一套', () => {
  const bundle = createBundle();
  bundle.equipments = ['helmet', 'shoes'].map((slot, index) => ({
    ...bundle.equipments[0]!,
    id: `eq_jiulong_${index + 1}`,
    slot,
    snapshotSlot: slot,
    build: {
      ...bundle.equipments[0]!.build!,
      equipmentId: `eq_jiulong_${index + 1}`,
      notesJson: JSON.stringify({
        activeRuneStoneSet: 0,
        runeStoneSetsNames: ['九龙诀'],
        runeStoneSets: [
          index === 0
            ? [
                { id: 'rune_1', type: 'white', stats: {} },
                { id: 'rune_2', type: 'red', stats: {} },
                { id: 'rune_3', type: 'yellow', stats: {} },
              ]
            : [
                { id: 'rune_4', type: 'white', stats: {} },
                { id: 'rune_5', type: 'red', stats: {} },
                { id: 'rune_6', type: 'yellow', stats: {} },
                { id: 'rune_7', type: 'blue', stats: {} },
              ],
        ],
      }),
    },
  }));

  const domain = buildSimulatorCharacterDomain(bundle);
  assert.ok(domain);

  const ruleSet = createRuleSet();
  ruleSet.skillBonuses = [
    {
      id: 'bonus_jiulong_lv2',
      versionId: 'rule_v1',
      bonusGroup: 'school_skill_rune',
      ruleCode: 'jiulong_lv2',
      skillCode: 'dragon_roll',
      skillName: '九龙诀',
      bonusType: 'skill_level',
      bonusValue: 2,
      condition: {
        triggerType: 'rune_combo',
        colorSequence: ['白', '红', '黄'],
        slotCount: 3,
        positionScope: ['helmet', 'shoes'],
        school: ['龙宫'],
        roleType: ['法师'],
      },
      conflictPolicy: 'take_max',
      limitPolicy: {
        globalMaxActive: 1,
      },
      sort: 10,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'bonus_jiulong_lv4',
      versionId: 'rule_v1',
      bonusGroup: 'school_skill_rune',
      ruleCode: 'jiulong_lv4',
      skillCode: 'dragon_roll',
      skillName: '九龙诀',
      bonusType: 'skill_level',
      bonusValue: 4,
      condition: {
        triggerType: 'rune_combo',
        colorSequence: ['白', '红', '黄', '蓝'],
        slotCount: 4,
        positionScope: ['helmet', 'shoes'],
        school: ['龙宫'],
        roleType: ['法师'],
      },
      conflictPolicy: 'take_max',
      limitPolicy: {
        globalMaxActive: 1,
      },
      sort: 20,
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
      skillCode: 'dragon_roll',
      targetCount: 1,
    },
  });

  const breakdown = result.targets[0]?.breakdown as Record<string, any>;

  assert.equal(result.skill.finalLevel, 154);
  assert.deepEqual(breakdown.activeBonusRuleCodes, ['jiulong_lv4']);
  assert.equal(breakdown.matchedBonusRules?.length, 1);
  assert.equal(breakdown.matchedBonusRules?.[0]?.ruleCode, 'jiulong_lv4');
});

test('M5-01/M5-08 符石组合位置错误时只识别颜色但不激活技能加成', () => {
  const bundle = createBundle();
  bundle.equipments[0]!.slot = 'weapon';
  bundle.equipments[0]!.snapshotSlot = 'weapon';
  bundle.equipments[0]!.build!.notesJson = JSON.stringify({
    activeRuneStoneSet: 0,
    runeStoneSetsNames: ['九龙诀'],
    runeStoneSets: [
      [
        { id: 'rune_1', type: 'white', stats: {} },
        { id: 'rune_2', type: 'red', stats: {} },
        { id: 'rune_3', type: 'yellow', stats: {} },
        { id: 'rune_4', type: 'blue', stats: {} },
        { id: 'rune_5', type: 'green', stats: {} },
      ],
    ],
  });

  const domain = buildSimulatorCharacterDomain(bundle);
  assert.ok(domain);

  const ruleSet = createRuleSet();
  ruleSet.skillBonuses = [
    {
      id: 'bonus_jiulong_lv6',
      versionId: 'rule_v1',
      bonusGroup: 'school_skill_rune',
      ruleCode: 'jiulong_lv6',
      skillCode: 'dragon_roll',
      skillName: '九龙诀',
      bonusType: 'skill_level',
      bonusValue: 6,
      condition: {
        triggerType: 'rune_combo',
        colorSequence: ['白', '红', '黄', '蓝', '绿'],
        slotCount: 5,
        positionScope: ['helmet'],
        school: ['龙宫'],
        roleType: ['法师'],
      },
      conflictPolicy: 'take_max',
      limitPolicy: {
        globalMaxActive: 1,
      },
      sort: 20,
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
      skillCode: 'dragon_roll',
      targetCount: 1,
    },
  });

  const breakdown = result.targets[0]?.breakdown as Record<string, any>;

  assert.equal(result.skill.finalLevel, 150);
  assert.deepEqual(breakdown.activeBonusRuleCodes, []);
  assert.equal(breakdown.matchedBonusRules?.length, 0);
});

test('M5-02 两件呼风唤雨 +6 同时存在时仅生效一件最高组合', () => {
  const bundle = createBundle();
  bundle.equipments = ['armor', 'armor'].map((slot, index) => ({
    ...bundle.equipments[0]!,
    id: `eq_hufeng_${index + 1}`,
    slot,
    snapshotSlot: slot,
    build: {
      ...bundle.equipments[0]!.build!,
      equipmentId: `eq_hufeng_${index + 1}`,
      holeCount: 5,
      notesJson: JSON.stringify({
        activeRuneStoneSet: 0,
        runeStoneSetsNames: ['呼风唤雨'],
        runeStoneSets: [
          [
            { id: `rune_${index}_1`, type: 'black', stats: {} },
            { id: `rune_${index}_2`, type: 'yellow', stats: {} },
            { id: `rune_${index}_3`, type: 'blue', stats: {} },
            { id: `rune_${index}_4`, type: 'green', stats: {} },
            { id: `rune_${index}_5`, type: 'white', stats: {} },
          ],
        ],
      }),
    },
  }));

  const domain = buildSimulatorCharacterDomain(bundle);
  assert.ok(domain);

  const ruleSet = createRuleSet();
  ruleSet.skillBonuses = [
    {
      id: 'bonus_hufeng_lv6',
      versionId: 'rule_v1',
      bonusGroup: 'school_skill_rune',
      ruleCode: 'hufeng_lv6',
      skillCode: 'dragon_roll',
      skillName: '呼风唤雨',
      bonusType: 'skill_level',
      bonusValue: 6,
      condition: {
        triggerType: 'rune_combo',
        colorSequence: ['黑', '黄', '蓝', '绿', '白'],
        slotCount: 5,
        positionScope: ['armor'],
        school: ['龙宫'],
        roleType: ['法师'],
      },
      conflictPolicy: 'take_max',
      limitPolicy: {
        globalMaxActive: 1,
      },
      sort: 20,
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
      skillCode: 'dragon_roll',
      targetCount: 1,
    },
  });

  const breakdown = result.targets[0]?.breakdown as Record<string, any>;

  assert.equal(result.skill.finalLevel, 156);
  assert.deepEqual(breakdown.activeBonusRuleCodes, ['hufeng_lv6']);
  assert.equal(breakdown.matchedBonusRules?.length, 1);
});

test('calculateDamageFromRuleSet caps 隔山打牛 panel bonuses at two active sets', () => {
  const bundle = createBundle();
  bundle.equipments = ['necklace', 'armor', 'belt'].map((slot, index) => ({
    ...bundle.equipments[0]!,
    id: `eq_geshan_${index + 1}`,
    slot,
    snapshotSlot: slot,
    build: {
      ...bundle.equipments[0]!.build!,
      equipmentId: `eq_geshan_${index + 1}`,
      holeCount: 5,
      notesJson: JSON.stringify({
        activeRuneStoneSet: 0,
        runeStoneSetsNames: ['隔山打牛'],
        runeStoneSets: [
          [
            { id: `rune_${index}_1`, type: 'white', stats: {} },
            { id: `rune_${index}_2`, type: 'red', stats: {} },
            { id: `rune_${index}_3`, type: 'purple', stats: {} },
            { id: `rune_${index}_4`, type: 'blue', stats: {} },
            { id: `rune_${index}_5`, type: 'yellow', stats: {} },
          ],
        ],
      }),
    },
  }));

  const domain = buildSimulatorCharacterDomain(bundle);
  assert.ok(domain);

  const ruleSet = createRuleSet();
  ruleSet.skillBonuses = [
    {
      id: 'bonus_geshan_70',
      versionId: 'rule_v1',
      bonusGroup: 'geshan_panel_magic_damage',
      ruleCode: 'geshan_magic_damage_70',
      skillCode: 'spell_magic',
      skillName: '法术攻击',
      bonusType: 'panel_stat_bonus',
      bonusValue: 70,
      condition: {
        triggerType: 'rune_combo',
        colorSequence: ['白', '红', '紫', '蓝', '黄'],
        slotCount: 5,
        positionScope: ['necklace', 'armor', 'belt'],
        school: ['龙宫'],
        roleType: ['法师'],
        skillCode: ['dragon_roll', 'dragon_teng'],
        targetKeys: ['magicDamage'],
      },
      conflictPolicy: 'stack',
      limitPolicy: {
        globalMaxActive: 2,
      },
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
      skillCode: 'dragon_roll',
      targetCount: 1,
    },
  });

  const breakdown = result.targets[0]?.breakdown as Record<string, any>;

  assert.equal(
    breakdown.panelMagicDamageBreakdown.panelStatBonuses.magicDamage,
    140
  );
  assert.equal(breakdown.activeBonusRuleCodes.length, 2);
  assert.equal(breakdown.activePanelStatBonusRules?.[0]?.ruleCode, 'geshan_magic_damage_70');
  assert.equal(breakdown.activePanelStatBonusRules?.[0]?.activeCount, 2);
});

test('M5-04/M5-09 三套隔山打牛仅按两套生效并记录超出上限失效', () => {
  const bundle = createBundle();
  bundle.equipments = ['necklace', 'armor', 'belt'].map((slot, index) => ({
    ...bundle.equipments[0]!,
    id: `eq_geshan_log_${index + 1}`,
    slot,
    snapshotSlot: slot,
    build: {
      ...bundle.equipments[0]!.build!,
      equipmentId: `eq_geshan_log_${index + 1}`,
      holeCount: 5,
      notesJson: JSON.stringify({
        activeRuneStoneSet: 0,
        runeStoneSetsNames: ['隔山打牛'],
        runeStoneSets: [
          [
            { id: `rune_${index}_1`, type: 'white', stats: {} },
            { id: `rune_${index}_2`, type: 'red', stats: {} },
            { id: `rune_${index}_3`, type: 'purple', stats: {} },
            { id: `rune_${index}_4`, type: 'blue', stats: {} },
            { id: `rune_${index}_5`, type: 'yellow', stats: {} },
          ],
        ],
      }),
    },
  }));

  const domain = buildSimulatorCharacterDomain(bundle);
  assert.ok(domain);

  const ruleSet = createRuleSet();
  ruleSet.skillBonuses = [
    {
      id: 'bonus_geshan_spirit_70',
      versionId: 'rule_v1',
      bonusGroup: 'geshan_panel_spirit',
      ruleCode: 'geshan_spirit_70',
      skillCode: 'spell_magic',
      skillName: '法术攻击',
      bonusType: 'panel_stat_bonus',
      bonusValue: 70,
      condition: {
        triggerType: 'rune_combo',
        colorSequence: ['白', '红', '紫', '蓝', '黄'],
        slotCount: 5,
        positionScope: ['necklace', 'armor', 'belt'],
        school: ['龙宫'],
        roleType: ['法师'],
        skillCode: ['dragon_roll', 'dragon_teng'],
        targetKeys: ['spirit'],
      },
      conflictPolicy: 'stack',
      limitPolicy: {
        globalMaxActive: 2,
      },
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
      skillCode: 'dragon_roll',
      targetCount: 1,
    },
  });

  const breakdown = result.targets[0]?.breakdown as Record<string, any>;

  assert.equal(breakdown.activeBonusRuleCodes.length, 2);
  assert.equal(breakdown.ignoredBonusRules?.[0]?.ruleCode, 'geshan_spirit_70');
  assert.equal(breakdown.ignoredBonusRules?.[0]?.ignoredCount, 1);
  assert.equal(breakdown.ignoredBonusRules?.[0]?.reasonLabel, '超出上限失效');
});

test('M5-03 三孔装备强行放入四色时只按前三孔识别并降为低阶组合', () => {
  const bundle = createBundle();
  bundle.equipments[0]!.slot = 'necklace';
  bundle.equipments[0]!.snapshotSlot = 'necklace';
  bundle.equipments[0]!.build!.holeCount = 3;
  bundle.equipments[0]!.build!.notesJson = JSON.stringify({
    activeRuneStoneSet: 0,
    holeCount: 3,
    runeStoneSetsNames: ['龙腾'],
    runeStoneSets: [
      [
        { id: 'rune_1', type: 'black', stats: {} },
        { id: 'rune_2', type: 'red', stats: {} },
        { id: 'rune_3', type: 'white', stats: {} },
        { id: 'rune_4', type: 'blue', stats: {} },
      ],
    ],
  });

  const domain = buildSimulatorCharacterDomain(bundle);
  assert.ok(domain);

  const ruleSet = createRuleSet();
  ruleSet.skillBonuses = [
    {
      id: 'bonus_longteng_lv2',
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
        positionScope: ['necklace'],
        school: ['龙宫'],
        roleType: ['法师'],
      },
      conflictPolicy: 'take_max',
      limitPolicy: { globalMaxActive: 1 },
      sort: 10,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'bonus_longteng_lv4',
      versionId: 'rule_v1',
      bonusGroup: 'school_skill_rune',
      ruleCode: 'longteng_lv4',
      skillCode: 'dragon_teng',
      skillName: '龙腾',
      bonusType: 'skill_level',
      bonusValue: 4,
      condition: {
        triggerType: 'rune_combo',
        colorSequence: ['黑', '红', '白', '蓝'],
        slotCount: 4,
        positionScope: ['necklace'],
        school: ['龙宫'],
        roleType: ['法师'],
      },
      conflictPolicy: 'take_max',
      limitPolicy: { globalMaxActive: 1 },
      sort: 20,
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

  const breakdown = result.targets[0]?.breakdown as Record<string, any>;

  assert.equal(result.skill.finalLevel, 142);
  assert.deepEqual(breakdown.activeBonusRuleCodes, ['longteng_lv2']);
});

test('M5-11/M5-18 符石颜色调整后会自动降级或失效', () => {
  const createResult = (notesJson: string) => {
    const bundle = createBundle();
    bundle.equipments[0]!.slot = 'belt';
    bundle.equipments[0]!.snapshotSlot = 'belt';
    bundle.equipments[0]!.build!.holeCount = 5;
    bundle.equipments[0]!.build!.notesJson = notesJson;

    const domain = buildSimulatorCharacterDomain(bundle);
    assert.ok(domain);

    const ruleSet = createRuleSet();
    ruleSet.skillBonuses = [
      {
        id: 'bonus_nilin_lv2',
        versionId: 'rule_v1',
        bonusGroup: 'school_skill_rune',
        ruleCode: 'nilin_lv2',
        skillCode: 'dragon_roll',
        skillName: '逆鳞',
        bonusType: 'skill_level',
        bonusValue: 2,
        condition: {
          triggerType: 'rune_combo',
          colorSequence: ['白', '红', '绿'],
          slotCount: 3,
          positionScope: ['belt'],
          school: ['龙宫'],
          roleType: ['法师'],
        },
        conflictPolicy: 'take_max',
        limitPolicy: { globalMaxActive: 1 },
        sort: 10,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'bonus_nilin_lv6',
        versionId: 'rule_v1',
        bonusGroup: 'school_skill_rune',
        ruleCode: 'nilin_lv6',
        skillCode: 'dragon_roll',
        skillName: '逆鳞',
        bonusType: 'skill_level',
        bonusValue: 6,
        condition: {
          triggerType: 'rune_combo',
          colorSequence: ['白', '红', '绿', '紫', '蓝'],
          slotCount: 5,
          positionScope: ['belt'],
          school: ['龙宫'],
          roleType: ['法师'],
        },
        conflictPolicy: 'take_max',
        limitPolicy: { globalMaxActive: 1 },
        sort: 20,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    return calculateDamageFromRuleSet({
      bundle,
      domain,
      ruleSet,
      request: {
        skillCode: 'dragon_roll',
        targetCount: 1,
      },
    });
  };

  const fullResult = createResult(
    JSON.stringify({
      activeRuneStoneSet: 0,
      holeCount: 5,
      runeStoneSetsNames: ['逆鳞'],
      runeStoneSets: [
        [
          { id: 'rune_1', type: 'white', stats: {} },
          { id: 'rune_2', type: 'red', stats: {} },
          { id: 'rune_3', type: 'green', stats: {} },
          { id: 'rune_4', type: 'purple', stats: {} },
          { id: 'rune_5', type: 'blue', stats: {} },
        ],
      ],
    })
  );
  const downgradeResult = createResult(
    JSON.stringify({
      activeRuneStoneSet: 0,
      holeCount: 3,
      runeStoneSetsNames: ['逆鳞'],
      runeStoneSets: [
        [
          { id: 'rune_1', type: 'white', stats: {} },
          { id: 'rune_2', type: 'red', stats: {} },
          { id: 'rune_3', type: 'green', stats: {} },
        ],
      ],
    })
  );
  const invalidResult = createResult(
    JSON.stringify({
      activeRuneStoneSet: 0,
      holeCount: 5,
      runeStoneSetsNames: ['逆鳞'],
      runeStoneSets: [
        [
          { id: 'rune_1', type: 'white', stats: {} },
          { id: 'rune_2', type: 'red', stats: {} },
          { id: 'rune_3', type: 'yellow', stats: {} },
          { id: 'rune_4', type: 'purple', stats: {} },
          { id: 'rune_5', type: 'blue', stats: {} },
        ],
      ],
    })
  );

  assert.equal(fullResult.skill.finalLevel, 156);
  assert.equal(downgradeResult.skill.finalLevel, 152);
  assert.equal(invalidResult.skill.finalLevel, 150);
});

test('M5-05 鞋子首孔颜色错误时招云整套效果消失', () => {
  const createZhaoyunResult = (
    colors: [string, string, string, string, string, string]
  ) => {
    const bundle = createBundle();
    applyFullSetRuneColors(bundle, colors);
    applyStrictStarAlignmentConfigs(bundle);

    const domain = buildSimulatorCharacterDomain(bundle);
    assert.ok(domain);

    const ruleSet = createRuleSet();
    ruleSet.modifiers.push(
      createFullSetModifier({
        id: 'mod_zhaoyun_spirit_m5_05',
        modifierDomain: 'panel_stat_bonus',
        modifierKey: 'zhaoyun_spirit_m5_05',
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
        requireStarResonance: true,
      }),
      createFullSetModifier({
        id: 'mod_zhaoyun_target_speed_m5_05',
        modifierDomain: 'skill_damage_addend',
        modifierKey: 'zhaoyun_target_speed_m5_05',
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
        requireStarResonance: true,
      })
    );

    return calculateDamageFromRuleSet({
      bundle,
      domain,
      ruleSet,
      request: {
        skillCode: 'dragon_roll',
        targetCount: 1,
      },
    });
  };

  const activatedResult = createZhaoyunResult([
    'white',
    'red',
    'yellow',
    'black',
    'blue',
    'red',
  ]);
  const invalidResult = createZhaoyunResult([
    'white',
    'red',
    'yellow',
    'black',
    'blue',
    'white',
  ]);

  const activatedBreakdown = activatedResult.targets[0]?.breakdown as Record<
    string,
    any
  >;
  const invalidBreakdown = invalidResult.targets[0]?.breakdown as Record<
    string,
    any
  >;

  assert.equal(activatedResult.panelStats.spirit - invalidResult.panelStats.spirit, 6);
  assert.equal(activatedBreakdown.conditionalDamageAddend, 30.4);
  assert.equal(invalidBreakdown.conditionalDamageAddend, 0);
  assert.equal(
    activatedBreakdown.panelMagicDamageBreakdown.panelStatBonuses.spirit,
    6
  );
  assert.equal(
    invalidBreakdown.panelMagicDamageBreakdown.panelStatBonuses.spirit ?? 0,
    0
  );
});

test('M5-10 龙腾四级组合会显著提升单体伤害', () => {
  const createLongtengResult = (withCombo: boolean) => {
    const bundle = createBundle();
    if (withCombo) {
      bundle.equipments[0]!.slot = 'necklace';
      bundle.equipments[0]!.snapshotSlot = 'necklace';
      bundle.equipments[0]!.build!.holeCount = 5;
      bundle.equipments[0]!.build!.notesJson = JSON.stringify({
        activeRuneStoneSet: 0,
        holeCount: 5,
        runeStoneSetsNames: ['龙腾'],
        runeStoneSets: [
          [
            { id: 'rune_1', type: 'black', stats: {} },
            { id: 'rune_2', type: 'red', stats: {} },
            { id: 'rune_3', type: 'white', stats: {} },
            { id: 'rune_4', type: 'blue', stats: {} },
            { id: 'rune_5', type: 'purple', stats: {} },
          ],
        ],
      });
    }

    const domain = buildSimulatorCharacterDomain(bundle);
    assert.ok(domain);

    const ruleSet = createRuleSet();
    ruleSet.skillBonuses = [
      {
        id: 'bonus_longteng_lv6_m5_10',
        versionId: 'rule_v1',
        bonusGroup: 'school_skill_rune',
        ruleCode: 'longteng_lv6_m5_10',
        skillCode: 'dragon_teng',
        skillName: '龙腾',
        bonusType: 'skill_level',
        bonusValue: 6,
        condition: {
          triggerType: 'rune_combo',
          colorSequence: ['黑', '红', '白', '蓝', '紫'],
          slotCount: 5,
          positionScope: ['necklace'],
          school: ['龙宫'],
          roleType: ['法师'],
        },
        conflictPolicy: 'take_max',
        limitPolicy: { globalMaxActive: 1 },
        sort: 20,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    return calculateDamageFromRuleSet({
      bundle,
      domain,
      ruleSet,
      request: {
        skillCode: 'dragon_teng',
        targetCount: 1,
      },
    });
  };

  const baselineResult = createLongtengResult(false);
  const comboResult = createLongtengResult(true);

  assert.equal(comboResult.skill.finalLevel, 146);
  assert.ok(
    (comboResult.targets[0]?.damage ?? 0) > (baselineResult.targets[0]?.damage ?? 0)
  );
});

test('M5-12 招云整套识别后会激活灵力与目标速度追加伤害', () => {
  const bundle = createBundle();
  applyFullSetRuneColors(bundle, [
    'white',
    'red',
    'yellow',
    'black',
    'blue',
    'red',
  ]);
  applyStrictStarAlignmentConfigs(bundle);

  const domain = buildSimulatorCharacterDomain(bundle);
  assert.ok(domain);

  const ruleSet = createRuleSet();
  ruleSet.modifiers.push(
    createFullSetModifier({
      id: 'mod_zhaoyun_spirit_m5_12',
      modifierDomain: 'panel_stat_bonus',
      modifierKey: 'zhaoyun_spirit_m5_12',
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
      requireStarResonance: true,
    }),
    createFullSetModifier({
      id: 'mod_zhaoyun_target_speed_m5_12',
      modifierDomain: 'skill_damage_addend',
      modifierKey: 'zhaoyun_target_speed_m5_12',
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
      requireStarResonance: true,
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

  assert.equal(result.panelStats.spirit, 807);
  assert.equal(breakdown.conditionalDamageAddend, 30.4);
  assert.equal(breakdown.panelMagicDamageBreakdown.panelStatBonuses.spirit, 6);
});

test('M5-14 隔山打牛灵力会自动转为法伤与法防', () => {
  const createGeshanResult = (withCombo: boolean) => {
    const bundle = createBundle();
    if (withCombo) {
      bundle.equipments[0]!.slot = 'necklace';
      bundle.equipments[0]!.snapshotSlot = 'necklace';
      bundle.equipments[0]!.build!.holeCount = 5;
      bundle.equipments[0]!.build!.notesJson = JSON.stringify({
        activeRuneStoneSet: 0,
        holeCount: 5,
        runeStoneSetsNames: ['隔山打牛'],
        runeStoneSets: [
          [
            { id: 'rune_1', type: 'white', stats: {} },
            { id: 'rune_2', type: 'red', stats: {} },
            { id: 'rune_3', type: 'purple', stats: {} },
            { id: 'rune_4', type: 'blue', stats: {} },
            { id: 'rune_5', type: 'yellow', stats: {} },
          ],
        ],
      });
    }

    const domain = buildSimulatorCharacterDomain(bundle);
    assert.ok(domain);

    const ruleSet = createRuleSet();
    ruleSet.skillBonuses = [
      {
        id: 'bonus_geshan_spirit_70_m5_14',
        versionId: 'rule_v1',
        bonusGroup: 'geshan_panel_spirit',
        ruleCode: 'geshan_spirit_70_m5_14',
        skillCode: 'spell_magic',
        skillName: '法术攻击',
        bonusType: 'panel_stat_bonus',
        bonusValue: 70,
        condition: {
          triggerType: 'rune_combo',
          colorSequence: ['白', '红', '紫', '蓝', '黄'],
          slotCount: 5,
          positionScope: ['necklace'],
          school: ['龙宫'],
          roleType: ['法师'],
          skillCode: ['dragon_roll', 'dragon_teng'],
          targetKeys: ['spirit'],
        },
        conflictPolicy: 'stack',
        limitPolicy: {
          globalMaxActive: 2,
        },
        sort: 10,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    return calculateDamageFromRuleSet({
      bundle,
      domain,
      ruleSet,
      request: {
        skillCode: 'dragon_roll',
        targetCount: 1,
      },
    });
  };

  const baselineResult = createGeshanResult(false);
  const comboResult = createGeshanResult(true);
  const breakdown = comboResult.targets[0]?.breakdown as Record<string, any>;

  assert.equal(comboResult.panelStats.spirit - baselineResult.panelStats.spirit, 70);
  assert.equal(
    comboResult.panelStats.magicDamage - baselineResult.panelStats.magicDamage,
    70
  );
  assert.equal(
    comboResult.panelStats.magicDefense - baselineResult.panelStats.magicDefense,
    70
  );
  assert.equal(breakdown.panelMagicDamageBreakdown.panelStatBonuses.spirit, 70);
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
  applyStrictStarAlignmentConfigs(bundle);

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
      requireStarResonance: true,
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
      requireStarResonance: true,
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

  assert.equal(result.panelStats.spirit, 807);
  assert.ok(Math.abs(result.panelStats.magicDamage - 2112.8) < 1e-9);
  assert.ok(Math.abs(result.panelStats.magicDefense - 792.8) < 1e-9);
  assert.equal(breakdown.targetSpeed, 760);
  assert.equal(breakdown.conditionalDamageAddend, 30.4);
  assert.equal(breakdown.panelMagicDamageBreakdown.panelStatBonuses.spirit, 6);
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
  applyStrictStarAlignmentConfigs(bundle);

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
      requireStarResonance: true,
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
      requireStarResonance: true,
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

  assert.equal(result.panelStats.spirit, 807);
  assert.ok(Math.abs(result.panelStats.magicDamage - 2112.8) < 1e-9);
  assert.ok(Math.abs(result.panelStats.magicDefense - 792.8) < 1e-9);
  assert.equal(breakdown.resolvedSkillManaCost, 30);
  assert.equal(breakdown.conditionalDamageAddend, 1.2);
  assert.equal(
    breakdown.conditionalDamageAddends?.[0]?.modifierKey,
    'tengjiao_mana_cost'
  );
});

test('M5-12 腾蛟整套识别后会激活灵力与龙腾魔法消耗追加伤害', () => {
  const bundle = createBundle();
  applyFullSetRuneColors(bundle, [
    'white',
    'red',
    'red',
    'black',
    'blue',
    'red',
  ]);
  applyStrictStarAlignmentConfigs(bundle);

  const domain = buildSimulatorCharacterDomain(bundle);
  assert.ok(domain);

  const ruleSet = createRuleSet();
  ruleSet.modifiers.push(
    createFullSetModifier({
      id: 'mod_tengjiao_spirit_m5_12',
      modifierDomain: 'panel_stat_bonus',
      modifierKey: 'tengjiao_spirit_m5_12',
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
      requireStarResonance: true,
    }),
    createFullSetModifier({
      id: 'mod_tengjiao_mana_cost_m5_12',
      modifierDomain: 'skill_damage_addend',
      modifierKey: 'tengjiao_mana_cost_m5_12',
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
      requireStarResonance: true,
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

  assert.equal(result.panelStats.spirit, 807);
  assert.equal(breakdown.resolvedSkillManaCost, 30);
  assert.equal(breakdown.conditionalDamageAddend, 1.2);
  assert.equal(
    breakdown.panelMagicDamageBreakdown.panelStatBonuses.spirit,
    6
  );
  assert.equal(
    breakdown.conditionalDamageAddends?.[0]?.modifierKey,
    'tengjiao_mana_cost_m5_12'
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
    1003
  );
  assert.ok(
    Math.abs(
      breakdown.panelMagicDamageBreakdown.panelMagicDamageAfterPercent -
        1018.045
    ) < 1e-9
  );
  assert.ok(Math.abs(breakdown.panelMagicDamage - 1018.045) < 1e-9);
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
  assert.ok(Math.abs(breakdown.panelMagicDamage - 1018.045) < 1e-9);
  assert.ok(
    (result.targets[0]?.damage ?? 0) > (baselineResult.targets[0]?.damage ?? 0)
  );
});

test('calculateDamageFromRuleSet applies jade magic upper percent modifiers to panel mp', () => {
  const bundle = createBundle();
  bundle.equipments.push({
    ...bundle.equipments[0]!,
    id: 'jade_magic_upper_meta',
    slot: 'jade1',
    name: '阳玉·蓝量',
    build: {
      ...bundle.equipments[0]!.build!,
      equipmentId: 'jade_magic_upper_meta',
      specialEffectJson: '{}',
      setEffectJson: '{}',
      notesJson: JSON.stringify({
        effectModifiers: [
          {
            code: 'magic_upper_percent',
            value: 5,
            label: '魔法值上限 +5%',
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

  assert.equal(result.panelStats.mp, 929.25);
  assert.equal(breakdown.magicUpperPercent, 0.05);
  assert.equal(
    breakdown.equipmentEffectModifiers?.find(
      (item: { code?: string }) => item.code === 'magic_upper_percent'
    )?.code,
    'magic_upper_percent'
  );
});

test('calculateDamageFromRuleSet applies matching jade element overcome percent to element factor', () => {
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
      selfElement: '水',
      targetElement: '火',
    },
  });

  const bundle = createBundle();
  bundle.equipments.push({
    ...bundle.equipments[0]!,
    id: 'jade_element_meta',
    slot: 'jade1',
    name: '阳玉·水克制',
    build: {
      ...bundle.equipments[0]!.build!,
      equipmentId: 'jade_element_meta',
      specialEffectJson: '{}',
      setEffectJson: '{}',
      notesJson: JSON.stringify({
        effectModifiers: [
          {
            code: 'element_overcome_percent',
            value: 1,
            source: '水',
            label: '水属性克制效果 +1%',
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
      selfElement: '水',
      targetElement: '火',
    },
  });

  const breakdown = result.targets[0]?.breakdown as Record<string, any>;

  assert.equal(breakdown.elementOvercomePercent, 0.01);
  assert.equal(breakdown.elementFactor, 1.06);
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
  const slotConfigs: Record<
    string,
    { comboName: string; colors: string[]; attrType: string }
  > = {
    weapon: {
      comboName: '破浪诀',
      colors: ['白', '红', '蓝', '黑', '绿'],
      attrType: 'strength',
    },
    helmet: {
      comboName: '九龙诀',
      colors: ['白', '红', '黄', '蓝', '绿'],
      attrType: 'physique',
    },
    necklace: {
      comboName: '龙腾',
      colors: ['黑', '红', '白', '蓝', '紫'],
      attrType: 'magic',
    },
    armor: {
      comboName: '呼风唤雨',
      colors: ['黑', '黄', '蓝', '绿', '白'],
      attrType: 'endurance',
    },
    belt: {
      comboName: '逆鳞',
      colors: ['白', '红', '绿', '紫', '蓝'],
      attrType: 'agility',
    },
    shoes: {
      comboName: '百步穿杨',
      colors: ['蓝', '白', '绿', '黑', '红'],
      attrType: 'strength',
    },
  };

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
        (() => {
          if (!starAlignment) {
            return {};
          }

          const config = slotConfigs[slot];
          return {
            starAlignment,
            starAlignmentConfig: {
              id: `star_alignment_${slot}`,
              label: starAlignment,
              attrType: config.attrType,
              attrValue: 2,
              comboName: config.comboName,
              colors: config.colors,
            },
            activeRuneStoneSet: 0,
            runeStoneSetsNames: [config.comboName],
            runeStoneSets: [
              [
                {
                  id: `rune_${slot}_1`,
                  type: config.colors[0],
                  stats: {},
                },
              ],
            ],
          };
        })()
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

  assert.ok(
    Math.abs(
      result.panelStats.magicDamage -
        ((baselineResult.panelStats.magicDamage ?? 0) + 4)
    ) < 1e-9
  );
  assert.ok(
    Math.abs(result.panelStats.hp - ((baselineResult.panelStats.hp ?? 0) + 18)) <
      1e-9
  );
  assert.ok(Math.abs(result.panelStats.speed - 24.48) < 1e-9);
  assert.ok(
    Math.abs(
      result.panelStats.damage -
        ((baselineResult.panelStats.damage ?? 0) + 3.36)
    ) < 1e-9
  );
  assert.ok(
    Math.abs(
      result.panelStats.defense -
        ((baselineResult.panelStats.defense ?? 0) + 6.4)
    ) < 1e-9
  );
  assert.ok(
    Math.abs(
      result.panelStats.hit - ((baselineResult.panelStats.hit ?? 0) + 10.2)
    ) < 1e-9
  );
  assert.ok(
    Math.abs(
      result.panelStats.dodge - ((baselineResult.panelStats.dodge ?? 0) + 4)
    ) < 1e-9
  );
  assert.ok(
    Math.abs(
      result.panelStats.magicDefense -
        ((baselineResult.panelStats.magicDefense ?? 0) + 4)
    ) < 1e-9
  );
  assert.ok(
    Math.abs(result.panelStats.mp - ((baselineResult.panelStats.mp ?? 0) + 14)) <
      1e-9
  );
  assert.equal(breakdown.starBonuses.fullSetActive, true);
  assert.equal(breakdown.starBonuses.fullSetAttributeBonus, 2);
  assert.equal(breakdown.starBonuses.attributeSourceBonuses.strength, 6);
  assert.equal(breakdown.starBonuses.attributeSourceBonuses.magic, 4);
  assert.equal(breakdown.starBonuses.attributeSourceBonuses.physique, 4);
  assert.equal(breakdown.starBonuses.attributeSourceBonuses.endurance, 4);
  assert.equal(breakdown.starBonuses.attributeSourceBonuses.agility, 4);
});

test('calculateDamageFromRuleSet applies ornament set panel bonuses from runtime config', () => {
  const bundle = createBundle();
  bundle.equipments = ['trinket1', 'trinket2', 'trinket3', 'trinket4'].map(
    (slot, index) => ({
      ...bundle.equipments[0]!,
      id: `ornament_${index + 1}`,
      slot,
      snapshotSlot: slot,
      level: 80,
      attrs: [],
      build: {
        ...bundle.equipments[0]!.build!,
        equipmentId: `ornament_${index + 1}`,
        setEffectJson: JSON.stringify({
          setName: '健步如飞',
        }),
        notesJson: '{}',
      },
    })
  );

  const domain = buildSimulatorCharacterDomain(bundle);
  assert.ok(domain);

  const ruleSet = createRuleSet();
  ruleSet.equipmentExtensionConfigs = [
    {
      id: 'ornament_rule_1',
      configKey: 'ornament_set_rules',
      label: '灵饰套装档位规则',
      description: '',
      enabled: true,
      sort: 0,
      value: [
        {
          setName: '健步如飞',
          minCount: 4,
          minTier: 8,
          tiers: [
            {
              tier: 8,
              effects: [
                {
                  type: 'panel_stat_bonus',
                  targetKey: 'speed',
                  value: 12,
                },
              ],
            },
            {
              tier: 32,
              effects: [
                {
                  type: 'panel_stat_bonus',
                  targetKey: 'speed',
                  value: 32,
                },
              ],
            },
          ],
        },
      ],
    },
  ];

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

  assert.ok(result.panelStats.speed > 20.7);
  assert.equal(breakdown.ornamentSetBonuses.panelStatBonuses.speed, 32);
  assert.equal(breakdown.ornamentSetBonuses.activeSets.length, 1);
  assert.equal(breakdown.ornamentSetBonuses.activeSets[0]?.setName, '健步如飞');
  assert.equal(breakdown.ornamentSetBonuses.activeSets[0]?.tier, 32);
  assert.equal(breakdown.ruleResolvedPanelStats.speedBeforeFormation, 55);
});

test('M4-05 灵饰套装联动：4件4级健步如飞带来速度面板 +30', () => {
  const bundle = createBundle();
  bundle.equipments = ['trinket1', 'trinket2', 'trinket3', 'trinket4'].map(
    (slot, index) => ({
      ...bundle.equipments[0]!,
      id: `ornament_speed_${index + 1}`,
      slot,
      snapshotSlot: slot,
      level: 4,
      attrs: [],
      build: {
        ...bundle.equipments[0]!.build!,
        equipmentId: `ornament_speed_${index + 1}`,
        setEffectJson: JSON.stringify({
          setName: '健步如飞',
        }),
        notesJson: '{}',
      },
    })
  );

  const domain = buildSimulatorCharacterDomain(bundle);
  assert.ok(domain);

  const ruleSet = createRuleSet();
  ruleSet.equipmentExtensionConfigs = [
    {
      id: 'ornament_rule_m4_05',
      configKey: 'ornament_set_rules',
      label: '灵饰套装档位规则',
      description: '',
      enabled: true,
      sort: 0,
      value: [
        {
          setName: '健步如飞',
          minCount: 4,
          minTier: 8,
          tiers: [
            {
              tier: 16,
              effects: [
                {
                  type: 'panel_stat_bonus',
                  targetKey: 'speed',
                  value: 30,
                },
              ],
            },
          ],
        },
      ],
    },
  ];

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

  assert.equal(breakdown.ornamentSetBonuses.panelStatBonuses.speed, 30);
  assert.equal(breakdown.ornamentSetBonuses.activeSets[0]?.tier, 16);
  assert.equal(breakdown.ruleResolvedPanelStats.speedBeforeFormation, 53);
});

test('M4-08 套装阶梯属性：3件同名常规套装带来魔力 +10', () => {
  const baselineBundle = createBundle();
  baselineBundle.equipments = [
    createPrimaryPlaceholderEquipment('eq_weapon', 'weapon'),
    createPrimaryPlaceholderEquipment('eq_helmet', 'helmet'),
    createPrimaryPlaceholderEquipment('eq_necklace', 'necklace'),
    createPrimaryPlaceholderEquipment('eq_armor', 'armor'),
    createPrimaryPlaceholderEquipment('eq_belt', 'belt'),
    createPrimaryPlaceholderEquipment('eq_shoes', 'shoes'),
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
    createPrimaryPlaceholderEquipment('eq_weapon', 'weapon', '炎魔神套'),
    createPrimaryPlaceholderEquipment('eq_helmet', 'helmet', '炎魔神套'),
    createPrimaryPlaceholderEquipment('eq_necklace', 'necklace'),
    createPrimaryPlaceholderEquipment('eq_armor', 'armor', '炎魔神套'),
    createPrimaryPlaceholderEquipment('eq_belt', 'belt'),
    createPrimaryPlaceholderEquipment('eq_shoes', 'shoes'),
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

  assert.equal(
    result.panelStats.mp - (baselineResult.panelStats.mp ?? 0),
    35
  );
  assert.equal(
    result.panelStats.magicDamage - (baselineResult.panelStats.magicDamage ?? 0),
    7
  );
  assert.equal(
    result.panelStats.magicDefense -
      (baselineResult.panelStats.magicDefense ?? 0),
    7
  );
  assert.equal(breakdown.regularSetBonuses.attributeSourceBonuses.magic, 10);
  assert.equal(breakdown.regularSetBonuses.activeSets.length, 1);
  assert.equal(breakdown.regularSetBonuses.activeSets[0]?.setName, '炎魔神套');
  assert.equal(breakdown.regularSetBonuses.activeSets[0]?.tier, 3);
});

test('M4-08 套装阶梯属性：5件同名常规套装升级为魔力 +20', () => {
  const baselineBundle = createBundle();
  baselineBundle.equipments = [
    createPrimaryPlaceholderEquipment('eq_weapon', 'weapon'),
    createPrimaryPlaceholderEquipment('eq_helmet', 'helmet'),
    createPrimaryPlaceholderEquipment('eq_necklace', 'necklace'),
    createPrimaryPlaceholderEquipment('eq_armor', 'armor'),
    createPrimaryPlaceholderEquipment('eq_belt', 'belt'),
    createPrimaryPlaceholderEquipment('eq_shoes', 'shoes'),
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
    createPrimaryPlaceholderEquipment('eq_weapon', 'weapon', '炎魔神套'),
    createPrimaryPlaceholderEquipment('eq_helmet', 'helmet', '炎魔神套'),
    createPrimaryPlaceholderEquipment('eq_necklace', 'necklace', '炎魔神套'),
    createPrimaryPlaceholderEquipment('eq_armor', 'armor', '炎魔神套'),
    createPrimaryPlaceholderEquipment('eq_belt', 'belt', '炎魔神套'),
    createPrimaryPlaceholderEquipment('eq_shoes', 'shoes'),
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

  assert.equal(
    result.panelStats.mp - (baselineResult.panelStats.mp ?? 0),
    70
  );
  assert.equal(
    result.panelStats.magicDamage - (baselineResult.panelStats.magicDamage ?? 0),
    14
  );
  assert.equal(
    result.panelStats.magicDefense -
      (baselineResult.panelStats.magicDefense ?? 0),
    14
  );
  assert.equal(breakdown.regularSetBonuses.attributeSourceBonuses.magic, 20);
  assert.equal(breakdown.regularSetBonuses.activeSets.length, 1);
  assert.equal(breakdown.regularSetBonuses.activeSets[0]?.setName, '炎魔神套');
  assert.equal(breakdown.regularSetBonuses.activeSets[0]?.tier, 5);
});

test('calculateDamageFromRuleSet prefers configured regular set rules over defaults', () => {
  const bundle = createBundle();
  bundle.equipments = [
    createPrimaryPlaceholderEquipment('eq_weapon', 'weapon', '炎魔神套'),
    createPrimaryPlaceholderEquipment('eq_helmet', 'helmet', '炎魔神套'),
    createPrimaryPlaceholderEquipment('eq_armor', 'armor', '炎魔神套'),
  ];

  const domain = buildSimulatorCharacterDomain(bundle);
  assert.ok(domain);

  const baselineResult = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      skillCode: 'dragon_roll',
      targetCount: 1,
    },
  });

  const ruleSet = createRuleSet();
  ruleSet.equipmentExtensionConfigs = [
    {
      id: 'regular_set_rule_1',
      configKey: 'regular_set_rules',
      label: '常规套装档位规则',
      description: '',
      enabled: true,
      sort: 0,
      value: [
        {
          setName: '*',
          tiers: [
            {
              tier: 3,
              minCount: 3,
              effects: [{ targetKey: 'magic', value: 12 }],
            },
          ],
        },
      ],
    },
  ];

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

  assert.equal(breakdown.regularSetBonuses.attributeSourceBonuses.magic, 12);
  assert.equal(result.panelStats.mp - (baselineResult.panelStats.mp ?? 0), 7);
  assert.ok(
    Math.abs(
      result.panelStats.magicDamage -
        (baselineResult.panelStats.magicDamage ?? 0) -
        1.4
    ) < 1e-9
  );
  assert.ok(
    Math.abs(
      result.panelStats.magicDefense -
        (baselineResult.panelStats.magicDefense ?? 0) -
        1.4
    ) < 1e-9
  );
});

test('calculateDamageFromRuleSet applies ornament set skill damage addends from runtime config', () => {
  const bundle = createBundle();
  bundle.equipments = ['trinket1', 'trinket2', 'trinket3', 'trinket4'].map(
    (slot, index) => ({
      ...bundle.equipments[0]!,
      id: `ornament_damage_${index + 1}`,
      slot,
      snapshotSlot: slot,
      level: 80,
      attrs: [],
      build: {
        ...bundle.equipments[0]!.build!,
        equipmentId: `ornament_damage_${index + 1}`,
        setEffectJson: JSON.stringify({
          setName: '锐不可当',
        }),
        notesJson: '{}',
      },
    })
  );

  const domain = buildSimulatorCharacterDomain(bundle);
  assert.ok(domain);

  const baseline = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      skillCode: 'dragon_roll',
      targetCount: 1,
    },
  });

  const ruleSet = createRuleSet();
  ruleSet.equipmentExtensionConfigs = [
    {
      id: 'ornament_rule_2',
      configKey: 'ornament_set_rules',
      label: '灵饰套装档位规则',
      description: '',
      enabled: true,
      sort: 0,
      value: [
        {
          setName: '锐不可当',
          tiers: [
            {
              tier: 32,
              effects: [
                {
                  type: 'skill_damage_addend',
                  skillCode: 'dragon_roll',
                  sourceKey: 'targetSpeed',
                  modifierType: 'multiplier',
                  value: 0.04,
                  label: '目标速度加成',
                },
              ],
            },
          ],
        },
      ],
    },
  ];

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
  const baselineBreakdown = baseline.targets[0]?.breakdown as Record<string, any>;

  assert.equal(
    breakdown.conditionalDamageAddends.some(
      (item: Record<string, unknown>) =>
        item.sourceType === 'ornament_set' && item.setName === '锐不可当'
    ),
    true
  );
  assert.equal(breakdown.conditionalDamageAddend, 30.4);
  assert.equal(
    result.targets[0]!.damage,
    Math.max(1, Math.round(Number(baselineBreakdown.rawDamage) + 30.4))
  );
});

test('M9-03 目标法防结果会在最终结果阶段固定扣减伤害', () => {
  const bundle = createBundle();
  const domain = buildSimulatorCharacterDomain(bundle);

  assert.ok(domain);

  const baseRequest = {
    skillCode: 'dragon_roll' as const,
    targetCount: 1,
    panelMagicDamageOverride: 2000,
    formationFactor: 1,
    formationCounterState: '无克/普通',
    elementRelation: '无克/普通',
    transformCardFactor: 1,
    damageVarianceFactor: 1,
    shenmuValue: 0,
    magicResult: 30,
    targets: [
      {
        name: '结果减伤木桩',
        magicDefense: 1000,
        magicDefenseCultivation: 20,
      },
    ],
  };

  const baseline = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: baseRequest,
  });
  const reduced = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      ...baseRequest,
      targetMagicDefenseResult: 50,
    },
  });

  const baselineBreakdown = baseline.targets[0]?.breakdown as Record<string, number>;
  const reducedBreakdown = reduced.targets[0]?.breakdown as Record<string, number>;

  assert.equal(reducedBreakdown.targetMagicDefenseResult, 50);
  assert.equal(
    Number((baselineBreakdown.rawDamage - reducedBreakdown.rawDamage).toFixed(2)),
    50
  );
  assert.equal(reduced.targets[0]!.damage, baseline.targets[0]!.damage - 50);
});

test('M9-04 雨天会为龙宫法伤施加 10% 环境补正', () => {
  const bundle = createBundle();
  const domain = buildSimulatorCharacterDomain(bundle);

  assert.ok(domain);

  const baseRequest = {
    skillCode: 'dragon_roll' as const,
    targetCount: 1,
    panelMagicDamageOverride: 2000,
    formationFactor: 1,
    formationCounterState: '无克/普通',
    elementRelation: '无克/普通',
    transformCardFactor: 1,
    damageVarianceFactor: 1,
    shenmuValue: 0,
    magicResult: 0,
    targets: [
      {
        name: '雨战木桩',
        magicDefense: 1000,
        magicDefenseCultivation: 20,
      },
    ],
  };

  const baseline = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: baseRequest,
  });
  const rainy = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      ...baseRequest,
      weather: '雨天',
    },
  });

  const baselineBreakdown = baseline.targets[0]?.breakdown as Record<string, number>;
  const rainyBreakdown = rainy.targets[0]?.breakdown as Record<string, number>;

  assert.equal(rainyBreakdown.weather, '雨天');
  assert.equal(rainyBreakdown.weatherFactor, 1.1);
  assert.equal(
    Number(rainyBreakdown.nonResultDamageBeforeLuohan.toFixed(2)),
    Number((baselineBreakdown.nonResultDamageBeforeMitigation * 1.1).toFixed(2))
  );
  assert.ok(rainy.targets[0]!.damage > baseline.targets[0]!.damage);
});

test('M9-05 目标防御状态不会影响当前龙宫法伤结果', () => {
  const bundle = createBundle();
  const domain = buildSimulatorCharacterDomain(bundle);

  assert.ok(domain);

  const baseRequest = {
    skillCode: 'dragon_roll' as const,
    targetCount: 1,
    panelMagicDamageOverride: 2000,
    formationFactor: 1,
    formationCounterState: '无克/普通',
    elementRelation: '无克/普通',
    transformCardFactor: 1,
    damageVarianceFactor: 1,
    shenmuValue: 0,
    magicResult: 0,
    targets: [
      {
        name: '防御木桩',
        magicDefense: 1000,
        magicDefenseCultivation: 20,
      },
    ],
  };

  const baseline = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: baseRequest,
  });
  const defending = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      ...baseRequest,
      targetDefenseState: '防御',
    },
  });

  const defendingBreakdown = defending.targets[0]?.breakdown as Record<string, number | string>;

  assert.equal(defendingBreakdown.targetDefenseState, '防御');
  assert.equal(defendingBreakdown.targetDefenseFactor, 1);
  assert.equal(defending.targets[0]!.damage, baseline.targets[0]!.damage);
});

test('M9-16 特殊目标法术减伤系数会压低非结果伤害区间', () => {
  const bundle = createBundle();
  const domain = buildSimulatorCharacterDomain(bundle);

  assert.ok(domain);

  const baseRequest = {
    skillCode: 'dragon_roll' as const,
    targetCount: 1,
    panelMagicDamageOverride: 2000,
    formationFactor: 1,
    formationCounterState: '无克/普通',
    elementRelation: '无克/普通',
    transformCardFactor: 1,
    damageVarianceFactor: 1,
    shenmuValue: 0,
    magicResult: 40,
    targets: [
      {
        name: '六星地煞',
        magicDefense: 1000,
        magicDefenseCultivation: 20,
      },
    ],
  };

  const baseline = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: baseRequest,
  });
  const reduced = calculateDamageFromRuleSet({
    bundle,
    domain,
    ruleSet: createRuleSet(),
    request: {
      ...baseRequest,
      specialMagicDamageReductionFactor: 0.6,
    },
  });

  const baselineBreakdown = baseline.targets[0]?.breakdown as Record<string, number>;
  const reducedBreakdown = reduced.targets[0]?.breakdown as Record<string, number>;

  assert.equal(reducedBreakdown.specialMagicDamageReductionFactor, 0.6);
  assert.equal(
    Number(reducedBreakdown.nonResultDamageBeforeLuohan.toFixed(2)),
    Number((baselineBreakdown.nonResultDamageBeforeMitigation * 0.6).toFixed(2))
  );
  assert.ok(reduced.targets[0]!.damage < baseline.targets[0]!.damage);
});
