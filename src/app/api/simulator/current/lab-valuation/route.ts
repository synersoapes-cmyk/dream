import { respData, respErr } from '@/shared/lib/resp';
import { getDamageRuleSet } from '@/shared/models/damage-rules';
import { getSimulatorCharacterBundle } from '@/shared/models/simulator';
import { getUserInfo } from '@/shared/models/user';
import { calculateLabValuationFromRuleSet } from '@/shared/services/lab-valuation';

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSeat(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  return {
    seatId:
      typeof value.seatId === 'string' && value.seatId
        ? value.seatId
        : `seat_${Date.now()}`,
    seatName: typeof value.seatName === 'string' ? value.seatName : undefined,
    isSample: Boolean(value.isSample),
    totalPrice:
      value.totalPrice === undefined
        ? undefined
        : toFiniteNumber(value.totalPrice),
    equipment: Array.isArray(value.equipment)
      ? value.equipment.filter(isRecord)
      : [],
  };
}

export async function POST(req: Request) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const body = await req.json();
    const characterId =
      typeof body?.characterId === 'string' && body.characterId
        ? body.characterId
        : undefined;

    const bundle = await getSimulatorCharacterBundle(user.id, characterId);
    if (!bundle || !bundle.profile) {
      return respErr('simulator character not initialized');
    }

    const ruleSet = await getDamageRuleSet({
      versionId:
        typeof body?.ruleVersionId === 'string'
          ? body.ruleVersionId
          : undefined,
      versionCode:
        typeof body?.ruleVersionCode === 'string'
          ? body.ruleVersionCode
          : undefined,
    });
    if (!ruleSet) {
      return respErr('damage rule version not found');
    }

    const seats = Array.isArray(body?.seats)
      ? body.seats.map(normalizeSeat).filter(Boolean)
      : [];
    if (seats.length === 0) {
      return respErr('lab valuation seats are required');
    }

    const result = calculateLabValuationFromRuleSet({
      bundle,
      ruleSet,
      request: {
        baseAttributes: {
          level: toFiniteNumber(
            body?.baseAttributes?.level,
            bundle.profile.level
          ),
          hp: toFiniteNumber(body?.baseAttributes?.hp),
          magic: toFiniteNumber(
            body?.baseAttributes?.magic,
            bundle.profile.magic
          ),
          physique: toFiniteNumber(
            body?.baseAttributes?.physique,
            bundle.profile.physique
          ),
          magicPower: toFiniteNumber(body?.baseAttributes?.magicPower),
          strength: toFiniteNumber(
            body?.baseAttributes?.strength,
            bundle.profile.strength
          ),
          endurance: toFiniteNumber(
            body?.baseAttributes?.endurance,
            bundle.profile.endurance
          ),
          agility: toFiniteNumber(
            body?.baseAttributes?.agility,
            bundle.profile.agility
          ),
          faction:
            typeof body?.baseAttributes?.faction === 'string'
              ? body.baseAttributes.faction
              : bundle.profile.school || bundle.character.school,
        },
        combatStats: {
          hp: toFiniteNumber(body?.combatStats?.hp, bundle.profile.hp),
          magic: toFiniteNumber(body?.combatStats?.magic, bundle.profile.mp),
          hit: toFiniteNumber(body?.combatStats?.hit, bundle.profile.hit),
          damage: toFiniteNumber(
            body?.combatStats?.damage,
            bundle.profile.damage
          ),
          magicDamage: toFiniteNumber(
            body?.combatStats?.magicDamage,
            bundle.profile.magicDamage
          ),
          defense: toFiniteNumber(
            body?.combatStats?.defense,
            bundle.profile.defense
          ),
          magicDefense: toFiniteNumber(
            body?.combatStats?.magicDefense,
            bundle.profile.magicDefense
          ),
          speed: toFiniteNumber(body?.combatStats?.speed, bundle.profile.speed),
          dodge: toFiniteNumber(body?.combatStats?.dodge),
        },
        treasure: isRecord(body?.treasure)
          ? {
              isActive: Boolean(body.treasure.isActive),
              stats: isRecord(body.treasure.stats) ? body.treasure.stats : {},
            }
          : null,
        target: {
          name:
            typeof body?.target?.name === 'string'
              ? body.target.name
              : undefined,
          magicDefense: toFiniteNumber(body?.target?.magicDefense),
          speed:
            body?.target?.speed === undefined
              ? undefined
              : toFiniteNumber(body.target.speed),
          magicDefenseCultivation:
            body?.target?.magicDefenseCultivation === undefined
              ? undefined
              : toFiniteNumber(body.target.magicDefenseCultivation),
        },
        skillCode:
          typeof body?.skillCode === 'string' ? body.skillCode : undefined,
        skillName:
          typeof body?.skillName === 'string' ? body.skillName : undefined,
        targetCount:
          body?.targetCount === undefined
            ? undefined
            : toFiniteNumber(body.targetCount, 1),
        ruleVersionId:
          typeof body?.ruleVersionId === 'string'
            ? body.ruleVersionId
            : undefined,
        ruleVersionCode:
          typeof body?.ruleVersionCode === 'string'
            ? body.ruleVersionCode
            : undefined,
        seats,
      },
    });

    return respData(result);
  } catch (error) {
    console.error('failed to calculate lab valuation:', error);
    return respErr(
      error instanceof Error
        ? error.message
        : 'failed to calculate lab valuation'
    );
  }
}
