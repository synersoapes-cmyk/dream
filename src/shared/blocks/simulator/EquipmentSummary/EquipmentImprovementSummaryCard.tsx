'use client';

import type {
  EquipmentImprovementDiffSummary,
  EquipmentImprovementEffectDiffItem,
  EquipmentImprovementSummary,
  EquipmentImprovementSummaryItem,
} from '@/shared/lib/simulator-equipment-improvement-summary';

type Props = {
  summary: EquipmentImprovementSummary;
  diffSummary?: EquipmentImprovementDiffSummary | null;
  diffTitle?: string;
};

function renderToneClass(tone: 'up' | 'down' | 'neutral') {
  if (tone === 'up') {
    return 'border-emerald-700/40 bg-emerald-950/20 text-emerald-100';
  }

  if (tone === 'down') {
    return 'border-rose-700/40 bg-rose-950/20 text-rose-100';
  }

  return 'border-slate-700/60 bg-slate-950/40 text-slate-100';
}

function renderEffectToneClass(
  tone: EquipmentImprovementEffectDiffItem['tone']
) {
  if (tone === 'added') {
    return 'border-emerald-700/40 bg-emerald-950/20 text-emerald-100';
  }

  if (tone === 'removed') {
    return 'border-rose-700/40 bg-rose-950/20 text-rose-100';
  }

  return 'border-amber-700/40 bg-amber-950/20 text-amber-100';
}

function SummaryChip({
  item,
}: {
  item: EquipmentImprovementSummaryItem;
}) {
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 px-3 py-2">
      <div className="text-[11px] text-slate-400">{item.label}</div>
      <div className="mt-1 text-sm font-semibold text-yellow-100">
        {item.value}
      </div>
      {item.note ? (
        <div className="mt-1 text-[11px] leading-relaxed text-slate-400">
          {item.note}
        </div>
      ) : null}
    </div>
  );
}

export function EquipmentImprovementSummaryCard({
  summary,
  diffSummary = null,
  diffTitle = '相对样本差异',
}: Props) {
  return (
    <div className="rounded-xl border border-violet-800/40 bg-slate-900 p-4">
      <div className="mb-3 text-sm font-bold text-violet-100">综合提升</div>

      <div className="space-y-4">
        <div>
          <div className="mb-2 text-xs font-medium text-violet-300">
            核心法系收益
          </div>
          {summary.numericSummary.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2">
              {summary.numericSummary.map((item) => (
                <SummaryChip key={item.key} item={item} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
              当前没有可识别的结构化数值收益。
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 text-xs font-medium text-violet-300">
            灵力等价说明
          </div>
          {summary.spiritEquivalentSummary.length > 0 ? (
            <div className="space-y-2">
              {summary.spiritEquivalentSummary.map((item) => (
                <SummaryChip key={item.key} item={item} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
              当前没有需要额外解释的法系等价收益。
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 text-xs font-medium text-violet-300">
            特技 / 特效 / 套装亮点
          </div>
          {summary.effectSummary.length > 0 ? (
            <div className="space-y-2">
              {summary.effectSummary.map((item) => (
                <div
                  key={item.key}
                  className="rounded-lg border border-slate-700/60 bg-slate-950/40 px-3 py-2"
                >
                  <div className="text-[11px] text-slate-400">{item.label}</div>
                  <div className="mt-1 text-sm font-semibold text-violet-100">
                    {item.value}
                  </div>
                  {item.note ? (
                    <div className="mt-1 text-[11px] leading-relaxed text-slate-400">
                      {item.note}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
              当前没有额外特技、特效或套装亮点。
            </div>
          )}
        </div>

        {diffSummary ? (
          <div className="border-t border-violet-900/30 pt-4">
            <div className="mb-2 text-xs font-medium text-violet-300">
              {diffTitle}
            </div>

            {diffSummary.numericSummary.length === 0 &&
            diffSummary.spiritEquivalentSummary.length === 0 &&
            diffSummary.effectSummary.length === 0 ? (
              <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
                当前与样本席位同部位装备相比，没有额外综合提升差异。
              </div>
            ) : (
              <div className="space-y-2">
                {diffSummary.numericSummary.map((item) => (
                  <div
                    key={item.key}
                    className={`rounded-lg border px-3 py-2 ${renderToneClass(item.tone)}`}
                  >
                    <div className="text-[11px] opacity-80">{item.label}</div>
                    <div className="mt-1 text-sm font-semibold">{item.value}</div>
                    {item.note ? (
                      <div className="mt-1 text-[11px] leading-relaxed opacity-80">
                        {item.note}
                      </div>
                    ) : null}
                  </div>
                ))}

                {diffSummary.spiritEquivalentSummary.map((item) => (
                  <div
                    key={item.key}
                    className={`rounded-lg border px-3 py-2 ${renderToneClass(item.tone)}`}
                  >
                    <div className="text-[11px] opacity-80">{item.label}</div>
                    <div className="mt-1 text-sm font-semibold">{item.value}</div>
                    {item.note ? (
                      <div className="mt-1 text-[11px] leading-relaxed opacity-80">
                        {item.note}
                      </div>
                    ) : null}
                  </div>
                ))}

                {diffSummary.effectSummary.map((item) => (
                  <div
                    key={item.key}
                    className={`rounded-lg border px-3 py-2 ${renderEffectToneClass(item.tone)}`}
                  >
                    <div className="text-[11px] opacity-80">{item.label}</div>
                    <div className="mt-1 text-sm font-semibold">{item.value}</div>
                    {item.note ? (
                      <div className="mt-1 text-[11px] leading-relaxed opacity-80">
                        {item.note}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
