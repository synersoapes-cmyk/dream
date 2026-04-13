import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSimulatorAdvisorAuditContextSummary } from './simulator-advisor-audit';

test('buildSimulatorAdvisorAuditContextSummary keeps key simulator context fields', () => {
  const summary = buildSimulatorAdvisorAuditContextSummary({
    role: {
      baseAttributes: {
        faction: '龙宫',
        level: 175,
      },
      combatStats: {
        magicDamage: 2145,
        magicDefense: 1288,
        speed: 612,
      },
    },
    battle: {
      target: {
        name: '乌鸡国树怪',
        magicDefense: 1200,
      },
      selectedSkill: {
        name: '龙卷雨击',
        level: 180,
      },
    },
    currentEquipment: [{ name: '沧海灵杖' }],
    candidateEquipment: [{ status: 'pending' }, { status: 'confirmed' }],
    laboratory: [{ id: 'seat_1' }],
  });

  assert.deepEqual(summary, {
    role: {
      faction: '龙宫',
      level: 175,
      magicDamage: 2145,
      magicDefense: 1288,
      speed: 612,
    },
    battle: {
      targetName: '乌鸡国树怪',
      targetMagicDefense: 1200,
      selectedSkillName: '龙卷雨击',
      selectedSkillLevel: 180,
    },
    assets: {
      currentEquipmentCount: 1,
      candidateEquipmentCount: 2,
      laboratorySeatCount: 1,
    },
  });
});
