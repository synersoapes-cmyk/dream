import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_JADE_PERCENT_SEMANTIC_OPTIONS,
  parseJadePercentSemanticOptions,
} from '@/shared/lib/simulator-jade-semantics';

test('parseJadePercentSemanticOptions falls back to defaults when config is missing', () => {
  const options = parseJadePercentSemanticOptions(undefined);

  assert.deepEqual(options, DEFAULT_JADE_PERCENT_SEMANTIC_OPTIONS);
});

test('parseJadePercentSemanticOptions parses enabled configured semantics', () => {
  const options = parseJadePercentSemanticOptions([
    {
      code: 'spell_ignore_percent',
      label: '法术忽视',
      suffix: '%',
      description: '测试描述',
    },
    {
      code: 'element_overcome_percent',
      label: '五行增强',
      sourceMode: 'element',
    },
    {
      code: 'disabled_semantic',
      label: '禁用',
      enabled: false,
    },
  ]);

  assert.equal(options.length, 2);
  assert.equal(options[0]?.code, 'spell_ignore_percent');
  assert.equal(options[0]?.description, '测试描述');
  assert.equal(options[1]?.code, 'element_overcome_percent');
  assert.equal(options[1]?.requiresElement, true);
  assert.equal(options[1]?.suffix, '%');
});
