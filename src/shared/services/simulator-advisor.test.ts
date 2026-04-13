import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_GEMINI_TEXT_MODEL,
  getSimulatorAdvisorCandidateModels,
  sanitizeSimulatorAdvisorReply,
} from './simulator-advisor';

test('sanitizeSimulatorAdvisorReply removes common markdown markers', () => {
  const result = sanitizeSimulatorAdvisorReply(`
## 结论
你的龙宫当前更适合先补生存。

1. **腰带** 优先级最高。
2. *鞋子* 次之。
- 可以先看气血和防御。
\`法伤\` 先不用急。
  `);

  assert.equal(
    result,
    ['结论', '你的龙宫当前更适合先补生存。', '腰带 优先级最高。', '鞋子 次之。', '可以先看气血和防御。', '法伤 先不用急。'].join('\n')
  );
});

test('getSimulatorAdvisorCandidateModels keeps Gemini 3 flash preview first and preserves configured model', () => {
  assert.equal(DEFAULT_GEMINI_TEXT_MODEL, 'gemini-3-flash-preview');
  assert.deepEqual(
    getSimulatorAdvisorCandidateModels('gemini-3-flash-preview'),
    ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.0-flash']
  );
  assert.deepEqual(
    getSimulatorAdvisorCandidateModels('custom-model'),
    ['custom-model', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.0-flash']
  );
});
