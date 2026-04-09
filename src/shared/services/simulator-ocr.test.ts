import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applySimulatorOcrDictionaryToEquipment,
  mergeRecognizedProfileWithBundle,
  normalizeRecognizedProfile,
  normalizeRecognizedEquipment,
  validateSimulatorOcrFile,
} from '@/shared/services/simulator-ocr';
import type {
  SimulatorCharacterBundle,
  SimulatorOcrDictionary,
} from '@/shared/models/simulator';

function createBundle(): SimulatorCharacterBundle {
  return {
    character: {
      id: 'char_1',
      userId: 'user_1',
      name: '测试龙宫',
      serverName: '测试服',
      school: '龙宫',
      roleType: '法师',
      level: 109,
      race: '仙族',
      status: 'active',
      currentSnapshotId: 'snapshot_1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    snapshot: {
      id: 'snapshot_1',
      characterId: 'char_1',
      snapshotType: 'current',
      name: '当前状态',
      versionNo: 1,
      source: 'manual',
      notes: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    profile: {
      snapshotId: 'snapshot_1',
      school: '龙宫',
      level: 109,
      physique: 40,
      magic: 230,
      strength: 15,
      endurance: 35,
      agility: 20,
      potentialPoints: 0,
      hp: 4200,
      mp: 2100,
      damage: 900,
      defense: 1100,
      magicDamage: 1800,
      magicDefense: 1350,
      speed: 520,
      hit: 980,
      sealHit: 0,
      rawBodyJson: JSON.stringify({
        magicPower: 610,
        dodge: 205,
      }),
    },
    skills: [],
    cultivations: [],
    battleContext: null,
    battleTargetTemplate: null,
    rules: [],
    equipments: [],
  };
}

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

test('applySimulatorOcrDictionaryToEquipment normalizes name and set highlights', () => {
  const entries: SimulatorOcrDictionary[] = [
    {
      id: 'dict_1',
      dictType: 'equipment_name',
      rawText: '晶凊诀头盔',
      normalizedText: '晶清诀头盔',
      priority: 100,
      enabled: true,
      createdBy: 'tester',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'dict_2',
      dictType: 'set_name',
      rawText: '招雲',
      normalizedText: '招云',
      priority: 50,
      enabled: true,
      createdBy: 'tester',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const normalized = applySimulatorOcrDictionaryToEquipment(
    {
      ...normalizeRecognizedEquipment({
        name: '晶凊诀头盔',
        type: 'helmet',
        mainStat: '魔法 +245',
        highlights: ['招雲', '高魔力'],
      }),
    },
    entries
  );

  assert.equal(normalized.name, '晶清诀头盔');
  assert.deepEqual(normalized.highlights, ['招云', '高魔力']);
});

test('normalizeRecognizedProfile maps chinese aliases and nested payloads', () => {
  const profile = normalizeRecognizedProfile({
    school: 'lg',
    profile: {
      等级: '175',
      体质: '42',
      魔力: '510',
      力量: '18',
      耐力: '36',
      敏捷: '54',
    },
    combatStats: {
      气血: '5821',
      魔法: '1920',
      法伤: '2145',
      法防: '1288',
      防御: '945',
      速度: '612',
      命中: '1333',
      躲避: '221',
      封印命中: '18',
    },
    stats: {
      灵力: '905',
    },
  });

  assert.deepEqual(profile, {
    level: 175,
    faction: '龙宫',
    physique: 42,
    magic: 510,
    strength: 18,
    endurance: 36,
    agility: 54,
    magicPower: 905,
    hp: 5821,
    mp: 1920,
    defense: 945,
    magicDamage: 2145,
    magicDefense: 1288,
    speed: 612,
    hit: 1333,
    dodge: 221,
    sealHit: 18,
  });
});

test('mergeRecognizedProfileWithBundle preserves current values for missing fields', () => {
  const merged = mergeRecognizedProfileWithBundle(createBundle(), {
    level: 175,
    magicDamage: 2145,
    speed: 612,
  });

  assert.deepEqual(merged, {
    level: 175,
    faction: '龙宫',
    physique: 40,
    magic: 230,
    strength: 15,
    endurance: 35,
    agility: 20,
    magicPower: 610,
    hp: 4200,
    mp: 2100,
    damage: 900,
    defense: 1100,
    magicDamage: 2145,
    magicDefense: 1350,
    speed: 612,
    hit: 980,
    dodge: 205,
    sealHit: 0,
  });
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
