import { respData, respErr } from '@/shared/lib/resp';
import { buildSimulatorArtifactConfigFromTreasure } from '@/shared/lib/simulator-artifact';
import { updateSimulatorProfile } from '@/shared/models/simulator-user';
import { getUserInfo } from '@/shared/models/user';

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toMeridianConfig(value: unknown) {
  const config =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    physique: toNumber(config.physique),
    magic: toNumber(config.magic),
    strength: toNumber(config.strength),
    endurance: toNumber(config.endurance),
    agility: toNumber(config.agility),
    magicPower: toNumber(config.magicPower),
  };
}

export async function PATCH(req: Request) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const body = await req.json();
    const bundle = await updateSimulatorProfile(user.id, {
      level: toNumber(body?.level),
      faction: String(body?.faction || ''),
      baseHp: toOptionalNumber(body?.baseHp),
      physique: toNumber(body?.physique),
      magic: toNumber(body?.magic),
      potentialPoints: toNumber(body?.potentialPoints),
      strength: toNumber(body?.strength),
      endurance: toNumber(body?.endurance),
      agility: toNumber(body?.agility),
      magicPower: toNumber(body?.magicPower),
      spiritualPower: toOptionalNumber(body?.spiritualPower),
      magicCritLevel: toOptionalNumber(body?.magicCritLevel),
      spellDamageLevel: toOptionalNumber(body?.spellDamageLevel),
      fixedDamage: toOptionalNumber(body?.fixedDamage),
      pierceLevel: toOptionalNumber(body?.pierceLevel),
      elementalMastery: toOptionalNumber(body?.elementalMastery),
      block: toOptionalNumber(body?.block),
      antiCritLevel: toOptionalNumber(body?.antiCritLevel),
      sealResistLevel: toOptionalNumber(body?.sealResistLevel),
      elementalResistance: toOptionalNumber(body?.elementalResistance),
      hp: toNumber(body?.hp),
      mp: toNumber(body?.mp),
      damage: toNumber(body?.damage),
      defense: toNumber(body?.defense),
      magicDamage: toNumber(body?.magicDamage),
      magicDefense: toNumber(body?.magicDefense),
      speed: toNumber(body?.speed),
      hit: toNumber(body?.hit),
      dodge: toNumber(body?.dodge),
      sealHit: toOptionalNumber(body?.sealHit),
      meridianConfig: toMeridianConfig(body?.meridianConfig),
      artifactConfig: buildSimulatorArtifactConfigFromTreasure(body?.treasure),
    });

    if (!bundle) {
      return respErr('simulator character not found');
    }

    return respData(bundle);
  } catch (error) {
    console.error('failed to update simulator profile:', error);
    return respErr('failed to save simulator profile');
  }
}
