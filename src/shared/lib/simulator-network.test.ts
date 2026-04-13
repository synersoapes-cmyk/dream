import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getSimulatorNetworkErrorMessage,
  isOfflineLikeError,
} from '@/shared/lib/simulator-network';

test('isOfflineLikeError recognizes common fetch failure text', () => {
  assert.equal(isOfflineLikeError(new TypeError('Failed to fetch')), true);
  assert.equal(
    isOfflineLikeError(new Error('Network connection lost while syncing')),
    true
  );
});

test('isOfflineLikeError ignores unrelated errors', () => {
  assert.equal(isOfflineLikeError(new Error('保存失败')), false);
});

test('getSimulatorNetworkErrorMessage returns network prompt for offline-like errors', () => {
  assert.equal(
    getSimulatorNetworkErrorMessage(new TypeError('Load failed'), '保存失败'),
    '请检查网络'
  );
  assert.equal(
    getSimulatorNetworkErrorMessage(new Error('业务校验失败'), '保存失败'),
    '保存失败'
  );
});
