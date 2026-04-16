'use client';

import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { DUNGEON_DATABASE } from '@/features/simulator/store/gameData';
import { useGameStore } from '@/features/simulator/store/gameStore';
import type { Dungeon, Skill } from '@/features/simulator/store/gameTypes';
import {
  buildDungeonDatabaseFromTemplates,
  mergeDungeonDatabases,
} from '@/features/simulator/utils/targetTemplates';
import { Calculator, ChevronDown, RefreshCw, X, Zap } from 'lucide-react';

import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import {
  resolveBattleContextDerivedFields,
  resolveElementRelationFromElements,
} from '@/shared/lib/simulator-battle-context';
import {
  buildDamageExplanationChips,
  buildDamageExplanationStages,
} from '@/shared/lib/simulator-damage-explanation';
import { getSimulatorNetworkErrorMessage } from '@/shared/lib/simulator-network';
import {
  getSkillTargetCountOptions,
  resolveLaboratorySkillLevels,
} from '@/shared/lib/simulator-rune-skill';
import type {
  DamageEngineResult,
  DamageEngineTargetInput,
  DamageEngineTargetResult,
} from '@/shared/services/damage-engine';

import { SimpleSelect } from './SimpleSelect';

const ELEMENT_RELATION_OPTIONS = ['克制', '无克/普通', '被克制'];
const PREFERRED_DAMAGE_SKILL_NAMES = ['龙卷雨击', '龙腾'];

type PanelMagicContribution = {
  sourceAttr: string;
  coefficient: number;
  contribution: number;
};

type PanelMagicDamageBreakdown = {
  formula?: string;
  spiritContributions?: PanelMagicContribution[];
  magicDamageContributions?: PanelMagicContribution[];
  overrideApplied?: boolean;
  overrideValue?: number;
  spiritBeforeRules?: number;
  spiritAfterRules?: number;
  ruleDerivedMagicDamage?: number;
  equipmentMagicDamageFlat?: number;
  result?: number;
};

type MatchedBonusRule = {
  ruleCode: string;
  skillName?: string;
  bonusValue: number;
};

type StarBonusEntry = {
  equipmentId: string;
  slot: string;
  label: string;
  targetKey: string;
  value: number;
};

type StarBonusesBreakdown = {
  panelStatBonuses?: Record<string, number>;
  attributeSourceBonuses?: Record<string, number>;
  fullSetActive?: boolean;
  fullSetAttributeBonus?: number;
  starPositionBonuses?: StarBonusEntry[];
  starAlignmentBonuses?: StarBonusEntry[];
};

type DamageTargetDetails = {
  baseItem: string;
  splitRatio: string;
  magicDamage: number;
  targetDef: number;
  formationRatio: string;
  transformCardFactor: string;
  cultDiff: number;
  magicResult: number;
  shenmuValue: number;
  elementFactor: string;
  luohanFactor: string;
  damageVarianceFactor: string;
  criticalChance: string;
  expectedDamage: number;
  finalDamage: number;
  critDamage: number;
  formulaExpression: string;
  matchedBonusRules: MatchedBonusRule[];
  rawBreakdown: Record<string, unknown> & {
    panelMagicDamageBreakdown?: PanelMagicDamageBreakdown;
    starBonuses?: StarBonusesBreakdown;
  };
};

type DamageDisplayTarget = DamageEngineTargetInput & {
  name: string;
  defense: number;
  isBoss?: boolean;
  singleTargetDamage: number;
  critDamage: number;
  totalDamage: number;
  totalCritDamage: number;
  details: DamageTargetDetails;
  targets: number;
};

type DamageDisplayGroup = {
  type: 'manual' | 'dungeon';
  groupName: string;
  targets: DamageDisplayTarget[];
};

type ModalSkillDetails = Skill & {
  targets: number;
  targetName: string;
  groupName: string;
  details: DamageTargetDetails;
  finalDamage: number;
  critDamage: number;
};

const localizeFormulaExpression = (expression: string) =>
  expression
    .replaceAll('panel_magic_damage', '面板法伤')
    .replaceAll('actual_target_magic_defense', '实际目标法防')
    .replaceAll('formation_factor', '阵法系数')
    .replaceAll('transform_card_factor', '变身卡系数')
    .replaceAll('element_factor', '五行系数')
    .replaceAll('split_factor', '分灵系数')
    .replaceAll('cult_diff', '修炼差')
    .replaceAll('shenmu_value', '神木符')
    .replaceAll('magic_result', '法伤结果')
    .replaceAll('base', '基础项');

const getPanelMagicDamageTooltipLines = (
  details: DamageTargetDetails | null | undefined
): string[] => {
  const breakdown = details?.rawBreakdown?.panelMagicDamageBreakdown;
  if (!breakdown) {
    return ['当前面板法伤由服务端规则链统一计算。'];
  }

  const lines = [`口径：${breakdown.formula}`];
  const spiritContributions = Array.isArray(breakdown.spiritContributions)
    ? breakdown.spiritContributions
        .map(
          (item) =>
            `${item.sourceAttr} x ${item.coefficient} = ${item.contribution}`
        )
        .join(' / ')
    : '';
  const magicDamageContributions = Array.isArray(
    breakdown.magicDamageContributions
  )
    ? breakdown.magicDamageContributions
        .map(
          (item) =>
            `${item.sourceAttr} x ${item.coefficient} = ${item.contribution}`
        )
        .join(' / ')
    : '';

  if (breakdown.overrideApplied) {
    lines.push(`覆盖值：${breakdown.overrideValue}`);
  }

  if (breakdown.spiritBeforeRules !== undefined) {
    lines.push(`初始灵力：${breakdown.spiritBeforeRules}`);
  }
  if (spiritContributions) {
    lines.push(`灵力转化：${spiritContributions}`);
  }
  if (breakdown.spiritAfterRules !== undefined) {
    lines.push(`规则灵力：${breakdown.spiritAfterRules}`);
  }
  if (magicDamageContributions) {
    lines.push(`法伤转化：${magicDamageContributions}`);
  }
  if (breakdown.ruleDerivedMagicDamage !== undefined) {
    lines.push(`规则法伤：${breakdown.ruleDerivedMagicDamage}`);
  }
  if (breakdown.equipmentMagicDamageFlat !== undefined) {
    lines.push(`装备法伤：${breakdown.equipmentMagicDamageFlat}`);
  }
  lines.push(`结果：${breakdown.result}`);

  return lines;
};

const getPanelMagicDamageTooltipText = (
  details: DamageTargetDetails | null | undefined
) => getPanelMagicDamageTooltipLines(details).join('\n');

const getExplanationToneClassName = (
  tone: 'neutral' | 'positive' | 'warning' | undefined
) => {
  if (tone === 'positive') {
    return 'border-emerald-700/30 bg-emerald-950/20 text-emerald-200';
  }
  if (tone === 'warning') {
    return 'border-amber-700/30 bg-amber-950/20 text-amber-200';
  }
  return 'border-slate-700/40 bg-slate-950/40 text-slate-200';
};

