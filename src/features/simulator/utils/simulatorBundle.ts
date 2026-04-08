import { createInitialEquipmentSets } from '@/features/simulator/store/gameInitialState';
import {
  createInitialExperimentSeats,
  createInitialManualTargets,
} from '@/features/simulator/store/gameRuntimeSeeds';
import { useGameStore } from '@/features/simulator/store/gameStore';
import type {
  AccountData,
  BaseAttributes,
  CharacterStatMap,
  CombatStats,
  Cultivation,
  Equipment,
  EquipmentEffectModifier,
  EquipmentSet,
  Faction,
  GameState,
  Skill,
  SyncedCloudState,
} from '@/features/simulator/store/gameTypes';
import { getEquipmentDefaultImage } from '@/features/simulator/utils/equipmentImage';

import { inferBaseHpSource } from '@/shared/lib/simulator-base-hp';
import {
  extractSimulatorEquipmentSlotNumber,
  normalizeSimulatorEquipmentType,
} from '@/shared/lib/simulator-equipment';
import { getSimulatorStatLabel } from '@/shared/lib/simulator-stat-labels';
import type { SimulatorCharacterBundle } from '@/shared/models/simulator';

const FALLBACK_FACTION: Faction = '龙宫';
type NumericStatKey = Exclude<keyof (CombatStats & BaseAttributes), 'faction'>;

const cultivationTypeMap: Record<string, keyof Cultivation> = {
  physicalAttack: 'physicalAttack',
  physical_attack: 'physicalAttack',
  attack: 'physicalAttack',
  攻击修炼: 'physicalAttack',
  physicalDefense: 'physicalDefense',
  physical_defense: 'physicalDefense',
  defense: 'physicalDefense',
  防御修炼: 'physicalDefense',
  magicAttack: 'magicAttack',
  magic_attack: 'magicAttack',
  spellAttack: 'magicAttack',
  法攻修炼: 'magicAttack',
  magicDefense: 'magicDefense',
  magic_defense: 'magicDefense',
  spellDefense: 'magicDefense',
  法防修炼: 'magicDefense',
  petPhysicalAttack: 'petPhysicalAttack',
  pet_physical_attack: 'petPhysicalAttack',
  猎术修炼: 'petPhysicalAttack',
  petPhysicalDefense: 'petPhysicalDefense',
  pet_physical_defense: 'petPhysicalDefense',
  petMagicAttack: 'petMagicAttack',
  pet_magic_attack: 'petMagicAttack',
  petMagicDefense: 'petMagicDefense',
  pet_magic_defense: 'petMagicDefense',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseJsonRecord(
  value: string | null | undefined
): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function toFaction(value: string | null | undefined): Faction {
  const factions: Faction[] = [
    '龙宫',
    '大唐官府',
    '狮驼岭',
    '化生寺',
    '方寸山',
    '普陀山',
  ];
  return factions.includes(value as Faction)
    ? (value as Faction)
    : FALLBACK_FACTION;
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0
  );

  return items.length > 0 ? items : undefined;
}

function toEffectModifiers(
  value: unknown
): EquipmentEffectModifier[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items: EquipmentEffectModifier[] = [];

  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const parsedValue =
      typeof item.value === 'number' && Number.isFinite(item.value)
        ? item.value
        : Number(item.value);
    if (
      typeof item.code !== 'string' ||
      item.code.trim().length === 0 ||
      !Number.isFinite(parsedValue)
    ) {
      continue;
    }

    items.push({
      code: item.code.trim(),
      value: parsedValue,
      label: typeof item.label === 'string' ? item.label : undefined,
      source: typeof item.source === 'string' ? item.source : undefined,
    });
  }

  return items.length > 0 ? items : undefined;
}

function toStatRecord(value: unknown): CharacterStatMap {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      ([, entryValue]) =>
        typeof entryValue === 'number' && Number.isFinite(entryValue)
    )
  ) as CharacterStatMap;
}

