import type { Equipment } from './gameTypes';

export const PRESET_EQUIPMENTS: Equipment[] = [
  {
    id: 'eq1',
    name: '混元金钩',
    type: 'weapon',
    mainStat: '伤害 +371 命中 +290 锻炼8级 开3孔\n总伤:467 初总伤:403 初伤害:307',
    extraStat: '敏捷 +11 体质 +10',
    highlights: ['笑里藏刀'],
    baseStats: { damage: 371, hit: 290, agility: 11, physique: 10 },
    stats: { damage: 371, hit: 290, agility: 11, physique: 10 },
    price: 333,
    runeStoneSets: [
      // 组合1：高法伤爆发流
      [
        { id: 'rs1_1', name: '回眸一笑·法伤', type: '回眸一笑', quality: '紫色', description: '提升法术伤害', stats: { magicDamage: 45, magic: 8 } },
        { id: 'rs1_2', name: '回眸一笑·法力', type: '回眸一笑', quality: '紫色', description: '提升法力上限', stats: { magic: 12, magicDamage: 35 } },
        { id: 'rs1_3', name: '九龙诀·命中', type: '九龙诀', quality: '橙色', description: '提升命中率', stats: { hit: 40, magicDamage: 28 } },
      ],
      // 组合2：法伤+速度平衡流
      [
        { id: 'rs2_1', name: '隔山打牛·法伤', type: '隔山打牛', quality: '蓝色', description: '法伤速度兼顾', stats: { magicDamage: 38, speed: 15 } },
        { id: 'rs2_2', name: '九龙诀·速度', type: '九龙诀', quality: '紫色', description: '提升出手速度', stats: { speed: 22, magicDamage: 25 } },
        { id: 'rs2_3', name: '回眸一笑·全能', type: '回眸一笑', quality: '绿色', description: '全属性提升', stats: { magicDamage: 30, magic: 10, speed: 8 } },
      ],
      // 组合3：呼风唤雨专属流
      [
        { id: 'rs3_1', name: '呼风唤雨·法伤', type: '呼风唤雨', quality: '红色', description: '龙宫专属，大幅提升法伤', stats: { magicDamage: 60, magic: 15 } },
        { id: 'rs3_2', name: '九龙诀·法力', type: '九龙诀', quality: '橙色', description: '强化法力储备', stats: { magic: 18, magicDamage: 32 } },
        { id: 'rs3_3', name: '回眸一笑·暴击', type: '回眸一笑', quality: '紫色', description: '提升暴击几率', stats: { magicDamage: 40, hit: 20 } },
      ],
    ],
    runeStoneSetsNames: ['全能', '法门', '逐兽'],
    activeRuneStoneSet: 0,
  },
  {
    id: 'eq2',
    name: '水晶夔帽',
    type: 'helmet',
    mainStat: '魔法 +113 防御 +57',
    highlights: ['破甲术'],
    baseStats: { magic: 113, defense: 57 },
    stats: { magic: 113, defense: 57 },
    price: 294.3,
    runeStoneSets: [
      // 组合1��双防加强
      [
        { id: 'rs4_1', name: '九龙诀·法防', type: '九龙诀', quality: '紫色', description: '提升法术防御', stats: { magicDefense: 40, magic: 10 } },
        { id: 'rs4_2', name: '九龙诀·物防', type: '九龙诀', quality: '橙色', description: '提升物理防御', stats: { defense: 35, magicDefense: 25 } },
      ],
      // 组合2：防御+法伤
      [
        { id: 'rs5_1', name: '回眸一笑·法防', type: '回眸一笑', quality: '蓝色', description: '法防魔力双提升', stats: { magicDefense: 35, magic: 12 } },
        { id: 'rs5_2', name: '隔山牛·法伤', type: '隔山打牛', quality: '绿色', description: '附加法伤属性', stats: { magicDamage: 25, magicDefense: 20 } },
      ],
      // 合3：极限法防
      [
        { id: 'rs6_1', name: '九龙诀·法防', type: '九龙诀', quality: '红色', description: '极限法术防御', stats: { magicDefense: 55, magic: 8 } },
        { id: 'rs6_2', name: '九龙诀·抗性', type: '九龙诀', quality: '紫色', description: '全抗性提升', stats: { magicDefense: 30, defense: 30 } },
      ],
    ],
    runeStoneSetsNames: ['心印', '仙骨', '招云'],
    activeRuneStoneSet: 0,
  },
  {
    id: 'eq3',
    name: '珠翠玉环',
    type: 'necklace', // Let's keep the slot type same as before to not break logic, just name it differently
    mainStat: '气血 +460 防御 +57 锻炼6级\n初气血:220',
    highlights: ['水清诀'],
    baseStats: { hp: 460, defense: 57 },
    stats: { hp: 460, defense: 57 },
    price: 234.7,
    runeStoneSets: [
      // 组合1：高爆发
      [
        { id: 'rs7_1', name: '回眸一·法伤', type: '回眸一笑', quality: '红色', description: '提升法术伤害', stats: { magicDamage: 40, magic: 6 } },
        { id: 'rs7_2', name: '回眸一笑·暴击', type: '回眸一笑', quality: '橙色', description: '暴击伤害', stats: { magicDamage: 35, hit: 15 } },
      ],
      // 组合2：速度流
      [
        { id: 'rs8_1', name: '隔山打牛·速度', type: '隔山打牛', quality: '蓝色', description: '提升速度', stats: { speed: 25, magicDamage: 20 } },
        { id: 'rs8_2', name: '隔山打牛·敏捷', type: '隔山打牛', quality: '紫色', description: '捷加成', stats: { speed: 18, agility: 10 } },
      ],
      // 组合3：法力储备
      [
        { id: 'rs9_1', name: '九龙诀·法力', type: '九龙诀', quality: '橙色', description: '法力上限提升', stats: { magic: 20, magicDamage: 25 } },
        { id: 'rs9_2', name: '回眸一笑·魔力', type: '回���一笑', quality: '绿色', description: '魔力增幅', stats: { magic: 15, magicDamage: 22 } },
      ],
    ],
    runeStoneSetsNames: ['心印', '招云', '腾蛟'], // 法力���备'],
    activeRuneStoneSet: 0,
  },
  {
    id: 'eq4',
    name: '龙鳞宝刀',
    type: 'weapon',
    mainStat: '伤害 +253 命中 +430 锻炼7级 开3孔\n总伤:396 初总伤:338',
    extraStat: '耐力 +5',
    highlights: ['简易', '破甲术'],
    baseStats: { damage: 253, hit: 430, endurance: 5 },
    stats: { damage: 253, hit: 430, endurance: 5 },
    price: 409,
    runeStoneSets: [
      // 组合1：呼风唤雨专属
      [
        { id: 'rs10_1', name: '呼风唤雨·法伤', type: '呼风唤雨', quality: '橙色', description: '专属衣服符石，大幅提升法伤', stats: { magicDamage: 55, magic: 12 } },
        { id: 'rs10_2', name: '九龙诀·双防', type: '九龙诀', quality: '紫色', description: '同时提升物防和法防', stats: { defense: 30, magicDefense: 35 } },
      ],
      // 组合2：生存向
      [
        { id: 'rs11_1', name: '九龙诀·体质', type: '九龙诀', quality: '蓝色', description: '提升生命值', stats: { physique: 15, defense: 35 } },
        { id: 'rs11_2', name: '九龙诀·耐力', type: '九龙诀', quality: '绿色', description: '增加耐力', stats: { endurance: 12, magicDefense: 30 } },
      ],
      // 组合3：攻守兼备
      [
        { id: 'rs12_1', name: '呼风唤雨·全能', type: '呼风唤雨', quality: '红色', description: '攻防全面提升', stats: { magicDamage: 48, defense: 25, magicDefense: 28 } },
        { id: 'rs12_2', name: '回眸一笑·法伤', type: '回眸一笑', quality: '紫色', description: '法伤补充', stats: { magicDamage: 38, magic: 10 } },
      ],
    ],
    runeStoneSetsNames: ['心印', '招云', '腾蛟'],
    activeRuneStoneSet: 0,
  },
  {
    id: 'eq5',
    name: '穰花翠裙',
    type: 'armor',
    mainStat: '防御 +184',
    extraStat: '敏捷 -2 体质 +29',
    baseStats: { defense: 184, agility: -2, physique: 29 },
    stats: { defense: 184, agility: -2, physique: 29 },
    price: 273.6,
    runeStoneSets: [
      // 组合1：极速流
      [
        { id: 'rs13_1', name: '隔���打牛·速度', type: '隔山打牛', quality: '紫色', description: '提升速度', stats: { speed: 28, magicDamage: 18 } },
        { id: 'rs13_2', name: '隔山打牛·敏捷', type: '隔山打牛', quality: '蓝色', description: '提升敏捷', stats: { agility: 12, speed: 15 } },
      ],
      // 组合2：平衡流
      [
        { id: 'rs14_1', name: '回眸一笑·速度', type: '回眸一', quality: '绿色', description: '速度法伤兼顾', stats: { speed: 20, magicDamage: 22 } },
        { id: 'rs14_2', name: '九龙��·全能', type: '九龙诀', quality: '紫色', description: '全属性加成', stats: { speed: 15, defense: 20, magicDamage: 15 } },
      ],
      // 组合3��先手流
      [
        { id: 'rs15_1', name: '隔山打牛·极速', type: '隔山打牛', quality: '橙色', description: '极限速提升', stats: { speed: 35, agility: 8 } },
        { id: 'rs15_2', name: '回眸一笑·敏捷', type: '回眸一笑', quality: '蓝色', description: '敏捷增幅', stats: { agility: 15, speed: 18 } },
      ],
    ],
    runeStoneSetsNames: ['全能', '法门', '逐兽'],
    activeRuneStoneSet: 0,
  },
  {
    id: 'eq6',
    name: '踏雪无痕',
    type: 'shoes',
    mainStat: '躲避 +75',
    baseStats: { dodge: 75, speed: 45, agility: 15 },
    stats: { dodge: 75, speed: 45, agility: 15 },
    price: 3200,
    runeStoneSets: [
      // 组合1：速度优先
      [
        { id: 'rs16_1', name: '九龙诀·速度', type: '九龙诀', quality: '紫色', description: '大幅提升速度', stats: { speed: 30, agility: 8 } },
        { id: 'rs16_2', name: '隔山打牛·法伤', type: '山打牛', quality: '橙色', description: '提升法伤', stats: { magicDamage: 32, speed: 12 } },
      ],
      // 组合2：敏捷加强
      [
        { id: 'rs17_1', name: '隔山打牛·敏捷', type: '隔山打牛', quality: '蓝色', description: '敏捷提升', stats: { agility: 18, speed: 15 } },
        { id: 'rs17_2', name: '回眸一笑·速度', type: '回眸一笑', quality: '绿色', description: '速度补充', stats: { speed: 20, magicDamage: 18 } },
      ],
      // 组合3：输出鞋
      [
        { id: 'rs18_1', name: '回眸一笑·法伤', type: '回眸一笑', quality: '红色', description: '法伤加成', stats: { magicDamage: 35, speed: 10 } },
        { id: 'rs18_2', name: '九龙诀·魔力', type: '九龙诀', quality: '紫色', description: '魔力提升', stats: { magic: 15, magicDamage: 25 } },
      ],
    ],
    runeStoneSetsNames: ['聚焦', '仙骨', '药香'],
    activeRuneStoneSet: 0,
  },
  // 灵饰
  {
    id: 'trinket1',
    name: '神命须弥',
    type: 'trinket',
    slot: 1,
    mainStat: '法术伤害 +125',
    baseStats: { magicDamage: 125, magic: 22, speed: 8 },
    stats: { magicDamage: 125, magic: 22, speed: 8 },
    price: 3800,
  },
  {
    id: 'trinket2',
    name: '破军须弥',
    type: 'trinket',
    slot: 2,
    mainStat: '法力 +180',
    baseStats: { magic: 180, magicDamage: 85, speed: 12 },
    stats: { magic: 180, magicDamage: 85, speed: 12 },
    price: 3500,
  },
  {
    id: 'trinket3',
    name: '皓雪无痕',
    type: 'trinket',
    slot: 3,
    mainStat: '速度 +38',
    baseStats: { speed: 38, magicDamage: 95, agility: 8 },
    stats: { speed: 38, magicDamage: 95, agility: 8 },
    price: 4200,
  },
  {
    id: 'trinket4',
    name: '坠星无痕',
    type: 'trinket',
    slot: 4,
    mainStat: '法术伤害 +118',
    baseStats: { magicDamage: 118, magic: 28, hit: 15 },
    stats: { magicDamage: 118, magic: 28, hit: 15 },
    price: 3600,
  },
  // 玉魄
  {
    id: 'jade1',
    name: '阳玉',
    type: 'jade',
    slot: 1,
    mainStat: '法术伤害 +95',
    baseStats: { magicDamage: 95, magic: 18, speed: 6 },
    stats: { magicDamage: 95, magic: 18, speed: 6 },
    price: 2800,
  },
  {
    id: 'jade2',
    name: '阴玉',
    type: 'jade',
    slot: 2,
    mainStat: '法力 +120',
    baseStats: { magic: 120, magicDamage: 68, defense: 25 },
    stats: { magic: 120, magicDamage: 68, defense: 25 },
    price: 2600,
  },
];

