import type { Equipment } from '@/features/simulator/store/gameTypes';
import { resolveRuneComboActivation } from '@/shared/lib/simulator-rune-combo';

function toText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function toPositiveHoleCount(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : null;
}

function getRuneStoneSetDisplayState(eq: Equipment): string | null {
  if (
    !Array.isArray(eq.runeStoneSetsNames) ||
    eq.runeStoneSetsNames.length === 0
  ) {
    return null;
  }

  const activeIndex = eq.activeRuneStoneSet ?? 0;
  const setName =
    toText(eq.runeStoneSetsNames[activeIndex]) ??
    toText(eq.runeStoneSetsNames[0]);

  if (!setName) {
    return null;
  }

  const luckyHoles = toPositiveHoleCount(eq.luckyHoles);
  const activeRuneSet =
    eq.runeStoneSets?.[activeIndex] ?? eq.runeStoneSets?.[0] ?? [];
  const comboActivation = resolveRuneComboActivation(eq);

  if (
    luckyHoles === 0 ||
    (Array.isArray(activeRuneSet) && activeRuneSet.length === 0) ||
    !comboActivation.isActivated
  ) {
    return '未激活';
  }

  return setName.split(/[:：]/)[0].trim();
}

export function getEquipmentRuneStoneSetInfo(
  equipments: Equipment[]
): string[] {
  const runeStoneInfo: string[] = [];

  equipments.forEach((eq) => {
    const displayState = getRuneStoneSetDisplayState(eq);
    if (displayState) {
      runeStoneInfo.push(displayState);
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
