'use client';

import type {
  CombatTarget,
  Dungeon,
  EnemyTarget,
  Skill,
} from '@/features/simulator/store/gameTypes';
import { Target, X } from 'lucide-react';

type Props = {
  combatTarget: CombatTarget;
  manualTargets: EnemyTarget[];
  skills: Skill[];
  selectedSkillName: string;
  selectedTargetCount: number;
  targetDungeons: Dungeon[];
  onClose: () => void;
  onSelectedSkillNameChange: (value: string) => void;
  onSelectedTargetCountChange: (value: number) => void;
  onCombatTargetChange: (target: Partial<CombatTarget>) => void;
};

export function LaboratoryTargetSelectorModal({
  combatTarget,
  manualTargets,
  skills,
  selectedSkillName,
  selectedTargetCount,
  targetDungeons,
  onClose,
  onSelectedSkillNameChange,
  onSelectedTargetCountChange,
  onCombatTargetChange,
}: Props) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[80%] w-full max-w-md flex-col rounded-xl border border-yellow-800/60 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-yellow-800/30 p-4">
          <h3 className="flex items-center gap-2 font-bold text-yellow-100">
            <Target className="h-4 w-4 text-yellow-500" /> 选择战队目标
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 border-b border-yellow-800/30 bg-slate-800/30 p-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-yellow-600">技能选择</label>
            <select
              id="target-skill-select"
              name="target-skill-select"
              value={selectedSkillName}
              onChange={(event) => onSelectedSkillNameChange(event.target.value)}
              className="w-full rounded-lg border border-yellow-800/40 bg-slate-800 px-3 py-2 text-sm text-yellow-100 focus:border-yellow-600 focus:outline-none"
            >
              {skills.map((skill) => (
                <option key={skill.name} value={skill.name}>
                  {skill.name} (Lv.{skill.level})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-yellow-600">秒几</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  onClick={() => onSelectedTargetCountChange(num)}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                    selectedTargetCount === num
                      ? 'border border-yellow-500 bg-yellow-600 text-slate-900'
                      : 'border border-yellow-800/40 bg-slate-800 text-yellow-100 hover:border-yellow-600/60'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
          {manualTargets.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-bold text-yellow-600">手动目标</div>
              <div className="space-y-2">
                {manualTargets.map((target) => (
                  <div
                    key={target.id}
                    onClick={() => {
                      onCombatTargetChange({
                        templateId: undefined,
                        name: target.name,
                        defense: target.defense,
                        magicDefense: target.magicDefense,
                        speed: target.speed,
                        hp: target.hp,
                        level: 175,
                        dungeonName: undefined,
                      });
                      onClose();
                    }}
                    className={`cursor-pointer rounded-lg border bg-slate-800/80 p-3 transition-colors hover:bg-slate-700/80 ${
                      combatTarget.name === target.name && !combatTarget.dungeonName
                        ? 'border-yellow-600 bg-yellow-900/10'
                        : 'border-slate-700'
                    }`}
                  >
                    <div className="text-sm font-bold text-yellow-100">
                      {target.name}
                    </div>
                    <div className="mt-1.5 flex gap-4 text-xs text-slate-400">
                      <span>物防: {target.defense}</span>
                      <span>法防: {target.magicDefense}</span>
                      <span>气血: {target.hp}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 text-xs font-bold text-yellow-600">副本</div>
            <div className="space-y-2">
              {targetDungeons.map((dungeon) => (
                <div key={dungeon.id} className="space-y-1">
                  <div className="rounded bg-slate-800/40 px-2 py-1 text-xs font-medium text-slate-400">
                    {dungeon.name} - {dungeon.description}
                  </div>
                  {dungeon.targets.map((target) => (
                    <div
                      key={target.id}
                      onClick={() => {
                        onCombatTargetChange({
                          templateId: target.templateId || target.id,
                          name: target.name,
                          defense: target.defense,
                          magicDefense: target.magicDefense,
                          speed: target.speed || 0,
                          hp: target.hp,
                          level: target.level,
                          element: target.element,
                          formation: target.formation,
                          dungeonName: dungeon.name,
                        });
                        onClose();
                      }}
                      className={`ml-2 cursor-pointer rounded-lg border bg-slate-800/80 p-3 transition-colors hover:bg-slate-700/80 ${
                        combatTarget.name === target.name &&
                        combatTarget.dungeonName === dungeon.name
                          ? 'border-yellow-600 bg-yellow-900/10'
                          : 'border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between text-sm font-bold text-yellow-100">
                        <span>{target.name}</span>
                        <span className="text-xs text-slate-500">
                          Lv.{target.level}
                        </span>
                      </div>
                      <div className="mt-1.5 flex gap-4 text-xs text-slate-400">
                        <span>物防: {target.defense}</span>
                        <span>法防: {target.magicDefense}</span>
                        <span>气血: {target.hp}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