const decodeName = (name: string): string => {
  if (!name) return '';
  try {
    return decodeURIComponent(escape(name));
  } catch {
    return name;
  }
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getPreferredDamageSkillName = (skills: Array<{ name: string }>) => {
  if (skills.length === 0) {
    return '';
  }

  return (
    PREFERRED_DAMAGE_SKILL_NAMES.find((name) =>
      skills.some((skill) => skill.name === name)
    ) ?? skills[0].name
  );
};

const findDungeonIdForCombatTarget = (
  dungeons: Dungeon[],
  combatTarget: {
    templateId?: string;
    name?: string;
    dungeonName?: string;
  }
) => {
  if (!combatTarget.templateId && !combatTarget.dungeonName) {
    return null;
  }

  for (const dungeon of dungeons) {
    const matchedTarget = dungeon.targets.find(
      (target) =>
        target.templateId === combatTarget.templateId ||
        target.id === combatTarget.templateId ||
        (combatTarget.dungeonName === dungeon.name &&
          target.name === combatTarget.name)
    );

    if (matchedTarget) {
      return dungeon.id;
    }
  }

  return null;
};

const mapTargetResult = (
  target: DamageEngineTargetInput & { name: string; defense: number },
  result: DamageEngineTargetResult | undefined,
  targetCount: number
): DamageDisplayTarget => {
  const breakdown = (result?.breakdown ?? {}) as Record<string, unknown> & {
    baseTerm?: number;
    splitFactor?: number;
    panelMagicDamage?: number;
    targetMagicDefense?: number;
    combinedFormationFactor?: number;
    formationFactor?: number;
    cultivationDiff?: number;
    magicResult?: number;
    elementFactor?: number;
    shenmuValue?: number;
    transformCardFactor?: number;
    luohanFactor?: number;
    damageVarianceFactor?: number;
    criticalChance?: number;
    expectedDamage?: number;
    finalDamage?: number;
    critDamage?: number;
    formulaExpression?: string;
    matchedBonusRules?: MatchedBonusRule[];
    panelMagicDamageBreakdown?: PanelMagicDamageBreakdown;
    starBonuses?: StarBonusesBreakdown;
  };
  const baseTerm = toNumber(breakdown.baseTerm);
  const splitFactor = toNumber(breakdown.splitFactor, 0.5);
  const panelMagicDamage = toNumber(breakdown.panelMagicDamage);
  const targetMagicDefense = toNumber(breakdown.targetMagicDefense);
  const combinedFormationFactor = toNumber(
    breakdown.combinedFormationFactor,
    toNumber(breakdown.formationFactor, 1)
  );
  const cultivationDiff = toNumber(breakdown.cultivationDiff);
  const magicResult = toNumber(breakdown.magicResult);
  const elementFactor = toNumber(breakdown.elementFactor, 1);
  const shenmuValue = toNumber(breakdown.shenmuValue);
  const transformCardFactor = toNumber(breakdown.transformCardFactor, 1);
  const luohanFactor = toNumber(breakdown.luohanFactor, 1);
  const damageVarianceFactor = toNumber(breakdown.damageVarianceFactor, 1);
  const criticalChance = toNumber(breakdown.criticalChance, 0);
  const expectedDamage = toNumber(
    breakdown.expectedDamage,
    (result as { expectedDamage?: number } | undefined)?.expectedDamage
  );

  return {
    ...target,
    name: result?.targetName || target.name,
    defense: target.magicDefense,
    singleTargetDamage: toNumber(result?.damage),
    critDamage: toNumber(result?.critDamage),
    totalDamage: toNumber(result?.totalDamage),
    totalCritDamage: toNumber(result?.totalCritDamage),
    details: {
      baseItem: baseTerm.toFixed(1),
      splitRatio: splitFactor.toFixed(2),
      magicDamage: panelMagicDamage,
      targetDef: targetMagicDefense,
      formationRatio: combinedFormationFactor.toFixed(2),
      transformCardFactor: transformCardFactor.toFixed(2),
      cultDiff: cultivationDiff,
      magicResult,
      shenmuValue,
      elementFactor: elementFactor.toFixed(2),
      luohanFactor: luohanFactor.toFixed(2),
      damageVarianceFactor: damageVarianceFactor.toFixed(2),
      criticalChance: `${(criticalChance * 100).toFixed(1)}%`,
      expectedDamage,
      finalDamage: toNumber(breakdown.finalDamage, result?.damage),
      critDamage: toNumber(breakdown.critDamage, result?.critDamage),
      formulaExpression: localizeFormulaExpression(
        breakdown.formulaExpression ||
          '(base + panel_magic_damage - actual_target_magic_defense) * formation_factor * transform_card_factor * element_factor * split_factor * (1 + cult_diff * 0.02) + cult_diff * 5 + shenmu_value + magic_result'
      ),
      matchedBonusRules: breakdown.matchedBonusRules || [],
      rawBreakdown: breakdown,
    },
    targets: targetCount,
  };
};

async function requestDamageCalculation(params: {
  skillName?: string;
  targetCount: number;
  selfFormation: string;
  targetFormation: string;
  formationFactor: number;
  formationCounterState: string;
  selfElement: string;
  targetElement: string;
  elementRelation: string;
  weather: string;
  shenmuValue: number;
  magicResult: number;
  targetMagicDefenseResult: number;
  targetDefenseState: string;
  specialMagicDamageReductionFactor: number;
  transformCardFactor: number;
  luohanFactor: number;
  damageVarianceFactor: number;
  criticalChance: number;
  criticalExpectationMultiplier: number;
  signal?: AbortSignal;
  targets: Array<{
    name: string;
    defense: number;
    magicDefense: number;
    speed?: number;
    isBoss?: boolean;
  }>;
}): Promise<{
  ruleVersion: DamageEngineResult['ruleVersion'] | null;
  skill: DamageEngineResult['skill'] | null;
  targets: DamageDisplayTarget[];
}> {
  if (!params.skillName || params.targets.length === 0) {
    return {
      ruleVersion: null,
      skill: null,
      targets: [],
    };
  }

  const response = await fetch('/api/simulator/calculate-damage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      skillName: params.skillName,
      targetCount: params.targetCount,
      selfFormation: params.selfFormation,
      targetFormation: params.targetFormation,
      formationFactor: params.formationFactor,
      formationCounterState: params.formationCounterState,
      selfElement: params.selfElement,
      targetElement: params.targetElement,
      elementRelation: params.elementRelation,
      weather: params.weather,
      shenmuValue: params.shenmuValue,
      magicResult: params.magicResult,
      targetMagicDefenseResult: params.targetMagicDefenseResult,
      targetDefenseState: params.targetDefenseState,
      specialMagicDamageReductionFactor:
        params.specialMagicDamageReductionFactor,
      transformCardFactor: params.transformCardFactor,
      luohanFactor: params.luohanFactor,
      damageVarianceFactor: params.damageVarianceFactor,
      criticalChance: params.criticalChance,
      criticalExpectationMultiplier: params.criticalExpectationMultiplier,
      targets: params.targets.map((target) => ({
        name: target.name,
        magicDefense: target.magicDefense,
        speed: target.speed,
      })),
    }),
    signal: params.signal,
  });

  const payload = await response.json();
  if (!response.ok || payload?.code !== 0) {
    throw new Error(payload?.message || '伤害试算失败');
  }

  const results = Array.isArray(payload?.data?.targets)
    ? (payload.data.targets as DamageEngineTargetResult[])
    : [];
  return {
    ruleVersion: (payload?.data?.ruleVersion ?? null) as
      | DamageEngineResult['ruleVersion']
      | null,
    skill: (payload?.data?.skill ?? null) as DamageEngineResult['skill'] | null,
    targets: params.targets.map((target, index) =>
      mapTargetResult(target, results[index], params.targetCount)
    ),
  };
}

