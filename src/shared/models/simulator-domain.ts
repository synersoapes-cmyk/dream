import { inferBaseHpSource } from '@/shared/lib/simulator-base-hp';
import type { SimulatorCharacterBundle } from '@/shared/models/simulator';

type JsonObject = Record<string, unknown>;

export type SimulatorSchool =
  | '龙宫'
  | '大唐官府'
  | '狮驼岭'
  | '化生寺'
  | '方寸山'
  | '普陀山'
  | (string & {});

export type SimulatorRoleType = '法师' | '物理' | '辅助' | (string & {});

export type SimulatorElement = '金' | '木' | '水' | '火' | '土';

export type SimulatorEquipmentSlot =
  | 'weapon'
  | 'helmet'
  | 'necklace'
  | 'armor'
  | 'belt'
  | 'shoes'
  | 'ring'
  | 'earring'
  | 'bracelet'
  | 'amulet'
  | 'jade'
  | 'trinket'
  | (string & {});

export type SimulatorNumericMap = Record<string, number>;

export type SimulatorCoreAttributes = {
  level: number;
  physique: number;
  magic: number;
  strength: number;
  endurance: number;
  agility: number;
  potentialPoints: number;
  hp: number;
  mp: number;
  damage: number;
  defense: number;
  magicDamage: number;
  magicDefense: number;
  speed: number;
  hit: number;
  sealHit: number;
  dodge: number;
  spirit: number;
};

export type SimulatorEquipmentBuildView = {
  holeCount: number;
  gemLevelTotal: number;
  refineLevel: number;
  specialEffect: JsonObject;
  setEffect: JsonObject;
  notes: JsonObject;
};

export type SimulatorEquipmentView = {
  id: string;
  name: string;
  slot: SimulatorEquipmentSlot;
  level: number;
  quality: string;
  price: number;
  source: string;
  status: string;
  isLocked: boolean;
  attributes: SimulatorNumericMap;
  build: SimulatorEquipmentBuildView | null;
};

export type SimulatorSkillView = {
  id: string;
  skillCode: string;
  skillName: string;
  baseLevel: number;
  extraLevel: number;
  finalLevel: number;
  sourceDetail: JsonObject;
};

export type SimulatorCharacterDomain = {
  characterId: string;
  school: SimulatorSchool;
  roleType: SimulatorRoleType;
  profile: SimulatorCoreAttributes;
  attributeSources: SimulatorNumericMap;
  cultivationLevels: SimulatorNumericMap;
  equipmentAttributeTotals: SimulatorNumericMap;
  skills: SimulatorSkillView[];
  equipment: SimulatorEquipmentView[];
  battleContext: {
    selfFormation: string;
    selfElement: string;
    formationCounterState: string;
    elementRelation: string;
    transformCardFactor: number;
    splitTargetCount: number;
    shenmuValue: number;
    magicResult: number;
    targetName: string;
    targetLevel: number;
    targetHp: number;
    targetDefense: number;
    targetMagicDefense: number;
    targetMagicDefenseCultivation: number;
    targetElement: string;
    targetFormation: string;
  } | null;
  rawProfile: JsonObject;
};

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseJsonObject(value: string | null | undefined): JsonObject {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as JsonObject) : {};
  } catch {
    return {};
  }
}

function normalizeEquipmentSlot(slot: string): SimulatorEquipmentSlot {
  if (!slot) {
    return 'weapon';
  }

  const normalized = slot.trim().toLowerCase();
  const slotMap: Record<string, SimulatorEquipmentSlot> = {
    weapon: 'weapon',
    helmet: 'helmet',
    head: 'helmet',
    necklace: 'necklace',
    armor: 'armor',
    clothes: 'armor',
    cloth: 'armor',
    belt: 'belt',
    shoes: 'shoes',
    ring: 'ring',
    earring: 'earring',
    bracelet: 'bracelet',
    amulet: 'amulet',
    jade: 'jade',
    trinket: 'trinket',
    headwear: 'helmet',
  };

  return slotMap[normalized] ?? (slot as SimulatorEquipmentSlot);
}

