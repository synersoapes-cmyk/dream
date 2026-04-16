import type { Equipment } from '@/features/simulator/store/gameTypes';

import { EquipmentImage } from '@/shared/blocks/simulator/EquipmentPanel/EquipmentImage';
import {
  getEquipmentPrimaryPreviewLine,
  getEquipmentSecondaryPreviewLine,
} from '@/shared/lib/simulator-equipment-preview';
import { getEquipmentSpotlightTags } from '@/shared/lib/simulator-equipment-spotlight';

interface LibraryEquipmentCardProps {
  equipment: Equipment;
  onClick: () => void;
  formatPrice: (price: number | undefined) => string;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  selectable?: boolean;
  sourceLabels?: string[];
  helperText?: string;
  recommendationLabel?: string;
  recommendationDescription?: string;
  statusLabels?: Array<{
    label: string;
    tone?: 'emerald' | 'amber' | 'violet';
  }>;
  recommendedAction?: 'primary' | 'secondary' | 'tertiary' | null;
  actionLabel?: string;
  actionDisabled?: boolean;
  onActionClick?: () => void;
  secondaryActionLabel?: string;
  secondaryActionDisabled?: boolean;
  onSecondaryActionClick?: () => void;
  tertiaryActionLabel?: string;
  tertiaryActionDisabled?: boolean;
  onTertiaryActionClick?: () => void;
  dangerActionLabel?: string;
  dangerActionDisabled?: boolean;
  onDangerActionClick?: () => void;
}

