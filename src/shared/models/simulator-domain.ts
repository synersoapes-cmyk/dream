import { inferBaseHpSource } from '@/shared/lib/simulator-base-hp';
import {
  normalizeSimulatorEquipmentSlot,
  type SimulatorEquipmentSlot,
} from '@/shared/lib/simulator-equipment';
import type { SimulatorCharacterBundle } from '@/shared/models/simulator-types';

type JsonObject = Record<string, unknown>;
type RuneStoneView = {
  id: string;
  name?: string;
  type: string;
  level?: number;
  quality?: string;
  description?: string;
  price?: number;
  stats: SimulatorNumericMap;
};

type EquipmentPersistedMeta = {
  runeStoneSets?: RuneStoneView[][];
  runeStoneSetsNames?: string[];
  activeRuneStoneSet?: number;
  [key: string]: unknown;
};

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
    targetSpeed: number;
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

function parseEquipmentPersistedMeta(
  value: string | null | undefined
): EquipmentPersistedMeta {
  return parseJsonObject(value) as EquipmentPersistedMeta;
}

function parseRuneStoneSets(value: unknown): RuneStoneView[][] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(Array.isArray)
    .map((set, setIndex) =>
      set
        .filter((item) => item && typeof item === 'object')
        .map((runeStone, runeIndex) => {
          const record = runeStone as Record<string, unknown>;

          return {
            id:
              typeof record.id === 'string' && record.id.trim().length > 0
                ? record.id
                : `persisted_rune_${setIndex}_${runeIndex}`,
            name: typeof record.name === 'string' ? record.name : undefined,
            type:
              typeof record.type === 'string' && record.type.trim().length > 0
                ? record.type
                : 'red',
            level: toFiniteNumber(record.level, Number.NaN),
            quality:
              typeof record.quality === 'string' ? record.quality : undefined,
            description:
              typeof record.description === 'string'
                ? record.description
                : undefined,
            price: toFiniteNumber(record.price, Number.NaN),
            stats: Object.fromEntries(
              Object.entries(
                record.stats && typeof record.stats === 'object'
                  ? (record.stats as Record<string, unknown>)
                  : {}
              )
                .map(([key, statValue]) => [
                  key,
                  toFiniteNumber(statValue, Number.NaN),
                ])
                .filter(([, statValue]) => Number.isFinite(statValue))
            ),
          };
        })
    )
    .filter((set) => set.length > 0);
}

function getActiveRuneStoneSet(meta: EquipmentPersistedMeta) {
  const runeStoneSets = parseRuneStoneSets(meta.runeStoneSets);
  if (runeStoneSets.length === 0) {
    return [];
  }

  const activeIndex = Math.max(
    0,
    Math.floor(toFiniteNumber(meta.activeRuneStoneSet, 0))
  );

  return runeStoneSets[activeIndex] ?? runeStoneSets[0] ?? [];
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

  const equipment = bundle.equipments.map((item) => {
    const persistedMeta = parseEquipmentPersistedMeta(item.build?.notesJson);

    return {
      id: item.id,
      name: item.name,
      slot: normalizeSimulatorEquipmentSlot(item.slot),
      level: toFiniteNumber(item.level),
      quality: item.quality ?? '',
      price: toFiniteNumber(item.price),
      source: item.source ?? '',
      status: item.status ?? '',
      isLocked: Boolean(item.isLocked),
      attributes: Object.fromEntries(
        item.attrs.map((attr) => [
          attr.attrType,
          toFiniteNumber(attr.attrValue),
        ])
      ),
      build: item.build
        ? {
            holeCount: toFiniteNumber(item.build.holeCount),
            gemLevelTotal: toFiniteNumber(item.build.gemLevelTotal),
            refineLevel: toFiniteNumber(item.build.refineLevel),
            specialEffect: parseJsonObject(item.build.specialEffectJson),
            setEffect: parseJsonObject(item.build.setEffectJson),
            notes: persistedMeta,
          }
        : null,
    };
  });

  const equipmentAttributeTotals = equipment.reduce<SimulatorNumericMap>(
    (totals, item) => {
      for (const [key, value] of Object.entries(item.attributes)) {
        totals[key] = (totals[key] ?? 0) + toFiniteNumber(value);
      }

      const activeRuneStoneSet = getActiveRuneStoneSet(item.build?.notes ?? {});
      for (const runeStone of activeRuneStoneSet) {
        for (const [key, value] of Object.entries(runeStone.stats)) {
          totals[key] = (totals[key] ?? 0) + toFiniteNumber(value);
        }
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
          targetSpeed: toFiniteNumber(
            bundle.battleContext.targetSpeed,
            bundle.battleTargetTemplate?.speed ?? 0
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
