import test from 'node:test';
import assert from 'node:assert/strict';

import { useGameStore } from '@/features/simulator/store/gameStore';
import { buildSimulatorAdvisorContext } from '@/features/simulator/utils/simulatorAdvisorContext';

test('buildSimulatorAdvisorContext summarizes current role and laboratory state', () => {
  useGameStore.setState((state) => ({
    ...state,
    baseAttributes: {
      ...state.baseAttributes,
      faction: '龙宫',
      level: 109,
    },
    combatTarget: {
      name: '乌鸡国树怪',
      level: 175,
      hp: 50000,
      defense: 1500,
      magicDefense: 1200,
      element: '火',
      formation: '普通阵',
    },
    equipment: [
      {
        id: 'weapon_current',
        name: '当前法杖',
        type: 'weapon',
        mainStat: '法伤 +80',
        baseStats: { magicDamage: 80 },
        stats: { magicDamage: 80 },
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
        id: 'comp_1',
        name: '对比席位1',
        isSample: false,
        equipment: [
          {
            id: 'weapon_new',
            name: '候选法杖',
            type: 'weapon',
            mainStat: '法伤 +120',
            baseStats: { magicDamage: 120 },
            stats: { magicDamage: 120 },
            price: 9999,
          },
        ],
      },
    ],
  }));

  const context = buildSimulatorAdvisorContext(useGameStore.getState());

  assert.equal(context.role.faction, '龙宫');
  assert.equal(context.battle.target.name, '乌鸡国树怪');
  assert.equal(context.currentEquipment[0]?.name, '当前法杖');
  assert.equal(context.laboratory[0]?.name, '对比席位1');
  assert.equal(context.laboratory[0]?.diffPreview[0]?.nextName, '候选法杖');
});
