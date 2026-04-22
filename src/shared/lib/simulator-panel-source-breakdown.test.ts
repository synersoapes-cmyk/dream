import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  BaseAttributes,
  Equipment,
  MeridianConfig,
  SyncedCloudState,
} from '@/features/simulator/store/gameTypes';

import {
  buildPanelSourceBreakdownSummary,
  buildPanelSourceDeltaSummary,
  buildSimulatorPanelSourceBreakdowns,
  buildSimulatorPanelSourceDeltaBreakdowns,
  type PanelSourceBreakdownItem,
} from '@/shared/lib/simulator-panel-source-breakdown';

const baseAttributes: BaseAttributes = {
  level: 0,
  hp: 0,
  magic: 100,
  potentialPoints: 0,
  physique: 0,
  magicPower: 0,
  strength: 0,
  endurance: 0,
  agility: 0,
  faction: '龙宫',
};

const zeroMeridian: MeridianConfig = {
  physique: 0,
  magic: 0,
  strength: 0,
  endurance: 0,
  agility: 0,
  magicPower: 0,
};

function createWeapon(id: string, magicDamage: number): Equipment {
  return {
    id,
    name: id,
    type: 'weapon',
    mainStat: `法伤 +${magicDamage}`,
    baseStats: { magicDamage },
    stats: { magicDamage },
  };
}

test('buildSimulatorPanelSourceBreakdowns separates equipment meridian and artifact deltas on top of OCR baseline', () => {
  const syncedCloudState: SyncedCloudState = {
    currentCharacter: {
      id: 'char_1',
      name: '测试龙宫',
      school: '龙宫',
      level: 89,
    },
    baseAttributes,
    combatStats: {
      hp: 3850,
      magic: 2200,
      hit: 990,
      damage: 0,
      magicDamage: 1460,
      defense: 920,
      magicDefense: 1180,
      speed: 540,
      dodge: 180,
      spiritualPower: 1180,
    },
    equipment: [createWeapon('baseline_weapon', 120)],
    equipmentSets: [],
    activeSetIndex: 0,
    skills: [],
    cultivation: {
      bodyStrength: 0,
      physicalAttack: 0,
      physicalDefense: 0,
      magicAttack: 0,
      magicDefense: 0,
      petPhysicalAttack: 0,
      petPhysicalDefense: 0,
      petMagicAttack: 0,
      petMagicDefense: 0,
    },
    meridian: zeroMeridian,
    treasure: null,
    combatTarget: {
      name: '手动目标1',
      level: 0,
      hp: 0,
      defense: 0,
      magicDefense: 0,
      speed: 0,
      element: '水',
      formation: '普通阵',
    },
    formation: '普通阵',
    playerSetup: {
      level: 0,
      faction: '龙宫',
      baseStats: baseAttributes,
      equipment: [createWeapon('baseline_weapon', 120)],
      skills: [],
      cultivation: {
        bodyStrength: 0,
        physicalAttack: 0,
        physicalDefense: 0,
        magicAttack: 0,
        magicDefense: 0,
        petPhysicalAttack: 0,
        petPhysicalDefense: 0,
        petMagicAttack: 0,
        petMagicDefense: 0,
      },
      meridian: zeroMeridian,
      element: '水',
      formation: '普通阵',
    },
    battleContext: {
      selfFormation: '普通阵',
      selfElement: '水',
      formationCounterState: '无克/普通',
      elementRelation: '无克/普通',
      weather: '',
      transformCardFactor: 1,
      splitTargetCount: 1,
      shenmuValue: 0,
      magicResult: 0,
      targetMagicDefenseResult: 0,
      targetMagicDefenseCultivation: 0,
      targetDefenseState: '',
      specialMagicDamageReductionFactor: 1,
      targetFormation: '普通阵',
    },
  };

  const result = buildSimulatorPanelSourceBreakdowns({
    baseAttributes,
    equipment: [createWeapon('upgraded_weapon', 220)],
    treasure: {
      id: 'artifact_1',
      name: '阳玉法伤',
      type: '法宝',
      level: 0,
      tier: 1,
      stats: {
        magicDamage: 24,
      },
      description: '法伤 +24',
      isActive: true,
    },
    bodyStrength: 0,
    formation: '普通阵',
    meridian: {
      ...zeroMeridian,
      magic: 10,
    },
    syncedCloudState,
  });

  const magicDamage = result.find((item) => item.key === 'magicDamage');
  const spiritualPower = result.find((item) => item.key === 'spiritualPower');

  assert.ok(magicDamage);
  assert.equal(magicDamage?.baseline, 1460);
  assert.equal(magicDamage?.total, 1591);
  assert.deepEqual(magicDamage?.sources, [
    { label: '装备/符石', value: 100 },
    { label: '经脉', value: 7 },
    { label: '神器', value: 24 },
  ]);
  assert.deepEqual(magicDamage?.sourceDetails, [
    {
      label: '装备底子',
      items: [
        {
          label: '武器·upgraded_weapon',
          value: 100,
          note: '含武器伤害/4转法伤',
        },
      ],
    },
    {
      label: '经脉',
      items: [
        {
          label: '经脉魔力',
          value: 7,
          note: '经脉魔力按 0.7 灵力折算',
        },
      ],
    },
    {
      label: '神器',
      items: [
        {
          label: '阳玉法伤',
          value: 24,
          note: '神器当前按手动录入单属性直接计入',
        },
      ],
    },
  ]);

  assert.ok(spiritualPower);
  assert.equal(spiritualPower?.baseline, 1180);
  assert.equal(spiritualPower?.total, 1187);
  assert.deepEqual(spiritualPower?.sources, [{ label: '经脉', value: 7 }]);
  assert.deepEqual(spiritualPower?.sourceDetails, [
    {
      label: '经脉',
      items: [
        {
          label: '经脉魔力',
          value: 7,
          note: '经脉魔力按 0.7 灵力折算',
        },
      ],
    },
  ]);
});

