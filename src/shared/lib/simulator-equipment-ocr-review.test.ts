import assert from 'node:assert/strict';
import test from 'node:test';

import type { PendingEquipment } from '@/features/simulator/store/gameTypes';

import { buildSimulatorEquipmentOcrReviewSummary } from './simulator-equipment-ocr-review';

function buildPendingEquipment(
  overrides: Partial<PendingEquipment> = {}
): PendingEquipment {
  return {
    id: 'pending-1',
    timestamp: Date.now(),
    status: 'pending',
    equipment: {
      id: 'eq-1',
      name: '沧海灵杖',
      type: 'weapon',
      mainStat: '伤害 +420',
      extraStat: '魔力 +28',
      baseStats: {},
      stats: {
        damage: 420,
        hit: 620,
        magicDamage: 105,
      },
      level: 160,
      price: 8888,
      specialEffect: '琴音三叠',
      luckyHoles: '5孔',
      repairFailCount: 0,
    },
    ...overrides,
  };
}

test('buildSimulatorEquipmentOcrReviewSummary returns recognized field summary', () => {
  const summary = buildSimulatorEquipmentOcrReviewSummary(
    buildPendingEquipment({
      rawText: JSON.stringify({
        confidence: 0.93,
        recognized: {
          name: '沧海灵杖',
          type: 'weapon',
          level: 160,
          mainStat: '伤害 +420',
          price: 8888,
          stats: {
            damage: 420,
            hit: 620,
            magicDamage: 105,
          },
        },
      }),
    })
  );

  assert.equal(summary.confidenceTone, 'high');
  assert.equal(summary.recognizedCoreFieldCount, 5);
  assert.equal(summary.recognizedStatCount, 3);
  assert.equal(summary.missingFields.length, 0);
  assert.ok(summary.recognizedCoreFields.some((field) => field.key === 'name'));
  assert.match(summary.summaryLines[0] ?? '', /识别出 8 个有效字段/);
});

test('buildSimulatorEquipmentOcrReviewSummary highlights missing core fields', () => {
  const summary = buildSimulatorEquipmentOcrReviewSummary(
    buildPendingEquipment({
      equipment: {
        id: 'eq-2',
        name: '',
        type: 'trinket',
        slot: undefined,
        mainStat: '',
        baseStats: {},
        stats: {},
        price: undefined,
      } as PendingEquipment['equipment'],
      rawText: JSON.stringify({
        confidenceScore: 0.62,
        recognized: {
          type: 'trinket',
        },
      }),
    })
  );

  assert.equal(summary.confidenceTone, 'low');
  assert.ok(summary.missingFields.some((field) => field.key === 'name'));
  assert.ok(summary.missingFields.some((field) => field.key === 'mainStat'));
  assert.ok(summary.missingFields.some((field) => field.key === 'price'));
  assert.ok(summary.missingFields.some((field) => field.key === 'slot'));
  assert.ok(summary.missingSuggestedStats.some((field) => field.label === '伤害'));
  assert.ok(
    summary.recommendedChecks.some((entry) => entry.includes('常见属性'))
  );
  assert.ok(
    summary.recommendedChecks.some((entry) => entry.includes('修理失败次数'))
  );
  assert.ok(summary.recommendedChecks.some((entry) => entry.includes('开孔')));
});
