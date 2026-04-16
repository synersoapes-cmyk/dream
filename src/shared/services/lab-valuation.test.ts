import assert from 'node:assert/strict';
import test from 'node:test';

import type { DamageRuleSet } from '@/shared/models/damage-rules';
import type { SimulatorCharacterBundle } from '@/shared/models/simulator-types';
import { calculateLabValuationFromRuleSet } from '@/shared/services/lab-valuation';

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
        baseHp: 716,
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
      splitTargetCount: 1,
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
    equipments: [],
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
          小克: 1.1,
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

test('calculateLabValuationFromRuleSet uses service-side damage results for seat comparison', () => {
  const result = calculateLabValuationFromRuleSet({
    bundle: createBundle(),
    ruleSet: createRuleSet(),
    request: {
      baseAttributes: {
        level: 109,
        hp: 716,
        magic: 230,
        physique: 40,
        magicPower: 610,
        strength: 15,
        endurance: 35,
        agility: 20,
        faction: '龙宫',
      },
      combatStats: {
        hp: 4200,
        magic: 2100,
        hit: 980,
        damage: 900,
        magicDamage: 1800,
        defense: 1100,
        magicDefense: 1350,
        speed: 520,
        dodge: 205,
      },
      target: {
        name: '默认目标',
        magicDefense: 1250,
        magicDefenseCultivation: 12,
      },
      skillName: '龙卷雨击',
      targetCount: 1,
      seats: [
        {
          seatId: 'sample',
          seatName: '样本席位',
          isSample: true,
          totalPrice: 1000,
          equipment: [
            {
              id: 'eq_sample',
              name: '样本武器',
              type: 'weapon',
              price: 1000,
              stats: {
                magicDamage: 220,
              },
            },
          ],
        },
        {
          seatId: 'compare',
          seatName: '对比席位1',
          totalPrice: 1200,
          equipment: [
            {
              id: 'eq_compare',
              name: '对比武器',
              type: 'weapon',
              price: 1200,
              stats: {
                magicDamage: 220,
              },
              activeRuneStoneSet: 0,
              runeStoneSets: [
                [
                  {
                    id: 'rs_1',
                    type: 'black',
                    stats: {
                      magicDamage: 30,
                    },
                  },
                ],
              ],
            },
          ],
        },
      ],
    },
  });

  assert.equal(result.sampleSeatId, 'sample');
  assert.equal(result.seats[0]?.panelStats.magicDamage, 1003);
  assert.equal(result.seats[1]?.panelStats.magicDamage, 1033);
  assert.ok(
    (result.seats[1]?.totalDamage ?? 0) > (result.seats[0]?.totalDamage ?? 0)
  );
  assert.equal(result.seats[1]?.comparison.priceDiff, 200);
  assert.ok((result.seats[1]?.comparison.damageDiff ?? 0) > 0);
  assert.ok((result.seats[1]?.comparison.damageGainPercent ?? 0) > 0);
  assert.ok((result.seats[1]?.comparison.costPerDamage ?? 0) > 0);
  assert.match(result.seats[1]?.comparison.costLabel ?? '', /^¥ /);
  assert.equal(result.seats[1]?.comparison.magicDamageDiff, 30);
  assert.ok((result.seats[1]?.comparison.costPerMagicDamage ?? 0) > 0);
  assert.equal(
    result.seats[1]?.comparison.magicDamageCostLabel,
    '¥ 6.7 / 点法伤'
  );
  assert.equal(result.seats[1]?.comparison.marginalWarning, null);
});

test('calculateLabValuationFromRuleSet supports dragon_teng service-side valuation', () => {
  const result = calculateLabValuationFromRuleSet({
    bundle: createBundle(),
    ruleSet: createRuleSet(),
    request: {
      baseAttributes: {
        level: 109,
        hp: 716,
        magic: 230,
        physique: 40,
        magicPower: 610,
        strength: 15,
        endurance: 35,
        agility: 20,
        faction: '龙宫',
      },
      combatStats: {
        hp: 4200,
        magic: 2100,
        hit: 980,
        damage: 900,
        magicDamage: 1800,
        defense: 1100,
        magicDefense: 1350,
        speed: 520,
        dodge: 205,
      },
      target: {
        name: '默认目标',
        magicDefense: 1250,
        magicDefenseCultivation: 12,
      },
      skillName: '龙腾',
      targetCount: 1,
      seats: [
        {
          seatId: 'sample',
          seatName: '样本席位',
          isSample: true,
          totalPrice: 1000,
          equipment: [
            {
              id: 'eq_sample',
              name: '样本武器',
              type: 'weapon',
              price: 1000,
              stats: {
                magicDamage: 220,
              },
            },
          ],
        },
      ],
    },
  });

  assert.equal(result.skill.skillCode, 'dragon_teng');
  assert.equal(result.skill.skillName, '龙腾');
  assert.equal(result.sampleSeatId, 'sample');
  assert.equal(
    result.seats[0]?.totalDamage,
    result.seats[0]?.singleTargetDamage
  );
});

