import assert from 'node:assert/strict';
import test from 'node:test';
import { useGameStore } from '@/features/simulator/store/gameStore';
import type { Equipment } from '@/features/simulator/store/gameTypes';

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
