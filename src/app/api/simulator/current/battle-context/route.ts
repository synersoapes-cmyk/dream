import { respData, respErr } from '@/shared/lib/resp';
import { updateSimulatorBattleContext } from '@/shared/models/simulator';
import { getUserInfo } from '@/shared/models/user';

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
    const bundle = await updateSimulatorBattleContext(user.id, {
      selfFormation: String(body?.selfFormation || '天覆阵'),
      selfElement: String(body?.selfElement || '水'),
      formationCounterState: String(body?.formationCounterState || '无克/普通'),
      elementRelation: String(body?.elementRelation || '无克/普通'),
      transformCardFactor: toNumber(body?.transformCardFactor, 1),
      splitTargetCount: toNumber(body?.splitTargetCount, 1),
      shenmuValue: toNumber(body?.shenmuValue, 0),
      magicResult: toNumber(body?.magicResult, 0),
      targetName: String(body?.targetName || '默认目标'),
      targetLevel: toNumber(body?.targetLevel, 0),
      targetHp: toNumber(body?.targetHp, 0),
      targetDefense: toNumber(body?.targetDefense, 0),
      targetMagicDefense: toNumber(body?.targetMagicDefense, 0),
      targetMagicDefenseCultivation: toNumber(
        body?.targetMagicDefenseCultivation,
        0
      ),
      targetElement: String(body?.targetElement || ''),
      targetFormation: String(body?.targetFormation || '普通阵'),
      targetTemplateId:
        typeof body?.targetTemplateId === 'string' && body.targetTemplateId.trim()
          ? body.targetTemplateId.trim()
          : null,
    });

    if (!bundle) {
      return respErr('simulator character not found');
    }

    return respData(bundle);
  } catch (error) {
    console.error('failed to save simulator battle context:', error);
    return respErr('failed to save simulator battle context');
  }
}
