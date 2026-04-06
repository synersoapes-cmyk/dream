import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeRecognizedEquipment,
  validateSimulatorOcrFile,
} from '@/shared/services/simulator-ocr';

test('normalizeRecognizedEquipment coerces recognized payload into simulator equipment shape', () => {
  const equipment = normalizeRecognizedEquipment({
    name: '晶清诀头盔',
    type: 'helmet',
    mainStat: '魔法 +245 法防 +156',
    level: '110',
    highlights: ['晶清诀', '高魔力'],
    stats: {
      magic: '245',
      magicDefense: 156,
      magicPower: '32',
      speed: '15',
      invalidField: 999,
    },
  });

  assert.equal(equipment.type, 'helmet');
  assert.equal(equipment.level, 110);
  assert.deepEqual(equipment.highlights, ['晶清诀', '高魔力']);
  assert.deepEqual(equipment.stats, {
    magic: 245,
    magicDefense: 156,
    magicPower: 32,
    speed: 15,
  });
});

test('normalizeRecognizedEquipment clamps jade slot to supported range 1-2', () => {
  const equipment = normalizeRecognizedEquipment({
    name: '测试玉魄',
    type: 'jade',
    slot: 4,
    mainStat: '法伤结果 +8',
  });

  assert.equal(equipment.type, 'jade');
  assert.equal(equipment.slot, 2);
});

test('validateSimulatorOcrFile rejects unsupported mime type and oversized files', () => {
  const invalidTypeFile = new File(['hello'], 'demo.txt', {
    type: 'text/plain',
  });
  const oversizedFile = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.png', {
    type: 'image/png',
  });
  const validFile = new File(['image'], 'ok.png', {
    type: 'image/png',
  });

  assert.deepEqual(validateSimulatorOcrFile(invalidTypeFile), {
    valid: false,
    error: '仅支持 JPG、PNG、WEBP 格式图片',
  });
  assert.deepEqual(validateSimulatorOcrFile(oversizedFile), {
    valid: false,
    error: '图片大小不能超过 10MB',
  });
  assert.deepEqual(validateSimulatorOcrFile(validFile), {
    valid: true,
  });
});