test('calculateLabValuationFromRuleSet applies jade spell ignore percent in seat comparison', () => {
  const result = calculateLabValuationFromRuleSet({
    bundle: createBundle(),
    ruleSet: createRuleSet(),
    request: {
      baseAttributes: {
        level: 109,
        hp: 716,
        magic: 230,
        physique: 40,
        magicPower: 610,
        strength: 15,
        endurance: 35,
        agility: 20,
        faction: '龙宫',
      },
      combatStats: {
        hp: 4200,
        magic: 2100,
        hit: 980,
        damage: 900,
        magicDamage: 1800,
        defense: 1100,
        magicDefense: 1350,
        speed: 520,
        dodge: 205,
      },
      target: {
        name: '默认目标',
        magicDefense: 1250,
        magicDefenseCultivation: 12,
      },
      skillName: '龙卷雨击',
      targetCount: 1,
      seats: [
        {
          seatId: 'sample',
          seatName: '样本席位',
          isSample: true,
          totalPrice: 1000,
          equipment: [
            {
              id: 'eq_sample',
              name: '样本武器',
              type: 'weapon',
              price: 1000,
              stats: {
                magicDamage: 220,
              },
            },
          ],
        },
        {
          seatId: 'compare_1',
          seatName: '法穿玉魄席位',
          isSample: false,
          totalPrice: 1300,
          equipment: [
            {
              id: 'eq_sample',
              name: '样本武器',
              type: 'weapon',
              price: 1000,
              stats: {
                magicDamage: 220,
              },
            },
            {
              id: 'jade_compare',
              name: '阳玉·法穿',
              type: 'jade',
              slot: 1,
              price: 300,
              stats: {},
              specialEffect: '法术忽视 5%',
              effectModifiers: [
                {
                  code: 'spell_ignore_percent',
                  value: 0.05,
                  label: '法术忽视 5%',
                },
              ],
            },
          ],
        },
      ],
    },
  });

  assert.equal(result.sampleSeatId, 'sample');
  assert.equal(result.seats[0]?.seatId, 'sample');
  assert.equal(result.seats[1]?.seatId, 'compare_1');
  assert.ok(
    (result.seats[1]?.totalDamage ?? 0) > (result.seats[0]?.totalDamage ?? 0)
  );
  assert.ok((result.seats[1]?.comparison.damageDiff ?? 0) > 0);
});

test('calculateLabValuationFromRuleSet applies jade spell damage percent in seat comparison', () => {
  const result = calculateLabValuationFromRuleSet({
    bundle: createBundle(),
    ruleSet: createRuleSet(),
    request: {
      baseAttributes: {
        level: 109,
        hp: 716,
        magic: 230,
        physique: 40,
        magicPower: 610,
        strength: 15,
        endurance: 35,
        agility: 20,
        faction: '龙宫',
      },
      combatStats: {
        hp: 4200,
        magic: 2100,
        hit: 980,
        damage: 900,
        magicDamage: 1800,
        defense: 1100,
        magicDefense: 1350,
        speed: 520,
        dodge: 205,
      },
      target: {
        name: '默认目标',
        magicDefense: 1250,
        magicDefenseCultivation: 12,
      },
      skillName: '龙卷雨击',
      targetCount: 1,
      seats: [
        {
          seatId: 'sample',
          seatName: '样本席位',
          isSample: true,
          totalPrice: 1000,
          equipment: [
            {
              id: 'eq_sample',
              name: '样本武器',
              type: 'weapon',
              price: 1000,
              stats: {
                magicDamage: 220,
              },
            },
          ],
        },
        {
          seatId: 'compare_1',
          seatName: '法伤玉魄席位',
          isSample: false,
          totalPrice: 1400,
          equipment: [
            {
              id: 'eq_sample',
              name: '样本武器',
              type: 'weapon',
              price: 1000,
              stats: {
                magicDamage: 220,
              },
            },
            {
              id: 'jade_compare',
              name: '阳玉·法伤',
              type: 'jade',
              slot: 1,
              price: 400,
              stats: {},
              specialEffect: '基础法术伤害 +1.5%',
              effectModifiers: [
                {
                  code: 'spell_damage_percent',
                  value: 0.015,
                  label: '基础法术伤害 +1.5%',
                },
              ],
            },
          ],
        },
      ],
    },
  });

  assert.equal(result.sampleSeatId, 'sample');
  assert.equal(result.seats[0]?.seatId, 'sample');
  assert.equal(result.seats[1]?.seatId, 'compare_1');
  assert.ok(
    (result.seats[1]?.totalDamage ?? 0) > (result.seats[0]?.totalDamage ?? 0)
  );
  assert.ok((result.seats[1]?.comparison.damageDiff ?? 0) > 0);
});

