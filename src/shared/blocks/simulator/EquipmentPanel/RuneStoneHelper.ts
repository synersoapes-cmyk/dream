// @ts-nocheck
import type { Equipment } from '@/features/simulator/store/gameTypes';

// 获取装备的符石套装效果描述
export const VALID_RUNE_SETS = ["隔山打牛", "回眸一笑", "万丈霞光", "飞檐走壁", "高山流水", "云随风舞"];

export function getEquipmentRuneStoneSetInfo(equipments: Equipment[]): string[] {
  const runeStoneInfo: string[] = [];
  
  equipments.forEach(eq => {
    if (eq.runeStoneSets && eq.runeStoneSetsNames && eq.activeRuneStoneSet !== undefined) {
      const setName = eq.runeStoneSetsNames[eq.activeRuneStoneSet];
      if (setName) {
        const cleanName = setName.split(/[:：]/)[0].trim();
        const validMatch = VALID_RUNE_SETS.find(valid => cleanName.includes(valid));
        if (validMatch) {
          runeStoneInfo.push(validMatch);
        }
      }
    }
  });
  
  return Array.from(new Set(runeStoneInfo));
}

// 获取整合的符石套装效果（所有装备的套装信息合并为一个字符串）
export function getConsolidatedRuneStoneSetInfo(equipments: Equipment[]): string {
  const runeStoneInfo = getEquipmentRuneStoneSetInfo(equipments);
  
  if (runeStoneInfo.length === 0) {
    return '';
  }
  
  // 仅需要保留名称，每个席位只有一个值
  return runeStoneInfo[0];
}