test('buildSimulatorPanelSourceBreakdowns supports magic crit fixed damage pierce and hit source tracing', () => {
  const syncedCloudState: SyncedCloudState = {
    currentCharacter: {
      id: 'char_crit',
      name: '测试龙宫',
      school: '龙宫',
      level: 89,
    },
    baseAttributes,
    combatStats: {
      hp: 3850,
      magic: 2200,
      hit: 990,
      damage: 0,
      magicDamage: 1460,
      defense: 920,
      magicDefense: 1180,
      speed: 540,
      dodge: 180,
      spiritualPower: 1180,
      magicCritLevel: 0,
      fixedDamage: 0,
      pierceLevel: 0,
    },
    equipment: [],
    equipmentSets: [],
    activeSetIndex: 0,
    skills: [],
    cultivation: {
      bodyStrength: 0,
      physicalAttack: 0,
      physicalDefense: 0,
      magicAttack: 0,
      magicDefense: 0,
      petPhysicalAttack: 0,
      petPhysicalDefense: 0,
      petMagicAttack: 0,
      petMagicDefense: 0,
    },
    meridian: zeroMeridian,
    treasure: null,
    combatTarget: {
      name: '手动目标1',
      level: 0,
      hp: 0,
      defense: 0,
      magicDefense: 0,
      speed: 0,
      element: '水',
      formation: '普通阵',
    },
    formation: '普通阵',
    playerSetup: {
      level: 0,
      faction: '龙宫',
      baseStats: baseAttributes,
      equipment: [],
      skills: [],
      cultivation: {
        bodyStrength: 0,
        physicalAttack: 0,
        physicalDefense: 0,
        magicAttack: 0,
        magicDefense: 0,
        petPhysicalAttack: 0,
        petPhysicalDefense: 0,
        petMagicAttack: 0,
        petMagicDefense: 0,
      },
      meridian: zeroMeridian,
      element: '水',
      formation: '普通阵',
    },
    battleContext: {
      selfFormation: '普通阵',
      selfElement: '水',
      formationCounterState: '无克/普通',
      elementRelation: '无克/普通',
      weather: '',
      transformCardFactor: 1,
      splitTargetCount: 1,
      shenmuValue: 0,
      magicResult: 0,
      targetMagicDefenseResult: 0,
      targetMagicDefenseCultivation: 0,
      targetDefenseState: '',
      specialMagicDamageReductionFactor: 1,
      targetFormation: '普通阵',
    },
  };

  const result = buildSimulatorPanelSourceBreakdowns({
    baseAttributes: {
      ...baseAttributes,
      strength: 10,
    },
    equipment: [
      {
        id: 'special_weapon',
        name: '特殊武器',
        type: 'weapon',
        mainStat: '命中 +20',
        baseStats: {
          hit: 20,
          magicCritLevel: 38,
          fixedDamage: 15,
          pierceLevel: 12,
        },
        stats: {
          hit: 20,
          magicCritLevel: 38,
          fixedDamage: 15,
          pierceLevel: 12,
        },
      },
    ],
    treasure: null,
    bodyStrength: 0,
    formation: '普通阵',
    meridian: zeroMeridian,
    syncedCloudState,
  });

  assert.deepEqual(
    result.find((item) => item.key === 'magicCritLevel')?.sources,
    [{ label: '装备/符石', value: 38 }]
  );
  assert.deepEqual(
    result.find((item) => item.key === 'magicCritLevel')?.sourceDetails,
    [
      {
        label: '装备底子',
        items: [{ label: '武器·特殊武器', value: 38 }],
      },
    ]
  );
  assert.deepEqual(result.find((item) => item.key === 'fixedDamage')?.sources, [
    { label: '装备/符石', value: 15 },
  ]);
  assert.deepEqual(result.find((item) => item.key === 'pierceLevel')?.sources, [
    { label: '装备/符石', value: 12 },
  ]);
  assert.deepEqual(result.find((item) => item.key === 'hit')?.sources, [
    { label: '加点/档案', value: 17 },
    { label: '装备/符石', value: 20 },
  ]);
  assert.deepEqual(result.find((item) => item.key === 'hit')?.sourceDetails, [
    {
      label: '加点/档案',
      items: [
        {
          label: '力量',
          value: 17,
          note: '仙族力量按 1.7 命中折算',
        },
      ],
    },
    {
      label: '装备底子',
      items: [
        {
          label: '武器·特殊武器',
          value: 20,
          note: '命中直接计入面板',
        },
      ],
    },
  ]);
});