function toRuneStoneSets(value: unknown): Equipment['runeStoneSets'] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const sets = value
    .filter(Array.isArray)
    .map((set, setIndex) =>
      set.filter(isRecord).map((runeStone, runeIndex) => ({
        id:
          typeof runeStone.id === 'string' && runeStone.id.trim().length > 0
            ? runeStone.id
            : `persisted_rune_${setIndex}_${runeIndex}`,
        name: typeof runeStone.name === 'string' ? runeStone.name : undefined,
        type: typeof runeStone.type === 'string' ? runeStone.type : 'red',
        level: toOptionalNumber(runeStone.level),
        quality:
          typeof runeStone.quality === 'string' ? runeStone.quality : undefined,
        description:
          typeof runeStone.description === 'string'
            ? runeStone.description
            : undefined,
        price: toOptionalNumber(runeStone.price),
        stats: toStatRecord(runeStone.stats),
      }))
    )
    .filter((set) => set.length > 0);

  return sets.length > 0 ? sets : undefined;
}

function buildAttrMap(
  bundleEquipment: SimulatorCharacterBundle['equipments'][number]
) {
  const attrMap: Partial<Record<NumericStatKey, number>> = {};

  for (const attr of bundleEquipment.attrs) {
    const key = attr.attrType as NumericStatKey;
    const current = toNumber(attrMap[key], 0);
    attrMap[key] = current + toNumber(attr.attrValue, 0);
  }

  return attrMap as CharacterStatMap;
}

function formatMainStat(attrMap: CharacterStatMap) {
  const entries = Object.entries(attrMap).filter(
    ([, value]) => typeof value === 'number' && value !== 0
  );
  if (!entries.length) {
    return '暂无属性';
  }

  return entries
    .slice(0, 2)
    .map(
      ([key, value]) =>
        `${getSimulatorStatLabel(key, 'mainStat')} +${Math.round(Number(value))}`
    )
    .join(' ');
}

function toSkillType(skillName: string): Skill['type'] {
  if (/(龙卷雨击|龙腾|龙吟|法|咒|雷|雨|火|水)/.test(skillName)) return 'magic';
  if (/(治疗|回复|恢复|活血)/.test(skillName)) return 'heal';
  if (/(封|催眠|失心|定身)/.test(skillName)) return 'seal';
  if (/(增益|鼓舞|护法|护盾)/.test(skillName)) return 'buff';
  return 'physical';
}

function toSkillTargets(skillName: string) {
  if (/(龙卷雨击|群秒|群法)/.test(skillName)) return 4;
  if (/(龙戏珠)/.test(skillName)) return 5;
  if (/(破釜沉舟|横扫群攻)/.test(skillName)) return 3;
  return 1;
}

function mapBaseAttributes(bundle: SimulatorCharacterBundle): BaseAttributes {
  const rawBody = parseJsonRecord(bundle.profile?.rawBodyJson);
  const equipmentHp = bundle.equipments.reduce((sum, item) => {
    return (
      sum +
      item.attrs.reduce((itemSum, attr) => {
        if (attr.attrType !== 'hp') {
          return itemSum;
        }

        return itemSum + toNumber(attr.attrValue);
      }, 0)
    );
  }, 0);

  return {
    level: bundle.profile?.level ?? bundle.character.level ?? 0,
    hp: toNumber(
      rawBody.baseHp,
      inferBaseHpSource({
        panelHp: bundle.profile?.hp ?? toNumber(rawBody.hp),
        physique: bundle.profile?.physique ?? toNumber(rawBody.physique),
        endurance: bundle.profile?.endurance ?? toNumber(rawBody.endurance),
        equipmentHp,
      })
    ),
    magic: bundle.profile?.magic ?? toNumber(rawBody.magic),
    physique: bundle.profile?.physique ?? toNumber(rawBody.physique),
    magicPower: toNumber(rawBody.magicPower ?? rawBody.spiritualPower),
    strength: bundle.profile?.strength ?? toNumber(rawBody.strength),
    endurance: bundle.profile?.endurance ?? toNumber(rawBody.endurance),
    agility: bundle.profile?.agility ?? toNumber(rawBody.agility),
    faction: toFaction(bundle.character.school),
  };
}

