import assert from 'node:assert/strict';
import test from 'node:test';

import type { Equipment, Skill } from '@/features/simulator/store/gameTypes';

import {
  getSkillTargetCountOptions,
  resolveJiulongPanelSpiritDelta,
  resolveLaboratorySkillLevels,
} from './simulator-rune-skill';

const baseSkills: Skill[] = [
  {
    name: '龙卷雨击',
    level: 149,
    baseLevel: 149,
    extraLevel: 0,
    finalLevel: 149,
    type: 'magic',
    targets: 6,
  },
  {
    name: '龙腾',
    level: 140,
    baseLevel: 140,
    extraLevel: 0,
    finalLevel: 140,
    type: 'magic',
    targets: 1,
  },
];

function createEquipment(overrides: Partial<Equipment>): Equipment {
  return {
    id: 'eq_1',
    name: '测试装备',
    type: 'armor',
    mainStat: '法伤 +100',
    baseStats: { magicDamage: 100 },
    stats: { magicDamage: 100 },
    runeStoneSetsNames: ['呼风唤雨'],
    runeStoneSets: [
      [
        { id: 'rune_1', type: 'black', stats: {} },
        { id: 'rune_2', type: 'yellow', stats: {} },
        { id: 'rune_3', type: 'blue', stats: {} },
      ],
    ],
    luckyHoles: '3',
    ...overrides,
  };
}

test('resolveLaboratorySkillLevels applies 呼风唤雨 bonus and unlocks 秒7 at level 150+', () => {
  const skills = resolveLaboratorySkillLevels(baseSkills, [
    createEquipment({
      type: 'armor',
      luckyHoles: '3',
      runeStoneSetsNames: ['呼风唤雨'],
      runeStoneSets: [
        [
          { id: 'rune_1', type: 'black', stats: {} },
          { id: 'rune_2', type: 'yellow', stats: {} },
          { id: 'rune_3', type: 'blue', stats: {} },
        ],
      ],
    }),
  ]);

  const dragonRoll = skills.find((item) => item.name === '龙卷雨击');

  assert.equal(dragonRoll?.extraLevel, 2);
  assert.equal(dragonRoll?.finalLevel, 151);
  assert.equal(dragonRoll?.targets, 7);
});

test('resolveLaboratorySkillLevels uses baseline equipment to avoid double counting existing rune levels', () => {
  const armor = createEquipment({
    type: 'armor',
    luckyHoles: '3',
    runeStoneSetsNames: ['呼风唤雨'],
    runeStoneSets: [
      [
        { id: 'rune_1', type: 'black', stats: {} },
        { id: 'rune_2', type: 'yellow', stats: {} },
        { id: 'rune_3', type: 'blue', stats: {} },
      ],
    ],
  });

  const skills = resolveLaboratorySkillLevels(
    [
      {
        name: '龙卷雨击',
        level: 151,
        baseLevel: 149,
        extraLevel: 2,
        finalLevel: 151,
        type: 'magic',
        targets: 7,
      },
    ],
    [armor],
    {
      baselineEquipment: [armor],
    }
  );

  assert.equal(skills[0]?.extraLevel, 2);
  assert.equal(skills[0]?.finalLevel, 151);
  assert.equal(skills[0]?.targets, 7);
});

test('resolveLaboratorySkillLevels lowers 龙卷雨击 target cap back to 秒6 when rune bonus is removed', () => {
  const skills = resolveLaboratorySkillLevels(
    [
      {
        name: '龙卷雨击',
        level: 151,
        baseLevel: 149,
        extraLevel: 2,
        finalLevel: 151,
        type: 'magic',
        targets: 7,
      },
    ],
    [],
    {
      baselineEquipment: [
        createEquipment({
          type: 'armor',
          luckyHoles: '3',
          runeStoneSetsNames: ['呼风唤雨'],
          runeStoneSets: [
            [
              { id: 'rune_1', type: 'black', stats: {} },
              { id: 'rune_2', type: 'yellow', stats: {} },
              { id: 'rune_3', type: 'blue', stats: {} },
            ],
          ],
        }),
      ],
    }
  );

  assert.equal(skills[0]?.extraLevel, 0);
  assert.equal(skills[0]?.finalLevel, 149);
  assert.equal(skills[0]?.targets, 6);
});

test('getSkillTargetCountOptions follows resolved skill target count', () => {
  const skills = resolveLaboratorySkillLevels(baseSkills, [
    createEquipment({
      type: 'armor',
      luckyHoles: '3',
      runeStoneSetsNames: ['呼风唤雨'],
      runeStoneSets: [
        [
          { id: 'rune_1', type: 'black', stats: {} },
          { id: 'rune_2', type: 'yellow', stats: {} },
          { id: 'rune_3', type: 'blue', stats: {} },
        ],
      ],
    }),
  ]);

  assert.deepEqual(getSkillTargetCountOptions(skills, '龙卷雨击'), [
    1, 2, 3, 4, 5, 6, 7,
  ]);
  assert.deepEqual(getSkillTargetCountOptions(skills, '龙腾'), [1]);
});

test('resolveJiulongPanelSpiritDelta returns rune-only spirit delta against baseline equipment', () => {
  const currentEquipment = [
    createEquipment({
      type: 'helmet',
      luckyHoles: '5',
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
    }),
  ];

  const baselineEquipment = [
    createEquipment({
      type: 'helmet',
      luckyHoles: '3',
      runeStoneSetsNames: ['九龙诀'],
      runeStoneSets: [
        [
          { id: 'rune_1', type: 'white', stats: {} },
          { id: 'rune_2', type: 'red', stats: {} },
          { id: 'rune_3', type: 'yellow', stats: {} },
        ],
      ],
    }),
  ];

  assert.equal(resolveJiulongPanelSpiritDelta(currentEquipment), 6);
  assert.equal(
    resolveJiulongPanelSpiritDelta(currentEquipment, baselineEquipment),
    4
  );
  assert.equal(
    resolveJiulongPanelSpiritDelta(baselineEquipment, currentEquipment),
    -4
  );
});