test('buildSimulatorPanelSourceBreakdowns separates equipment base gemstone and rune details', () => {
  const syncedCloudState: SyncedCloudState = {
    currentCharacter: {
      id: 'char_split',
      name: '测试龙宫',
      school: '龙宫',
      level: 89,
    },
    baseAttributes,
    combatStats: {
      hp: 3850,
      magic: 2200,
      hit: 990,
      damage: 0,
      magicDamage: 1460,
      defense: 920,
      magicDefense: 1180,
      speed: 540,
      dodge: 180,
      spiritualPower: 1180,
    },
    equipment: [
      {
        id: 'baseline_split_weapon',
        name: '基础武器',
        type: 'weapon',
        mainStat: '伤害 +400',
        baseStats: { magicDamage: 80 },
        stats: { magicDamage: 80 },
      },
    ],
    equipmentSets: [],
    activeSetIndex: 0,
    skills: [],
    cultivation: {
      bodyStrength: 0,
      physicalAttack: 0,
      physicalDefense: 0,
      magicAttack: 0,
      magicDefense: 0,
      petPhysicalAttack: 0,
      petPhysicalDefense: 0,
      petMagicAttack: 0,
      petMagicDefense: 0,
    },
    meridian: zeroMeridian,
    treasure: null,
    combatTarget: {
      name: '手动目标1',
      level: 0,
      hp: 0,
      defense: 0,
      magicDefense: 0,
      speed: 0,
      element: '水',
      formation: '普通阵',
    },
    formation: '普通阵',
    playerSetup: {
      level: 0,
      faction: '龙宫',
      baseStats: baseAttributes,
      equipment: [
        {
          id: 'baseline_split_weapon',
          name: '基础武器',
          type: 'weapon',
          mainStat: '伤害 +400',
          baseStats: { magicDamage: 80 },
          stats: { magicDamage: 80 },
        },
      ],
      skills: [],
      cultivation: {
        bodyStrength: 0,
        physicalAttack: 0,
        physicalDefense: 0,
        magicAttack: 0,
        magicDefense: 0,
        petPhysicalAttack: 0,
        petPhysicalDefense: 0,
        petMagicAttack: 0,
        petMagicDefense: 0,
      },
      meridian: zeroMeridian,
      element: '水',
      formation: '普通阵',
    },
    battleContext: {
      selfFormation: '普通阵',
      selfElement: '水',
      formationCounterState: '无克/普通',
      elementRelation: '无克/普通',
      weather: '',
      transformCardFactor: 1,
      splitTargetCount: 1,
      shenmuValue: 0,
      magicResult: 0,
      targetMagicDefenseResult: 0,
      targetMagicDefenseCultivation: 0,
      targetDefenseState: '',
      specialMagicDamageReductionFactor: 1,
      targetFormation: '普通阵',
    },
  };

  const result = buildSimulatorPanelSourceBreakdowns({
    baseAttributes,
    equipment: [
      {
        id: 'split_weapon',
        name: '拆分武器',
        type: 'weapon',
        mainStat: '伤害 +500',
        baseStats: { magicDamage: 100 },
        stats: { magicDamage: 100 },
        gemstones: [
          {
            id: 'gem_1',
            name: '舍利子',
            type: '舍利子',
            level: 10,
            quantity: 1,
            stats: { magicDamage: 12 },
          },
        ],
        runeStoneSets: [
          [
            {
              id: 'rune_1',
              type: 'red',
              stats: { magicDamage: 18 },
            },
          ],
        ],
        activeRuneStoneSet: 0,
      },
    ],
    treasure: null,
    bodyStrength: 0,
    formation: '普通阵',
    meridian: zeroMeridian,
    syncedCloudState,
  });

  assert.deepEqual(
    result.find((item) => item.key === 'magicDamage')?.sourceDetails,
    [
      {
        label: '装备底子',
        items: [
          {
            label: '武器·拆分武器',
            value: 20,
            note: '含武器伤害/4转法伤',
          },
        ],
      },
      {
        label: '宝石',
        items: [
          {
            label: '武器·拆分武器',
            value: 12,
            note: '直接计入法伤',
          },
        ],
      },
      {
        label: '符石',
        items: [
          {
            label: '武器·拆分武器',
            value: 18,
            note: '直接计入法伤',
          },
        ],
      },
    ]
  );
});