test('calculateLabValuationFromRuleSet fallback total price includes cross-server fee', () => {
  const result = calculateLabValuationFromRuleSet({
    bundle: createBundle(),
    ruleSet: createRuleSet(),
    request: {
      baseAttributes: {
        level: 109,
        hp: 716,
        magic: 230,
        physique: 40,
        magicPower: 610,
        strength: 15,
        endurance: 35,
        agility: 20,
        faction: '龙宫',
      },
      combatStats: {
        hp: 4200,
        magic: 2100,
        hit: 980,
        damage: 900,
        magicDamage: 1800,
        defense: 1100,
        magicDefense: 1350,
        speed: 520,
        dodge: 205,
      },
      target: {
        name: '默认目标',
        magicDefense: 1250,
        magicDefenseCultivation: 12,
      },
      skillName: '龙卷雨击',
      targetCount: 1,
      seats: [
        {
          seatId: 'sample',
          seatName: '样本席位',
          isSample: true,
          equipment: [
            {
              id: 'eq_sample',
              name: '样本武器',
              type: 'weapon',
              price: 1000,
              crossServerFee: 300,
              stats: {
                magicDamage: 220,
              },
            },
          ],
        },
        {
          seatId: 'compare',
          seatName: '对比席位1',
          equipment: [
            {
              id: 'eq_compare',
              name: '对比武器',
              type: 'weapon',
              price: 1200,
              crossServerFee: 500,
              stats: {
                magicDamage: 220,
              },
            },
          ],
        },
      ],
    },
  });

  assert.equal(result.seats[0]?.totalPrice, 1300);
  assert.equal(result.seats[1]?.totalPrice, 1700);
  assert.equal(result.seats[1]?.comparison.priceDiff, 400);
});

test('calculateLabValuationFromRuleSet inherits battle context formation and element inputs', () => {
  const sampleSeat = {
    seatId: 'sample',
    seatName: '样本席位',
    isSample: true,
    totalPrice: 1000,
    equipment: [
      {
        id: 'eq_sample',
        name: '样本武器',
        type: 'weapon',
        price: 1000,
        stats: {
          magicDamage: 220,
        },
      },
    ],
  };

  const baselineResult = calculateLabValuationFromRuleSet({
    bundle: createBundle(),
    ruleSet: createRuleSet(),
    request: {
      baseAttributes: {
        level: 109,
        hp: 716,
        magic: 230,
        physique: 40,
        magicPower: 610,
        strength: 15,
        endurance: 35,
        agility: 20,
        faction: '龙宫',
      },
      combatStats: {
        hp: 4200,
        magic: 2100,
        hit: 980,
        damage: 900,
        magicDamage: 1800,
        defense: 1100,
        magicDefense: 1350,
        speed: 520,
        dodge: 205,
      },
      battleContext: {
        selfFormation: '天覆阵',
        selfElement: '水',
        transformCardFactor: 1,
        shenmuValue: 18,
        magicResult: 42,
        targetMagicDefenseCultivation: 12,
      },
      target: {
        name: '默认目标',
        magicDefense: 1250,
        magicDefenseCultivation: 12,
        element: '火',
        formation: '普通阵',
      },
      skillName: '龙卷雨击',
      targetCount: 1,
      seats: [sampleSeat],
    },
  });

  const derivedContextResult = calculateLabValuationFromRuleSet({
    bundle: createBundle(),
    ruleSet: createRuleSet(),
    request: {
      baseAttributes: {
        level: 109,
        hp: 716,
        magic: 230,
        physique: 40,
        magicPower: 610,
        strength: 15,
        endurance: 35,
        agility: 20,
        faction: '龙宫',
      },
      combatStats: {
        hp: 4200,
        magic: 2100,
        hit: 980,
        damage: 900,
        magicDamage: 1800,
        defense: 1100,
        magicDefense: 1350,
        speed: 520,
        dodge: 205,
      },
      battleContext: {
        selfFormation: '风扬阵',
        selfElement: '火',
        transformCardFactor: 1,
        shenmuValue: 18,
        magicResult: 42,
        targetMagicDefenseCultivation: 12,
      },
      target: {
        name: '默认目标',
        magicDefense: 1250,
        magicDefenseCultivation: 12,
        element: '水',
        formation: '天覆阵',
      },
      skillName: '龙卷雨击',
      targetCount: 1,
      seats: [sampleSeat],
    },
  });

  assert.ok(
    (baselineResult.seats[0]?.totalDamage ?? 0) >
      (derivedContextResult.seats[0]?.totalDamage ?? 0)
  );
  assert.notEqual(
    baselineResult.seats[0]?.totalDamage,
    derivedContextResult.seats[0]?.totalDamage
  );
});
