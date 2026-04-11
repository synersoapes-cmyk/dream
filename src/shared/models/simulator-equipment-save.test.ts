import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { db } from '@/core/db';
import { initD1ContextForDev, resetD1DevBindingCache } from '@/core/db/d1';
import {
  characterProfile,
  characterSnapshot,
  equipmentPlan,
  gameCharacter,
  snapshotBattleContext,
  user,
} from '@/config/db/schema';
import { withTransientD1Retry } from '@/shared/models/simulator-core';
import { updateSimulatorEquipment } from '@/shared/models/simulator-main';

async function createCharacterFixture(suffix: string) {
  const userId = `itest_user_${suffix}`;
  const characterId = `itest_character_${suffix}`;
  const snapshotId = `itest_snapshot_${suffix}`;
  const now = new Date();

  await withTransientD1Retry('createCharacterFixture', async () => {
    const database = db();

    await database
      .delete(user)
      .where(eq(user.id, userId))
      .catch(() => undefined);

    await database.insert(user).values({
      id: userId,
      name: 'ITest User',
      email: `itest.${suffix}@example.com`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      utmSource: '',
      ip: '',
      locale: 'zh',
    });

    await database.insert(gameCharacter).values({
      id: characterId,
      userId,
      name: 'ITest 龙宫号',
      serverName: '测试服',
      school: '龙宫',
      roleType: '法师',
      level: 89,
      race: '仙族',
      status: 'active',
      currentSnapshotId: snapshotId,
      createdAt: now,
      updatedAt: now,
    });

    await database.insert(characterSnapshot).values({
      id: snapshotId,
      characterId,
      snapshotType: 'current',
      name: '当前状态',
      versionNo: 1,
      source: 'manual',
      notes: '',
      createdAt: now,
      updatedAt: now,
    });

    await database.insert(characterProfile).values({
      snapshotId,
      school: '龙宫',
      level: 89,
      physique: 40,
      magic: 210,
      strength: 20,
      endurance: 30,
      agility: 25,
      potentialPoints: 0,
      hp: 3850,
      mp: 1720,
      damage: 860,
      defense: 920,
      magicDamage: 1460,
      magicDefense: 1180,
      speed: 540,
      hit: 990,
      sealHit: 0,
      rawBodyJson: '{}',
    });

    await database.insert(snapshotBattleContext).values({
      snapshotId,
      ruleVersionId: null,
      selfFormation: '天覆阵',
      selfElement: '水',
      formationCounterState: '无克/普通',
      elementRelation: '无克/普通',
      transformCardFactor: 1,
      splitTargetCount: 1,
      shenmuValue: 0,
      magicResult: 0,
      targetTemplateId: null,
      targetName: '默认目标',
      targetLevel: 0,
      targetHp: 0,
      targetDefense: 0,
      targetMagicDefense: 0,
      targetSpeed: 0,
      targetMagicDefenseCultivation: 0,
      targetElement: '',
      targetFormation: '普通阵',
      notesJson: '{}',
      createdAt: now,
      updatedAt: now,
    });
  });

  return { userId };
}

