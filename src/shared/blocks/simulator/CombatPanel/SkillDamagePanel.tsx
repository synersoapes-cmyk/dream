// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';
import { DUNGEON_DATABASE } from '@/features/simulator/store/gameData';
import { useGameStore } from '@/features/simulator/store/gameStore';
import type { Dungeon } from '@/features/simulator/store/gameTypes';
import { buildDungeonDatabaseFromTemplates } from '@/features/simulator/utils/targetTemplates';
import { Calculator, ChevronDown, RefreshCw, X, Zap } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';

const ELEMENT_RELATION_OPTIONS = ['克制', '无克/普通', '被克制'];
const DEFAULT_SELF_FORMATION_LABEL = '天覆阵';
const DEFAULT_FORMATION_COUNTER_LABEL = '无克/普通';

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

const getPanelMagicDamageTooltipLines = (details: any): string[] => {
  const breakdown = details?.rawBreakdown?.panelMagicDamageBreakdown;
  if (!breakdown) {
    return ['当前面板法伤由服务端规则链统一计算。'];
  }

  const lines = [`口径：${breakdown.formula}`];
  const spiritContributions = Array.isArray(breakdown.spiritContributions)
    ? breakdown.spiritContributions
        .map(
          (item: any) =>
            `${item.sourceAttr} x ${item.coefficient} = ${item.contribution}`
        )
        .join(' / ')
    : '';
  const magicDamageContributions = Array.isArray(
    breakdown.magicDamageContributions
  )
    ? breakdown.magicDamageContributions
        .map(
          (item: any) =>
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

const getPanelMagicDamageTooltipText = (details: any) =>
  getPanelMagicDamageTooltipLines(details).join('\n');

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

const mapTargetResult = (target: any, result: any, targetCount: number) => {
  const breakdown = result?.breakdown ?? {};
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
      cultDiff: cultivationDiff,
      magicResult,
      shenmuValue,
      elementFactor: elementFactor.toFixed(2),
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
  elementRelation: string;
  shenmuValue: number;
  magicResult: number;
  transformCardFactor: number;
  targets: Array<{
    name: string;
    magicDefense: number;
    isBoss?: boolean;
  }>;
}) {
  if (!params.skillName || params.targets.length === 0) {
    return [];
  }

  const response = await fetch('/api/simulator/calculate-damage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      skillName: params.skillName,
      targetCount: params.targetCount,
      elementRelation: params.elementRelation,
      shenmuValue: params.shenmuValue,
      magicResult: params.magicResult,
      transformCardFactor: params.transformCardFactor,
      targets: params.targets.map((target) => ({
        name: target.name,
        magicDefense: target.magicDefense,
      })),
    }),
  });

  const payload = await response.json();
  if (!response.ok || payload?.code !== 0) {
    throw new Error(payload?.message || '伤害试算失败');
  }

  const results = Array.isArray(payload?.data?.targets)
    ? payload.data.targets
    : [];
  return {
    ruleVersion: payload?.data?.ruleVersion || null,
    skill: payload?.data?.skill || null,
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
  const manualTargets = useGameStore((state) => state.manualTargets);
  const skills = useGameStore((state) => state.skills);
  const selectSkill = useGameStore((state) => state.selectSkill);
  const combatTab = useGameStore((state) => state.combatTab);

  const [showModal, setShowModal] = useState(false);
  const [modalSkillDetails, setModalSkillDetails] = useState<any>(null);
  const [activeTargetDisplay, setActiveTargetDisplay] = useState('手动设置');
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationError, setCalculationError] = useState('');
  const [damageDisplayData, setDamageDisplayData] = useState<any[]>([]);
  const [ruleVersionInfo, setRuleVersionInfo] = useState<any>(null);

  const [targetDungeons, setTargetDungeons] =
    useState<Dungeon[]>(DUNGEON_DATABASE);
  const [selectedDungeonId, setSelectedDungeonId] = useState<string>(
    DUNGEON_DATABASE[0]?.id || ''
  );
  const [isDungeonSelectOpen, setIsDungeonSelectOpen] = useState(false);

  const [activeSkillId, setActiveSkillId] = useState<string>(
    skills[0]?.name || ''
  );
  const [isSkillSelectOpen, setIsSkillSelectOpen] = useState(false);
  const [skillSearchQuery, setSkillSearchQuery] = useState('');

  const [targetCount, setTargetCount] = useState<number>(7);
  const [isTargetCountOpen, setIsTargetCountOpen] = useState(false);
  const [elementRelation, setElementRelation] = useState('无克/普通');
  const [shenmuValue, setShenmuValue] = useState(0);
  const [magicResult, setMagicResult] = useState(0);
  const [transformCardFactor, setTransformCardFactor] = useState(1);

  const activeSkill = useMemo(
    () => skills.find((skill) => skill.name === activeSkillId) || skills[0],
    [skills, activeSkillId]
  );

  const selectedDungeon = useMemo(
    () => targetDungeons.find((dungeon) => dungeon.id === selectedDungeonId),
    [selectedDungeonId, targetDungeons]
  );

  useEffect(() => {
    let cancelled = false;

    const loadTemplates = async () => {
      try {
        const response = await fetch('/api/simulator/target-templates', {
          method: 'GET',
          cache: 'no-store',
        });
        const payload = await response.json();
        if (
          !response.ok ||
          payload?.code !== 0 ||
          !Array.isArray(payload?.data)
        ) {
          return;
        }

        if (!cancelled) {
          const dungeons = buildDungeonDatabaseFromTemplates(payload.data);
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
        // Keep local fallback data when remote templates are unavailable.
      }
    };

    void loadTemplates();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeSkillId) {
      return;
    }

    if (skills[0]?.name) {
      setActiveSkillId(skills[0].name);
    }
  }, [skills, activeSkillId]);

  const loadDamageData = async () => {
    setIsCalculating(true);
    setCalculationError('');

    let targetDisplay = '';
    if (combatTab === 'manual') {
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
        magicDefense: toNumber(target.magicDefense),
      }));

      const dungeonTargetInputs =
        selectedDungeon?.targets.map((target: any) => ({
          name: decodeName(target.name),
          magicDefense: toNumber(target.magicDefense),
          isBoss: target.isBoss,
        })) ?? [];

      const [manualResults, dungeonResults] = await Promise.all([
        requestDamageCalculation({
          skillName: activeSkill.name,
          targetCount,
          elementRelation,
          shenmuValue,
          magicResult,
          transformCardFactor,
          targets: manualTargetInputs,
        }),
        requestDamageCalculation({
          skillName: activeSkill.name,
          targetCount,
          elementRelation,
          shenmuValue,
          magicResult,
          transformCardFactor,
          targets: dungeonTargetInputs,
        }),
      ]);

      setRuleVersionInfo(
        manualResults.ruleVersion || dungeonResults.ruleVersion || null
      );

      const nextDisplayData: any[] = [
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

      setDamageDisplayData(nextDisplayData);
    } catch (error) {
      console.error('failed to calculate skill damage panel:', error);
      setCalculationError(
        error instanceof Error ? error.message : '伤害试算失败'
      );
      setDamageDisplayData([]);
    } finally {
      setIsCalculating(false);
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
    transformCardFactor,
    combatTab,
    combatTarget.name,
    combatTarget.dungeonName,
  ]);

  const handleRecalculate = () => {
    void loadDamageData();
  };

  const handleSkillClick = (
    skillData: any,
    targetData?: any,
    groupName?: string
  ) => {
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
      setModalSkillDetails(skillData);
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
                        type="text"
                        placeholder="搜索技能..."
                        value={skillSearchQuery}
                        onChange={(e) => setSkillSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-yellow-700/30 bg-slate-950/50 px-2 py-1 text-xs text-yellow-100 placeholder-yellow-700/50 focus:border-yellow-500/50 focus:outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto p-1.5">
                      {skills
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
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((count) => (
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
                  {group.targets.map((target: any, idx: number) => (
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
                          面板法伤: {modalSkillDetails.details.magicDamage}
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
                    <span>目标法防: {modalSkillDetails.details.targetDef}</span>
                    <span>
                      阵法系数: {modalSkillDetails.details.formationRatio}
                    </span>
                    <span>修炼差: {modalSkillDetails.details.cultDiff}</span>
                    <span>
                      五行系数: {modalSkillDetails.details.elementFactor}
                    </span>
                    <span>神木符: {modalSkillDetails.details.shenmuValue}</span>
                    <span>
                      法伤结果: {modalSkillDetails.details.magicResult}
                    </span>
                  </div>
                </div>
                <div className="font-mono text-sm leading-relaxed tracking-wide text-green-400">
                  = ({modalSkillDetails.details.baseItem} +{' '}
                  {modalSkillDetails.details.magicDamage} -{' '}
                  {modalSkillDetails.details.targetDef}) *{' '}
                  {modalSkillDetails.details.formationRatio} *{' '}
                  {modalSkillDetails.details.elementFactor} *{' '}
                  {modalSkillDetails.details.splitRatio} * (1 +{' '}
                  {modalSkillDetails.details.cultDiff} * 0.02) +{' '}
                  {modalSkillDetails.details.cultDiff} * 5 +{' '}
                  {modalSkillDetails.details.shenmuValue} +{' '}
                  {modalSkillDetails.details.magicResult}
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
                  </div>
                </div>
              </div>

              {modalSkillDetails.details.matchedBonusRules?.length > 0 && (
                <div className="rounded-xl border border-yellow-800/30 bg-slate-900/50 p-4 shadow-inner">
                  <div className="mb-2 text-sm font-bold text-yellow-400">
                    命中的技能加成规则
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {modalSkillDetails.details.matchedBonusRules.map(
                      (rule: any) => (
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
