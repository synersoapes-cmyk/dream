import assert from 'node:assert/strict';
import test from 'node:test';
import { useGameStore } from '@/features/simulator/store/gameStore';
import type {
  CombatTarget,
  Equipment,
  SyncedCloudState,
} from '@/features/simulator/store/gameTypes';

function cloneEquipment(equipment: Equipment[]): Equipment[] {
  return equipment.map((item) => ({
    ...item,
    highlights: item.highlights ? [...item.highlights] : undefined,
    baseStats: { ...item.baseStats },
    stats: { ...item.stats },
    runeStoneSets: item.runeStoneSets?.map((set) =>
      set.map((runeStone) => ({
        ...runeStone,
        stats: { ...runeStone.stats },
      }))
    ),
    runeStoneSetsNames: item.runeStoneSetsNames
      ? [...item.runeStoneSetsNames]
      : undefined,
  }));
}

function createEquipment(
  id: string,
  type: Equipment['type'],
  value: number
): Equipment {
  return {
    id,
    name: id,
    type,
    slot: type === 'trinket' ? 1 : undefined,
    mainStat: `属性 +${value}`,
    baseStats: { magicDamage: value },
    stats: { magicDamage: value },
  };
}

test('equipment sets switch and retain per-set equipment changes', () => {
  const baseSetA = [
    createEquipment('weapon_a', 'weapon', 100),
    createEquipment('helmet_a', 'helmet', 20),
  ];
  const baseSetB = [
    createEquipment('weapon_b', 'weapon', 200),
    createEquipment('helmet_b', 'helmet', 40),
  ];

  useGameStore.setState((state) => ({
    ...state,
    equipment: cloneEquipment(baseSetA),
    equipmentSets: [
      {
        id: 'set_1',
        name: '方案一',
        items: cloneEquipment(baseSetA),
        isActive: true,
      },
      {
        id: 'set_2',
        name: '方案二',
        items: cloneEquipment(baseSetB),
        isActive: false,
      },
    ],
    activeSetIndex: 0,
  }));

  useGameStore
    .getState()
    .updateEquipment(createEquipment('weapon_a_plus', 'weapon', 150));

  let state = useGameStore.getState();
  assert.equal(state.equipment[0]?.id, 'weapon_a_plus');
  assert.equal(state.equipmentSets[0]?.items[0]?.id, 'weapon_a_plus');
  assert.equal(state.equipmentSets[1]?.items[0]?.id, 'weapon_b');

  useGameStore.getState().selectEquipmentSet(1);

  state = useGameStore.getState();
  assert.equal(state.activeSetIndex, 1);
  assert.equal(state.equipment[0]?.id, 'weapon_b');
  assert.equal(state.equipmentSets[0]?.items[0]?.id, 'weapon_a_plus');
  assert.equal(state.equipmentSets[1]?.isActive, true);

  useGameStore.getState().selectEquipmentSet(0);

  state = useGameStore.getState();
  assert.equal(state.activeSetIndex, 0);
  assert.equal(state.equipment[0]?.id, 'weapon_a_plus');
  assert.equal(state.equipmentSets[0]?.isActive, true);
  assert.equal(state.equipmentSets[1]?.isActive, false);
});

test('equipment set CRUD actions create duplicate remove and reorder plans', () => {
  const baseSetA = [createEquipment('weapon_a', 'weapon', 100)];
  const baseSetB = [createEquipment('weapon_b', 'weapon', 200)];

  useGameStore.setState((state) => ({
    ...state,
    equipment: cloneEquipment(baseSetA),
    equipmentSets: [
      {
        id: 'set_1',
        name: '方案一',
        items: cloneEquipment(baseSetA),
        isActive: true,
      },
      {
        id: 'set_2',
        name: '方案二',
        items: cloneEquipment(baseSetB),
        isActive: false,
      },
    ],
    activeSetIndex: 0,
  }));

  useGameStore.getState().addEquipmentSet();

  let state = useGameStore.getState();
  assert.equal(state.equipmentSets.length, 3);
  assert.equal(state.activeSetIndex, 2);
  assert.equal(state.equipmentSets[2]?.isActive, true);
  assert.equal(state.equipmentSets[2]?.items[0]?.id, 'weapon_a');

  useGameStore.getState().duplicateEquipmentSet(0);

  state = useGameStore.getState();
  assert.equal(state.equipmentSets.length, 4);
  assert.equal(state.activeSetIndex, 1);
  assert.equal(state.equipmentSets[1]?.name, '方案一 副本');
  assert.equal(state.equipment[0]?.id, 'weapon_a');

  useGameStore.getState().moveEquipmentSet(1, 'right');

  state = useGameStore.getState();
  assert.equal(state.activeSetIndex, 2);
  assert.equal(state.equipmentSets[2]?.name, '方案一 副本');
  assert.equal(state.equipmentSets[2]?.isActive, true);

  useGameStore.getState().removeEquipmentSet(2);

  state = useGameStore.getState();
  assert.equal(state.equipmentSets.length, 3);
  assert.equal(state.activeSetIndex, 2);
  assert.equal(state.equipmentSets[2]?.isActive, true);
});

