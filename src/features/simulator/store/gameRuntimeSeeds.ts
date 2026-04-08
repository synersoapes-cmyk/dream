import type {
  CombatTarget,
  EnemyTarget,
  ExperimentSeat,
  PendingEquipment,
} from './gameTypes';

const createEnemyTarget = (
  id: string,
  name: string,
  element: EnemyTarget['element'],
  formation: string,
): EnemyTarget => ({
  id,
  name,
  element,
  formation,
  magicDamage: 800,
  spiritualPower: 450,
  magicCritLevel: 120,
  speed: 650,
  hit: 1200,
  fixedDamage: 0,
  pierceLevel: 80,
  elementalMastery: 100,
  hp: 50000,
  magicDefense: 1200,
  defense: 1500,
  block: 300,
  antiCritLevel: 100,
  sealResistLevel: 80,
  dodge: 450,
  elementalResistance: 90,
});

export const createInitialManualTargets = (): EnemyTarget[] => [
  createEnemyTarget('manual_target_1', '手动目标1', '火', '地载阵'),
];

export const createDefaultManualTarget = (index: number): EnemyTarget =>
  createEnemyTarget(`manual_target_${Date.now()}`, `手动目标${index}`, '金', '天覆阵');

export const createCombatTargetFromManualTarget = (
  target: EnemyTarget
): CombatTarget => ({
  name: target.name,
  level: 175,
  hp: target.hp,
  defense: target.defense,
  magicDefense: target.magicDefense,
  speed: target.speed,
  element: target.element,
  formation: target.formation,
});

export const createInitialExperimentSeats = (): ExperimentSeat[] => [
  {
    id: 'sample',
    name: '样本席位',
    isSample: true,
    equipment: [],
  },
];

export const createInitialPendingEquipments = (): PendingEquipment[] => [];
