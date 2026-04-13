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
          magicDefenseResult:
            item?.magicDefenseResult === undefined
              ? undefined
              : toFiniteNumber(item?.magicDefenseResult),
          defenseState:
            typeof item?.defenseState === 'string' ? item.defenseState : undefined,
          specialMagicDamageReductionFactor:
            item?.specialMagicDamageReductionFactor === undefined
              ? undefined
              : toFiniteNumber(item?.specialMagicDamageReductionFactor, 1),
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
      selfFormation:
        typeof body?.selfFormation === 'string' ? body.selfFormation : undefined,
      targetFormation:
        typeof body?.targetFormation === 'string'
          ? body.targetFormation
          : undefined,
      selfElement:
        typeof body?.selfElement === 'string' ? body.selfElement : undefined,
      targetElement:
        typeof body?.targetElement === 'string' ? body.targetElement : undefined,
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
      weather: typeof body?.weather === 'string' ? body.weather : undefined,
      shenmuValue:
        body?.shenmuValue === undefined ? undefined : toFiniteNumber(body.shenmuValue),
      magicResult:
        body?.magicResult === undefined ? undefined : toFiniteNumber(body.magicResult),
      targetMagicDefense:
        body?.targetMagicDefense === undefined
          ? undefined
          : toFiniteNumber(body.targetMagicDefense),
      targetMagicDefenseResult:
        body?.targetMagicDefenseResult === undefined
          ? undefined
          : toFiniteNumber(body.targetMagicDefenseResult),
      targetSpeed:
        body?.targetSpeed === undefined
          ? undefined
          : toFiniteNumber(body.targetSpeed),
      targetMagicDefenseCultivation:
        body?.targetMagicDefenseCultivation === undefined
          ? undefined
          : toFiniteNumber(body.targetMagicDefenseCultivation),
      targetDefenseState:
        typeof body?.targetDefenseState === 'string'
          ? body.targetDefenseState
          : undefined,
      specialMagicDamageReductionFactor:
        body?.specialMagicDamageReductionFactor === undefined
          ? undefined
          : toFiniteNumber(body.specialMagicDamageReductionFactor, 1),
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
      luohanFactor:
        body?.luohanFactor === undefined
          ? undefined
          : toFiniteNumber(body.luohanFactor, 1),
      damageVarianceFactor:
        body?.damageVarianceFactor === undefined
          ? undefined
          : toFiniteNumber(body.damageVarianceFactor, 1),
      criticalChance:
        body?.criticalChance === undefined
          ? undefined
          : toFiniteNumber(body.criticalChance, 0),
      criticalExpectationMultiplier:
        body?.criticalExpectationMultiplier === undefined
          ? undefined
          : toFiniteNumber(body.criticalExpectationMultiplier, 2),
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