test('status mode keeps cloud combat stats when equipment changes locally', () => {
  const cloudCombatStats = {
    hp: 3850,
    magic: 2200,
    hit: 990,
    damage: 0,
    magicDamage: 1460,
    defense: 920,
    magicDefense: 1180,
    speed: 540,
    dodge: 180,
  };

  useGameStore.setState((state) => ({
    ...state,
    baseAttributes: {
      ...state.baseAttributes,
      level: 89,
      hp: 3850,
      magic: 210,
      physique: 40,
      strength: 20,
      endurance: 30,
      agility: 25,
      magicPower: 0,
    },
    combatStats: cloudCombatStats,
    equipment: [createEquipment('weapon_a', 'weapon', 100)],
    equipmentSets: [
      {
        id: 'set_1',
        name: '当前方案',
        items: [createEquipment('weapon_a', 'weapon', 100)],
        isActive: true,
      },
    ],
    activeSetIndex: 0,
    autoRecalculateDerivedStats: false,
  }));

  useGameStore
    .getState()
    .updateEquipment(createEquipment('weapon_b', 'weapon', 220));

  const state = useGameStore.getState();
  assert.equal(state.equipment[0]?.id, 'weapon_b');
  assert.deepEqual(state.combatStats, cloudCombatStats);
});

test('restoring status mode reapplies last synced cloud snapshot', () => {
  const target: CombatTarget = {
    name: '手动目标1',
    level: 89,
    hp: 50000,
    defense: 1500,
    magicDefense: 1200,
    speed: 650,
    element: '火',
    formation: '地载阵',
  };
  const cloudEquipment = [createEquipment('cloud_weapon', 'weapon', 120)];
  const cloudState: SyncedCloudState = {
    accounts: [
      {
        id: 'cloud_1',
        name: 'Cloud Character',
        baseAttributes: {
          level: 89,
          hp: 3850,
          magic: 210,
          physique: 40,
          strength: 20,
          endurance: 30,
          agility: 25,
          magicPower: 0,
          faction: '龙宫',
        },
        combatStats: {
          hp: 3850,
          magic: 2200,
          hit: 990,
          damage: 0,
          magicDamage: 1460,
          defense: 920,
          magicDefense: 1180,
          speed: 540,
          dodge: 180,
        },
        equipment: cloneEquipment(cloudEquipment),
        equipmentSets: [
          {
            id: 'set_1',
            name: '当前方案',
            items: cloneEquipment(cloudEquipment),
            isActive: true,
          },
        ],
        activeSetIndex: 0,
        skills: [],
        cultivation: {
          physicalAttack: 0,
          physicalDefense: 0,
          magicAttack: 0,
          magicDefense: 0,
          petPhysicalAttack: 0,
          petPhysicalDefense: 0,
          petMagicAttack: 0,
          petMagicDefense: 0,
        },
        treasure: null,
      },
    ],
    activeAccountId: 'cloud_1',
    baseAttributes: {
      level: 89,
      hp: 3850,
      magic: 210,
      physique: 40,
      strength: 20,
      endurance: 30,
      agility: 25,
      magicPower: 0,
      faction: '龙宫',
    },
    combatStats: {
      hp: 3850,
      magic: 2200,
      hit: 990,
      damage: 0,
      magicDamage: 1460,
      defense: 920,
      magicDefense: 1180,
      speed: 540,
      dodge: 180,
    },
    equipment: cloneEquipment(cloudEquipment),
    equipmentSets: [
      {
        id: 'set_1',
        name: '当前方案',
        items: cloneEquipment(cloudEquipment),
        isActive: true,
      },
    ],
    activeSetIndex: 0,
    skills: [],
    cultivation: {
      physicalAttack: 0,
      physicalDefense: 0,
      magicAttack: 0,
      magicDefense: 0,
      petPhysicalAttack: 0,
      petPhysicalDefense: 0,
      petMagicAttack: 0,
      petMagicDefense: 0,
    },
    treasure: null,
    combatTarget: target,
    formation: '天覆阵',
    playerSetup: {
      level: 89,
      faction: '龙宫',
      baseStats: {
        level: 89,
        hp: 3850,
        magic: 210,
        physique: 40,
        strength: 20,
        endurance: 30,
        agility: 25,
        magicPower: 0,
        faction: '龙宫',
      },
      equipment: cloneEquipment(cloudEquipment),
      skills: [],
      cultivation: {
        physicalAttack: 0,
        physicalDefense: 0,
        magicAttack: 0,
        magicDefense: 0,
        petPhysicalAttack: 0,
        petPhysicalDefense: 0,
        petMagicAttack: 0,
        petMagicDefense: 0,
      },
      element: '水',
      formation: '天覆阵',
    },
  };

  useGameStore.setState((state) => ({
    ...state,
    syncedCloudState: cloudState,
    autoRecalculateDerivedStats: true,
    combatStats: {
      ...cloudState.combatStats,
      magicDamage: 2630,
      speed: 471,
      magicDefense: 910,
    },
    equipment: [createEquipment('lab_weapon', 'weapon', 220)],
  }));

  useGameStore
    .getState()
    .setAutoRecalculateDerivedStats(false, { restoreCloudState: true });

  const state = useGameStore.getState();
  assert.equal(state.autoRecalculateDerivedStats, false);
  assert.equal(state.equipment[0]?.id, 'cloud_weapon');
  assert.equal(state.combatStats.magicDamage, 1460);
  assert.equal(state.combatStats.speed, 540);
  assert.equal(state.combatStats.magicDefense, 1180);
});
