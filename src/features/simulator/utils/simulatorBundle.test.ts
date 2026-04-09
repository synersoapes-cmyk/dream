import assert from 'node:assert/strict';
import test from 'node:test';
import { useGameStore } from '@/features/simulator/store/gameStore';
import { applySimulatorBundleToStore } from '@/features/simulator/utils/simulatorBundle';

import type { SimulatorCharacterBundle } from '@/shared/models/simulator';

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
    skills: [
      {
        id: 'skill_1',
        snapshotId: 'snapshot_1',
        skillCode: 'dragon_roll',
        skillName: '龙卷雨击',
        baseLevel: 150,
        extraLevel: 0,
        finalLevel: 150,
        sourceDetailJson: '{}',
      },
    ],
    cultivations: [
      {
        id: 'cult_1',
        snapshotId: 'snapshot_1',
        cultivationType: 'magicAttack',
        level: 20,
      },
    ],
    battleContext: {
      snapshotId: 'snapshot_1',
      ruleVersionId: 'rule_v1',
      selfFormation: '虎翼阵',
      selfElement: '水',
      formationCounterState: '小克',
      elementRelation: '克制',
      transformCardFactor: 1,
      splitTargetCount: 7,
      shenmuValue: 18,
      magicResult: 42,
      targetTemplateId: 'target_1',
      targetName: '乌鸡国树怪',
      targetLevel: 175,
      targetHp: 50000,
      targetDefense: 1500,
      targetMagicDefense: 1250,
      targetSpeed: 780,
      targetMagicDefenseCultivation: 12,
      targetElement: '火',
      targetFormation: '地载阵',
      notesJson: '{}',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    battleTargetTemplate: {
      id: 'target_1',
      userId: null,
      scope: 'system',
      sceneType: 'dungeon',
      name: '乌鸡国树怪',
      dungeonName: '乌鸡国',
      targetType: 'mob',
      school: '',
      level: 175,
      hp: 50000,
      defense: 1500,
      magicDefense: 1250,
      magicDefenseCultivation: 12,
      speed: 500,
      element: '火',
      formation: '地载阵',
      notes: '',
      payloadJson: '{}',
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    rules: [],
    equipments: [],
  };
}

test('applySimulatorBundleToStore hydrates persisted battle context into store', () => {
  applySimulatorBundleToStore(createBundle());

  const state = useGameStore.getState();

  assert.equal(state.activeAccountId, 'char_1');
  assert.equal(state.baseAttributes.faction, '龙宫');
  assert.equal(state.baseAttributes.hp, 716);
  assert.equal(state.combatStats.hp, 4200);
  assert.equal(state.combatTarget.name, '乌鸡国树怪');
  assert.equal(state.combatTarget.formation, '地载阵');
  assert.equal(state.combatTarget.element, '火');
  assert.equal(state.combatTarget.speed, 780);
  assert.equal(state.formation, '虎翼阵');
  assert.equal(state.playerSetup.formation, '虎翼阵');
  assert.equal(state.playerSetup.element, '水');
});

test('applySimulatorBundleToStore preserves workbench state when requested', () => {
  useGameStore.setState((state) => ({
    ...state,
    pendingEquipments: [
      {
        id: 'pending_1',
        equipment: {
          id: 'eq_pending',
          name: '待确认头盔',
          type: 'helmet',
          mainStat: '法防 +50',
          baseStats: { magicDefense: 50 },
          stats: { magicDefense: 50 },
        },
        timestamp: Date.now(),
        status: 'pending',
      },
    ],
    experimentSeats: [
      {
        id: 'sample',
        name: '样本席位',
        isSample: true,
        equipment: [],
      },
      {
        id: 'comp_keep',
        name: '对比席位1',
        isSample: false,
        equipment: [
          {
            id: 'eq_keep',
            name: '保留对比装备',
            type: 'weapon',
            mainStat: '法伤 +66',
            baseStats: { magicDamage: 66 },
            stats: { magicDamage: 66 },
          },
        ],
      },
    ],
  }));

  applySimulatorBundleToStore(createBundle(), { preserveWorkbenchState: true });

  const state = useGameStore.getState();
  assert.equal(state.pendingEquipments.length, 1);
  assert.equal(state.pendingEquipments[0]?.equipment.name, '待确认头盔');
  assert.equal(state.experimentSeats[1]?.id, 'comp_keep');
  assert.equal(state.experimentSeats[1]?.equipment[0]?.name, '保留对比装备');
});

