import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDamageExplanationChips,
  buildDamageExplanationStages,
} from '@/shared/lib/simulator-damage-explanation';

test('buildDamageExplanationStages returns ordered damage pipeline summary', () => {
  const stages = buildDamageExplanationStages({
    nonResultDamageBeforeMitigation: 1200.25,
    nonResultDamageBeforeLuohan: 1320.5,
    luohanFactor: 0.5,
    nonResultDamage: 660.25,
    magicResult: 42,
    rawDamageBeforeVariance: 702.25,
    damageVarianceFactor: 1.02,
    rawDamageAfterVariance: 716.3,
    targetMagicDefenseResult: 50,
    rawDamage: 666.3,
    finalDamage: 666,
    weatherFactor: 1.1,
    targetDefenseFactor: 1,
    specialMagicDamageReductionFactor: 1,
  });

  assert.deepEqual(
    stages.map((item) => item.label),
    [
      '主公式结果',
      '环境修正后',
      '罗汉修正后',
      '加法伤结果后',
      '波动后',
      '扣法防结果后',
      '最终取整伤害',
    ]
  );
  assert.equal(stages[2]?.tone, 'warning');
  assert.equal(stages[6]?.value, 666);
});

test('buildDamageExplanationChips summarizes active and ignored bonuses', () => {
  const chips = buildDamageExplanationChips({
    matchedBonusRules: [
      { ruleCode: 'jiulong_6', skillName: '九龙诀', bonusValue: 6 },
    ],
    ignoredBonusRules: [
      {
        ruleCode: 'geshan_spirit_70',
        skillName: '隔山打牛',
        ignoredCount: 1,
        reasonLabel: '超出上限失效',
      },
    ],
    conditionalDamageAddends: [
      {
        sourceType: 'ornament_set',
        setName: '招云',
        tier: 6,
        sourceKey: 'targetSpeed',
        contribution: 30.4,
      },
    ],
    equipmentEffectModifiers: [
      {
        equipmentId: 'jade_1',
        equipmentName: '阳玉',
        code: 'spell_ignore_percent',
        value: 0.05,
        label: '法术忽视 5%',
      },
    ],
    ornamentSetBonuses: {
      activeSets: [{ setName: '健步如飞', tier: 16 }],
    },
    regularSetBonuses: {
      activeSets: [{ setName: '炎魔神套', tier: 3 }],
    },
  });

  assert.equal(
    chips.some((item) => item.label === '技能加成'),
    true
  );
  assert.equal(
    chips.some((item) => item.label === '未生效规则'),
    true
  );
  assert.equal(
    chips.some((item) => item.label === '追加伤害'),
    true
  );
  assert.equal(
    chips.some((item) => item.label === '法术忽视'),
    true
  );
  assert.equal(
    chips.some((item) => item.label === '灵饰套装'),
    true
  );
  assert.equal(
    chips.some((item) => item.label === '装备套装'),
    true
  );
});
