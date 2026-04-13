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

test('laboratory compare seats are capped at two visible comparison seats', () => {
  useGameStore.setState((state) => ({
    ...state,
    experimentSeats: [
      {
        id: 'sample',
        name: '样本席位',
        isSample: true,
        equipment: [],
      },
    ],
    equipment: [createEquipment('weapon_current', 'weapon', 100)],
  }));

  useGameStore.getState().addExperimentSeat();
  useGameStore.getState().addExperimentSeat();
  useGameStore.getState().addExperimentSeat();

  const state = useGameStore.getState();
  const compareSeats = state.experimentSeats.filter((seat) => !seat.isSample);
  assert.equal(compareSeats.length, 2);
  assert.equal(compareSeats[0]?.name, '对比席位1');
  assert.equal(compareSeats[1]?.name, '对比席位2');
  assert.equal(compareSeats[0]?.inheritGemstones, true);
  assert.equal(compareSeats[0]?.inheritRuneStones, true);
  assert.equal(compareSeats[1]?.inheritGemstones, true);
  assert.equal(compareSeats[1]?.inheritRuneStones, true);
});

test('laboratory compare seat updates persist inheritance strategy per seat', () => {
  useGameStore.setState((state) => ({
    ...state,
    experimentSeats: [
      {
        id: 'sample',
        name: '样本席位',
        isSample: true,
        inheritGemstones: false,
        inheritRuneStones: false,
        equipment: [],
      },
      {
        id: 'comp_1',
        name: '对比席位1',
        isSample: false,
        inheritGemstones: true,
        inheritRuneStones: true,
        equipment: [],
      },
    ],
  }));

  useGameStore.getState().updateExperimentSeatEquipment(
    'comp_1',
    createEquipment('weapon_override', 'weapon', 180),
    {
      inheritGemstones: false,
      inheritRuneStones: true,
    }
  );

  const compareSeat = useGameStore
    .getState()
    .experimentSeats.find((seat) => seat.id === 'comp_1');

  assert.equal(compareSeat?.equipment[0]?.id, 'weapon_override');
  assert.equal(compareSeat?.inheritGemstones, false);
  assert.equal(compareSeat?.inheritRuneStones, true);
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
    currentCharacter: {
      id: 'cloud_1',
      name: 'Cloud Character',
      school: '龙宫',
      level: 89,
    },
    baseAttributes: {
      level: 89,
      hp: 3850,
      magic: 210,
      potentialPoints: 0,
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
      bodyStrength: 0,
      physicalAttack: 0,
      physicalDefense: 0,
      magicAttack: 0,
      magicDefense: 0,
      petPhysicalAttack: 0,
      petPhysicalDefense: 0,
      petMagicAttack: 0,
      petMagicDefense: 0,
    },
    meridian: {
      physique: 0,
      magic: 0,
      strength: 0,
      endurance: 0,
      agility: 0,
      magicPower: 0,
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
        potentialPoints: 0,
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
        bodyStrength: 0,
        physicalAttack: 0,
        physicalDefense: 0,
        magicAttack: 0,
        magicDefense: 0,
        petPhysicalAttack: 0,
        petPhysicalDefense: 0,
        petMagicAttack: 0,
        petMagicDefense: 0,
      },
      meridian: {
        physique: 0,
        magic: 0,
        strength: 0,
        endurance: 0,
        agility: 0,
        magicPower: 0,
      },
      element: '水',
      formation: '天覆阵',
    },
    battleContext: {
      selfFormation: '天覆阵',
      selfElement: '水',
      formationCounterState: '无克/普通',
      elementRelation: '无克/普通',
      weather: '',
      transformCardFactor: 1,
      splitTargetCount: 1,
      shenmuValue: 0,
      magicResult: 0,
      targetMagicDefenseResult: 0,
      targetMagicDefenseCultivation: 0,
      targetDefenseState: '',
      specialMagicDamageReductionFactor: 1,
      targetFormation: '地载阵',
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

test('restoring status mode can resume auto recalculation from synced cloud snapshot', () => {
  const cloudEquipment = [createEquipment('cloud_weapon', 'weapon', 120)];
  const cloudState: SyncedCloudState = {
    currentCharacter: {
      id: 'cloud_2',
      name: 'Cloud Character',
      school: '龙宫',
      level: 89,
    },
    baseAttributes: {
      level: 0,
      hp: 0,
      magic: 100,
      potentialPoints: 0,
      physique: 0,
      strength: 0,
      endurance: 0,
      agility: 0,
      magicPower: 0,
      faction: '龙宫',
    },
    combatStats: {
      hp: 0,
      magic: 350,
      hit: 0,
      damage: 0,
      magicDamage: 70,
      defense: 0,
      magicDefense: 70,
      speed: 0,
      dodge: 0,
      spiritualPower: 70,
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
      bodyStrength: 0,
      physicalAttack: 0,
      physicalDefense: 0,
      magicAttack: 0,
      magicDefense: 0,
      petPhysicalAttack: 0,
      petPhysicalDefense: 0,
      petMagicAttack: 0,
      petMagicDefense: 0,
    },
    meridian: {
      physique: 0,
      magic: 0,
      strength: 0,
      endurance: 0,
      agility: 0,
      magicPower: 0,
    },
    treasure: null,
    combatTarget: {
      name: '手动目标1',
      level: 89,
      hp: 0,
      defense: 0,
      magicDefense: 0,
      speed: 0,
      element: '水',
      formation: '天覆阵',
    },
    formation: '天覆阵',
    playerSetup: {
      level: 0,
      faction: '龙宫',
      baseStats: {
        level: 0,
        hp: 0,
        magic: 100,
        potentialPoints: 0,
        physique: 0,
        strength: 0,
        endurance: 0,
        agility: 0,
        magicPower: 0,
        faction: '龙宫',
      },
      equipment: cloneEquipment(cloudEquipment),
      skills: [],
      cultivation: {
        bodyStrength: 0,
        physicalAttack: 0,
        physicalDefense: 0,
        magicAttack: 0,
        magicDefense: 0,
        petPhysicalAttack: 0,
        petPhysicalDefense: 0,
        petMagicAttack: 0,
        petMagicDefense: 0,
      },
      meridian: {
        physique: 0,
        magic: 0,
        strength: 0,
        endurance: 0,
        agility: 0,
        magicPower: 0,
      },
      element: '水',
      formation: '天覆阵',
    },
    battleContext: {
      selfFormation: '天覆阵',
      selfElement: '水',
      formationCounterState: '无克/普通',
      elementRelation: '无克/普通',
      weather: '',
      transformCardFactor: 1,
      splitTargetCount: 1,
      shenmuValue: 0,
      magicResult: 0,
      targetMagicDefenseResult: 0,
      targetMagicDefenseCultivation: 0,
      targetDefenseState: '',
      specialMagicDamageReductionFactor: 1,
      targetFormation: '天覆阵',
    },
  };

  useGameStore.setState((state) => ({
    ...state,
    syncedCloudState: cloudState,
    autoRecalculateDerivedStats: false,
    combatStats: {
      ...cloudState.combatStats,
      magicDamage: 999,
    },
    equipment: [createEquipment('lab_weapon', 'weapon', 220)],
  }));

  useGameStore
    .getState()
    .setAutoRecalculateDerivedStats(true, { restoreCloudState: true });

  let state = useGameStore.getState();
  assert.equal(state.autoRecalculateDerivedStats, true);
  assert.equal(state.equipment[0]?.id, 'cloud_weapon');
  assert.equal(state.combatStats.magicDamage, 190);
  assert.equal(state.combatStats.magicDefense, 70);

  useGameStore.getState().updateMeridian('magic', 10);

  state = useGameStore.getState();
  assert.equal(state.combatStats.magicDamage, 197);
  assert.equal(state.combatStats.magicDefense, 77);
  assert.equal(state.combatStats.spiritualPower, 77);
});

test('recalculateCombatStats applies formation speed factor from player setup', () => {
  useGameStore.setState((state) => ({
    ...state,
    autoRecalculateDerivedStats: true,
    baseAttributes: {
      ...state.baseAttributes,
      level: 109,
      hp: 804,
      magic: 230,
      potentialPoints: 0,
      physique: 40,
      strength: 15,
      endurance: 35,
      agility: 20,
      magicPower: 610,
      faction: '龙宫',
    },
    equipment: [],
    treasure: null,
    playerSetup: {
      ...state.playerSetup,
      formation: '天覆阵',
    },
  }));

  useGameStore.getState().recalculateCombatStats();
  assert.equal(useGameStore.getState().combatStats.speed, 21);

  useGameStore.setState((state) => ({
    ...state,
    playerSetup: {
      ...state.playerSetup,
      formation: '普通阵',
    },
  }));

  useGameStore.getState().recalculateCombatStats();
  assert.equal(useGameStore.getState().combatStats.speed, 23);
});

test('allocatePotentialPoints spends remaining points and updates panel stats for all-magic allocation', () => {
  useGameStore.setState((state) => ({
    ...state,
    autoRecalculateDerivedStats: true,
    baseAttributes: {
      ...state.baseAttributes,
      level: 0,
      hp: 0,
      magic: 100,
      potentialPoints: 10,
      physique: 0,
      strength: 0,
      endurance: 0,
      agility: 0,
      magicPower: 0,
      faction: '龙宫',
    },
    equipment: [],
    treasure: null,
  }));

  useGameStore.getState().recalculateCombatStats();
  const before = useGameStore.getState();

  useGameStore.getState().allocatePotentialPoints('magic', 10);

  const after = useGameStore.getState();
  assert.equal(after.baseAttributes.magic, before.baseAttributes.magic + 10);
  assert.equal(after.baseAttributes.potentialPoints, 0);
  assert.equal(after.combatStats.magic, (before.combatStats.magic ?? 0) + 35);
  assert.equal(
    after.combatStats.magicDamage,
    (before.combatStats.magicDamage ?? 0) + 7
  );
  assert.equal(
    after.combatStats.magicDefense,
    (before.combatStats.magicDefense ?? 0) + 7
  );
});

test('bodyStrength cultivation scales hp when physique changes', () => {
  useGameStore.setState((state) => ({
    ...state,
    autoRecalculateDerivedStats: true,
    baseAttributes: {
      ...state.baseAttributes,
      level: 0,
      hp: 100,
      magic: 0,
      potentialPoints: 0,
      physique: 10,
      strength: 0,
      endurance: 0,
      agility: 0,
      magicPower: 0,
      faction: '龙宫',
    },
    cultivation: {
      ...state.cultivation,
      bodyStrength: 20,
    },
    equipment: [],
    treasure: null,
  }));

  useGameStore.getState().recalculateCombatStats();
  assert.equal(useGameStore.getState().combatStats.hp, 654);

  useGameStore.getState().updateBaseAttribute('physique', 20);
  assert.equal(useGameStore.getState().combatStats.hp, 708);
});

test('meridian magic bonus updates panel stats immediately', () => {
  useGameStore.setState((state) => ({
    ...state,
    autoRecalculateDerivedStats: true,
    baseAttributes: {
      ...state.baseAttributes,
      level: 0,
      hp: 0,
      magic: 100,
      potentialPoints: 0,
      physique: 0,
      strength: 0,
      endurance: 0,
      agility: 0,
      magicPower: 0,
      faction: '龙宫',
    },
    meridian: {
      ...state.meridian,
      magic: 0,
    },
    equipment: [],
    treasure: null,
  }));

  useGameStore.getState().recalculateCombatStats();
  const before = useGameStore.getState().combatStats;

  useGameStore.getState().updateMeridian('magic', 10);

  const after = useGameStore.getState().combatStats;
  assert.equal(after.magic, (before.magic ?? 0) + 35);
  assert.equal(after.magicDamage, (before.magicDamage ?? 0) + 7);
  assert.equal(after.magicDefense, (before.magicDefense ?? 0) + 7);
  assert.equal(after.spiritualPower, (before.spiritualPower ?? 0) + 7);
});

test('setActiveRegularSetRules updates current combat panel stats immediately', () => {
  useGameStore.setState((state) => ({
    ...state,
    autoRecalculateDerivedStats: true,
    activeRegularSetRules: [],
    baseAttributes: {
      ...state.baseAttributes,
      level: 0,
      hp: 0,
      magic: 100,
      potentialPoints: 0,
      physique: 0,
      strength: 0,
      endurance: 0,
      agility: 0,
      magicPower: 0,
      faction: '龙宫',
    },
    meridian: {
      ...state.meridian,
      physique: 0,
      magic: 0,
      strength: 0,
      endurance: 0,
      agility: 0,
      magicPower: 0,
    },
    equipment: [
      {
        id: 'weapon_set_live',
        name: '套装武器',
        type: 'weapon',
        setName: '炎魔神套',
        mainStat: '测试属性',
        baseStats: {},
        stats: {},
      },
      {
        id: 'helmet_set_live',
        name: '套装头盔',
        type: 'helmet',
        setName: '炎魔神套',
        mainStat: '测试属性',
        baseStats: {},
        stats: {},
      },
      {
        id: 'armor_set_live',
        name: '套装衣服',
        type: 'armor',
        setName: '炎魔神套',
        mainStat: '测试属性',
        baseStats: {},
        stats: {},
      },
    ],
    treasure: null,
  }));

  useGameStore.getState().recalculateCombatStats();
  const before = useGameStore.getState().combatStats;

  useGameStore.getState().setActiveRegularSetRules([
    {
      setName: '*',
      enabled: true,
      tiers: [
        {
          tier: 3,
          minCount: 3,
          effects: [{ targetKey: 'magic', value: 12 }],
        },
      ],
    },
  ]);

  const after = useGameStore.getState().combatStats;
  assert.equal(after.magic, (before.magic ?? 0) + 7);
  assert.equal(after.magicDamage, 78);
  assert.equal(after.magicDefense, 78);
});

test('restoreCloudState keeps active regular set rules for later recalculation', () => {
  const cloudState: SyncedCloudState = {
    currentCharacter: {
      id: 'cloud_regular_set',
      name: 'Cloud Character',
      school: '龙宫',
      level: 0,
    },
    baseAttributes: {
      level: 0,
      hp: 0,
      magic: 100,
      potentialPoints: 0,
      physique: 0,
      strength: 0,
      endurance: 0,
      agility: 0,
      magicPower: 0,
      faction: '龙宫',
    },
    combatStats: {
      hp: 0,
      magic: 350,
      hit: 0,
      damage: 0,
      magicDamage: 70,
      defense: 0,
      magicDefense: 70,
      speed: 0,
      dodge: 0,
      spiritualPower: 70,
    },
    equipment: [
      {
        id: 'weapon_set_cloud',
        name: '套装武器',
        type: 'weapon',
        setName: '炎魔神套',
        mainStat: '测试属性',
        baseStats: {},
        stats: {},
      },
      {
        id: 'helmet_set_cloud',
        name: '套装头盔',
        type: 'helmet',
        setName: '炎魔神套',
        mainStat: '测试属性',
        baseStats: {},
        stats: {},
      },
      {
        id: 'armor_set_cloud',
        name: '套装衣服',
        type: 'armor',
        setName: '炎魔神套',
        mainStat: '测试属性',
        baseStats: {},
        stats: {},
      },
    ],
    equipmentSets: [
      {
        id: 'set_cloud_regular',
        name: '当前方案',
        items: [
          {
            id: 'weapon_set_cloud',
            name: '套装武器',
            type: 'weapon',
            setName: '炎魔神套',
            mainStat: '测试属性',
            baseStats: {},
            stats: {},
          },
          {
            id: 'helmet_set_cloud',
            name: '套装头盔',
            type: 'helmet',
            setName: '炎魔神套',
            mainStat: '测试属性',
            baseStats: {},
            stats: {},
          },
          {
            id: 'armor_set_cloud',
            name: '套装衣服',
            type: 'armor',
            setName: '炎魔神套',
            mainStat: '测试属性',
            baseStats: {},
            stats: {},
          },
        ],
        isActive: true,
      },
    ],
    activeSetIndex: 0,
    skills: [],
    cultivation: {
      bodyStrength: 0,
      physicalAttack: 0,
      physicalDefense: 0,
      magicAttack: 0,
      magicDefense: 0,
      petPhysicalAttack: 0,
      petPhysicalDefense: 0,
      petMagicAttack: 0,
      petMagicDefense: 0,
    },
    meridian: {
      physique: 0,
      magic: 0,
      strength: 0,
      endurance: 0,
      agility: 0,
      magicPower: 0,
    },
    treasure: null,
    combatTarget: {
      name: '手动目标1',
      level: 89,
      hp: 0,
      defense: 0,
      magicDefense: 0,
      speed: 0,
      element: '水',
      formation: '天覆阵',
    },
    formation: '天覆阵',
    playerSetup: {
      level: 0,
      faction: '龙宫',
      baseStats: {
        level: 0,
        hp: 0,
        magic: 100,
        potentialPoints: 0,
        physique: 0,
        strength: 0,
        endurance: 0,
        agility: 0,
        magicPower: 0,
        faction: '龙宫',
      },
      equipment: [
        {
          id: 'weapon_set_cloud',
          name: '套装武器',
          type: 'weapon',
          setName: '炎魔神套',
          mainStat: '测试属性',
          baseStats: {},
          stats: {},
        },
        {
          id: 'helmet_set_cloud',
          name: '套装头盔',
          type: 'helmet',
          setName: '炎魔神套',
          mainStat: '测试属性',
          baseStats: {},
          stats: {},
        },
        {
          id: 'armor_set_cloud',
          name: '套装衣服',
          type: 'armor',
          setName: '炎魔神套',
          mainStat: '测试属性',
          baseStats: {},
          stats: {},
        },
      ],
      skills: [],
      cultivation: {
        bodyStrength: 0,
        physicalAttack: 0,
        physicalDefense: 0,
        magicAttack: 0,
        magicDefense: 0,
        petPhysicalAttack: 0,
        petPhysicalDefense: 0,
        petMagicAttack: 0,
        petMagicDefense: 0,
      },
      meridian: {
        physique: 0,
        magic: 0,
        strength: 0,
        endurance: 0,
        agility: 0,
        magicPower: 0,
      },
      element: '水',
      formation: '天覆阵',
    },
    battleContext: {
      selfFormation: '天覆阵',
      selfElement: '水',
      formationCounterState: '无克/普通',
      elementRelation: '无克/普通',
      weather: '',
      transformCardFactor: 1,
      splitTargetCount: 1,
      shenmuValue: 0,
      magicResult: 0,
      targetMagicDefenseResult: 0,
      targetMagicDefenseCultivation: 0,
      targetDefenseState: '',
      specialMagicDamageReductionFactor: 1,
      targetFormation: '天覆阵',
    },
  };

  useGameStore.setState((state) => ({
    ...state,
    syncedCloudState: cloudState,
    autoRecalculateDerivedStats: false,
    activeRegularSetRules: [
      {
        setName: '*',
        enabled: true,
        tiers: [
          {
            tier: 3,
            minCount: 3,
            effects: [{ targetKey: 'magic', value: 12 }],
          },
        ],
      },
    ],
  }));

  useGameStore
    .getState()
    .setAutoRecalculateDerivedStats(true, { restoreCloudState: true });

  const state = useGameStore.getState();
  assert.equal(state.activeRegularSetRules.length, 1);
  assert.equal(state.combatStats.magic, 392);
  assert.equal(state.combatStats.magicDamage, 78);
  assert.equal(state.combatStats.magicDefense, 78);
});

test('recalculateCombatStats uses synced baseline equipment to avoid double counting jiulong panel spirit', () => {
  const jiulongHelmet: Equipment = {
    id: 'helmet_jiulong_live',
    name: '当前九龙诀头盔',
    type: 'helmet',
    mainStat: '防御 +80',
    baseStats: {},
    stats: {},
    luckyHoles: '5',
    activeRuneStoneSet: 0,
    runeStoneSetsNames: ['九龙诀'],
    runeStoneSets: [
      [
        { id: 'rune_1', type: 'white', stats: {} },
        { id: 'rune_2', type: 'red', stats: {} },
        { id: 'rune_3', type: 'yellow', stats: {} },
        { id: 'rune_4', type: 'blue', stats: {} },
        { id: 'rune_5', type: 'green', stats: {} },
      ],
    ],
  };

  const plainHelmet: Equipment = {
    ...jiulongHelmet,
    id: 'helmet_plain',
    name: '普通头盔',
    runeStoneSetsNames: ['九龙诀'],
    luckyHoles: '0',
    runeStoneSets: [[]],
  };

  useGameStore.setState((state) => ({
    ...state,
    autoRecalculateDerivedStats: true,
    baseAttributes: {
      ...state.baseAttributes,
      level: 0,
      hp: 0,
      magic: 0,
      potentialPoints: 0,
      physique: 0,
      strength: 0,
      endurance: 0,
      agility: 0,
      magicPower: 520,
      faction: '龙宫',
    },
    cultivation: {
      ...state.cultivation,
      bodyStrength: 0,
    },
    meridian: {
      ...state.meridian,
      physique: 0,
      magic: 0,
      strength: 0,
      endurance: 0,
      agility: 0,
      magicPower: 0,
    },
    treasure: null,
    equipment: [jiulongHelmet],
    syncedCloudState: {
      ...(state.syncedCloudState ?? {
        currentCharacter: null,
        combatTarget: {
          name: '手动目标1',
          level: 0,
          hp: 0,
          defense: 0,
          magicDefense: 0,
          speed: 0,
          element: '水',
          formation: '普通阵',
        },
        formation: '普通阵',
        playerSetup: {
          ...state.playerSetup,
          level: 0,
          faction: '龙宫',
          baseStats: {
            ...state.baseAttributes,
            level: 0,
            hp: 0,
            magic: 0,
            potentialPoints: 0,
            physique: 0,
            strength: 0,
            endurance: 0,
            agility: 0,
            magicPower: 520,
            faction: '龙宫',
          },
          equipment: [jiulongHelmet],
          skills: [],
          cultivation: {
            ...state.cultivation,
            bodyStrength: 0,
          },
          meridian: {
            ...state.meridian,
            physique: 0,
            magic: 0,
            strength: 0,
            endurance: 0,
            agility: 0,
            magicPower: 0,
          },
          element: '水',
          formation: '普通阵',
        },
        battleContext: {
          selfFormation: '普通阵',
          selfElement: '水',
          formationCounterState: '无克/普通',
          elementRelation: '无克/普通',
          weather: '',
          transformCardFactor: 1,
          splitTargetCount: 1,
          shenmuValue: 0,
          magicResult: 0,
          targetMagicDefenseResult: 0,
          targetMagicDefenseCultivation: 0,
          targetDefenseState: '',
          specialMagicDamageReductionFactor: 1,
          targetFormation: '普通阵',
        },
      }),
      baseAttributes: {
        ...state.baseAttributes,
        level: 0,
        hp: 0,
        magic: 0,
        potentialPoints: 0,
        physique: 0,
        strength: 0,
        endurance: 0,
        agility: 0,
        magicPower: 520,
        faction: '龙宫',
      },
      combatStats: {
        hp: 0,
        magic: 0,
        hit: 0,
        damage: 0,
        magicDamage: 520,
        defense: 0,
        magicDefense: 520,
        speed: 0,
        dodge: 0,
        spiritualPower: 520,
      },
      equipment: [jiulongHelmet],
      equipmentSets: [
        {
          id: 'set_jiulong_live',
          name: '当前方案',
          items: [jiulongHelmet],
          isActive: true,
        },
      ],
      activeSetIndex: 0,
      skills: [],
      cultivation: {
        ...state.cultivation,
        bodyStrength: 0,
      },
      meridian: {
        ...state.meridian,
        physique: 0,
        magic: 0,
        strength: 0,
        endurance: 0,
        agility: 0,
        magicPower: 0,
      },
      treasure: null,
    },
    playerSetup: {
      ...state.playerSetup,
      formation: '普通阵',
    },
  }));

  useGameStore.getState().recalculateCombatStats();
  assert.equal(useGameStore.getState().combatStats.spiritualPower, 520);
  assert.equal(useGameStore.getState().combatStats.magicDamage, 520);

  useGameStore.getState().updateEquipment(plainHelmet);

  assert.equal(useGameStore.getState().combatStats.spiritualPower, 514);
  assert.equal(useGameStore.getState().combatStats.magicDamage, 514);
  assert.equal(useGameStore.getState().combatStats.magicDefense, 514);
});
