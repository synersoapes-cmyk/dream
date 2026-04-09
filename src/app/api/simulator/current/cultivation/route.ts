import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import { updateSimulatorCultivation } from '@/shared/models/simulator-user';

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function PATCH(req: Request) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const body = await req.json();
    const bundle = await updateSimulatorCultivation(user.id, {
      physicalAttack: toNumber(body?.physicalAttack),
      physicalDefense: toNumber(body?.physicalDefense),
      magicAttack: toNumber(body?.magicAttack),
      magicDefense: toNumber(body?.magicDefense),
      petPhysicalAttack: toNumber(body?.petPhysicalAttack),
      petPhysicalDefense: toNumber(body?.petPhysicalDefense),
      petMagicAttack: toNumber(body?.petMagicAttack),
      petMagicDefense: toNumber(body?.petMagicDefense),
    });

    if (!bundle) {
      return respErr('simulator character not found');
    }

    return respData(bundle);
  } catch (error) {
    console.error('failed to update simulator cultivation:', error);
    return respErr('failed to save simulator cultivation');
  }
}
