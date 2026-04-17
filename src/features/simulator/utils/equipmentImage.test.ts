import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeEquipmentArtworkName } from '@/shared/lib/simulator-equipment-artwork';

import { getEquipmentDefaultImage } from './equipmentImage';

test('getEquipmentDefaultImage falls back to local default artwork when weapon name does not hit manifest', () => {
  assert.equal(
    getEquipmentDefaultImage('weapon', '沧海灵杖'),
    '/simulator/equipment-art/weapon/折扇.jpg'
  );
});

test('getEquipmentDefaultImage returns static local artwork when manifest already contains the asset', () => {
  assert.equal(
    getEquipmentDefaultImage('shoes', '踏雪无痕'),
    '/simulator/equipment-art/shoes/踏雪无痕.jpg'
  );
});

test('getEquipmentDefaultImage falls back to local default artwork for unknown equipment name', () => {
  assert.equal(
    getEquipmentDefaultImage('helmet', '测试头盔'),
    '/simulator/equipment-art/helmet/布帽.jpg'
  );
});

test('getEquipmentDefaultImage normalizes aliases and still falls back to local default artwork when alias is not in manifest', () => {
  assert.equal(
    getEquipmentDefaultImage('trinket', '【珍品】灵符 潮声'),
    '/simulator/equipment-art/trinket/碧木镯.jpg'
  );
});

test('getEquipmentDefaultImage returns local default artwork when name is empty', () => {
  assert.equal(
    getEquipmentDefaultImage('jade'),
    '/simulator/equipment-art/jade/上古玉魄·阳.jpg'
  );
});

test('normalizeEquipmentArtworkName strips quality wrappers and keeps canonical punctuation', () => {
  assert.equal(normalizeEquipmentArtworkName('【珍品】灵玉 映月'), '灵玉·映月');
});

test('getEquipmentDefaultImage can resolve parenthetical local artwork by stripped base name', () => {
  assert.equal(
    getEquipmentDefaultImage('weapon', '罗喉计都'),
    '/simulator/equipment-art/weapon/罗喉计都（乾坤）.png'
  );
});
