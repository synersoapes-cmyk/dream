import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildStarStonePersistenceRows,
  mergeStarStateIntoNotesJson,
} from './simulator-equipment-persistence';

test('buildStarStonePersistenceRows does not persist fake star alignment config ids as rule ids', () => {
  const rows = buildStarStonePersistenceRows({
    snapshotId: 'snapshot_1',
    characterId: 'character_1',
    equipmentId: 'equipment_1',
    slot: 'necklace',
    notesJson: JSON.stringify({
      starAlignment: '魔力 +2',
      starAlignmentConfig: {
        id: 'ui_config_only_id',
        label: '魔力 +2',
        attrType: 'magic',
        attrValue: 2,
      },
    }),
    availableRules: [],
    createdAt: new Date('2026-05-08T00:00:00.000Z'),
    updatedAt: new Date('2026-05-08T00:00:00.000Z'),
  });

  assert.equal(rows.resonanceRow?.ruleId, null);
  assert.equal(rows.resonanceRow?.matched, false);
});

test('mergeStarStateIntoNotesJson avoids synthesizing fake star alignment config ids', () => {
  const nextNotesJson = mergeStarStateIntoNotesJson({
    notesJson: JSON.stringify({ starAlignment: '魔力 +2' }),
    starStoneRows: [],
    starStoneAttrRows: [],
    resonanceRow: {
      id: 'resonance_row_1',
      snapshotId: 'snapshot_1',
      slot: 'necklace',
      ruleId: null,
      matched: false,
      bonusJson: JSON.stringify({
        label: '魔力 +2',
        attrType: 'magic',
        attrValue: 2,
      }),
      createdAt: new Date('2026-05-08T00:00:00.000Z'),
      updatedAt: new Date('2026-05-08T00:00:00.000Z'),
    },
    resonanceRule: null,
  });

  assert.equal(nextNotesJson.includes('starAlignmentConfig'), false);
  assert.equal(nextNotesJson.includes('starAlignment'), true);
});
