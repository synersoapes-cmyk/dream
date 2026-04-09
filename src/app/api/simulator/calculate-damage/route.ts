import { respData, respErr } from '@/shared/lib/resp';
import { getSimulatorCharacterBundle } from '@/shared/models/simulator-user';
import { calculateDamageWithRules } from '@/shared/services/damage-engine';
import { getUserInfo } from '@/shared/models/user';

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

    if (!bundle) {
      return respErr('simulator character not initialized');
    }

    const targets = Array.isArray(body?.targets)
      ? body.targets.map((item: any) => ({
          name: typeof item?.name === 'string' ? item.name : undefined,
          magicDefense: toFiniteNumber(item?.magicDefense),
          speed:
            item?.speed === undefined ? undefined : toFiniteNumber(item?.speed),
          magicDefenseCultivation: toFiniteNumber(item?.magicDefenseCultivation),
          shenmuValue:
            item?.shenmuValue === undefined ? undefined : toFiniteNumber(item?.shenmuValue),
          magicResult:
            item?.magicResult === undefined ? undefined : toFiniteNumber(item?.magicResult),
        }))
      : undefined;

    const result = await calculateDamageWithRules(bundle, {
      skillCode: typeof body?.skillCode === 'string' ? body.skillCode : undefined,
      skillName: typeof body?.skillName === 'string' ? body.skillName : undefined,
      ruleVersionId:
        typeof body?.ruleVersionId === 'string' ? body.ruleVersionId : undefined,
      ruleVersionCode:
        typeof body?.ruleVersionCode === 'string' ? body.ruleVersionCode : undefined,
      targetCount: toFiniteNumber(body?.targetCount, 1),
      formationFactor:
        body?.formationFactor === undefined ? undefined : toFiniteNumber(body.formationFactor, 1),
      formationCounterState:
        typeof body?.formationCounterState === 'string'
          ? body.formationCounterState
          : undefined,
      elementRelation:
        typeof body?.elementRelation === 'string' ? body.elementRelation : undefined,
      transformCardFactor:
        body?.transformCardFactor === undefined
          ? undefined
          : toFiniteNumber(body.transformCardFactor, 1),
      shenmuValue:
        body?.shenmuValue === undefined ? undefined : toFiniteNumber(body.shenmuValue),
      magicResult:
        body?.magicResult === undefined ? undefined : toFiniteNumber(body.magicResult),
      targetMagicDefense:
        body?.targetMagicDefense === undefined
          ? undefined
          : toFiniteNumber(body.targetMagicDefense),
      targetSpeed:
        body?.targetSpeed === undefined
          ? undefined
          : toFiniteNumber(body.targetSpeed),
      targetMagicDefenseCultivation:
        body?.targetMagicDefenseCultivation === undefined
          ? undefined
          : toFiniteNumber(body.targetMagicDefenseCultivation),
      targetName: typeof body?.targetName === 'string' ? body.targetName : undefined,
      activeBonusRuleCodes: Array.isArray(body?.activeBonusRuleCodes)
        ? body.activeBonusRuleCodes
            .filter((item: unknown) => typeof item === 'string' && item)
            .map((item: string) => item)
        : [],
      panelMagicDamageOverride:
        body?.panelMagicDamageOverride === undefined
          ? undefined
          : toFiniteNumber(body.panelMagicDamageOverride),
      targets,
    });

    return respData(result);
  } catch (error) {
    console.error('failed to calculate simulator damage:', error);
    return respErr(
      error instanceof Error ? error.message : 'failed to calculate simulator damage',
    );
  }
}