test('buildPanelSourceBreakdownSummary prioritizes the strongest source text', () => {
  const item: PanelSourceBreakdownItem = {
    key: 'magicDamage',
    label: '法伤',
    total: 1591,
    baseline: 1460,
    delta: 131,
    sources: [
      { label: '经脉', value: 7 },
      { label: '装备/符石', value: 100 },
      { label: '神器', value: 24 },
    ],
    sourceDetails: [],
    hasBaseline: true,
  };

  assert.equal(
    buildPanelSourceBreakdownSummary(item, 2),
    '主因 装备/符石 +100 · 次因 神器 +24'
  );
});

test('buildPanelSourceBreakdownSummary returns null when there are no source deltas', () => {
  const item: PanelSourceBreakdownItem = {
    key: 'magicDamage',
    label: '法伤',
    total: 1460,
    baseline: 1460,
    delta: 0,
    sources: [],
    sourceDetails: [],
    hasBaseline: true,
  };

  assert.equal(buildPanelSourceBreakdownSummary(item, 2), null);
});

test('buildSimulatorPanelSourceDeltaBreakdowns compares seat deltas against sample deltas', () => {
  const sample = buildSimulatorPanelSourceBreakdowns({
    baseAttributes,
    equipment: [createWeapon('sample_weapon', 160)],
    treasure: null,
    bodyStrength: 0,
    formation: '普通阵',
    meridian: zeroMeridian,
    syncedCloudState: {
      currentCharacter: {
        id: 'char_2',
        name: '测试龙宫',
        school: '龙宫',
        level: 89,
      },
      baseAttributes,
      combatStats: {
        hp: 3850,
        magic: 2200,
        hit: 990,
        damage: 0,
        magicDamage: 1460,
        defense: 920,
        magicDefense: 1180,
        speed: 540,
        dodge: 180,
        spiritualPower: 1180,
      },
      equipment: [createWeapon('baseline_weapon', 120)],
      equipmentSets: [],
      activeSetIndex: 0,
      skills: [],
      cultivation: {
        bodyStrength: 0,
        physicalAttack: 0,
        physicalDefense: 0,
        magicAttack: 0,
        magicDefense: 0,
        petPhysicalAttack: 0,
        petPhysicalDefense: 0,
        petMagicAttack: 0,
        petMagicDefense: 0,
      },
      meridian: zeroMeridian,
      treasure: null,
      combatTarget: {
        name: '手动目标1',
        level: 0,
        hp: 0,
        defense: 0,
        magicDefense: 0,
        speed: 0,
        element: '水',
        formation: '普通阵',
      },
      formation: '普通阵',
      playerSetup: {
        level: 0,
        faction: '龙宫',
        baseStats: baseAttributes,
        equipment: [createWeapon('baseline_weapon', 120)],
        skills: [],
        cultivation: {
          bodyStrength: 0,
          physicalAttack: 0,
          physicalDefense: 0,
          magicAttack: 0,
          magicDefense: 0,
          petPhysicalAttack: 0,
          petPhysicalDefense: 0,
          petMagicAttack: 0,
          petMagicDefense: 0,
        },
        meridian: zeroMeridian,
        element: '水',
        formation: '普通阵',
      },
      battleContext: {
        selfFormation: '普通阵',
        selfElement: '水',
        formationCounterState: '无克/普通',
        elementRelation: '无克/普通',
        weather: '',
        transformCardFactor: 1,
        splitTargetCount: 1,
        shenmuValue: 0,
        magicResult: 0,
        targetMagicDefenseResult: 0,
        targetMagicDefenseCultivation: 0,
        targetDefenseState: '',
        specialMagicDamageReductionFactor: 1,
        targetFormation: '普通阵',
      },
    },
  });

  const seat = buildSimulatorPanelSourceBreakdowns({
    baseAttributes,
    equipment: [createWeapon('seat_weapon', 220)],
    treasure: {
      id: 'artifact_2',
      name: '阳玉法伤',
      type: '法宝',
      level: 0,
      tier: 1,
      stats: {
        magicDamage: 24,
      },
      description: '法伤 +24',
      isActive: true,
    },
    bodyStrength: 0,
    formation: '普通阵',
    meridian: zeroMeridian,
    syncedCloudState: sample[0]
      ? ({
          currentCharacter: {
            id: 'char_2',
            name: '测试龙宫',
            school: '龙宫',
            level: 89,
          },
          baseAttributes,
          combatStats: {
            hp: 3850,
            magic: 2200,
            hit: 990,
            damage: 0,
            magicDamage: 1460,
            defense: 920,
            magicDefense: 1180,
            speed: 540,
            dodge: 180,
            spiritualPower: 1180,
          },
          equipment: [createWeapon('baseline_weapon', 120)],
          equipmentSets: [],
          activeSetIndex: 0,
          skills: [],
          cultivation: {
            bodyStrength: 0,
            physicalAttack: 0,
            physicalDefense: 0,
            magicAttack: 0,
            magicDefense: 0,
            petPhysicalAttack: 0,
            petPhysicalDefense: 0,
            petMagicAttack: 0,
            petMagicDefense: 0,
          },
          meridian: zeroMeridian,
          treasure: null,
          combatTarget: {
            name: '手动目标1',
            level: 0,
            hp: 0,
            defense: 0,
            magicDefense: 0,
            speed: 0,
            element: '水',
            formation: '普通阵',
          },
          formation: '普通阵',
          playerSetup: {
            level: 0,
            faction: '龙宫',
            baseStats: baseAttributes,
            equipment: [createWeapon('baseline_weapon', 120)],
            skills: [],
            cultivation: {
              bodyStrength: 0,
              physicalAttack: 0,
              physicalDefense: 0,
              magicAttack: 0,
              magicDefense: 0,
              petPhysicalAttack: 0,
              petPhysicalDefense: 0,
              petMagicAttack: 0,
              petMagicDefense: 0,
            },
            meridian: zeroMeridian,
            element: '水',
            formation: '普通阵',
          },
          battleContext: {
            selfFormation: '普通阵',
            selfElement: '水',
            formationCounterState: '无克/普通',
            elementRelation: '无克/普通',
            weather: '',
            transformCardFactor: 1,
            splitTargetCount: 1,
            shenmuValue: 0,
            magicResult: 0,
            targetMagicDefenseResult: 0,
            targetMagicDefenseCultivation: 0,
            targetDefenseState: '',
            specialMagicDamageReductionFactor: 1,
            targetFormation: '普通阵',
          },
        } satisfies SyncedCloudState)
      : undefined,
  });

  const result = buildSimulatorPanelSourceDeltaBreakdowns(sample, seat);
  const magicDamage = result.find((item) => item.key === 'magicDamage');

  assert.ok(magicDamage);
  assert.equal(magicDamage?.totalDiff, 84);
  assert.deepEqual(magicDamage?.sourceDiffs, [
    { label: '装备/符石', value: 60 },
    { label: '神器', value: 24 },
  ]);
  assert.deepEqual(magicDamage?.sourceDetailDiffs, [
    {
      label: '装备底子',
      items: [
        { label: '武器·seat_weapon', value: 100 },
        { label: '武器·sample_weapon', value: -40 },
      ],
    },
    {
      label: '神器',
      items: [{ label: '阳玉法伤', value: 24 }],
    },
  ]);
  assert.equal(
    buildPanelSourceDeltaSummary(magicDamage!, 2),
    '主因 装备/符石 +60 · 次因 神器 +24'
  );
});
