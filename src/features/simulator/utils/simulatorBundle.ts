import { createInitialEquipmentSets } from '@/features/simulator/store/gameInitialState';
import { createInitialExperimentSeats, createInitialManualTargets } from '@/features/simulator/store/gameRuntimeSeeds';
import { useGameStore } from '@/features/simulator/store/gameStore';
import type {
  AccountData,
  BaseAttributes,
  CombatStats,
  Cultivation,
  Equipment,
  Faction,
  GameState,
  Skill,
} from '@/features/simulator/store/gameTypes';
import { getEquipmentDefaultImage } from '@/features/simulator/utils/equipmentImage';
import type { SimulatorCharacterBundle } from '@/shared/models/simulator';

const FALLBACK_FACTION: Faction = '龙宫';
type NumericStatKey = Exclude<keyof (CombatStats & BaseAttributes), 'faction'>;

const slotTypeMap: Record<string, Equipment['type']> = {
  weapon: 'weapon',
  arms: 'weapon',
  helmet: 'helmet',
  head: 'helmet',
  necklace: 'necklace',
  armor: 'armor',
  cloth: 'armor',
  belt: 'belt',
  shoes: 'shoes',
  trinket: 'trinket',
  ring: 'trinket',
  jade: 'jade',
  runestone: 'runeStone',
  rune_stone: 'runeStone',
  rune: 'rune',
  武器: 'weapon',
  头盔: 'helmet',
  项链: 'necklace',
  衣服: 'armor',
  腰带: 'belt',
  鞋子: 'shoes',
  灵饰: 'trinket',
  戒指: 'trinket',
  耳饰: 'trinket',
  佩饰: 'trinket',
  手镯: 'trinket',
  玉佩: 'jade',
  玉魄: 'jade',
  符石: 'runeStone',
};

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

function parseJsonRecord(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function toFaction(value: string | null | undefined): Faction {
  const factions: Faction[] = ['龙宫', '大唐官府', '狮驼岭', '化生寺', '方寸山', '普陀山'];
  return factions.includes(value as Faction) ? (value as Faction) : FALLBACK_FACTION;
}

function toEquipmentType(slot: string): Equipment['type'] {
  const normalized = slot.trim().toLowerCase();
  if (slotTypeMap[slot]) return slotTypeMap[slot];
  if (slotTypeMap[normalized]) return slotTypeMap[normalized];
  if (normalized.startsWith('trinket') || normalized.startsWith('ring')) return 'trinket';
  if (normalized.startsWith('jade')) return 'jade';
  if (normalized.startsWith('weapon')) return 'weapon';
  if (normalized.startsWith('helmet') || normalized.startsWith('head')) return 'helmet';
  if (normalized.startsWith('necklace')) return 'necklace';
  if (normalized.startsWith('armor') || normalized.startsWith('cloth')) return 'armor';
  if (normalized.startsWith('belt')) return 'belt';
  if (normalized.startsWith('shoes')) return 'shoes';
  return 'weapon';
}

function toTrinketSlot(slot: string): number | undefined {
  const match = slot.match(/(\d+)/);
  return match ? Number(match[1]) : undefined;
}

function toEquipmentSlotNumber(slot: string): number | undefined {
  const match = slot.match(/(\d+)/);
  return match ? Number(match[1]) : undefined;
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function buildAttrMap(bundleEquipment: SimulatorCharacterBundle['equipments'][number]) {
  const attrMap: Partial<Record<NumericStatKey, number>> = {};

  for (const attr of bundleEquipment.attrs) {
    const key = attr.attrType as NumericStatKey;
    const current = toNumber(attrMap[key], 0);
    attrMap[key] = current + toNumber(attr.attrValue, 0);
  }

  return attrMap as Partial<CombatStats & BaseAttributes>;
}

function formatMainStat(attrMap: Partial<CombatStats & BaseAttributes>) {
  const labels: Record<string, string> = {
    damage: '伤害',
    magicDamage: '法伤',
    defense: '防御',
    magicDefense: '法防',
    hp: '气血',
    magic: '魔力',
    hit: '命中',
    speed: '速度',
    agility: '敏捷',
    physique: '体质',
    strength: '力量',
    endurance: '耐力',
    magicPower: '灵力',
  };

  const entries = Object.entries(attrMap).filter(([, value]) => typeof value === 'number' && value !== 0);
  if (!entries.length) {
    return '暂无属性';
  }

  return entries
    .slice(0, 2)
    .map(([key, value]) => `${labels[key] ?? key} +${Math.round(Number(value))}`)
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

  return {
    level: bundle.profile?.level ?? bundle.character.level ?? 0,
    hp: Math.round(bundle.profile?.hp ?? toNumber(rawBody.hp)),
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
  } as CombatStats;
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
    const type = toEquipmentType(item.snapshotSlot ?? item.slot);
    const attrMap = buildAttrMap(item);
    const buildMeta = parseJsonRecord(item.build?.specialEffectJson);
    const setMeta = parseJsonRecord(item.build?.setEffectJson);

    const highlights = [
      ...Object.values(buildMeta),
      ...Object.values(setMeta),
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .slice(0, 3);

    return {
      id: item.id,
      name: item.name,
      type,
      slot:
        type === 'trinket' || type === 'jade'
          ? toEquipmentSlotNumber(item.snapshotSlot ?? item.slot)
          : undefined,
      mainStat: formatMainStat(attrMap),
      baseStats: attrMap,
      stats: attrMap,
      price: item.price,
      imageUrl: getEquipmentDefaultImage(type),
      level: item.level,
      quality: item.quality,
      forgeLevel: item.build?.refineLevel ?? 0,
      highlights: highlights.length ? highlights : undefined,
    };
  });
}

export function applySimulatorBundleToStore(bundle: SimulatorCharacterBundle) {
  const baseAttributes = mapBaseAttributes(bundle);
  const combatStats = mapCombatStats(bundle);
  const equipment = mapEquipments(bundle);
  const equipmentSets = createInitialEquipmentSets(equipment);
  const skills = mapSkills(bundle);
  const cultivation = mapCultivation(bundle);

  const account: AccountData = {
    id: bundle.character.id,
    name: bundle.character.name,
    baseAttributes,
    combatStats,
    equipment,
    equipmentSets,
    activeSetIndex: 0,
    skills,
    cultivation,
    treasure: null,
  };

  useGameStore.setState((state: GameState) => ({
    ...state,
    accounts: [account],
    activeAccountId: account.id,
    baseAttributes,
    combatStats,
    equipment,
    equipmentSets,
    activeSetIndex: 0,
    skills,
    cultivation,
    treasure: null,
    playerSetup: {
      ...state.playerSetup,
      level: baseAttributes.level,
      faction: baseAttributes.faction,
      baseStats: baseAttributes,
      equipment,
      skills,
      cultivation,
    },
    experimentSeats: createInitialExperimentSeats(equipment),
    manualTargets: createInitialManualTargets(),
    pendingEquipments: [],
    selectedPendingIds: [],
    history: [],
    ocrLogs: [],
    previewMode: false,
    previewEquipment: null,
  }));
}