test('updateSimulatorEquipment can save the same structured equipment plan twice', async (t) => {
  await resetD1DevBindingCache();
  await initD1ContextForDev();

  const suffix = randomUUID();
  const { userId } = await createCharacterFixture(suffix);

  t.after(async () => {
    const database = db();

    await database
      .delete(user)
      .where(eq(user.id, userId))
      .catch(() => undefined);
    await resetD1DevBindingCache();
  });

  const equipmentItem = {
    id: 'armor_src_1',
    name: '流云法袍',
    type: 'armor',
    level: 90,
    quality: '稀有',
    price: 1040000,
    forgeLevel: 7,
    baseStats: {
      defense: 185,
      magicDefense: 105,
      physique: 16,
    },
    stats: {
      defense: 185,
      magicDefense: 105,
      physique: 16,
    },
    runeStoneSets: [
      [
        {
          id: 'empty_rune_1',
          name: '未配置符石',
          type: 'empty',
          stats: {},
        },
      ],
    ],
    runeStoneSetsNames: ['未配置'],
    activeRuneStoneSet: 0,
    luckyHoles: '1',
    starAlignment: '法术防御 +2',
    starAlignmentConfig: {
      id: 'seed_star_resonance_armor_hufeng',
      label: '法术防御 +2',
      attrType: 'magicDefense',
      attrValue: 2,
      comboName: '呼风唤雨',
      colors: ['黑', '黄', '蓝', '绿', '白'],
    },
  };

  const payload = {
    equipment: [equipmentItem],
    equipmentSets: [
      {
        id: 'set_1',
        name: '当前方案',
        items: [equipmentItem],
        isActive: true,
      },
    ],
    activeSetIndex: 0,
  };

  const first = await updateSimulatorEquipment(userId, payload);
  const second = await updateSimulatorEquipment(userId, payload);

  assert.ok(first);
  assert.ok(second);
  assert.equal(first.equipments.length, 1);
  assert.equal(second.equipments.length, 1);
  assert.equal(first.equipmentPlan?.equipmentSets.length, 1);
  assert.equal(second.equipmentPlan?.equipmentSets.length, 1);
  assert.equal(
    second.equipments[0]?.build?.notesJson.includes('starAlignmentConfig'),
    true
  );
});

test('updateSimulatorEquipment assigns unique persisted plan ids for different users', async (t) => {
  await resetD1DevBindingCache();
  await initD1ContextForDev();

  const firstSuffix = randomUUID();
  const secondSuffix = randomUUID();
  const firstFixture = await createCharacterFixture(firstSuffix);
  const secondFixture = await createCharacterFixture(secondSuffix);

  t.after(async () => {
    const database = db();

    await database
      .delete(user)
      .where(eq(user.id, firstFixture.userId))
      .catch(() => undefined);
    await database
      .delete(user)
      .where(eq(user.id, secondFixture.userId))
      .catch(() => undefined);
    await resetD1DevBindingCache();
  });

  const payload = {
    equipment: [
      {
        id: 'armor_src_1',
        name: '流云法袍',
        type: 'armor',
        level: 90,
        quality: '稀有',
        price: 1040000,
        forgeLevel: 7,
        baseStats: {
          defense: 185,
          magicDefense: 105,
          physique: 16,
        },
        stats: {
          defense: 185,
          magicDefense: 105,
          physique: 16,
        },
      },
    ],
    equipmentSets: [
      {
        id: 'set_1',
        name: '当前方案',
        items: [
          {
            id: 'armor_src_1',
            name: '流云法袍',
            type: 'armor',
            level: 90,
            quality: '稀有',
            price: 1040000,
            forgeLevel: 7,
            baseStats: {
              defense: 185,
              magicDefense: 105,
              physique: 16,
            },
            stats: {
              defense: 185,
              magicDefense: 105,
              physique: 16,
            },
          },
        ],
        isActive: true,
      },
    ],
    activeSetIndex: 0,
  };

  await updateSimulatorEquipment(firstFixture.userId, payload);
  await updateSimulatorEquipment(secondFixture.userId, payload);

  const database = db();
  const persistedPlans = await database
    .select({ id: equipmentPlan.id, characterId: equipmentPlan.characterId })
    .from(equipmentPlan)
    .where(eq(equipmentPlan.name, '当前方案'));

  const firstPlan = persistedPlans.find(
    (plan) => plan.characterId === `itest_character_${firstSuffix}`
  );
  const secondPlan = persistedPlans.find(
    (plan) => plan.characterId === `itest_character_${secondSuffix}`
  );

  assert.ok(firstPlan);
  assert.ok(secondPlan);
  assert.notEqual(firstPlan.id, 'set_1');
  assert.notEqual(secondPlan.id, 'set_1');
  assert.notEqual(firstPlan.id, secondPlan.id);
});
