import assert from 'node:assert/strict';
import test from 'node:test';

import { sanitizeSimulatorAdvisorReply } from './simulator-advisor';

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
