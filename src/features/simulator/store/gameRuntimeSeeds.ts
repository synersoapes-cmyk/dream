import type { EnemyTarget, Equipment, ExperimentSeat, PendingEquipment } from './gameTypes';

const cloneRuneStoneSets = (equipment: Equipment): Equipment['runeStoneSets'] =>
  equipment.runeStoneSets?.map(set =>
    set.map(runeStone => ({
      ...runeStone,
      stats: { ...runeStone.stats },
    })),
  );

const cloneEquipment = (equipment: Equipment): Equipment => ({
  ...equipment,
  highlights: equipment.highlights ? [...equipment.highlights] : undefined,
  baseStats: { ...equipment.baseStats },
  stats: { ...equipment.stats },
  runeStoneSets: cloneRuneStoneSets(equipment),
  runeStoneSetsNames: equipment.runeStoneSetsNames ? [...equipment.runeStoneSetsNames] : undefined,
});

const cloneEquipmentList = (equipment: Equipment[]): Equipment[] => equipment.map(cloneEquipment);

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
  createEnemyTarget('manual_target_1', '敌方目标1', '火', '地载阵'),
];

export const createDefaultManualTarget = (index: number): EnemyTarget =>
  createEnemyTarget(`manual_target_${Date.now()}`, `敌方目标${index}`, '金', '天覆阵');

const createComparisonHelmet = (): Equipment => ({
  id: 'lib_eq1',
  name: '紫霄云雷冠',
  type: 'helmet',
  mainStat: '魔法 +130 防御 +75 锻炼8级',
  extraStat: '法术暴击伤害 +2%',
  highlights: ['琴音三叠'],
  baseStats: { magic: 130, defense: 75, magicDamage: 30, damage: 30 },
  stats: { magic: 130, defense: 75, magicDamage: 30, damage: 30 },
  price: 8800,
  runeStoneSets: [
    [{ id: 'rs_comp1_1', name: '法门·法伤', type: '法门', quality: '红色', description: '法术伤害', stats: { magicDamage: 50, damage: 50 } }],
  ],
  runeStoneSetsNames: ['法门'],
  activeRuneStoneSet: 0,
});

const createComparisonNecklace = (): Equipment => ({
  id: 'lib_eq2',
  name: '神农项链',
  type: 'necklace',
  mainStat: '灵力 +250 锻炼10级',
  highlights: ['神农'],
  baseStats: { magicDamage: 85, defense: 50, damage: 85 },
  stats: { magicDamage: 85, defense: 50, damage: 85 },
  price: 12500,
  runeStoneSets: [
    [{ id: 'rs_comp2_1', name: '逐兽·全能', type: '逐兽', quality: '红色', description: '伤害', stats: { magicDamage: 20, damage: 20 } }],
  ],
  runeStoneSetsNames: ['逐兽'],
  activeRuneStoneSet: 0,
});

export const createInitialExperimentSeats = (initialEquipment: Equipment[]): ExperimentSeat[] => [
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
      ...cloneEquipmentList(initialEquipment.filter(e => e.type !== 'helmet')),
      createComparisonHelmet(),
    ],
  },
  {
    id: 'comp_2',
    name: '对比席位2',
    isSample: false,
    equipment: [
      ...cloneEquipmentList(initialEquipment.filter(e => e.type !== 'necklace')),
      createComparisonNecklace(),
    ],
  },
];

const createPendingWeapon = (): Equipment => ({
  id: 'new_eq1',
  name: '星辰破天斧',
  type: 'weapon',
  description: '传说中星辰陨落时凝聚的神器，蕴含着破碎星辰的无穷力量。',
  equippableRoles: '大唐官府，狮驼岭',
  level: 120,
  element: '金',
  mainStat: '伤害 +420 命中 +550',
  durability: 500,
  forgeLevel: 9,
  gemstone: '太阳石',
  extraStat: '力量 +15 体质 +10',
  luckyHoles: '4孔/4孔',
  starPosition: '伤害 +3.5',
  starAlignment: '力量 +3',
  factionRequirement: '无',
  positionRequirement: '无',
  specialEffect: '物理攻击时有25%的几率给目标额外造成100点伤害',
  manufacturer: '铸剑大师3强化打造',
  refinementEffect: '+2力量 +1体质',
  highlights: ['无级别限制', '野兽之力'],
  baseStats: { damage: 420, hit: 550, strength: 15, physique: 10 },
  stats: { damage: 420, hit: 550, strength: 15, physique: 10 },
  price: 15000,
  crossServerFee: 800,
  runeStoneSets: [[
    { id: 'pw_1', name: '符石1', type: 'red', stats: { damage: 12, hit: 15 } },
    { id: 'pw_2', name: '符石2', type: 'yellow', stats: { damage: 12, hit: 15 } },
    { id: 'pw_3', name: '符石3', type: 'green', stats: { damage: 12, hit: 15 } },
    { id: 'pw_4', name: '符石4', type: 'blue', stats: { damage: 12, hit: 15 } },
  ]],
  runeStoneSetsNames: ['聚焦'],
});

