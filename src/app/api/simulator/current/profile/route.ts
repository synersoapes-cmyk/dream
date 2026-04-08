import { respData, respErr } from '@/shared/lib/resp';
import { updateSimulatorProfile } from '@/shared/models/simulator';
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
      physique: toNumber(body?.physique),
      magic: toNumber(body?.magic),
      strength: toNumber(body?.strength),
      endurance: toNumber(body?.endurance),
      agility: toNumber(body?.agility),
      magicPower: toNumber(body?.magicPower),
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
