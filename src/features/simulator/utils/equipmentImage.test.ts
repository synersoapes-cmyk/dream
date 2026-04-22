import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getSimulatorEquipmentArtworkR2ObjectKeyFromAssetPath,
  normalizeEquipmentArtworkName,
} from '@/shared/lib/simulator-equipment-artwork';

import { getEquipmentDefaultImage } from './equipmentImage';

function expectArtworkResolverUrl(
  actualUrl: string,
  type: string,
  expectedName?: string
) {
  const url = new URL(actualUrl, 'https://dream.local');
  assert.equal(url.pathname, '/api/simulator/equipment-art');
  assert.equal(url.searchParams.get('type'), type);
  assert.equal(url.searchParams.get('name'), expectedName ?? null);
}

test('getEquipmentDefaultImage falls back through artwork resolver when weapon name does not hit manifest', () => {
  expectArtworkResolverUrl(
    getEquipmentDefaultImage('weapon', '沧海灵杖'),
    'weapon',
    '沧海灵杖'
  );
});

test('getEquipmentDefaultImage routes known manifest names through artwork resolver', () => {
  expectArtworkResolverUrl(
    getEquipmentDefaultImage('shoes', '踏雪无痕'),
    'shoes',
    '踏雪无痕'
  );
});

test('getEquipmentDefaultImage routes unknown equipment name through artwork resolver', () => {
  expectArtworkResolverUrl(
    getEquipmentDefaultImage('helmet', '测试头盔'),
    'helmet',
    '测试头盔'
  );
});

test('getEquipmentDefaultImage normalizes aliases before building resolver url', () => {
  expectArtworkResolverUrl(
    getEquipmentDefaultImage('trinket', '【珍品】灵符 潮声'),
    'trinket',
    '灵符·潮声'
  );
});

test('getEquipmentDefaultImage uses artwork resolver without name when input is empty', () => {
  expectArtworkResolverUrl(getEquipmentDefaultImage('jade'), 'jade');
});

test('normalizeEquipmentArtworkName strips quality wrappers and keeps canonical punctuation', () => {
  assert.equal(normalizeEquipmentArtworkName('【珍品】灵玉 映月'), '灵玉·映月');
});

test('normalizeEquipmentArtworkName strips generic level and screenshot labels', () => {
  assert.equal(normalizeEquipmentArtworkName('100级 踏雪无痕 展示图'), '踏雪无痕');
});

test('getEquipmentDefaultImage keeps stripped base name for parenthetical artwork lookup', () => {
  expectArtworkResolverUrl(
    getEquipmentDefaultImage('weapon', '罗喉计都'),
    'weapon',
    '罗喉计都'
  );
});

test('getSimulatorEquipmentArtworkR2ObjectKeyFromAssetPath maps local artwork asset paths into R2 keys', () => {
  assert.equal(
    getSimulatorEquipmentArtworkR2ObjectKeyFromAssetPath(
      '/simulator/equipment-art/weapon/罗喉计都（乾坤）.png'
    ),
    'equipment-art/weapon/罗喉计都（乾坤）.png'
  );
});
