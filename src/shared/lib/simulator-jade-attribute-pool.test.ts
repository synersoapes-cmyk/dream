import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseJadeAttributePoolConfig,
  resolveJadeAttributePoolForSlot,
} from '@/shared/lib/simulator-jade-attribute-pool';

test('parseJadeAttributePoolConfig parses slot and allowed keys from flexible config fields', () => {
  const rules = parseJadeAttributePoolConfig([
    {
      slot: 'jade1',
      label: '前位玉魄',
      attrTypes: ['magicDamage', 'speed'],
      percentCodes: ['spell_damage_percent'],
    },
    {
      slotKeys: ['jade2'],
      fixedAttrTypes: ['magicResult'],
      effectModifierCodes: ['spell_ignore_percent'],
    },
  ]);

  assert.equal(rules.length, 2);
  assert.deepEqual(rules[0]?.slotKeys, ['jade1']);
  assert.deepEqual(rules[0]?.allowedStatKeys, ['magicDamage', 'speed']);
  assert.deepEqual(rules[0]?.allowedModifierCodes, ['spell_damage_percent']);
  assert.deepEqual(rules[1]?.slotKeys, ['jade2']);
});

test('resolveJadeAttributePoolForSlot merges all/default and slot-specific rules', () => {
  const resolved = resolveJadeAttributePoolForSlot({
    slot: 1,
    value: [
      {
        slot: 'all',
        statKeys: ['magicDamage'],
        modifierCodes: ['spell_damage_percent'],
      },
      {
        slot: 'jade1',
        statKeys: ['speed'],
        modifierCodes: ['element_overcome_percent'],
        description: '玉魄 1 号位',
      },
    ],
  });

  assert.ok(resolved);
  assert.deepEqual(resolved?.allowedStatKeys, ['magicDamage', 'speed']);
  assert.deepEqual(resolved?.allowedModifierCodes, [
    'spell_damage_percent',
    'element_overcome_percent',
  ]);
  assert.equal(resolved?.description, '玉魄 1 号位');
});
