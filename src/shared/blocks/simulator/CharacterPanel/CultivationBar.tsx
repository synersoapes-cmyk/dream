interface CultivationBarProps {
  label: string;
  value: number;
  max?: number;
}

export function CultivationBar({
  label,
  value,
  max = 20,
}: CultivationBarProps) {
  const percentage = (value / max) * 100;

  return (
    <div className="rounded-lg border border-yellow-800/30 bg-slate-900/40 px-3 py-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-yellow-100/90">{label}</span>
        <span className="text-sm text-yellow-400">
          {value}/{max}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full border border-yellow-800/30 bg-slate-900/80">
        <div
          className="h-full bg-gradient-to-r from-yellow-600 to-yellow-500 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