// 测试用的替代装备
export const ALTERNATIVE_EQUIPMENTS: Equipment[] = [
  {
    id: 'wea_alt_1',
    name: '无级别长剑',
    type: 'weapon',
    mainStat: '伤害 +480',
    baseStats: { damage: 480, hit: 520, strength: 30, magic: -10 },
    stats: { damage: 480, hit: 520, strength: 30, magic: -10 },
    runeStoneSets: [
      // 第1套：极限法伤
      [
        { id: 'trs1_1', type: 'red', level: 6, stats: { magicDamage: 25, hit: 10 } },
        { id: 'trs1_2', type: 'blue', level: 6, stats: { magic: 20, speed: 10 } },
        { id: 'trs1_3', type: 'red', level: 5, stats: { magicDamage: 20, hit: 8 } },
        { id: 'trs1_4', type: 'blue', level: 5, stats: { magic: 18, speed: 8 } }
      ],
      // 第2套：法速衡
      [
        { id: 'trs1_5', type: 'yellow', level: 6, stats: { speed: 25, agility: 15 } },
        { id: 'trs1_6', type: 'blue', level: 6, stats: { magic: 22, speed: 12 } },
        { id: 'trs1_7', type: 'yellow', level: 5, stats: { speed: 18, agility: 12 } },
        { id: 'trs1_8', type: 'blue', level: 5, stats: { magic: 16, speed: 10 } }
      ],
      // 第3套：高速流
      [
        { id: 'trs1_9', type: 'yellow', level: 6, stats: { speed: 30, agility: 20 } },
        { id: 'trs1_10', type: 'blue', level: 6, stats: { magic: 15, speed: 15 } },
        { id: 'trs1_11', type: 'yellow', level: 5, stats: { speed: 22, agility: 15 } },
        { id: 'trs1_12', type: 'blue', level: 5, stats: { magic: 15, speed: 12 } }
      ]
    ],
    runeStoneSetsNames: ['心印', '招云', '腾蛟'],
    activeRuneStoneSet: 0,
  },
  {
    id: 'wea_alt_2',
    name: '专用法杖',
    type: 'weapon',
    mainStat: '伤害 +550',
    baseStats: { damage: 550, hit: 600, magic: 35, agility: 15 },
    stats: { damage: 550, hit: 600, magic: 35, agility: 15 },
    runeStoneSets: [
      // 第1套：极限法伤
      [
        { id: 'trs2_1', type: 'red', level: 6, stats: { magicDamage: 28, hit: 12 } },
        { id: 'trs2_2', type: 'blue', level: 6, stats: { magic: 22, speed: 11 } },
        { id: 'trs2_3', type: 'red', level: 5, stats: { magicDamage: 19, hit: 7 } },
        { id: 'trs2_4', type: 'blue', level: 5, stats: { magic: 17, speed: 7 } }
      ],
      [
        { id: 'trs2_5', type: 'red', level: 6, stats: { magicDamage: 23, hit: 9 } },
        { id: 'trs2_6', type: 'blue', level: 6, stats: { magic: 19, speed: 10 } },
        { id: 'trs2_7', type: 'yellow', level: 5, stats: { speed: 17, agility: 11 } },
        { id: 'trs2_8', type: 'blue', level: 5, stats: { magic: 15, speed: 9 } }
      ],
      [
        { id: 'trs2_9', type: 'yellow', level: 6, stats: { speed: 24, agility: 14 } },
        { id: 'trs2_10', type: 'blue', level: 6, stats: { magic: 18, speed: 11 } },
        { id: 'trs2_11', type: 'yellow', level: 5, stats: { speed: 16, agility: 10 } },
        { id: 'trs2_12', type: 'blue', level: 5, stats: { magic: 14, speed: 11 } }
      ]
    ],
    runeStoneSetsNames: ['全能', '法门', '逐兽'],
    activeRuneStoneSet: 0,
  },
  {
    id: 'wea_alt_3',
    name: '敏魔双加弓',
    type: 'weapon',
    mainStat: '伤害 +500',
    baseStats: { damage: 500, hit: 550, magic: 20, agility: 20 },
    stats: { damage: 500, hit: 550, magic: 20, agility: 20 },
    runeStoneSets: [
      // 第1套：极限法伤
      [
        { id: 'trs3_1', type: 'red', level: 6, stats: { magicDamage: 24, hit: 11 } },
        { id: 'trs3_2', type: 'blue', level: 6, stats: { magic: 21, speed: 12 } },
        { id: 'trs3_3', type: 'red', level: 5, stats: { magicDamage: 21, hit: 9 } },
        { id: 'trs3_4', type: 'blue', level: 5, stats: { magic: 19, speed: 9 } }
      ],
      [
        { id: 'trs3_5', type: 'red', level: 6, stats: { magicDamage: 25, hit: 11 } },
        { id: 'trs3_6', type: 'blue', level: 6, stats: { magic: 21, speed: 12 } },
        { id: 'trs3_7', type: 'yellow', level: 5, stats: { speed: 19, agility: 13 } },
        { id: 'trs3_8', type: 'blue', level: 5, stats: { magic: 17, speed: 11 } }
      ],
      [
        { id: 'trs3_9', type: 'yellow', level: 6, stats: { speed: 26, agility: 16 } },
        { id: 'trs3_10', type: 'blue', level: 6, stats: { magic: 20, speed: 13 } },
        { id: 'trs3_11', type: 'yellow', level: 5, stats: { speed: 18, agility: 12 } },
        { id: 'trs3_12', type: 'blue', level: 5, stats: { magic: 16, speed: 13 } }
      ]
    ],
    runeStoneSetsNames: ['聚焦', '仙骨', '药香'],
    activeRuneStoneSet: 0,
  },
  {
    id: 'wea_alt_4',
    name: '高伤大刀',
    type: 'weapon',
    mainStat: '伤害 +580',
    baseStats: { damage: 580, hit: 620, strength: 40 },
    stats: { damage: 580, hit: 620, strength: 40 },
    runeStoneSets: [
      // 第1��：极限法伤
      [
        { id: 'trs4_1', type: 'red', level: 6, stats: { magicDamage: 26, hit: 12 } },
        { id: 'trs4_2', type: 'blue', level: 6, stats: { magic: 23, speed: 13 } },
        { id: 'trs4_3', type: 'red', level: 5, stats: { magicDamage: 22, hit: 9 } },
        { id: 'trs4_4', type: 'blue', level: 5, stats: { magic: 20, speed: 10 } }
      ],
      [
        { id: 'trs4_5', type: 'red', level: 6, stats: { magicDamage: 26, hit: 12 } },
        { id: 'trs4_6', type: 'blue', level: 6, stats: { magic: 23, speed: 13 } },
        { id: 'trs4_7', type: 'yellow', level: 5, stats: { speed: 20, agility: 14 } },
        { id: 'trs4_8', type: 'blue', level: 5, stats: { magic: 18, speed: 12 } }
      ],
      [
        { id: 'trs4_9', type: 'yellow', level: 6, stats: { speed: 27, agility: 17 } },
        { id: 'trs4_10', type: 'blue', level: 6, stats: { magic: 21, speed: 14 } },
        { id: 'trs4_11', type: 'yellow', level: 5, stats: { speed: 19, agility: 13 } },
        { id: 'trs4_12', type: 'blue', level: 5, stats: { magic: 17, speed: 14 } }
      ]
    ],
    runeStoneSetsNames: ['全能', '法门', '逐兽'],
    activeRuneStoneSet: 0,
  },
  {
    id: 'nek_alt_1',
    name: '初级法术项链',
    type: 'necklace',
    mainStat: '法术伤害 +150',
    baseStats: { magicDamage: 150, magic: 20 },
    stats: { magicDamage: 150, magic: 20 },
    runeStoneSets: [
      // 第1套：法伤流
      [
        { id: 'jrs1_1', type: 'red', level: 6, stats: { magicDamage: 20, hit: 8 } },
        { id: 'jrs1_2', type: 'red', level: 5, stats: { magicDamage: 16, hit: 6 } },
        { id: 'jrs1_3', type: 'blue', level: 4, stats: { magic: 12, speed: 5 } }
      ],
      // 第2套：速度流
      [
        { id: 'jrs1_4', type: 'yellow', level: 5, stats: { speed: 15, agility: 10 } },
        { id: 'jrs1_5', type: 'yellow', level: 4, stats: { speed: 12, agility: 8 } },
        { id: 'jrs1_6', type: 'blue', level: 4, stats: { magic: 10, speed: 6 } }
      ],
      // 第3套：防御流
      [
        { id: 'jrs1_7', type: 'purple', level: 6, stats: { magicDefense: 30, physique: 12 } },
        { id: 'jrs1_8', type: 'purple', level: 5, stats: { magicDefense: 25, physique: 10 } },
        { id: 'jrs1_9', type: 'purple', level: 4, stats: { magicDefense: 22, physique: 8 } }
      ]
    ],
    runeStoneSetsNames: ['心印', '招云', '腾蛟'],
    activeRuneStoneSet: 0,
  }
];