function mapCombatStats(bundle: SimulatorCharacterBundle): CombatStats {
  const rawBody = parseJsonRecord(bundle.profile?.rawBodyJson);

  return {
    hp: Math.round(bundle.profile?.hp ?? 0),
    magic: Math.round(bundle.profile?.mp ?? 0),
    hit: Math.round(bundle.profile?.hit ?? 0),
    damage: Math.round(bundle.profile?.damage ?? 0),
    magicDamage: Math.round(bundle.profile?.magicDamage ?? 0),
    defense: Math.round(bundle.profile?.defense ?? 0),
    magicDefense: Math.round(bundle.profile?.magicDefense ?? 0),
    speed: Math.round(bundle.profile?.speed ?? 0),
    dodge: Math.round(toNumber(rawBody.dodge)),
    sealHit: Math.round(bundle.profile?.sealHit ?? 0),
    spiritualPower: Math.round(toNumber(rawBody.spiritualPower)),
    magicCritLevel: Math.round(toNumber(rawBody.magicCritLevel)),
    fixedDamage: Math.round(toNumber(rawBody.fixedDamage)),
    pierceLevel: Math.round(toNumber(rawBody.pierceLevel)),
    elementalMastery: Math.round(toNumber(rawBody.elementalMastery)),
    block: Math.round(toNumber(rawBody.block)),
    antiCritLevel: Math.round(toNumber(rawBody.antiCritLevel)),
    sealResistLevel: Math.round(toNumber(rawBody.sealResistLevel)),
    elementalResistance: Math.round(toNumber(rawBody.elementalResistance)),
  };
}

function mapCombatTarget(
  bundle: SimulatorCharacterBundle
): GameState['combatTarget'] {
  const ctx = bundle.battleContext;
  const template = bundle.battleTargetTemplate;

  return {
    templateId: template?.id || ctx?.targetTemplateId || undefined,
    name: ctx?.targetName || template?.name || '默认目标',
    level: ctx?.targetLevel || template?.level || 0,
    hp: Math.round(ctx?.targetHp || template?.hp || 0),
    defense: Math.round(ctx?.targetDefense || template?.defense || 0),
    magicDefense: Math.round(
      ctx?.targetMagicDefense || template?.magicDefense || 0
    ),
    speed: Math.round(ctx?.targetSpeed ?? template?.speed ?? 0),
    dungeonName: template?.dungeonName || undefined,
    element: (ctx?.targetElement || template?.element || undefined) as any,
    formation: ctx?.targetFormation || template?.formation || undefined,
  };
}

function mapCultivation(bundle: SimulatorCharacterBundle): Cultivation {
  const cultivation: Cultivation = {
    physicalAttack: 0,
    physicalDefense: 0,
    magicAttack: 0,
    magicDefense: 0,
    petPhysicalAttack: 0,
    petPhysicalDefense: 0,
    petMagicAttack: 0,
    petMagicDefense: 0,
  };

  for (const item of bundle.cultivations) {
    const key = cultivationTypeMap[item.cultivationType];
    if (key) {
      cultivation[key] = item.level;
    }
  }

  return cultivation;
}

function mapSkills(bundle: SimulatorCharacterBundle): Skill[] {
  return bundle.skills.map((skill) => ({
    name: skill.skillName,
    level: skill.finalLevel || skill.baseLevel || 0,
    type: toSkillType(skill.skillName),
    targets: toSkillTargets(skill.skillName),
  }));
}

