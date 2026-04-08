import type { Dungeon } from './gameTypes';

// Local fallback dungeon targets used when cloud templates are unavailable.
export const DUNGEON_DATABASE: Dungeon[] = [
  {
    id: 'd1',
    name: '乌鸡国',
    level: 50,
    difficulty: 'easy',
    description: '基础副本，怪物法防较低，适合测试基础群秒伤害。',
    targets: [
      { name: '树怪', level: 55, hp: 8000, defense: 300, magicDefense: 200, id: 'd1_1' },
      { name: '野猪', level: 55, hp: 12000, defense: 400, magicDefense: 150, id: 'd1_2' },
      { name: '强盗', level: 55, hp: 10000, defense: 350, magicDefense: 250, id: 'd1_3' },
      { name: '乌鸡国王', level: 60, hp: 25000, defense: 600, magicDefense: 450, isBoss: true, id: 'd1_4' },
    ],
  },
  {
    id: 'd2',
    name: '水陆大会',
    level: 70,
    difficulty: 'normal',
    description: '常规副本，有一定的法术抗性，测试法穿效果。',
    targets: [
      { name: '虾兵', level: 75, hp: 15000, defense: 500, magicDefense: 400, id: 'd2_1' },
      { name: '蟹将', level: 75, hp: 18000, defense: 700, magicDefense: 350, id: 'd2_2' },
      { name: '龟丞相', level: 75, hp: 22000, defense: 800, magicDefense: 600, id: 'd2_3' },
      { name: '毒战将', level: 80, hp: 45000, defense: 1000, magicDefense: 800, isBoss: true, id: 'd2_4' },
    ],
  },
  {
    id: 'd3',
    name: '车迟国',
    level: 90,
    difficulty: 'hard',
    description: '高难度副本，怪物法防极高，是测试极限法伤的试金石。',
    targets: [
      { name: '羊力大仙', level: 95, hp: 35000, defense: 1200, magicDefense: 1200, id: 'd3_1' },
      { name: '鹿力大仙', level: 95, hp: 40000, defense: 1500, magicDefense: 1500, id: 'd3_2' },
      { name: '虎力大仙', level: 95, hp: 45000, defense: 1800, magicDefense: 1800, id: 'd3_3' },
      { name: '车迟国师', level: 100, hp: 80000, defense: 2200, magicDefense: 2500, isBoss: true, id: 'd3_4' },
    ],
  },
  {
    id: 'd4',
    name: '大雁塔',
    level: 110,
    difficulty: 'nightmare',
    description: '顶级挑战，怪物具备超高双防和血量。',
    targets: [
      { name: '镇塔之神', level: 115, hp: 80000, defense: 2500, magicDefense: 2200, id: 'd4_1' },
      { name: '护塔灵兽', level: 115, hp: 120000, defense: 2800, magicDefense: 2000, id: 'd4_2' },
      { name: '千年蛇魅', level: 115, hp: 95000, defense: 2000, magicDefense: 3000, id: 'd4_3' },
      { name: '万年熊王', level: 120, hp: 200000, defense: 3500, magicDefense: 3500, isBoss: true, id: 'd4_4' },
    ],
  },
];
