import type { Equipment } from '@/features/simulator/store/gameTypes';

function toText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

export function getEquipmentRuneStoneSetInfo(
  equipments: Equipment[]
): string[] {
  const runeStoneInfo: string[] = [];

  equipments.forEach((eq) => {
    if (
      !Array.isArray(eq.runeStoneSetsNames) ||
      eq.runeStoneSetsNames.length === 0
    ) {
      return;
    }

    const activeIndex = eq.activeRuneStoneSet ?? 0;
    const setName =
      toText(eq.runeStoneSetsNames[activeIndex]) ??
      toText(eq.runeStoneSetsNames[0]);

    if (setName) {
      runeStoneInfo.push(setName.split(/[:：]/)[0].trim());
    }
  });

  return Array.from(new Set(runeStoneInfo));
}

// 获取整合的符石套装效果（所有装备的套装信息合并为一个字符串）
export function getConsolidatedRuneStoneSetInfo(
  equipments: Equipment[]
): string {
  const runeStoneInfo = getEquipmentRuneStoneSetInfo(equipments);

  if (runeStoneInfo.length === 0) {
    return '';
  }

  // 仅需要保留名称，每个席位只有一个值
  return runeStoneInfo[0];
}
