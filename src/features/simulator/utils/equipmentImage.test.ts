import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeEquipmentArtworkName } from '@/shared/lib/simulator-equipment-artwork';

import { getEquipmentDefaultImage } from './equipmentImage';

test('getEquipmentDefaultImage returns named artwork route for mapped equipment', () => {
  assert.equal(
    getEquipmentDefaultImage('weapon', '沧海灵杖'),
    '/api/simulator/equipment-art?type=weapon&name=%E6%B2%A7%E6%B5%B7%E7%81%B5%E6%9D%96'
  );
});

test('getEquipmentDefaultImage falls back to generated local art route for unknown equipment name', () => {
  assert.equal(
    getEquipmentDefaultImage('helmet', '测试头盔'),
    '/api/simulator/equipment-art?type=helmet&name=%E6%B5%8B%E8%AF%95%E5%A4%B4%E7%9B%94'
  );
});

test('getEquipmentDefaultImage normalizes aliases before resolving artwork route', () => {
  assert.equal(
    getEquipmentDefaultImage('trinket', '【珍品】灵符 潮声'),
    '/api/simulator/equipment-art?type=trinket&name=%E7%81%B5%E7%AC%A6%C2%B7%E6%BD%AE%E5%A3%B0'
  );
});

test('getEquipmentDefaultImage returns type placeholder route when name is empty', () => {
  assert.equal(
    getEquipmentDefaultImage('jade'),
    '/api/simulator/equipment-art?type=jade'
  );
});

test('normalizeEquipmentArtworkName strips quality wrappers and keeps canonical punctuation', () => {
  assert.equal(normalizeEquipmentArtworkName('【珍品】灵玉 映月'), '灵玉·映月');
});