const createPendingHelmet = (): Equipment => ({
  id: 'new_eq2',
  name: '紫霄云雷冠',
  type: 'helmet',
  description: '紫霄天宫遗留的法冠，佩戴者可沟通天地雷霆之力。',
  equippableRoles: '龙宫，魔王寨',
  level: 110,
  element: '火',
  mainStat: '魔法 +280 法防 +120',
  durability: 450,
  forgeLevel: 8,
  gemstone: '月亮石',
  extraStat: '魔力 +25 速度 +12',
  luckyHoles: '3孔/4孔',
  starPosition: '法防 +2.8',
  starAlignment: '魔力 +4',
  factionRequirement: '龙宫、魔王寨',
  positionRequirement: '无',
  specialEffect: '法术攻击时有20%的几率增加60点法伤',
  manufacturer: '天工巧匠2强化打造',
  refinementEffect: '+2魔力 +1体质',
  highlights: ['高魔力', '双加'],
  baseStats: { magic: 280, magicDefense: 120, magicPower: 25, speed: 12 },
  stats: { magic: 280, magicDefense: 120, magicPower: 25, speed: 12 },
  price: 8800,
  crossServerFee: 500,
  runeStoneSets: [[
    { id: 'ph_1', name: '符石1', type: 'purple', stats: { magic: 20, magicDefense: 15 } },
    { id: 'ph_2', name: '符石2', type: 'blue', stats: { magic: 20, magicDefense: 15 } },
    { id: 'ph_3', name: '符石3', type: 'yellow', stats: { magic: 20, magicDefense: 15 } },
  ]],
  runeStoneSetsNames: ['仙骨'],
});

const createConfirmedArmor = (): Equipment => ({
  id: 'lib_eq1',
  name: '玄武重甲',
  type: 'armor',
  description: '以玄武之力铸造的重甲，防御力惊人，可抵御千军万马。',
  equippableRoles: '通用',
  level: 130,
  element: '土',
  mainStat: '气血 +520 防御 +240',
  durability: 600,
  forgeLevel: 12,
  gemstone: '光芒石',
  extraStat: '体质 +35 耐力 +28',
  luckyHoles: '4孔/4孔',
  starPosition: '防御 +4.5',
  starAlignment: '气血 +35',
  factionRequirement: '无',
  positionRequirement: '无',
  specialEffect: '受到物理攻击时有30%的几率反震30点伤害',
  manufacturer: '神铸工坊4强化打造',
  refinementEffect: '+3体质 +2耐力',
  highlights: ['高防', '高体耐'],
  baseStats: { hp: 520, defense: 240, physique: 35, endurance: 28 },
  stats: { hp: 520, defense: 240, physique: 35, endurance: 28 },
  price: 22000,
  crossServerFee: 1200,
  runeStoneSets: [[
    { id: 'ca_1', name: '符石1', type: 'green', stats: { hp: 40, defense: 25 } },
    { id: 'ca_2', name: '符石2', type: 'blue', stats: { hp: 40, defense: 25 } },
    { id: 'ca_3', name: '符石3', type: 'yellow', stats: { hp: 40, defense: 25 } },
    { id: 'ca_4', name: '符石4', type: 'red', stats: { hp: 40, defense: 25 } },
  ]],
  runeStoneSetsNames: ['药香'],
});

export const createInitialPendingEquipments = (): PendingEquipment[] => {
  const now = Date.now();

  return [
    {
      id: 'pending_mock_1',
      timestamp: now,
      status: 'pending',
      equipment: createPendingWeapon(),
    },
    {
      id: 'pending_mock_2',
      timestamp: now + 1,
      status: 'pending',
      equipment: createPendingHelmet(),
    },
    {
      id: 'pending_mock_3',
      timestamp: now + 2,
      status: 'confirmed',
      equipment: createConfirmedArmor(),
    },
  ];
};