function mapEquipments(bundle: SimulatorCharacterBundle): Equipment[] {
  return bundle.equipments.map((item) => {
    const type = normalizeSimulatorEquipmentType(
      item.snapshotSlot ?? item.slot
    );
    const attrMap = buildAttrMap(item);
    const buildMeta = parseJsonRecord(item.build?.specialEffectJson);
    const setMeta = parseJsonRecord(item.build?.setEffectJson);
    const notesMeta = parseJsonRecord(item.build?.notesJson);

    const legacyHighlights = [
      ...(toStringArray(buildMeta.highlights) ?? []),
      ...Object.values(buildMeta).filter(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0
      ),
      ...Object.values(setMeta).filter(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0
      ),
    ];
    const highlights = Array.from(
      new Set([
        ...(toStringArray(notesMeta.highlights) ?? []),
        ...legacyHighlights,
      ])
    ).slice(0, 3);

    return {
      id: item.id,
      name: item.name,
      type,
      slot:
        type === 'trinket' || type === 'jade'
          ? extractSimulatorEquipmentSlotNumber(item.snapshotSlot ?? item.slot)
          : undefined,
      mainStat: formatMainStat(attrMap),
      baseStats: attrMap,
      stats: attrMap,
      price: item.price,
      imageUrl: getEquipmentDefaultImage(type),
      level: item.level,
      quality: item.quality,
      setName:
        typeof notesMeta.setName === 'string' ? notesMeta.setName : undefined,
      forgeLevel: item.build?.refineLevel ?? 0,
      crossServerFee: toOptionalNumber(notesMeta.crossServerFee),
      runeStoneSets: toRuneStoneSets(notesMeta.runeStoneSets),
      runeStoneSetsNames: toStringArray(notesMeta.runeStoneSetsNames),
      activeRuneStoneSet: toOptionalNumber(notesMeta.activeRuneStoneSet),
      runeSetEffect:
        typeof notesMeta.runeSetEffect === 'string'
          ? notesMeta.runeSetEffect
          : typeof setMeta.runeSetEffect === 'string'
            ? setMeta.runeSetEffect
            : undefined,
      extraStat:
        typeof notesMeta.extraStat === 'string'
          ? notesMeta.extraStat
          : undefined,
      effectModifiers: toEffectModifiers(notesMeta.effectModifiers),
      description:
        typeof notesMeta.description === 'string'
          ? notesMeta.description
          : undefined,
      equippableRoles:
        typeof notesMeta.equippableRoles === 'string'
          ? notesMeta.equippableRoles
          : undefined,
      element:
        typeof notesMeta.element === 'string' ? notesMeta.element : undefined,
      durability: toOptionalNumber(notesMeta.durability),
      gemstone:
        typeof notesMeta.gemstone === 'string' ? notesMeta.gemstone : undefined,
      luckyHoles:
        typeof notesMeta.luckyHoles === 'string'
          ? notesMeta.luckyHoles
          : undefined,
      starPosition:
        typeof notesMeta.starPosition === 'string'
          ? notesMeta.starPosition
          : undefined,
      starAlignment:
        typeof notesMeta.starAlignment === 'string'
          ? notesMeta.starAlignment
          : undefined,
      factionRequirement:
        typeof notesMeta.factionRequirement === 'string'
          ? notesMeta.factionRequirement
          : undefined,
      positionRequirement:
        typeof notesMeta.positionRequirement === 'string'
          ? notesMeta.positionRequirement
          : undefined,
      specialEffect:
        typeof notesMeta.specialEffect === 'string'
          ? notesMeta.specialEffect
          : typeof buildMeta.specialEffect === 'string'
            ? buildMeta.specialEffect
            : undefined,
      manufacturer:
        typeof notesMeta.manufacturer === 'string'
          ? notesMeta.manufacturer
          : undefined,
      refinementEffect:
        typeof notesMeta.refinementEffect === 'string'
          ? notesMeta.refinementEffect
          : typeof buildMeta.refinementEffect === 'string'
            ? buildMeta.refinementEffect
            : undefined,
      highlights: highlights.length ? highlights : undefined,
    };
  });
}

