// @ts-nocheck
import { Equipment } from '../store/gameStore';

/**
 * 模拟OCR识别延迟
 */
export const simulateOcrDelay = (ms: number = 1500): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * 从图片文件模拟识别装备数据
 */
export const mockOcrEquipment = async (file: File): Promise<Equipment> => {
  await simulateOcrDelay();
  
  // 根据文件名或随机生成模拟装备
  const equipmentTemplates: Equipment[] = [
    {
      id: Date.now().toString(),
      name: '无双神剑',
      type: 'weapon',
      mainStat: '伤害 +320',
      stats: { damage: 320, hit: 180, strength: 25, agility: 10 }
    },
    {
      id: Date.now().toString(),
      name: '龙吟宝刀',
      type: 'weapon',
      mainStat: '伤害 +295',
      stats: { damage: 295, hit: 165, strength: 22, physique: 8 }
    },
    {
      id: Date.now().toString(),
      name: '紫电青霜',
      type: 'weapon',
      mainStat: '伤害 +340',
      stats: { damage: 340, hit: 200, strength: 30, agility: 15 }
    },
    {
      id: Date.now().toString(),
      name: '天罡战盔',
      type: 'helmet',
      mainStat: '防御 +145',
      stats: { defense: 145, physique: 20, endurance: 10 }
    },
    {
      id: Date.now().toString(),
      name: '凤凰玉佩',
      type: 'necklace',
      mainStat: '法伤 +210',
      stats: { magicDamage: 210, magic: 30, speed: 20 }
    },
    {
      id: Date.now().toString(),
      name: '白虎战甲',
      type: 'armor',
      mainStat: '防御 +200',
      stats: { defense: 200, physique: 30, endurance: 20 }
    },
    {
      id: Date.now().toString(),
      name: '神行腰带',
      type: 'belt',
      mainStat: '速度 +45',
      stats: { speed: 45, agility: 18, physique: 10 }
    },
    {
      id: Date.now().toString(),
      name: '云履',
      type: 'shoes',
      mainStat: '速度 +65',
      stats: { speed: 65, agility: 28, physique: 10 }
    },
  ];
  
  // 随机返回一个装备
  return equipmentTemplates[Math.floor(Math.random() * equipmentTemplates.length)];
};

/**
 * 验证图片文件格式
 */
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  
  if (!validTypes.includes(file.type)) {
    return { valid: false, error: '仅支持 JPG、PNG、WEBP 格式图片' };
  }
  
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return { valid: false, error: '图片大小不能超过 10MB' };
  }
  
  return { valid: true };
};

/**
 * 格式化时间戳
 */
export const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  // 小于1分钟
  if (diff < 60000) {
    return '刚刚';
  }
  
  // 小于1小时
  if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`;
  }
  
  // 小于1天
  if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}小时前`;
  }
  
  // 否则显示完整日期
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * 生成随机ID
 */
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * 计算属性差值百分比
 */
export const calculateDeltaPercentage = (current: number, newValue: number): number => {
  if (current === 0) return 100;
  return Math.round(((newValue - current) / current) * 100);
};

/**
 * 格式化大数字
 */
export const formatLargeNumber = (num: number): string => {
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}万`;
  }
  return num.toLocaleString('zh-CN');
};
