import type { Equipment } from '@/features/simulator/store/gameTypes';

function normalizeText(value?: string) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function pushTag(tags: string[], seen: Set<string>, value?: string) {
  const normalized = normalizeText(value);
  if (!normalized || seen.has(normalized)) {
    return;
  }

  seen.add(normalized);
  tags.push(normalized);
}

export function getEquipmentSpotlightTags(equipment: Equipment): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();

  equipment.highlights?.forEach((item) => pushTag(tags, seen, item));

  pushTag(
    tags,
    seen,
    equipment.specialEffect ? `特效 ${equipment.specialEffect}` : undefined
  );
  pushTag(
    tags,
    seen,
    equipment.runeSetEffect ? `符石套装 ${equipment.runeSetEffect}` : undefined
  );
  pushTag(tags, seen, equipment.setName ? `套装 ${equipment.setName}` : undefined);
  pushTag(
    tags,
    seen,
    equipment.luckyHoles ? `开孔 ${equipment.luckyHoles}` : undefined
  );
  pushTag(
    tags,
    seen,
    equipment.repairFailCount !== undefined
      ? `修理失败 ${equipment.repairFailCount}`
      : undefined
  );
  pushTag(tags, seen, equipment.gemstone ? `宝石 ${equipment.gemstone}` : undefined);
  pushTag(tags, seen, equipment.element ? `五行 ${equipment.element}` : undefined);

  return tags;
}