function toPersistedEquipment(
  value: unknown,
  fallbackId: string
): Equipment | null {
  if (!isRecord(value) || typeof value.name !== 'string') {
    return null;
  }

  const rawType = typeof value.type === 'string' ? value.type : '';
  if (!rawType.trim()) {
    return null;
  }

  const type = normalizeSimulatorEquipmentType(rawType);
  const baseStats = toStatRecord(value.baseStats);
  const stats = toStatRecord(value.stats);

  return {
    id:
      typeof value.id === 'string' && value.id.trim().length > 0
        ? value.id
        : fallbackId,
    name: value.name,
    type,
    slot:
      toOptionalNumber(value.slot) ??
      (type === 'trinket' || type === 'jade'
        ? extractSimulatorEquipmentSlotNumber(rawType)
        : undefined),
    mainStat:
      typeof value.mainStat === 'string'
        ? value.mainStat
        : formatMainStat(baseStats),
    extraStat:
      typeof value.extraStat === 'string' ? value.extraStat : undefined,
    effectModifiers: toEffectModifiers(value.effectModifiers),
    highlights: toStringArray(value.highlights),
    baseStats,
    stats: Object.keys(stats).length > 0 ? stats : baseStats,
    price: toOptionalNumber(value.price),
    crossServerFee: toOptionalNumber(value.crossServerFee),
    imageUrl:
      typeof value.imageUrl === 'string'
        ? value.imageUrl
        : getEquipmentDefaultImage(type),
    runeStoneSets: toRuneStoneSets(value.runeStoneSets),
    runeStoneSetsNames: toStringArray(value.runeStoneSetsNames),
    activeRuneStoneSet: toOptionalNumber(value.activeRuneStoneSet),
    runeSetEffect:
      typeof value.runeSetEffect === 'string' ? value.runeSetEffect : undefined,
    setName: typeof value.setName === 'string' ? value.setName : undefined,
    description:
      typeof value.description === 'string' ? value.description : undefined,
    equippableRoles:
      typeof value.equippableRoles === 'string'
        ? value.equippableRoles
        : undefined,
    level: toOptionalNumber(value.level),
    element: typeof value.element === 'string' ? value.element : undefined,
    durability: toOptionalNumber(value.durability),
    forgeLevel: toOptionalNumber(value.forgeLevel),
    gemstone: typeof value.gemstone === 'string' ? value.gemstone : undefined,
    luckyHoles:
      typeof value.luckyHoles === 'string' ? value.luckyHoles : undefined,
    starPosition:
      typeof value.starPosition === 'string' ? value.starPosition : undefined,
    starAlignment:
      typeof value.starAlignment === 'string' ? value.starAlignment : undefined,
    factionRequirement:
      typeof value.factionRequirement === 'string'
        ? value.factionRequirement
        : undefined,
    positionRequirement:
      typeof value.positionRequirement === 'string'
        ? value.positionRequirement
        : undefined,
    specialEffect:
      typeof value.specialEffect === 'string' ? value.specialEffect : undefined,
    manufacturer:
      typeof value.manufacturer === 'string' ? value.manufacturer : undefined,
    refinementEffect:
      typeof value.refinementEffect === 'string'
        ? value.refinementEffect
        : undefined,
    quality: typeof value.quality === 'string' ? value.quality : undefined,
  };
}

function createFallbackEquipmentSet(
  index: number,
  equipment: Equipment[]
): EquipmentSet {
  return {
    id: `set_${index + 1}`,
    name: `配置${index + 1}`,
    items: equipment,
    isActive: false,
  };
}