export function SkillDamagePanel({
  isOpen,
  onClose,
}: {
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const combatTarget = useGameStore((state) => state.combatTarget);
  const equipment = useGameStore((state) => state.equipment);
  const manualTargets = useGameStore((state) => state.manualTargets);
  const skills = useGameStore((state) => state.skills);
  const selectSkill = useGameStore((state) => state.selectSkill);
  const playerSetup = useGameStore((state) => state.playerSetup);
  const syncedCloudState = useGameStore((state) => state.syncedCloudState);

  const [showModal, setShowModal] = useState(false);
  const [modalSkillDetails, setModalSkillDetails] =
    useState<ModalSkillDetails | null>(null);
  const [activeTargetDisplay, setActiveTargetDisplay] = useState('手动设置');
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationError, setCalculationError] = useState('');
  const [damageDisplayData, setDamageDisplayData] = useState<
    DamageDisplayGroup[]
  >([]);
  const [ruleVersionInfo, setRuleVersionInfo] = useState<
    DamageEngineResult['ruleVersion'] | null
  >(null);

  const [targetDungeons, setTargetDungeons] = useState<Dungeon[]>([]);
  const [selectedDungeonId, setSelectedDungeonId] = useState<string>('');
  const [isDungeonSelectOpen, setIsDungeonSelectOpen] = useState(false);

  const [activeSkillId, setActiveSkillId] = useState<string>(
    getPreferredDamageSkillName(skills)
  );
  const [isSkillSelectOpen, setIsSkillSelectOpen] = useState(false);
  const [skillSearchQuery, setSkillSearchQuery] = useState('');

  const [targetCount, setTargetCount] = useState<number>(7);
  const [isTargetCountOpen, setIsTargetCountOpen] = useState(false);
  const [elementRelation, setElementRelation] = useState('无克/普通');
  const [shenmuValue, setShenmuValue] = useState(0);
  const [magicResult, setMagicResult] = useState(0);
  const [transformCardFactor, setTransformCardFactor] = useState(1);
  const [weather, setWeather] = useState('');
  const [targetDefenseState, setTargetDefenseState] = useState('');
  const [targetMagicDefenseResult, setTargetMagicDefenseResult] = useState(0);
  const [
    specialMagicDamageReductionFactor,
    setSpecialMagicDamageReductionFactor,
  ] = useState(1);
  const [luohanEnabled, setLuohanEnabled] = useState(false);
  const [damageVariancePercent, setDamageVariancePercent] = useState(100);
  const [criticalChancePercent, setCriticalChancePercent] = useState(0);
  const latestCalculationRequestRef = useRef(0);
  const activeCalculationAbortRef = useRef<AbortController | null>(null);

  const updatePercentInput = (
    setter: Dispatch<SetStateAction<number>>,
    value: string,
    fallback: number,
    min: number,
    max: number
  ) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      setter(fallback);
      return;
    }

    setter(Math.min(max, Math.max(min, parsed)));
  };

  const resolvedSkills = useMemo(
    () =>
      resolveLaboratorySkillLevels(skills, equipment, {
        baselineEquipment: syncedCloudState?.equipment ?? [],
      }),
    [skills, equipment, syncedCloudState]
  );

  const derivedBattleContext = useMemo(
    () =>
      resolveBattleContextDerivedFields({
        selfFormation: playerSetup.formation,
        targetFormation: combatTarget.formation,
        selfElement: playerSetup.element,
        targetElement: combatTarget.element,
      }),
    [
      combatTarget.element,
      combatTarget.formation,
      playerSetup.element,
      playerSetup.formation,
    ]
  );

  const activeSkill = useMemo(
    () =>
      resolvedSkills.find((skill) => skill.name === activeSkillId) ||
      resolvedSkills[0],
    [resolvedSkills, activeSkillId]
  );
  const targetCountOptions = useMemo(
    () => getSkillTargetCountOptions(resolvedSkills, activeSkillId),
    [resolvedSkills, activeSkillId]
  );

  const selectedDungeon = useMemo(
    () => targetDungeons.find((dungeon) => dungeon.id === selectedDungeonId),
    [selectedDungeonId, targetDungeons]
  );
  const isDungeonTargetSelected = Boolean(
    combatTarget.templateId || combatTarget.dungeonName
  );

  useEffect(() => {
    let cancelled = false;

    const loadTemplates = async () => {
      try {
        const response = await fetch(
          '/api/simulator/target-templates?scene=dungeon',
          {
            method: 'GET',
            cache: 'no-store',
          }
        );
        const payload = await response.json();
        if (
          !response.ok ||
          payload?.code !== 0 ||
          !Array.isArray(payload?.data)
        ) {
          return;
        }

        if (!cancelled) {
          const dungeons = mergeDungeonDatabases(
            buildDungeonDatabaseFromTemplates(payload.data),
            DUNGEON_DATABASE
          );
          setTargetDungeons(dungeons);
          if (dungeons.length > 0) {
            setSelectedDungeonId((current) =>
              dungeons.some((dungeon) => dungeon.id === current)
                ? current
                : dungeons[0].id
            );
          }
        }
      } catch {
        if (!cancelled) {
          setTargetDungeons(DUNGEON_DATABASE);
          setSelectedDungeonId((current) =>
            DUNGEON_DATABASE.some((dungeon) => dungeon.id === current)
              ? current
              : DUNGEON_DATABASE[0]?.id || ''
          );
        }
      }
    };

    void loadTemplates();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      activeSkillId &&
      resolvedSkills.some((skill) => skill.name === activeSkillId)
    ) {
      return;
    }

    const nextSkillName = getPreferredDamageSkillName(resolvedSkills);
    if (nextSkillName) {
      setActiveSkillId(nextSkillName);
    }
  }, [resolvedSkills, activeSkillId]);

  useEffect(() => {
    const maxTargetCount =
      targetCountOptions[targetCountOptions.length - 1] ?? 1;
    setTargetCount((current) =>
      current > maxTargetCount ? maxTargetCount : current
    );
  }, [targetCountOptions]);

  useEffect(() => {
    if (!isOpen || targetDungeons.length === 0) {
      return;
    }

    const matchedDungeonId = findDungeonIdForCombatTarget(
      targetDungeons,
      combatTarget
    );

    if (matchedDungeonId) {
      setSelectedDungeonId(matchedDungeonId);
      return;
    }

    setSelectedDungeonId((current) =>
      targetDungeons.some((dungeon) => dungeon.id === current)
        ? current
        : targetDungeons[0]?.id || ''
    );
  }, [
    isOpen,
    targetDungeons,
    combatTarget.templateId,
    combatTarget.dungeonName,
    combatTarget.name,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const persistedBattleContext = syncedCloudState?.battleContext;
    setElementRelation(
      resolveElementRelationFromElements(
        playerSetup.element,
        combatTarget.element
      )
    );
    setShenmuValue(persistedBattleContext?.shenmuValue ?? 0);
    setMagicResult(persistedBattleContext?.magicResult ?? 0);
    setTransformCardFactor(persistedBattleContext?.transformCardFactor ?? 1);
    setWeather(persistedBattleContext?.weather ?? '');
    setTargetDefenseState(persistedBattleContext?.targetDefenseState ?? '');
    setTargetMagicDefenseResult(
      persistedBattleContext?.targetMagicDefenseResult ?? 0
    );
    setSpecialMagicDamageReductionFactor(
      persistedBattleContext?.specialMagicDamageReductionFactor ?? 1
    );
  }, [
    isOpen,
    syncedCloudState?.battleContext,
    playerSetup.element,
    combatTarget.element,
  ]);

  const loadDamageData = async () => {
    const requestId = latestCalculationRequestRef.current + 1;
    latestCalculationRequestRef.current = requestId;
    activeCalculationAbortRef.current?.abort();
    const requestController = new AbortController();
    activeCalculationAbortRef.current = requestController;
    setIsCalculating(true);
    setCalculationError('');

    let targetDisplay = '';
    if (!isDungeonTargetSelected) {
      targetDisplay = '手动设置';
    } else {
      try {
        const decodedName = decodeName(combatTarget.name || '');
        const decodedDungeon = combatTarget.dungeonName
          ? decodeName(combatTarget.dungeonName)
          : '';
        targetDisplay = decodedDungeon
          ? `${decodedDungeon} - ${decodedName}`
          : decodedName;
      } catch {
        targetDisplay = combatTarget.dungeonName
          ? `${combatTarget.dungeonName} - ${combatTarget.name}`
          : combatTarget.name;
      }
    }

    setActiveTargetDisplay(targetDisplay);

    try {
      if (!activeSkill) {
        setDamageDisplayData([]);
        return;
      }

      const manualTargetInputs = manualTargets.map((target) => ({
        name: decodeName(target.name),
        defense: toNumber(target.defense),
        magicDefense: toNumber(target.magicDefense),
        speed: toNumber(target.speed),
      }));

      const dungeonTargetInputs =
        selectedDungeon?.targets.map((target) => ({
          name: decodeName(target.name),
          magicDefense: toNumber(target.magicDefense),
          speed: toNumber(target.speed),
          isBoss: target.isBoss,
          defense: toNumber(target.defense),
        })) ?? [];

      const [manualResults, dungeonResults] = await Promise.all([
        requestDamageCalculation({
          skillName: activeSkill.name,
          targetCount,
          selfFormation: playerSetup.formation,
          targetFormation: combatTarget.formation || '普通阵',
          formationFactor: derivedBattleContext.formationFactor,
          formationCounterState: derivedBattleContext.formationCounterState,
          selfElement: playerSetup.element,
          targetElement: combatTarget.element || '',
          elementRelation,
          weather,
          shenmuValue,
          magicResult,
          targetMagicDefenseResult,
          targetDefenseState,
          specialMagicDamageReductionFactor,
          transformCardFactor,
          luohanFactor: luohanEnabled ? 0.5 : 1,
          damageVarianceFactor: damageVariancePercent / 100,
          criticalChance: criticalChancePercent / 100,
          criticalExpectationMultiplier: 2,
          signal: requestController.signal,
          targets: manualTargetInputs,
        }),
        requestDamageCalculation({
          skillName: activeSkill.name,
          targetCount,
          selfFormation: playerSetup.formation,
          targetFormation: '普通阵',
          formationFactor: derivedBattleContext.formationFactor,
          formationCounterState: derivedBattleContext.formationCounterState,
          selfElement: playerSetup.element,
          targetElement: '',
          elementRelation,
          weather,
          shenmuValue,
          magicResult,
          targetMagicDefenseResult,
          targetDefenseState,
          specialMagicDamageReductionFactor,
          transformCardFactor,
          luohanFactor: luohanEnabled ? 0.5 : 1,
          damageVarianceFactor: damageVariancePercent / 100,
          criticalChance: criticalChancePercent / 100,
          criticalExpectationMultiplier: 2,
          signal: requestController.signal,
          targets: dungeonTargetInputs,
        }),
      ]);

      if (requestId !== latestCalculationRequestRef.current) {
        return;
      }

      setRuleVersionInfo(
        manualResults.ruleVersion || dungeonResults.ruleVersion || null
      );

      const nextDisplayData: DamageDisplayGroup[] = [
        {
          type: 'manual',
          groupName: '手动目标',
          targets: manualResults.targets,
        },
      ];

      if (selectedDungeon) {
        nextDisplayData.push({
          type: 'dungeon',
          groupName: decodeName(selectedDungeon.name),
          targets: dungeonResults.targets,
        });
      }

      startTransition(() => {
        setDamageDisplayData(nextDisplayData);
      });
    } catch (error) {
      if (requestId !== latestCalculationRequestRef.current) {
        return;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('failed to calculate skill damage panel:', error);
      setCalculationError(
        getSimulatorNetworkErrorMessage(error, '伤害试算失败')
      );
      setDamageDisplayData([]);
    } finally {
      if (requestId === latestCalculationRequestRef.current) {
        setIsCalculating(false);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void loadDamageData();
  }, [
    isOpen,
    activeSkill?.name,
    targetCount,
    selectedDungeonId,
    manualTargets,
    elementRelation,
    shenmuValue,
    magicResult,
    weather,
    targetDefenseState,
    targetMagicDefenseResult,
    specialMagicDamageReductionFactor,
    transformCardFactor,
    luohanEnabled,
    damageVariancePercent,
    criticalChancePercent,
    playerSetup.element,
    playerSetup.formation,
    derivedBattleContext,
    combatTarget.name,
    combatTarget.dungeonName,
    combatTarget.templateId,
    isDungeonTargetSelected,
  ]);

  useEffect(
    () => () => {
      activeCalculationAbortRef.current?.abort();
    },
    []
  );

  const handleRecalculate = () => {
    void loadDamageData();
  };

  const handleSkillClick = (
    skillData: Skill | undefined,
    targetData?: DamageDisplayTarget,
    groupName?: string
  ) => {
    if (!skillData) {
      return;
    }

    selectSkill(skillData);
    if (targetData && groupName) {
      setModalSkillDetails({
        ...skillData,
        targets: targetCount,
        targetName: targetData.name,
        groupName,
        details: targetData.details,
        finalDamage: targetData.singleTargetDamage,
        critDamage: targetData.critDamage,
      });
    } else {
      setModalSkillDetails(null);
    }
    setShowModal(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-yellow-800/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl">
        <div className="z-50 flex items-center justify-between border-b border-yellow-700/60 bg-gradient-to-r from-yellow-900/50 to-yellow-800/30 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-yellow-600">
              <Zap className="h-4 w-4 text-slate-900" />
            </div>
            <div className="flex items-center gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-bold text-yellow-100">
                  技能伤害
                </h2>
              </div>
              <div className="relative">
                <div
                  onClick={() => setIsSkillSelectOpen(!isSkillSelectOpen)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-yellow-800/60 bg-slate-900/80 px-3 py-1.5 transition-colors hover:border-yellow-600/60"
                >
                  <span className="text-sm font-medium text-yellow-300">
                    {activeSkill?.name || '选择技能'}
                  </span>
                  <span className="text-xs text-yellow-500/70">
                    Lv.{activeSkill?.level || 0}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-yellow-600/80 transition-transform ${
                      isSkillSelectOpen ? 'rotate-180' : ''
                    }`}
                  />
                </div>

                {isSkillSelectOpen && (
                  <div className="absolute top-full left-0 z-50 mt-2 flex w-48 flex-col overflow-hidden rounded-xl border border-yellow-800/80 bg-slate-900 shadow-2xl">
                    <div className="border-b border-yellow-800/40 p-2">
                      <input
                        id="skill-damage-search-input"
                        name="skill-damage-search-input"
                        aria-label="搜索技能"
                        type="text"
                        placeholder="搜索技能..."
                        value={skillSearchQuery}
                        onChange={(e) => setSkillSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-yellow-700/30 bg-slate-950/50 px-2 py-1 text-xs text-yellow-100 placeholder-yellow-700/50 focus:border-yellow-500/50 focus:outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto p-1.5">
                      {resolvedSkills
                        .filter((skill) =>
                          skill.name
                            .toLowerCase()
                            .includes(skillSearchQuery.toLowerCase())
                        )
                        .map((skill) => (
                          <div
                            key={skill.name}
                            onClick={() => {
                              setActiveSkillId(skill.name);
                              setIsSkillSelectOpen(false);
                              setSkillSearchQuery('');
                            }}
                            className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm ${
                              activeSkillId === skill.name
                                ? 'bg-yellow-900/40 text-yellow-300'
                                : 'text-yellow-100 hover:bg-slate-800'
                            }`}
                          >
                            <span>{skill.name}</span>
                            <span className="text-xs opacity-60">
                              Lv.{skill.level}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <div
                  onClick={() => setIsTargetCountOpen(!isTargetCountOpen)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-yellow-800/60 bg-slate-900/80 px-3 py-1.5 transition-colors hover:border-yellow-600/60"
                >
                  <span className="text-sm font-medium text-yellow-300">
                    秒{targetCount}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-yellow-600/80 transition-transform ${
                      isTargetCountOpen ? 'rotate-180' : ''
                    }`}
                  />
                </div>

                {isTargetCountOpen && (
                  <div className="absolute top-full left-0 z-50 mt-2 flex w-28 flex-col overflow-hidden rounded-xl border border-yellow-800/80 bg-slate-900 shadow-2xl">
                    <div className="max-h-64 overflow-y-auto p-1.5">
                      {targetCountOptions.map((count) => (
                        <div
                          key={count}
                          onClick={() => {
                            setTargetCount(count);
                            setIsTargetCountOpen(false);
                          }}
                          className={`flex cursor-pointer items-center justify-center rounded-lg px-3 py-2 text-sm ${
                            targetCount === count
                              ? 'bg-yellow-900/40 text-yellow-300'
                              : 'text-yellow-100 hover:bg-slate-800'
                          }`}
                        >
                          秒{count}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRecalculate}
              disabled={isCalculating}
              className="flex items-center gap-1.5 rounded-lg border border-yellow-700/50 bg-yellow-900/40 px-3 py-1.5 text-xs font-medium text-yellow-100 transition-colors hover:bg-yellow-800/60 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isCalculating ? 'animate-spin' : ''}`}
              />
              重新计算
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-yellow-800/40 bg-slate-900/60 transition-all hover:border-yellow-600/60 hover:bg-slate-800/80"
              >
                <X className="h-4 w-4 text-yellow-400/80" />
              </button>
            )}
          </div>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
          <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-yellow-900/30 bg-slate-900/35 px-4 py-2 text-xs text-yellow-300/80">
            <span>当前目标：{activeTargetDisplay || '未选择'}</span>
            <span className="flex flex-wrap items-center gap-3">
              {ruleVersionInfo?.versionCode && (
                <span className="rounded-full border border-yellow-700/30 bg-yellow-900/30 px-2 py-0.5 text-[10px] text-yellow-200">
                  规则 {ruleVersionInfo.versionCode}
                </span>
              )}
            </span>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-yellow-900/30 bg-slate-900/35 p-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1.5">
              <Label
                id="skill-damage-weather-label"
                className="text-xs text-yellow-300/80"
              >
                天气
              </Label>
              <SimpleSelect
                triggerId="skill-damage-weather-select"
                ariaLabelledBy="skill-damage-weather-label"
                value={weather || '无天气'}
                onValueChange={(value) =>
                  setWeather(value === '无天气' ? '' : value)
                }
                className="h-9 py-1 text-sm"
              >
                {['无天气', '雨天'].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </SimpleSelect>
            </div>
            <div className="space-y-1.5">
              <Label
                id="skill-damage-target-defense-state-label"
                className="text-xs text-yellow-300/80"
              >
                目标状态
              </Label>
              <SimpleSelect
                triggerId="skill-damage-target-defense-state-select"
                ariaLabelledBy="skill-damage-target-defense-state-label"
                value={targetDefenseState || '普通'}
                onValueChange={(value) =>
                  setTargetDefenseState(value === '普通' ? '' : value)
                }
                className="h-9 py-1 text-sm"
              >
                {['普通', '防御'].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </SimpleSelect>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-yellow-300/80">变身卡倍率</Label>
              <Input
                value={transformCardFactor}
                type="number"
                min={0}
                step={0.01}
                onChange={(e) =>
                  updatePercentInput(
                    setTransformCardFactor,
                    e.target.value,
                    1,
                    0,
                    10
                  )
                }
                className="h-9 border-yellow-800/40 bg-slate-950/60 text-sm text-yellow-100"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-yellow-300/80">伤害波动 %</Label>
              <Input
                value={damageVariancePercent}
                type="number"
                min={95}
                max={105}
                step={1}
                onChange={(e) =>
                  updatePercentInput(
                    setDamageVariancePercent,
                    e.target.value,
                    100,
                    95,
                    105
                  )
                }
                className="h-9 border-yellow-800/40 bg-slate-950/60 text-sm text-yellow-100"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-yellow-300/80">法爆率 %</Label>
              <Input
                value={criticalChancePercent}
                type="number"
                min={0}
                max={100}
                step={0.1}
                onChange={(e) =>
                  updatePercentInput(
                    setCriticalChancePercent,
                    e.target.value,
                    0,
                    0,
                    100
                  )
                }
                className="h-9 border-yellow-800/40 bg-slate-950/60 text-sm text-yellow-100"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-yellow-300/80">神木符</Label>
              <Input
                value={shenmuValue}
                type="number"
                step={1}
                onChange={(e) =>
                  updatePercentInput(
                    setShenmuValue,
                    e.target.value,
                    0,
                    -99999,
                    99999
                  )
                }
                className="h-9 border-yellow-800/40 bg-slate-950/60 text-sm text-yellow-100"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-yellow-300/80">法伤结果</Label>
              <Input
                value={magicResult}
                type="number"
                step={1}
                onChange={(e) =>
                  updatePercentInput(
                    setMagicResult,
                    e.target.value,
                    0,
                    -99999,
                    99999
                  )
                }
                className="h-9 border-yellow-800/40 bg-slate-950/60 text-sm text-yellow-100"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-yellow-300/80">目标法防结果</Label>
              <Input
                value={targetMagicDefenseResult}
                type="number"
                min={0}
                step={1}
                onChange={(e) =>
                  updatePercentInput(
                    setTargetMagicDefenseResult,
                    e.target.value,
                    0,
                    0,
                    99999
                  )
                }
                className="h-9 border-yellow-800/40 bg-slate-950/60 text-sm text-yellow-100"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-yellow-300/80">法术减伤系数</Label>
              <Input
                value={specialMagicDamageReductionFactor}
                type="number"
                min={0}
                max={1}
                step={0.01}
                onChange={(e) =>
                  updatePercentInput(
                    setSpecialMagicDamageReductionFactor,
                    e.target.value,
                    1,
                    0,
                    1
                  )
                }
                className="h-9 border-yellow-800/40 bg-slate-950/60 text-sm text-yellow-100"
              />
            </div>
            <label className="flex items-center gap-3 rounded-lg border border-yellow-800/30 bg-slate-950/40 px-3 py-2.5 text-sm text-yellow-100">
              <input
                type="checkbox"
                checked={luohanEnabled}
                onChange={(e) => setLuohanEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-yellow-700/50 bg-slate-900 text-yellow-500"
              />
              <span>开启罗汉减伤</span>
              <span className="ml-auto text-xs text-yellow-500/70">
                非结果部分 x0.5
              </span>
            </label>
          </div>

          {calculationError && (
            <div className="mb-4 rounded-xl border border-red-800/50 bg-red-950/20 px-4 py-3 text-sm text-red-200">
              {calculationError}
            </div>
          )}

          <div className="space-y-4">
            {damageDisplayData.map((group, groupIdx) => (
              <div
                key={groupIdx}
                className="overflow-hidden rounded-xl border border-yellow-900/30 bg-slate-900/40 shadow-inner"
              >
                <div className="flex items-center justify-between gap-2.5 border-b border-yellow-900/40 bg-gradient-to-r from-slate-800/80 to-slate-900/80 px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`h-4 w-2 rounded-full ${
                        group.type === 'manual'
                          ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]'
                          : 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]'
                      }`}
                    />
                    <span className="text-sm font-bold tracking-wide text-yellow-100">
                      {group.groupName}
                    </span>
                    {group.type === 'dungeon' && (
                      <span className="rounded-full border border-yellow-700/30 bg-yellow-900/40 px-2 py-0.5 text-[10px] text-yellow-500">
                        副本目标
                      </span>
                    )}
                  </div>

                  {group.type === 'dungeon' && (
                    <div className="relative">
                      <div
                        onClick={() =>
                          setIsDungeonSelectOpen(!isDungeonSelectOpen)
                        }
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-yellow-800/60 bg-slate-900/80 px-3 py-1 text-xs font-medium text-yellow-300 transition-colors hover:border-yellow-600/60"
                      >
                        <span>
                          {decodeName(
                            targetDungeons.find(
                              (dungeon) => dungeon.id === selectedDungeonId
                            )?.name || '选择副本'
                          )}
                        </span>
                        <ChevronDown
                          className={`h-3 w-3 text-yellow-600/80 transition-transform ${
                            isDungeonSelectOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </div>

                      {isDungeonSelectOpen && (
                        <div className="absolute top-full right-0 z-50 mt-2 flex max-h-96 w-64 flex-col overflow-hidden rounded-xl border border-yellow-800/80 bg-slate-900 shadow-2xl">
                          <div className="overflow-y-auto p-1.5">
                            {targetDungeons.map((dungeon) => (
                              <div
                                key={dungeon.id}
                                onClick={() => {
                                  setSelectedDungeonId(dungeon.id);
                                  setIsDungeonSelectOpen(false);
                                }}
                                className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-xs ${
                                  selectedDungeonId === dungeon.id
                                    ? 'bg-yellow-900/40 text-yellow-300'
                                    : 'text-yellow-100 hover:bg-slate-800'
                                }`}
                              >
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-medium">
                                    {dungeon.name}
                                  </span>
                                  <span className="text-[10px] text-yellow-500/60">
                                    {dungeon.level}级 · {dungeon.targets.length}
                                    个怪物
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2.5 p-3">
                  {group.targets.map((target, idx) => (
                    <button
                      key={idx}
                      onClick={() =>
                        handleSkillClick(activeSkill, target, group.groupName)
                      }
                      className="group relative flex w-full flex-col justify-between gap-3 overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-r from-slate-800/60 to-slate-900/40 p-3.5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-yellow-600/50 hover:shadow-[0_4px_20px_rgba(234,179,8,0.1)] sm:flex-row sm:items-center"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/5 to-yellow-500/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                      <div className="relative z-10 flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold tracking-wide text-yellow-50 transition-colors group-hover:text-yellow-300">
                            {target.name}
                          </span>
                          {target.isBoss && (
                            <span className="rounded bg-red-900/40 px-1.5 py-0.5 text-[10px] text-red-300">
                              BOSS
                            </span>
                          )}
                          <span className="rounded border border-slate-800 bg-slate-950/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                            法防 {target.defense}
                          </span>
                        </div>
                      </div>

                      <div className="relative z-10 flex items-stretch gap-3">
                        <div className="flex min-w-[80px] flex-col items-end justify-center rounded-lg border border-slate-800/60 bg-slate-950/40 px-3 py-1.5">
                          <span className="mb-0.5 text-[10px] text-slate-400">
                            普通伤害
                          </span>
                          <span className="text-sm font-bold text-yellow-200 tabular-nums transition-colors group-hover:text-yellow-400">
                            {target.singleTargetDamage.toLocaleString()}
                          </span>
                        </div>

                        <div className="w-px bg-gradient-to-b from-transparent via-slate-700 to-transparent" />

                        <div className="flex min-w-[80px] flex-col items-end justify-center rounded-lg border border-red-900/30 bg-red-950/20 px-3 py-1.5">
                          <span className="mb-0.5 text-[10px] text-red-400/80">
                            暴击伤害
                          </span>
                          <span className="text-sm font-bold text-red-400 tabular-nums transition-colors group-hover:text-red-300">
                            {target.critDamage.toLocaleString()}
                          </span>
                        </div>

                        <div className="w-px bg-gradient-to-b from-transparent via-slate-700 to-transparent" />

                        {target.details.expectedDamage > 0 && (
                          <>
                            <div className="flex min-w-[88px] flex-col items-end justify-center rounded-lg border border-cyan-900/30 bg-cyan-950/20 px-3 py-1.5">
                              <span className="mb-0.5 text-[10px] text-cyan-400/80">
                                法爆期望
                              </span>
                              <span className="text-sm font-bold text-cyan-300 tabular-nums">
                                {target.details.expectedDamage.toLocaleString()}
                              </span>
                            </div>

                            <div className="w-px bg-gradient-to-b from-transparent via-slate-700 to-transparent" />
                          </>
                        )}

                        <div className="flex min-w-[80px] flex-col items-end justify-center rounded-lg border border-yellow-900/30 bg-yellow-950/20 px-3 py-1.5">
                          <span className="mb-0.5 text-[10px] text-yellow-600/80">
                            总伤 (x{targetCount})
                          </span>
                          <span className="text-base font-black text-yellow-400 tabular-nums drop-shadow-[0_0_8px_rgba(234,179,8,0.3)]">
                            {target.totalDamage.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showModal && modalSkillDetails && modalSkillDetails.details && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border-2 border-yellow-700/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-yellow-700/60 bg-gradient-to-r from-yellow-900/50 to-yellow-800/30 px-5 py-4">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-yellow-400" />
                <h3 className="font-bold text-yellow-100">
                  伤害计算公式 - {modalSkillDetails.name}
                  <span className="ml-2 text-xs font-normal text-yellow-500/80">
                    [{modalSkillDetails.groupName}]{' '}
                    {modalSkillDetails.targetName}
                  </span>
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-yellow-800/40 bg-slate-900/60 transition-all hover:border-yellow-600/60 hover:bg-slate-800/80"
              >
                <X className="h-4 w-4 text-yellow-400/80" />
              </button>
            </div>

            <div className="max-h-[80vh] space-y-5 overflow-y-auto p-6">
              {(() => {
                const explanationStages = buildDamageExplanationStages(
                  modalSkillDetails.details.rawBreakdown
                );
                const explanationChips = buildDamageExplanationChips(
                  modalSkillDetails.details.rawBreakdown
                );

                return (
                  <>
                    <div className="rounded-xl border border-yellow-800/30 bg-slate-900/50 p-4 shadow-inner">
                      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-yellow-400">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-yellow-900/60 text-xs text-yellow-300">
                          1
                        </span>
                        基础项计算
                      </div>
                      <div className="mb-3 rounded bg-black/30 p-2 text-xs text-yellow-100/60">
                        公式: (技能等级² / 145) + (技能等级 * 1.4) + 39.5
                      </div>
                      <div className="font-mono text-sm leading-relaxed tracking-wide text-green-400">
                        = ({modalSkillDetails.level}² / 145) + (
                        {modalSkillDetails.level} * 1.4) + 39.5
                        <br />
                        <span className="mt-1 inline-block font-bold text-yellow-300">
                          = {modalSkillDetails.details.baseItem}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-yellow-800/30 bg-slate-900/50 p-4 shadow-inner">
                      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-yellow-400">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-yellow-900/60 text-xs text-yellow-300">
                          2
                        </span>
                        分灵系数计算
                      </div>
                      <div className="mb-3 rounded bg-black/30 p-2 text-xs text-yellow-100/60">
                        服务端规则命中后的分灵系数
                      </div>
                      <div className="font-mono text-sm leading-relaxed tracking-wide text-green-400">
                        秒{modalSkillDetails.targets}
                        <br />
                        <span className="mt-1 inline-block font-bold text-yellow-300">
                          = {modalSkillDetails.details.splitRatio}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-yellow-800/30 bg-slate-900/50 p-4 shadow-inner">
                      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-yellow-400">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-yellow-900/60 text-xs text-yellow-300">
                          3
                        </span>
                        最终伤害计算
                      </div>
                      <div className="mb-3 rounded bg-black/30 p-2 text-xs leading-relaxed text-yellow-100/60">
                        <div className="mb-2">
                          公式: {modalSkillDetails.details.formulaExpression}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-yellow-800/40 pt-2 text-yellow-500/80">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                title={getPanelMagicDamageTooltipText(
                                  modalSkillDetails.details
                                )}
                                className="inline-flex cursor-help items-center underline decoration-dotted underline-offset-2"
                              >
                                面板法伤:{' '}
                                {modalSkillDetails.details.magicDamage}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="max-w-xs text-left whitespace-pre-line"
                            >
                              {getPanelMagicDamageTooltipText(
                                modalSkillDetails.details
                              )}
                            </TooltipContent>
                          </Tooltip>
                          <span>
                            目标法防: {modalSkillDetails.details.targetDef}
                          </span>
                          <span>
                            阵法系数: {modalSkillDetails.details.formationRatio}
                          </span>
                          <span>
                            变身卡:{' '}
                            {modalSkillDetails.details.transformCardFactor}
                          </span>
                          <span>
                            罗汉: {modalSkillDetails.details.luohanFactor}
                          </span>
                          <span>
                            修炼差: {modalSkillDetails.details.cultDiff}
                          </span>
                          <span>
                            五行系数: {modalSkillDetails.details.elementFactor}
                          </span>
                          <span>
                            波动:{' '}
                            {modalSkillDetails.details.damageVarianceFactor}
                          </span>
                          <span>
                            法爆率: {modalSkillDetails.details.criticalChance}
                          </span>
                          <span>
                            神木符: {modalSkillDetails.details.shenmuValue}
                          </span>
                          <span>
                            法伤结果: {modalSkillDetails.details.magicResult}
                          </span>
                          <span>
                            目标法防结果:{' '}
                            {toNumber(
                              modalSkillDetails.details.rawBreakdown
                                ?.targetMagicDefenseResult
                            )}
                          </span>
                          <span>
                            天气:{' '}
                            {String(
                              modalSkillDetails.details.rawBreakdown?.weather ||
                                '无天气'
                            )}
                          </span>
                          <span>
                            目标状态:{' '}
                            {String(
                              modalSkillDetails.details.rawBreakdown
                                ?.targetDefenseState || '普通'
                            )}
                          </span>
                          <span>
                            法术减伤系数:{' '}
                            {toNumber(
                              modalSkillDetails.details.rawBreakdown
                                ?.specialMagicDamageReductionFactor,
                              1
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="font-mono text-sm leading-relaxed tracking-wide text-green-400">
                        = ({modalSkillDetails.details.baseItem} +{' '}
                        {modalSkillDetails.details.magicDamage} -{' '}
                        {modalSkillDetails.details.targetDef}) *{' '}
                        {modalSkillDetails.details.formationRatio} *{' '}
                        {modalSkillDetails.details.transformCardFactor} *{' '}
                        {modalSkillDetails.details.elementFactor} *{' '}
                        {modalSkillDetails.details.splitRatio} * (1 +{' '}
                        {modalSkillDetails.details.cultDiff} * 0.02) +{' '}
                        {modalSkillDetails.details.cultDiff} * 5 +{' '}
                        {modalSkillDetails.details.shenmuValue}
                        <br />
                        罗汉后非结果部分 x{' '}
                        {modalSkillDetails.details.luohanFactor}
                        ，再 + {modalSkillDetails.details.magicResult}，最后波动
                        x {modalSkillDetails.details.damageVarianceFactor}
                        ，再扣目标法防结果
                        <br />
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <div className="rounded border border-yellow-600/40 bg-yellow-900/30 px-4 py-2 font-bold text-yellow-300">
                            <span className="mb-1 block text-[10px] text-yellow-500/80">
                              普通伤害
                            </span>
                            {modalSkillDetails.details.finalDamage}
                          </div>
                          <div className="rounded border border-red-600/40 bg-red-900/30 px-4 py-2 font-bold text-red-300">
                            <span className="mb-1 block text-[10px] text-red-500/80">
                              暴击伤害 (x1.5)
                            </span>
                            {modalSkillDetails.details.critDamage}
                          </div>
                          {modalSkillDetails.details.expectedDamage > 0 && (
                            <div className="rounded border border-cyan-600/40 bg-cyan-900/30 px-4 py-2 font-bold text-cyan-300">
                              <span className="mb-1 block text-[10px] text-cyan-500/80">
                                法爆期望
                              </span>
                              {modalSkillDetails.details.expectedDamage}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {explanationStages.length > 0 && (
                      <div className="rounded-xl border border-sky-800/30 bg-slate-900/50 p-4 shadow-inner">
                        <div className="mb-3 text-sm font-bold text-sky-300">
                          过程分解
                        </div>
                        <div className="grid grid-cols-1 gap-2.5">
                          {explanationStages.map((stage, index) => (
                            <div
                              key={stage.key}
                              className={`rounded-lg border px-3 py-2 ${getExplanationToneClassName(
                                stage.tone
                              )}`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/25 text-[10px] font-semibold">
                                    {index + 1}
                                  </span>
                                  <span className="text-sm font-semibold">
                                    {stage.label}
                                  </span>
                                </div>
                                <span className="font-mono text-sm font-bold tabular-nums">
                                  {stage.value.toLocaleString()}
                                </span>
                              </div>
                              {stage.note && (
                                <div className="mt-1.5 text-xs leading-relaxed text-slate-300/85">
                                  {stage.note}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {explanationChips.length > 0 && (
                      <div className="rounded-xl border border-violet-800/30 bg-slate-900/50 p-4 shadow-inner">
                        <div className="mb-3 text-sm font-bold text-violet-300">
                          生效规则与来源
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {explanationChips.map((chip) => (
                            <div
                              key={chip.key}
                              className={`rounded-full border px-3 py-1.5 text-xs ${getExplanationToneClassName(
                                chip.tone
                              )}`}
                            >
                              <span className="mr-1.5 text-slate-400">
                                {chip.label}
                              </span>
                              <span className="font-medium">{chip.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {modalSkillDetails.details.matchedBonusRules?.length >
                      0 && (
                      <div className="rounded-xl border border-yellow-800/30 bg-slate-900/50 p-4 shadow-inner">
                        <div className="mb-2 text-sm font-bold text-yellow-400">
                          命中的技能加成规则
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {modalSkillDetails.details.matchedBonusRules.map(
                            (rule) => (
                              <span
                                key={rule.ruleCode}
                                className="rounded-full border border-yellow-700/30 bg-yellow-900/30 px-2.5 py-1 text-xs text-yellow-200"
                              >
                                {rule.skillName} +{rule.bonusValue}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {!!modalSkillDetails.details.rawBreakdown?.starBonuses && (
                      <div className="rounded-xl border border-cyan-800/30 bg-slate-900/50 p-4 shadow-inner">
                        <div className="mb-2 text-sm font-bold text-cyan-300">
                          星石 / 星相互合加成
                        </div>

                        {Array.isArray(
                          modalSkillDetails.details.rawBreakdown.starBonuses
                            ?.starPositionBonuses
                        ) &&
                          modalSkillDetails.details.rawBreakdown.starBonuses
                            .starPositionBonuses!.length > 0 && (
                            <div className="mb-3">
                              <div className="mb-1.5 text-xs text-cyan-200/80">
                                单件星位加成
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {modalSkillDetails.details.rawBreakdown.starBonuses.starPositionBonuses!.map(
                                  (item) => (
                                    <span
                                      key={`${item.equipmentId}-${item.targetKey}-${item.label}`}
                                      className="rounded-full border border-cyan-700/30 bg-cyan-900/20 px-2.5 py-1 text-xs text-cyan-100"
                                    >
                                      {item.slot}: {item.label}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          )}

                        {Array.isArray(
                          modalSkillDetails.details.rawBreakdown.starBonuses
                            ?.starAlignmentBonuses
                        ) &&
                          modalSkillDetails.details.rawBreakdown.starBonuses
                            .starAlignmentBonuses!.length > 0 && (
                            <div className="mb-3">
                              <div className="mb-1.5 text-xs text-cyan-200/80">
                                单件互合属性
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {modalSkillDetails.details.rawBreakdown.starBonuses.starAlignmentBonuses!.map(
                                  (item) => (
                                    <span
                                      key={`${item.equipmentId}-${item.targetKey}-${item.label}`}
                                      className="rounded-full border border-sky-700/30 bg-sky-900/20 px-2.5 py-1 text-xs text-sky-100"
                                    >
                                      {item.slot}: {item.label}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          )}

                        <div className="space-y-1.5 text-xs text-cyan-100/90">
                          <div>
                            六件全套：
                            <span className="ml-2 font-semibold text-cyan-300">
                              {modalSkillDetails.details.rawBreakdown
                                .starBonuses?.fullSetActive
                                ? `已生效（全基础属性 +${modalSkillDetails.details.rawBreakdown.starBonuses?.fullSetAttributeBonus ?? 0}）`
                                : '未生效'}
                            </span>
                          </div>
                          {modalSkillDetails.details.rawBreakdown.starBonuses
                            ?.attributeSourceBonuses && (
                            <div className="text-cyan-200/75">
                              基础属性加成：
                              {Object.entries(
                                modalSkillDetails.details.rawBreakdown
                                  .starBonuses.attributeSourceBonuses
                              )
                                .map(([key, value]) => `${key} +${value}`)
                                .join(' / ')}
                            </div>
                          )}
                          {modalSkillDetails.details.rawBreakdown.starBonuses
                            ?.panelStatBonuses &&
                            Object.keys(
                              modalSkillDetails.details.rawBreakdown.starBonuses
                                .panelStatBonuses
                            ).length > 0 && (
                              <div className="text-cyan-200/75">
                                面板直加：
                                {Object.entries(
                                  modalSkillDetails.details.rawBreakdown
                                    .starBonuses.panelStatBonuses
                                )
                                  .map(([key, value]) => `${key} +${value}`)
                                  .join(' / ')}
                              </div>
                            )}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
