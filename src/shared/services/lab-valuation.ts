import type { DamageRuleSet } from '@/shared/models/damage-rules';
import type {
  SimulatorCharacterBundle,
  SimulatorEquipment,
  SimulatorProfile,
} from '@/shared/models/simulator';
import { buildSimulatorCharacterDomain } from '@/shared/models/simulator-domain';
import { calculateDamageFromRuleSet } from '@/shared/services/damage-engine';

type JsonRecord = Record<string, unknown>;

export type LabValuationBaseAttributes = {
  level: number;
  hp: number;
  magic: number;
  physique: number;
  magicPower: number;
  strength: number;
  endurance: number;
  agility: number;
  faction: string;
};

export type LabValuationCombatStats = {
  hp: number;
  magic: number;
  hit: number;
  damage: number;
  magicDamage: number;
  defense: number;
  magicDefense: number;
  speed: number;
  dodge: number;
};

export type LabValuationSeatInput = {
  seatId: string;
  seatName?: string;
  isSample?: boolean;
  totalPrice?: number;
  equipment: Array<Record<string, unknown>>;
};

export type LabValuationRequest = {
  baseAttributes: LabValuationBaseAttributes;
  combatStats: LabValuationCombatStats;
  treasure?: {
    isActive?: boolean;
    stats?: Record<string, unknown>;
  } | null;
  target: {
    name?: string;
    magicDefense: number;
    magicDefenseCultivation?: number;
  };
  skillCode?: string;
  skillName?: string;
  targetCount?: number;
  ruleVersionId?: string;
  ruleVersionCode?: string;
  seats: LabValuationSeatInput[];
};

export type LabValuationSeatResult = {
  seatId: string;
  seatName: string;
  isSample: boolean;
  totalPrice: number;
  singleTargetDamage: number;
  totalDamage: number;
  critDamage: number;
  totalCritDamage: number;
  panelStats: ReturnType<typeof calculateDamageFromRuleSet>['panelStats'];
  comparison: {
    damageDiff: number;
    priceDiff: number;
    costPerDamage: number | null;
    costLabel: string;
  };
};

export type LabValuationResult = {
  skill: ReturnType<typeof calculateDamageFromRuleSet>['skill'];
  ruleVersion: ReturnType<typeof calculateDamageFromRuleSet>['ruleVersion'];
  sampleSeatId: string;
  seats: LabValuationSeatResult[];
};

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseJsonRecord(value: string | null | undefined) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? (parsed as JsonRecord) : {};
  } catch {
    return {};
  }
}

function extractActiveEquipmentStats(equipment: Record<string, unknown>) {
  const totals: Record<string, number> = {};

  const appendStats = (stats: unknown) => {
    if (!isRecord(stats)) {
      return;
    }

    for (const [key, value] of Object.entries(stats)) {
      const numericValue = toFiniteNumber(value, Number.NaN);
      if (!Number.isFinite(numericValue)) {
        continue;
      }

      totals[key] = (totals[key] ?? 0) + numericValue;
    }
  };

  appendStats(equipment.stats);

  const activeRuneIndex = Math.max(
    0,
    Math.floor(toFiniteNumber(equipment.activeRuneStoneSet, 0))
  );
  const runeStoneSets = Array.isArray(equipment.runeStoneSets)
    ? equipment.runeStoneSets
    : [];
  const activeRuneSet = Array.isArray(runeStoneSets[activeRuneIndex])
    ? runeStoneSets[activeRuneIndex]
    : [];

  for (const runeStone of activeRuneSet) {
    if (!isRecord(runeStone)) {
      continue;
    }

    appendStats(runeStone.stats);
  }

  return totals;
}

function toSimulatorEquipments(
  equipmentList: Array<Record<string, unknown>>,
  treasure: LabValuationRequest['treasure']
): SimulatorEquipment[] {
  const now = new Date();
  const rows: SimulatorEquipment[] = equipmentList.map((equipment, index) => {
    const stats = extractActiveEquipmentStats(equipment);
    const equipmentId =
      typeof equipment.id === 'string' && equipment.id
        ? equipment.id
        : `lab_eq_${index + 1}`;

    return {
      id: equipmentId,
      characterId: 'lab_character',
      slot:
        typeof equipment.type === 'string' && equipment.type
          ? equipment.type
          : 'weapon',
      name:
        typeof equipment.name === 'string' && equipment.name
          ? equipment.name
          : `实验装备${index + 1}`,
      level: Math.floor(toFiniteNumber(equipment.level)),
      quality:
        typeof equipment.quality === 'string' ? equipment.quality : '实验',
      price: toFiniteNumber(equipment.price),
      source: 'laboratory',
      status: 'equipped',
      isLocked: false,
      createdAt: now,
      updatedAt: now,
      build: null,
      attrs: Object.entries(stats).map(([key, value], attrIndex) => ({
        id: `${equipmentId}_attr_${attrIndex + 1}`,
        equipmentId,
        attrGroup: 'base',
        attrType: key,
        valueType: 'flat',
        attrValue: value,
        displayOrder: attrIndex,
      })),
      snapshotSlot:
        typeof equipment.type === 'string' && equipment.type
          ? equipment.type
          : 'weapon',
    };
  });

  if (treasure?.isActive && isRecord(treasure.stats)) {
    const treasureStats = Object.entries(treasure.stats)
      .map(([key, value]) => [key, toFiniteNumber(value, Number.NaN)] as const)
      .filter(([, value]) => Number.isFinite(value));

    if (treasureStats.length > 0) {
      rows.push({
        id: 'lab_treasure',
        characterId: 'lab_character',
        slot: 'treasure',
        name: '法宝',
        level: 0,
        quality: '法宝',
        price: 0,
        source: 'laboratory',
        status: 'equipped',
        isLocked: false,
        createdAt: now,
        updatedAt: now,
        build: null,
        attrs: treasureStats.map(([key, value], index) => ({
          id: `lab_treasure_attr_${index + 1}`,
          equipmentId: 'lab_treasure',
          attrGroup: 'base',
          attrType: key,
          valueType: 'flat',
          attrValue: value,
          displayOrder: index,
        })),
        snapshotSlot: 'treasure',
      });
    }
  }

  return rows;
}