export function LibraryEquipmentCard({
  equipment,
  onClick,
  formatPrice,
  isSelected = false,
  isSelectionMode = false,
  selectable = true,
  sourceLabels = [],
  helperText,
  recommendationLabel,
  recommendationDescription,
  statusLabels = [],
  recommendedAction = null,
  actionLabel,
  actionDisabled = false,
  onActionClick,
  secondaryActionLabel,
  secondaryActionDisabled = false,
  onSecondaryActionClick,
  tertiaryActionLabel,
  tertiaryActionDisabled = false,
  onTertiaryActionClick,
  dangerActionLabel,
  dangerActionDisabled = false,
  onDangerActionClick,
}: LibraryEquipmentCardProps) {
  const totalPrice = (equipment.price || 0) + (equipment.crossServerFee || 0);
  const spotlightTags = getEquipmentSpotlightTags(equipment);
  const primaryPreviewLine = getEquipmentPrimaryPreviewLine(equipment);
  const secondaryPreviewLine = getEquipmentSecondaryPreviewLine(equipment);

  return (
    <div
      onClick={onClick}
      className={`group relative flex cursor-pointer flex-col gap-1.5 overflow-hidden rounded-xl border bg-slate-900/60 p-3 shadow-sm transition-colors ${
        isSelected
          ? 'border-yellow-600 bg-yellow-900/20'
          : 'border-yellow-800/40 hover:border-yellow-600/60'
      }`}
    >
      {/* 选中状态指示器 */}
      {isSelectionMode && selectable && (
        <div
          className={`absolute top-2 left-2 z-10 flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${
            isSelected
              ? 'border-yellow-600 bg-yellow-600'
              : 'border-slate-600 bg-slate-800/50'
          }`}
        >
          {isSelected && (
            <svg
              className="h-3 w-3 text-slate-900"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>
      )}

      <div className={`${isSelectionMode && selectable ? 'ml-7' : ''} mb-2`}>
        <EquipmentImage equipment={equipment} size="lg" />
      </div>

      <div className="absolute top-0 right-0 rounded-bl-lg border-b border-l border-yellow-700/50 bg-yellow-900/60 px-2 py-0.5">
        <div className="mb-0.5 text-[10px] leading-none font-medium text-yellow-500/80">
          总价
        </div>
        <div className="text-xs font-bold text-[#fff064]">
          ¥ {formatPrice(totalPrice)}
        </div>
      </div>

      <div
        className={`text-sm font-bold text-yellow-100 ${isSelectionMode && selectable ? 'pl-7' : ''} truncate pr-16`}
      >
        {equipment.name}
      </div>
      {statusLabels.length > 0 && (
        <div
          className={`mt-1 flex flex-wrap gap-1 ${isSelectionMode && selectable ? 'pl-7' : ''}`}
        >
          {statusLabels.map((statusLabel, index) => {
            const toneClassName =
              statusLabel.tone === 'amber'
                ? 'border-amber-500/40 bg-amber-950/30 text-amber-100'
                : statusLabel.tone === 'violet'
                  ? 'border-violet-500/40 bg-violet-950/30 text-violet-100'
                  : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-100';

            return (
              <span
                key={`${equipment.id}-${statusLabel.label}-${index}`}
                className={`rounded border px-1.5 py-0.5 text-[10px] ${toneClassName}`}
              >
                {statusLabel.label}
              </span>
            );
          })}
        </div>
      )}
      {sourceLabels.length > 0 && (
        <div
          className={`mt-1 flex flex-wrap gap-1 ${isSelectionMode && selectable ? 'pl-7' : ''}`}
        >
          {sourceLabels.slice(0, 2).map((sourceLabel) => (
            <span
              key={`${equipment.id}-${sourceLabel}`}
              className="rounded border border-sky-700/40 bg-sky-950/30 px-1.5 py-0.5 text-[10px] text-sky-200"
            >
              {sourceLabel}
            </span>
          ))}
          {sourceLabels.length > 2 && (
            <span className="rounded border border-slate-700/60 bg-slate-900/70 px-1.5 py-0.5 text-[10px] text-slate-300">
              +{sourceLabels.length - 2}
            </span>
          )}
        </div>
      )}
      {helperText ? (
        <div
          className={`mt-1 truncate text-[11px] text-slate-400 ${isSelectionMode && selectable ? 'pl-7' : ''}`}
        >
          {helperText}
        </div>
      ) : null}
      {recommendationLabel ? (
        <div
          className={`mt-1 flex items-center gap-1.5 ${isSelectionMode && selectable ? 'pl-7' : ''}`}
          title={recommendationDescription}
        >
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-100">
            {recommendationLabel}
          </span>
          {recommendationDescription ? (
            <span className="truncate text-[10px] text-emerald-200/75">
              {recommendationDescription}
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        className={`mt-1 truncate text-xs text-slate-300 ${isSelectionMode && selectable ? 'pl-7' : ''}`}
      >
        {primaryPreviewLine}
      </div>
      {secondaryPreviewLine && (
        <div
          className={`truncate text-xs text-red-400 ${isSelectionMode && selectable ? 'pl-7' : ''}`}
        >
          {secondaryPreviewLine}
        </div>
      )}
      {spotlightTags.length > 0 && (
        <div
          className={`mt-auto flex flex-wrap gap-1 ${isSelectionMode && selectable ? 'pl-7' : ''}`}
        >
          {spotlightTags.slice(0, 3).map((hl, idx) => (
            <span
              key={`${equipment.id}-${hl}-${idx}`}
              className="rounded border border-red-500/50 px-1 text-[10px] text-red-400"
            >
              {hl}
            </span>
          ))}
        </div>
      )}
      {(actionLabel && onActionClick) ||
      (secondaryActionLabel && onSecondaryActionClick) ||
      (tertiaryActionLabel && onTertiaryActionClick) ||
      (dangerActionLabel && onDangerActionClick) ? (
        <div
          className={`mt-2 flex flex-wrap gap-2 ${isSelectionMode && selectable ? 'ml-7' : ''}`}
        >
          {actionLabel && onActionClick ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (!actionDisabled) {
                  onActionClick();
                }
              }}
              disabled={actionDisabled}
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                actionDisabled
                  ? 'cursor-not-allowed border-slate-700/60 bg-slate-900/60 text-slate-500'
                  : recommendedAction === 'primary'
                    ? 'border-emerald-300/70 bg-emerald-500/20 text-emerald-50 shadow-[0_0_0_1px_rgba(110,231,183,0.28)] hover:bg-emerald-500/25'
                    : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/40'
              }`}
            >
              {actionLabel}
            </button>
          ) : null}
          {secondaryActionLabel && onSecondaryActionClick ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (!secondaryActionDisabled) {
                  onSecondaryActionClick();
                }
              }}
              disabled={secondaryActionDisabled}
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                secondaryActionDisabled
                  ? 'cursor-not-allowed border-slate-700/60 bg-slate-900/60 text-slate-500'
                  : recommendedAction === 'secondary'
                    ? 'border-sky-300/70 bg-sky-500/20 text-sky-50 shadow-[0_0_0_1px_rgba(125,211,252,0.28)] hover:bg-sky-500/25'
                    : 'border-sky-500/40 bg-sky-950/30 text-sky-100 hover:bg-sky-900/40'
              }`}
            >
              {secondaryActionLabel}
            </button>
          ) : null}
          {tertiaryActionLabel && onTertiaryActionClick ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (!tertiaryActionDisabled) {
                  onTertiaryActionClick();
                }
              }}
              disabled={tertiaryActionDisabled}
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                tertiaryActionDisabled
                  ? 'cursor-not-allowed border-slate-700/60 bg-slate-900/60 text-slate-500'
                  : recommendedAction === 'tertiary'
                    ? 'border-amber-300/70 bg-amber-500/20 text-amber-50 shadow-[0_0_0_1px_rgba(252,211,77,0.28)] hover:bg-amber-500/25'
                    : 'border-amber-500/40 bg-amber-950/30 text-amber-100 hover:bg-amber-900/40'
              }`}
            >
              {tertiaryActionLabel}
            </button>
          ) : null}
          {dangerActionLabel && onDangerActionClick ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (!dangerActionDisabled) {
                  onDangerActionClick();
                }
              }}
              disabled={dangerActionDisabled}
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                dangerActionDisabled
                  ? 'cursor-not-allowed border-slate-700/60 bg-slate-900/60 text-slate-500'
                  : 'border-red-500/40 bg-red-950/30 text-red-200 hover:bg-red-900/40'
              }`}
            >
              {dangerActionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
