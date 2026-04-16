import assert from 'node:assert/strict';
import test from 'node:test';

import {
  attachSimulatorEquipmentOcrImageHintMeta,
  buildSimulatorEquipmentOcrImageHintMeta,
  getSimulatorEquipmentOcrImageHintPrompt,
  normalizeSimulatorEquipmentOcrImageHint,
  readSimulatorEquipmentOcrImageHintMeta,
} from '@/shared/lib/simulator-ocr-image-hint';

test('normalizeSimulatorEquipmentOcrImageHint falls back to auto for unknown values', () => {
  assert.equal(normalizeSimulatorEquipmentOcrImageHint('unknown'), 'auto');
  assert.equal(
    normalizeSimulatorEquipmentOcrImageHint('chat_preview'),
    'chat_preview'
  );
});

test('getSimulatorEquipmentOcrImageHintPrompt returns hint-specific guidance', () => {
  assert.match(getSimulatorEquipmentOcrImageHintPrompt('auto'), /自行判断/);
  assert.match(getSimulatorEquipmentOcrImageHintPrompt('cangbaoge'), /藏宝阁/);
  assert.match(
    getSimulatorEquipmentOcrImageHintPrompt('chat_preview'),
    /聊天框/
  );
});

test('buildSimulatorEquipmentOcrImageHintMeta marks auto and manual routing modes', () => {
  assert.deepEqual(buildSimulatorEquipmentOcrImageHintMeta('auto'), {
    imageHint: 'auto',
    routingMode: 'automatic',
  });
  assert.deepEqual(buildSimulatorEquipmentOcrImageHintMeta('general'), {
    imageHint: 'general',
    routingMode: 'manual',
  });
});

test('attachSimulatorEquipmentOcrImageHintMeta appends OCR meta without losing original fields', () => {
  assert.deepEqual(
    attachSimulatorEquipmentOcrImageHintMeta(
      {
        name: '测试头盔',
        level: 130,
      },
      'cangbaoge'
    ),
    {
      name: '测试头盔',
      level: 130,
      _ocrMeta: {
        imageHint: 'cangbaoge',
        routingMode: 'manual',
      },
    }
  );
});

test('readSimulatorEquipmentOcrImageHintMeta parses label and routing mode from raw result', () => {
  assert.deepEqual(
    readSimulatorEquipmentOcrImageHintMeta({
      _ocrMeta: {
        imageHint: 'chat_preview',
        routingMode: 'manual',
      },
    }),
    {
      imageHint: 'chat_preview',
      routingMode: 'manual',
      label: '聊天框预览',
    }
  );
  assert.equal(readSimulatorEquipmentOcrImageHintMeta({}), null);
});