function buildLabProfile(
  baseProfile: SimulatorProfile,
  request: LabValuationRequest
): SimulatorProfile {
  const rawBody = parseJsonRecord(baseProfile.rawBodyJson);

  return {
    ...baseProfile,
    school: request.baseAttributes.faction,
    level: request.baseAttributes.level,
    physique: request.baseAttributes.physique,
    magic: request.baseAttributes.magic,
    strength: request.baseAttributes.strength,
    endurance: request.baseAttributes.endurance,
    agility: request.baseAttributes.agility,
    hp: request.combatStats.hp,
    mp: request.combatStats.magic,
    damage: request.combatStats.damage,
    defense: request.combatStats.defense,
    magicDamage: request.combatStats.magicDamage,
    magicDefense: request.combatStats.magicDefense,
    speed: request.combatStats.speed,
    hit: request.combatStats.hit,
    rawBodyJson: JSON.stringify({
      ...rawBody,
      baseHp: request.baseAttributes.hp,
      hp: request.combatStats.hp,
      magic: request.baseAttributes.magic,
      physique: request.baseAttributes.physique,
      strength: request.baseAttributes.strength,
      endurance: request.baseAttributes.endurance,
      agility: request.baseAttributes.agility,
      magicPower: request.baseAttributes.magicPower,
      dodge: request.combatStats.dodge,
    }),
  };
}

function buildCostLabel(damageDiff: number, priceDiff: number) {
  if (damageDiff > 0) {
    if (priceDiff > 0) {
      return `¥ ${(priceDiff / damageDiff).toFixed(1)}`;
    }

    return '收益';
  }

  if (damageDiff < 0) {
    if (priceDiff < 0) {
      return `省 ¥ ${Math.abs(priceDiff / damageDiff).toFixed(1)}`;
    }

    return '纯亏';
  }

  if (priceDiff > 0) {
    return '只花钱不提升';
  }

  if (priceDiff < 0) {
    return '纯省钱';
  }

  return '-';
}

export function calculateLabValuationFromRuleSet(params: {
  bundle: SimulatorCharacterBundle;
  ruleSet: DamageRuleSet;
  request: LabValuationRequest;
}): LabValuationResult {
  const { bundle, ruleSet, request } = params;

  if (!bundle.profile) {
    throw new Error('character profile not found');
  }

  const seatResults = request.seats.map((seat, index) => {
    const seatBundle: SimulatorCharacterBundle = {
      ...bundle,
      character: {
        ...bundle.character,
        school: request.baseAttributes.faction,
        level: request.baseAttributes.level,
      },
      profile: buildLabProfile(bundle.profile!, request),
      equipments: toSimulatorEquipments(seat.equipment, request.treasure),
    };
    const domain = buildSimulatorCharacterDomain(seatBundle);

    if (!domain) {
      throw new Error('failed to build lab valuation character domain');
    }

    const result = calculateDamageFromRuleSet({
      bundle: seatBundle,
      domain,
      ruleSet,
      request: {
        skillCode: request.skillCode,
        skillName: request.skillName,
        ruleVersionId: request.ruleVersionId,
        ruleVersionCode: request.ruleVersionCode,
        targetCount: request.targetCount,
        targets: [
          {
            name: request.target.name,
            magicDefense: request.target.magicDefense,
            magicDefenseCultivation: request.target.magicDefenseCultivation,
          },
        ],
      },
    });

    const target = result.targets[0];
    if (!target) {
      throw new Error('lab valuation target result missing');
    }

    return {
      seatId: seat.seatId,
      seatName: seat.seatName || `席位${index + 1}`,
      isSample: Boolean(seat.isSample),
      totalPrice:
        seat.totalPrice ??
        seat.equipment.reduce(
          (sum, item) => sum + toFiniteNumber(item.price),
          0
        ),
      singleTargetDamage: target.damage,
      totalDamage: target.totalDamage,
      critDamage: target.critDamage,
      totalCritDamage: target.totalCritDamage,
      panelStats: result.panelStats,
      skill: result.skill,
      ruleVersion: result.ruleVersion,
    };
  });

  const sampleSeat =
    seatResults.find((seat) => seat.isSample) ?? seatResults[0];

  if (!sampleSeat) {
    throw new Error('lab valuation seats missing');
  }

  return {
    skill: seatResults[0]!.skill,
    ruleVersion: seatResults[0]!.ruleVersion,
    sampleSeatId: sampleSeat.seatId,
    seats: seatResults.map((seat) => {
      const damageDiff = seat.totalDamage - sampleSeat.totalDamage;
      const priceDiff = seat.totalPrice - sampleSeat.totalPrice;

      return {
        seatId: seat.seatId,
        seatName: seat.seatName,
        isSample: seat.isSample,
        totalPrice: seat.totalPrice,
        singleTargetDamage: seat.singleTargetDamage,
        totalDamage: seat.totalDamage,
        critDamage: seat.critDamage,
        totalCritDamage: seat.totalCritDamage,
        panelStats: seat.panelStats,
        comparison: {
          damageDiff,
          priceDiff,
          costPerDamage: damageDiff > 0 ? priceDiff / damageDiff : null,
          costLabel: buildCostLabel(damageDiff, priceDiff),
        },
      };
    }),
  };
}