function parsePersistedEquipmentPlan(
  notesJson: string | null | undefined,
  currentEquipment: Equipment[]
): { equipmentSets: EquipmentSet[]; activeSetIndex: number } | null {
  const notes = parseJsonRecord(notesJson);
  const plan = notes.equipmentPlan;
  if (!isRecord(plan) || !Array.isArray(plan.equipmentSets)) {
    return null;
  }

  const activeSetIndex = Number.isInteger(plan.activeSetIndex)
    ? Math.max(0, Number(plan.activeSetIndex))
    : 0;

  const equipmentSets: EquipmentSet[] = plan.equipmentSets
    .filter(isRecord)
    .map((set, index): EquipmentSet => {
      const items = Array.isArray(set.items)
        ? set.items
            .map((item, itemIndex) =>
              toPersistedEquipment(item, `persisted_eq_${index}_${itemIndex}`)
            )
            .filter((item): item is Equipment => item !== null)
        : [];

      return {
        id:
          typeof set.id === 'string' && set.id.trim().length > 0
            ? set.id
            : `set_${index + 1}`,
        name:
          typeof set.name === 'string' && set.name.trim().length > 0
            ? set.name
            : `配置${index + 1}`,
        items,
        isActive: false,
      };
    });

  if (equipmentSets.length === 0) {
    return null;
  }

  while (equipmentSets.length <= activeSetIndex) {
    equipmentSets.push(
      createFallbackEquipmentSet(equipmentSets.length, currentEquipment)
    );
  }

  return {
    activeSetIndex,
    equipmentSets: equipmentSets.map((set, index) => ({
      ...set,
      items: index === activeSetIndex ? currentEquipment : set.items,
      isActive: index === activeSetIndex,
    })),
  };
}

type ApplySimulatorBundleOptions = {
  preserveWorkbenchState?: boolean;
};

export function applySimulatorBundleToStore(
  bundle: SimulatorCharacterBundle,
  options: ApplySimulatorBundleOptions = {}
) {
  const baseAttributes = mapBaseAttributes(bundle);
  const combatStats = mapCombatStats(bundle);
  const equipment = mapEquipments(bundle);
  const persistedPlan = parsePersistedEquipmentPlan(
    bundle.battleContext?.notesJson,
    equipment
  );
  const equipmentSets =
    persistedPlan?.equipmentSets ?? createInitialEquipmentSets(equipment);
  const activeSetIndex = persistedPlan?.activeSetIndex ?? 0;
  const skills = mapSkills(bundle);
  const cultivation = mapCultivation(bundle);
  const combatTarget = mapCombatTarget(bundle);
  const selfFormation = bundle.battleContext?.selfFormation || '天覆阵';
  const selfElement = (bundle.battleContext?.selfElement || '水') as any;
  const preserveWorkbenchState = options.preserveWorkbenchState ?? false;

  const account: AccountData = {
    id: bundle.character.id,
    name: bundle.character.name,
    baseAttributes,
    combatStats,
    equipment,
    equipmentSets,
    activeSetIndex,
    skills,
    cultivation,
    treasure: null,
  };

  const syncedCloudState: SyncedCloudState = {
    accounts: [account],
    activeAccountId: account.id,
    baseAttributes,
    combatStats,
    equipment,
    equipmentSets,
    activeSetIndex,
    skills,
    cultivation,
    treasure: null,
    combatTarget,
    formation: selfFormation,
    playerSetup: {
      ...useGameStore.getState().playerSetup,
      level: baseAttributes.level,
      faction: baseAttributes.faction,
      baseStats: baseAttributes,
      equipment,
      skills,
      cultivation,
      element: selfElement,
      formation: selfFormation,
    },
  };

  useGameStore.setState((state: GameState) => ({
    ...state,
    ...syncedCloudState,
    syncedCloudState,
    experimentSeats: preserveWorkbenchState
      ? state.experimentSeats
      : createInitialExperimentSeats(),
    manualTargets: preserveWorkbenchState
      ? state.manualTargets
      : createInitialManualTargets(),
    pendingEquipments: preserveWorkbenchState ? state.pendingEquipments : [],
    selectedPendingIds: preserveWorkbenchState ? state.selectedPendingIds : [],
    history: preserveWorkbenchState ? state.history : [],
    ocrLogs: preserveWorkbenchState ? state.ocrLogs : [],
    previewMode: preserveWorkbenchState ? state.previewMode : false,
    previewEquipment: preserveWorkbenchState ? state.previewEquipment : null,
  }));
}