export function buildSimulatorCharacterDomain(
  bundle: SimulatorCharacterBundle
): SimulatorCharacterDomain | null {
  const profile = bundle.profile;
  if (!profile) {
    return null;
  }

  const rawProfile = parseJsonObject(profile.rawBodyJson);
  const spirit = toFiniteNumber(rawProfile.magicPower);
  const dodge = toFiniteNumber(rawProfile.dodge);

  const equipment = bundle.equipments.map((item) => ({
    id: item.id,
    name: item.name,
    slot: normalizeEquipmentSlot(item.slot),
    level: toFiniteNumber(item.level),
    quality: item.quality ?? '',
    price: toFiniteNumber(item.price),
    source: item.source ?? '',
    status: item.status ?? '',
    isLocked: Boolean(item.isLocked),
    attributes: Object.fromEntries(
      item.attrs.map((attr) => [attr.attrType, toFiniteNumber(attr.attrValue)])
    ),
    build: item.build
      ? {
          holeCount: toFiniteNumber(item.build.holeCount),
          gemLevelTotal: toFiniteNumber(item.build.gemLevelTotal),
          refineLevel: toFiniteNumber(item.build.refineLevel),
          specialEffect: parseJsonObject(item.build.specialEffectJson),
          setEffect: parseJsonObject(item.build.setEffectJson),
          notes: parseJsonObject(item.build.notesJson),
        }
      : null,
  }));

  const equipmentAttributeTotals = equipment.reduce<SimulatorNumericMap>(
    (totals, item) => {
      for (const [key, value] of Object.entries(item.attributes)) {
        totals[key] = (totals[key] ?? 0) + toFiniteNumber(value);
      }

      return totals;
    },
    {}
  );

  const cultivationLevels = bundle.cultivations.reduce<SimulatorNumericMap>(
    (totals, item) => {
      totals[item.cultivationType] = toFiniteNumber(item.level);
      return totals;
    },
    {}
  );

  const skills = bundle.skills.map((item) => ({
    id: item.id,
    skillCode: item.skillCode,
    skillName: item.skillName,
    baseLevel: toFiniteNumber(item.baseLevel),
    extraLevel: toFiniteNumber(item.extraLevel),
    finalLevel: toFiniteNumber(item.finalLevel),
    sourceDetail: parseJsonObject(item.sourceDetailJson),
  }));

  const normalizedProfile: SimulatorCoreAttributes = {
    level: toFiniteNumber(profile.level),
    physique: toFiniteNumber(profile.physique),
    magic: toFiniteNumber(profile.magic),
    strength: toFiniteNumber(profile.strength),
    endurance: toFiniteNumber(profile.endurance),
    agility: toFiniteNumber(profile.agility),
    potentialPoints: toFiniteNumber(profile.potentialPoints),
    hp: toFiniteNumber(profile.hp),
    mp: toFiniteNumber(profile.mp),
    damage: toFiniteNumber(profile.damage),
    defense: toFiniteNumber(profile.defense),
    magicDamage: toFiniteNumber(profile.magicDamage),
    magicDefense: toFiniteNumber(profile.magicDefense),
    speed: toFiniteNumber(profile.speed),
    hit: toFiniteNumber(profile.hit),
    sealHit: toFiniteNumber(profile.sealHit),
    dodge,
    spirit,
  };
  const baseHp = toFiniteNumber(
    rawProfile.baseHp,
    inferBaseHpSource({
      panelHp: normalizedProfile.hp,
      physique: normalizedProfile.physique,
      endurance: normalizedProfile.endurance,
      equipmentHp: equipmentAttributeTotals.hp,
    })
  );

  return {
    characterId: bundle.character.id,
    school: (profile.school || bundle.character.school) as SimulatorSchool,
    roleType: bundle.character.roleType as SimulatorRoleType,
    profile: normalizedProfile,
    attributeSources: {
      ...normalizedProfile,
      baseHp,
      magicPower: spirit,
    },
    cultivationLevels,
    equipmentAttributeTotals,
    skills,
    equipment,
    battleContext: bundle.battleContext
      ? {
          selfFormation: bundle.battleContext.selfFormation,
          selfElement: bundle.battleContext.selfElement,
          formationCounterState: bundle.battleContext.formationCounterState,
          elementRelation: bundle.battleContext.elementRelation,
          transformCardFactor: toFiniteNumber(
            bundle.battleContext.transformCardFactor,
            1
          ),
          splitTargetCount: toFiniteNumber(
            bundle.battleContext.splitTargetCount,
            1
          ),
          shenmuValue: toFiniteNumber(bundle.battleContext.shenmuValue),
          magicResult: toFiniteNumber(bundle.battleContext.magicResult),
          targetName: bundle.battleContext.targetName,
          targetLevel: toFiniteNumber(bundle.battleContext.targetLevel),
          targetHp: toFiniteNumber(bundle.battleContext.targetHp),
          targetDefense: toFiniteNumber(bundle.battleContext.targetDefense),
          targetMagicDefense: toFiniteNumber(
            bundle.battleContext.targetMagicDefense
          ),
          targetMagicDefenseCultivation: toFiniteNumber(
            bundle.battleContext.targetMagicDefenseCultivation
          ),
          targetElement: bundle.battleContext.targetElement,
          targetFormation: bundle.battleContext.targetFormation,
        }
      : null,
    rawProfile,
  };
}
