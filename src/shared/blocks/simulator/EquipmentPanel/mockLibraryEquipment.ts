// @ts-nocheck
import type { Equipment } from '@/features/simulator/store/gameTypes';

// 模拟装备库数据
export const MOCK_LIBRARY_EQUIPMENT: Equipment[] = [
  // 武器类
  {
    id: 'lib_weapon_1',
    name: '破军斩',
    type: 'weapon',
    mainStat: '命中 +685 伤害 +512',
    extraStat: '体质 +25 敏捷 +18',
    highlights: ['无级别', '破血狂攻'],
    price: 8500,
    crossServerFee: 850,
    stats: { damage: 512, hit: 685, physique: 25, agility: 18 }
  },
  {
    id: 'lib_weapon_2',
    name: '神威天罡锤',
    type: 'weapon',
    mainStat: '命中 +620 伤害 +470',
    extraStat: '力量 +28',
    highlights: ['高伤', '专用武器'],
    price: 6200,
    crossServerFee: 620,
    stats: { damage: 470, hit: 620, strength: 28 }
  },
  {
    id: 'lib_weapon_3',
    name: '追魂夺魄枪',
    type: 'weapon',
    mainStat: '命中 +598 伤害 +445',
    extraStat: '敏捷 +22 速度 +12',
    highlights: ['双加敏捷', '速度加成'],
    price: 5800,
    crossServerFee: 580,
    stats: { damage: 445, hit: 598, agility: 22, speed: 12 }
  },
  {
    id: 'lib_weapon_4',
    name: '龙吟',
    type: 'weapon',
    mainStat: '命中 +712 伤害 +528',
    extraStat: '体质 +30 力量 +20',
    highlights: ['无级别', '双加'],
    price: 12000,
    crossServerFee: 1200,
    stats: { damage: 528, hit: 712, physique: 30, strength: 20 }
  },
  
  // 头盔类
  {
    id: 'lib_helmet_1',
    name: '玄武战盔',
    type: 'helmet',
    mainStat: '防御 +245 气血 +380',
    extraStat: '体质 +20 耐力 +15',
    highlights: ['高防', '双加'],
    price: 3500,
    crossServerFee: 350,
    stats: { defense: 245, hp: 380, physique: 20, endurance: 15 }
  },
  {
    id: 'lib_helmet_2',
    name: '法神冠',
    type: 'helmet',
    mainStat: '魔法 +288 法防 +175',
    extraStat: '魔力 +35 速度 +18',
    highlights: ['高魔力', '速度加成'],
    price: 4200,
    crossServerFee: 420,
    stats: { magic: 288, magicDefense: 175, magicPower: 35, speed: 18 }
  },
  {
    id: 'lib_helmet_3',
    name: '霸者之盔',
    type: 'helmet',
    mainStat: '防御 +268 气血 +420',
    extraStat: '体质 +25',
    highlights: ['超高血量', '防御优秀'],
    price: 3800,
    crossServerFee: 380,
    stats: { defense: 268, hp: 420, physique: 25 }
  },
  
  // 项链类
  {
    id: 'lib_necklace_1',
    name: '凤舞九天',
    type: 'necklace',
    mainStat: '气血 +485 速度 +75',
    extraStat: '体质 +32 耐力 +25',
    highlights: ['超高速', '神农特技'],
    price: 15000,
    crossServerFee: 1500,
    stats: { hp: 485, speed: 75, physique: 32, endurance: 25 }
  },
  {
    id: 'lib_necklace_2',
    name: '玉清链',
    type: 'necklace',
    mainStat: '气血 +420 速度 +62',
    extraStat: '魔力 +28',
    highlights: ['高速', '高魔力'],
    price: 8500,
    crossServerFee: 850,
    stats: { hp: 420, speed: 62, magicPower: 28 }
  },
  {
    id: 'lib_necklace_3',
    name: '龙鳞护心坠',
    type: 'necklace',
    mainStat: '气血 +510 速度 +58',
    extraStat: '体质 +38',
    highlights: ['超高血量', '体质优秀'],
    price: 7200,
    crossServerFee: 720,
    stats: { hp: 510, speed: 58, physique: 38 }
  },
  
  // 衣服类
  {
    id: 'lib_armor_1',
    name: '天罡战甲',
    type: 'armor',
    mainStat: '防御 +325 气血 +520',
    extraStat: '体质 +35 耐力 +28',
    highlights: ['超高防御', '罗汉特技'],
    price: 18000,
    crossServerFee: 1800,
    stats: { defense: 325, hp: 520, physique: 35, endurance: 28 }
  },
  {
    id: 'lib_armor_2',
    name: '星辰法袍',
    type: 'armor',
    mainStat: '法防 +285 魔法 +380',
    extraStat: '魔力 +42 速度 +20',
    highlights: ['高法防', '愤怒特技'],
    price: 12500,
    crossServerFee: 1250,
    stats: { magicDefense: 285, magic: 380, magicPower: 42, speed: 20 }
  },
  {
    id: 'lib_armor_3',
    name: '龙鳞甲',
    type: 'armor',
    mainStat: '防御 +298 气血 +485',
    extraStat: '体质 +30',
    highlights: ['防御优秀', '血量充足'],
    price: 9800,
    crossServerFee: 980,
    stats: { defense: 298, hp: 485, physique: 30 }
  },
  
  // 腰带类
  {
    id: 'lib_belt_1',
    name: '碧海腰带',
    type: 'belt',
    mainStat: '气血 +368 防御 +210',
    extraStat: '速度 +48 体质 +22',
    highlights: ['愤怒特技', '高速'],
    price: 14000,
    crossServerFee: 1400,
    stats: { hp: 368, defense: 210, speed: 48, physique: 22 }
  },
  {
    id: 'lib_belt_2',
    name: '玄铁束带',
    type: 'belt',
    mainStat: '气血 +385 防御 +225',
    extraStat: '体质 +28 耐力 +18',
    highlights: ['高防御', '双加'],
    price: 8200,
    crossServerFee: 820,
    stats: { hp: 385, defense: 225, physique: 28, endurance: 18 }
  },
  {
    id: 'lib_belt_3',
    name: '法师腰带',
    type: 'belt',
    mainStat: '气血 +340 法防 +195',
    extraStat: '魔力 +38 速度 +25',
    highlights: ['高魔力', '速度优秀'],
    price: 7500,
    crossServerFee: 750,
    stats: { hp: 340, magicDefense: 195, magicPower: 38, speed: 25 }
  },
  
  // 鞋子类
  {
    id: 'lib_shoes_1',
    name: '追风靴',
    type: 'shoes',
    mainStat: '防御 +168 速度 +82',
    extraStat: '敏捷 +38 体质 +20',
    highlights: ['超高速', '敏捷极品'],
    price: 22000,
    crossServerFee: 2200,
    stats: { defense: 168, speed: 82, agility: 38, physique: 20 }
  },
  {
    id: 'lib_shoes_2',
    name: '云步履',
    type: 'shoes',
    mainStat: '防御 +152 速度 +72',
    extraStat: '敏捷 +30 速度 +15',
    highlights: ['超高速', '双速度'],
    price: 16500,
    crossServerFee: 1650,
    stats: { defense: 152, speed: 87, agility: 30 }
  },
  {
    id: 'lib_shoes_3',
    name: '金甲战靴',
    type: 'shoes',
    mainStat: '防御 +185 速度 +65',
    extraStat: '体质 +25',
    highlights: ['高防御', '速度充足'],
    price: 8800,
    crossServerFee: 880,
    stats: { defense: 185, speed: 65, physique: 25 }
  },
  
  // 戒指类（灵饰）
  {
    id: 'lib_ring_1',
    name: '霜寒指环',
    type: 'trinket',
    slot: 1,
    mainStat: '法伤 +125 魔法 +88',
    extraStat: '魔力 +18',
    highlights: ['高法伤', '魔力优秀'],
    price: 9500,
    crossServerFee: 950,
    stats: { magicDamage: 125, magic: 88, magicPower: 18 }
  },
  {
    id: 'lib_ring_2',
    name: '烈焰戒',
    type: 'trinket',
    slot: 1,
    mainStat: '法伤 +138 魔法 +95',
    extraStat: '魔力 +22 速度 +8',
    highlights: ['超高法伤', '双加'],
    price: 12800,
    crossServerFee: 1280,
    stats: { magicDamage: 138, magic: 95, magicPower: 22, speed: 8 }
  },
  {
    id: 'lib_ring_3',
    name: '疾风指环',
    type: 'trinket',
    slot: 1,
    mainStat: '伤害 +102 命中 +75',
    extraStat: '敏捷 +20',
    highlights: ['高伤害', '敏捷优秀'],
    price: 8900,
    crossServerFee: 890,
    stats: { damage: 102, hit: 75, agility: 20 }
  },
  {
    id: 'lib_ring_4',
    name: '龙纹戒',
    type: 'trinket',
    slot: 1,
    mainStat: '伤害 +115 命中 +82',
    extraStat: '力量 +25 体质 +15',
    highlights: ['超高伤害', '双加'],
    price: 11200,
    crossServerFee: 1120,
    stats: { damage: 115, hit: 82, strength: 25, physique: 15 }
  },
  
  // 耳饰类（灵饰）
  {
    id: 'lib_earring_1',
    name: '月华耳坠',
    type: 'trinket',
    slot: 2,
    mainStat: '法伤 +118 法防 +85',
    extraStat: '魔力 +20',
    highlights: ['高法伤', '法防优秀'],
    price: 8800,
    crossServerFee: 880,
    stats: { magicDamage: 118, magicDefense: 85, magicPower: 20 }
  },
  {
    id: 'lib_earring_2',
    name: '星耀耳环',
    type: 'trinket',
    slot: 2,
    mainStat: '法伤 +132 法防 +92',
    extraStat: '魔力 +25 速度 +10',
    highlights: ['超高法伤', '双加'],
    price: 13500,
    crossServerFee: 1350,
    stats: { magicDamage: 132, magicDefense: 92, magicPower: 25, speed: 10 }
  },
  {
    id: 'lib_earring_3',
    name: '破军耳坠',
    type: 'trinket',
    slot: 2,
    mainStat: '伤害 +95 防御 +68',
    extraStat: '力量 +18',
    highlights: ['高伤害', '防御充足'],
    price: 7500,
    crossServerFee: 750,
    stats: { damage: 95, defense: 68, strength: 18 }
  },
  
  // 手镯类（灵饰）
  {
    id: 'lib_bracelet_1',
    name: '冰心镯',
    type: 'trinket',
    slot: 3,
    mainStat: '法伤 +122 气血 +180',
    extraStat: '魔力 +22',
    highlights: ['高法伤', '血量优秀'],
    price: 10200,
    crossServerFee: 1020,
    stats: { magicDamage: 122, hp: 180, magicPower: 22 }
  },
  {
    id: 'lib_bracelet_2',
    name: '紫金镯',
    type: 'trinket',
    slot: 3,
    mainStat: '法伤 +135 气血 +195',
    extraStat: '魔力 +28 体质 +12',
    highlights: ['超高法伤', '双加'],
    price: 14800,
    crossServerFee: 1480,
    stats: { magicDamage: 135, hp: 195, magicPower: 28, physique: 12 }
  },
  {
    id: 'lib_bracelet_3',
    name: '战神手镯',
    type: 'trinket',
    slot: 3,
    mainStat: '伤害 +98 气血 +165',
    extraStat: '力量 +20',
    highlights: ['高伤害', '血量充足'],
    price: 8200,
    crossServerFee: 820,
    stats: { damage: 98, hp: 165, strength: 20 }
  },
  {
    id: 'lib_bracelet_4',
    name: '龙鳞镯',
    type: 'trinket',
    slot: 3,
    mainStat: '伤害 +108 气血 +185',
    extraStat: '力量 +25 体质 +18',
    highlights: ['超高伤害', '双加'],
    price: 12500,
    crossServerFee: 1250,
    stats: { damage: 108, hp: 185, strength: 25, physique: 18 }
  },
  
  // 佩饰类（灵饰）
  {
    id: 'lib_pendant_1',
    name: '玄天佩',
    type: 'trinket',
    slot: 4,
    mainStat: '法伤 +128 速度 +35',
    extraStat: '魔力 +24',
    highlights: ['高法伤', '速度优秀'],
    price: 11500,
    crossServerFee: 1150,
    stats: { magicDamage: 128, speed: 35, magicPower: 24 }
  },
  {
    id: 'lib_pendant_2',
    name: '凤鸣佩',
    type: 'trinket',
    slot: 4,
    mainStat: '法伤 +142 速度 +42',
    extraStat: '魔力 +30 敏捷 +15',
    highlights: ['超高法伤', '高速'],
    price: 16800,
    crossServerFee: 1680,
    stats: { magicDamage: 142, speed: 42, magicPower: 30, agility: 15 }
  },
  {
    id: 'lib_pendant_3',
    name: '霸者之佩',
    type: 'trinket',
    slot: 4,
    mainStat: '伤害 +105 速度 +38',
    extraStat: '力量 +22',
    highlights: ['高伤害', '速度优秀'],
    price: 9800,
    crossServerFee: 980,
    stats: { damage: 105, speed: 38, strength: 22 }
  },
  
  // 玉魄类
  {
    id: 'lib_jade_1',
    name: '青龙玉魄',
    type: 'jade',
    slot: 1,
    mainStat: '气血 +280 法防 +120',
    extraStat: '魔力 +25 体质 +18',
    highlights: ['高血量', '双加'],
    price: 8500,
    crossServerFee: 850,
    stats: { hp: 280, magicDefense: 120, magicPower: 25, physique: 18 }
  },
  {
    id: 'lib_jade_2',
    name: '白虎玉魄',
    type: 'jade',
    slot: 1,
    mainStat: '气血 +265 防御 +135',
    extraStat: '力量 +28 耐力 +15',
    highlights: ['高防御', '双加'],
    price: 7800,
    crossServerFee: 780,
    stats: { hp: 265, defense: 135, strength: 28, endurance: 15 }
  },
  {
    id: 'lib_jade_3',
    name: '朱雀玉魄',
    type: 'jade',
    slot: 1,
    mainStat: '气血 +295 速度 +40',
    extraStat: '敏捷 +30 体质 +20',
    highlights: ['超高血量', '高速'],
    price: 12000,
    crossServerFee: 1200,
    stats: { hp: 295, speed: 40, agility: 30, physique: 20 }
  },
  {
    id: 'lib_jade_4',
    name: '玄武玉魄',
    type: 'jade',
    slot: 2,
    mainStat: '气血 +310 防御 +145',
    extraStat: '体质 +32 耐力 +22',
    highlights: ['超高血量', '超高防御'],
    price: 15500,
    crossServerFee: 1550,
    stats: { hp: 310, defense: 145, physique: 32, endurance: 22 }
  },
  {
    id: 'lib_jade_5',
    name: '麒麟玉魄',
    type: 'jade',
    slot: 2,
    mainStat: '气血 +285 速度 +45',
    extraStat: '敏捷 +35 魔力 +20',
    highlights: ['超高速', '全能'],
    price: 18000,
    crossServerFee: 1800,
    stats: { hp: 285, speed: 45, agility: 35, magicPower: 20 }
  }
];
