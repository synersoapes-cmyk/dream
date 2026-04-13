import assert from 'node:assert/strict';
import test from 'node:test';

import { getSimulatorDisplayImageUrl } from './simulator-image-url';

test('proxies raw Cloudflare R2 image urls through the app proxy', () => {
  const imageUrl =
    'https://example-account.r2.cloudflarestorage.com/dream/uploads/simulator/ocr/test.png';

  assert.equal(
    getSimulatorDisplayImageUrl(imageUrl),
    `/api/proxy/file?url=${encodeURIComponent(imageUrl)}`
  );
});

test('keeps first-party relative image urls unchanged', () => {
  assert.equal(getSimulatorDisplayImageUrl('/logo.png'), '/logo.png');
});

test('treats stored object keys as proxyable file keys', () => {
  assert.equal(
    getSimulatorDisplayImageUrl('simulator/ocr/test.png'),
    '/api/proxy/file?key=simulator%2Focr%2Ftest.png'
  );
});