test('applySimulatorBundleToStore restores persisted equipment plans', () => {
  const bundle = createBundle();
  bundle.equipments = [
    {
      id: 'eq_current_weapon',
      characterId: 'char_1',
      slot: 'weapon',
      name: '当前云端武器',
      level: 160,
      quality: '无级别',
      price: 8888,
      source: 'manual',
      status: 'equipped',
      isLocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      build: {
        equipmentId: 'eq_current_weapon',
        holeCount: 0,
        gemLevelTotal: 0,
        refineLevel: 12,
        specialEffectJson: '{}',
        setEffectJson: '{}',
        notesJson: JSON.stringify({
          activeRuneStoneSet: 0,
          runeStoneSets: [
            [
              {
                id: 'rune_1',
                name: '黑符石',
                type: 'black',
                stats: { magicDamage: 4 },
              },
            ],
          ],
          runeStoneSetsNames: ['腾蛟'],
          runeSetEffect: '破血狂攻',
          extraStat: '魔力 +28',
          luckyHoles: '1',
        }),
      },
      attrs: [
        {
          id: 'attr_1',
          equipmentId: 'eq_current_weapon',
          attrGroup: 'base',
          attrType: 'magicDamage',
          valueType: 'flat',
          attrValue: 321,
          displayOrder: 0,
        },
      ],
      snapshotSlot: 'weapon',
    },
  ];
  bundle.equipmentPlan = {
    activeSetIndex: 1,
    equipmentSets: [
      {
        id: 'set_1',
        name: '常规方案',
        items: [
          {
            id: 'eq_plan_1',
            name: '常规武器',
            type: 'weapon',
            mainStat: '法伤 +250',
            baseStats: { magicDamage: 250 },
            stats: { magicDamage: 250 },
          },
        ],
      },
      {
        id: 'set_2',
        name: '爆发方案',
        items: [
          {
            id: 'eq_old_active',
            name: '旧激活武器',
            type: 'weapon',
            mainStat: '法伤 +111',
            baseStats: { magicDamage: 111 },
            stats: { magicDamage: 111 },
          },
        ],
      },
    ],
  };

  applySimulatorBundleToStore(bundle);

  const state = useGameStore.getState();
  assert.equal(state.activeSetIndex, 1);
  assert.equal(state.equipment.length, 1);
  assert.equal(state.equipment[0]?.name, '当前云端武器');
  assert.equal(state.equipmentSets[0]?.name, '常规方案');
  assert.equal(state.equipmentSets[0]?.items[0]?.name, '常规武器');
  assert.equal(state.equipmentSets[1]?.name, '爆发方案');
  assert.equal(state.equipmentSets[1]?.items[0]?.name, '当前云端武器');
  assert.equal(state.accounts[0]?.activeSetIndex, 1);
  assert.equal(state.equipment[0]?.runeStoneSets?.[0]?.[0]?.name, '黑符石');
  assert.equal(state.equipment[0]?.runeStoneSetsNames?.[0], '腾蛟');
  assert.equal(state.equipment[0]?.extraStat, '魔力 +28');
  assert.equal(state.equipment[0]?.luckyHoles, '1');
});

test('applySimulatorBundleToStore restores persisted combat workbench state', () => {
  const bundle = createBundle();
  const existingBattleContext = bundle.battleContext;
  assert.ok(existingBattleContext);
  bundle.battleContext = {
    ...existingBattleContext,
    notesJson: JSON.stringify({
      combatTab: 'dungeon',
      selectedDungeonIds: ['target_1', 'target_2'],
      manualTargets: [
        {
          id: 'manual_template_1',
          name: '后台手动目标',
          element: '土',
          formation: '鸟翔阵',
          magicDamage: 999,
          spiritualPower: 666,
          magicCritLevel: 188,
          speed: 888,
          hit: 1444,
          fixedDamage: 20,
          pierceLevel: 88,
          elementalMastery: 120,
          hp: 88888,
          magicDefense: 1666,
          defense: 1777,
          block: 333,
          antiCritLevel: 166,
          sealResistLevel: 199,
          dodge: 555,
          elementalResistance: 144,
        },
      ],
    }),
  };

  applySimulatorBundleToStore(bundle);

  const state = useGameStore.getState();
  assert.equal(state.combatTab, 'dungeon');
  assert.deepEqual(state.selectedDungeonIds, ['target_1', 'target_2']);
  assert.equal(state.manualTargets.length, 1);
  assert.equal(state.manualTargets[0]?.id, 'manual_template_1');
  assert.equal(state.manualTargets[0]?.name, '后台手动目标');
  assert.equal(state.manualTargets[0]?.magicDamage, 999);
  assert.equal(state.manualTargets[0]?.hp, 88888);
});
