import test from 'node:test';
import assert from 'node:assert/strict';

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
  assert.equal(state.combatTarget.name, '乌鸡国树怪');
  assert.equal(state.combatTarget.formation, '地载阵');
  assert.equal(state.combatTarget.element, '火');
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
