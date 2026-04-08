import assert from 'node:assert/strict';
import test from 'node:test';

import type { DamageRuleSet } from '@/shared/models/damage-rules';
import type { SimulatorCharacterBundle } from '@/shared/models/simulator';
import { calculateLabValuationFromRuleSet } from '@/shared/services/lab-valuation';

const attributeConversionSeeds: Array<{
  sourceAttr: string;
  targetAttr: string;
  coefficient: number;
  valueType: string;
  sort: number;
}> = [
  {
    sourceAttr: 'baseHp',
    targetAttr: 'hp',
    coefficient: 5,
    valueType: 'linear',
    sort: 10,
  },
  {
    sourceAttr: 'physique',
    targetAttr: 'hp',
    coefficient: 12,
    valueType: 'linear',
    sort: 20,
  },
  {
    sourceAttr: 'endurance',
    targetAttr: 'hp',
    coefficient: 4,
    valueType: 'linear',
    sort: 30,
  },
  {
    sourceAttr: 'magic',
    targetAttr: 'mp',
    coefficient: 1.6,
    valueType: 'linear',
    sort: 40,
  },
  {
    sourceAttr: 'spirit',
    targetAttr: 'mp',
    coefficient: 0.25,
    valueType: 'linear',
    sort: 50,
  },
  {
    sourceAttr: 'magic',
    targetAttr: 'magicDamage',
    coefficient: 5,
    valueType: 'linear',
    sort: 60,
  },
  {
    sourceAttr: 'spirit',
    targetAttr: 'magicDamage',
    coefficient: 1.2,
    valueType: 'linear',
    sort: 70,
  },
  {
    sourceAttr: 'level',
    targetAttr: 'magicDamage',
    coefficient: 3,
    valueType: 'linear',
    sort: 80,
  },
  {
    sourceAttr: 'spirit',
    targetAttr: 'magicDefense',
    coefficient: 0.6,
    valueType: 'linear',
    sort: 90,
  },
  {
    sourceAttr: 'endurance',
    targetAttr: 'magicDefense',
    coefficient: 2,
    valueType: 'linear',
    sort: 100,
  },
  {
    sourceAttr: 'level',
    targetAttr: 'magicDefense',
    coefficient: 2.6,
    valueType: 'linear',
    sort: 110,
  },
  {
    sourceAttr: 'agility',
    targetAttr: 'speed',
    coefficient: 4,
    valueType: 'linear',
    sort: 120,
  },
  {
    sourceAttr: 'level',
    targetAttr: 'speed',
    coefficient: 2,
    valueType: 'linear',
    sort: 130,
  },
  {
    sourceAttr: 'strength',
    targetAttr: 'hit',
    coefficient: 2,
    valueType: 'linear',
    sort: 140,
  },
  {
    sourceAttr: 'level',
    targetAttr: 'hit',
    coefficient: 6,
    valueType: 'linear',
    sort: 150,
  },
  {
    sourceAttr: 'strength',
    targetAttr: 'damage',
    coefficient: 8,
    valueType: 'linear',
    sort: 160,
  },
  {
    sourceAttr: 'level',
    targetAttr: 'damage',
    coefficient: 6,
    valueType: 'linear',
    sort: 170,
  },
  {
    sourceAttr: 'endurance',
    targetAttr: 'defense',
    coefficient: 4,
    valueType: 'linear',
    sort: 180,
  },
  {
    sourceAttr: 'physique',
    targetAttr: 'defense',
    coefficient: 2,
    valueType: 'linear',
    sort: 190,
  },
  {
    sourceAttr: 'level',
    targetAttr: 'defense',
    coefficient: 3,
    valueType: 'linear',
    sort: 200,
  },
  {
    sourceAttr: 'agility',
    targetAttr: 'dodge',
    coefficient: 2,
    valueType: 'linear',
    sort: 210,
  },
  {
    sourceAttr: 'level',
    targetAttr: 'dodge',
    coefficient: 0.8,
    valueType: 'floor_linear',
    sort: 220,
  },
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
  assert.equal(result.seats[0]?.panelStats.magicDamage, 2429);
  assert.equal(result.seats[1]?.panelStats.magicDamage, 2459);
  assert.ok(
    (result.seats[1]?.totalDamage ?? 0) > (result.seats[0]?.totalDamage ?? 0)
  );
  assert.equal(result.seats[1]?.comparison.priceDiff, 200);
  assert.ok((result.seats[1]?.comparison.damageDiff ?? 0) > 0);
  assert.ok((result.seats[1]?.comparison.costPerDamage ?? 0) > 0);
  assert.match(result.seats[1]?.comparison.costLabel ?? '', /^¥ /);
});
