// @ts-nocheck
interface CultivationBarProps {
  label: string;
  value: number;
  max?: number;
}

export function CultivationBar({ label, value, max = 20 }: CultivationBarProps) {
  const percentage = (value / max) * 100;
  
  return (
    <div className="py-2 px-3 bg-slate-900/40 border border-yellow-800/30 rounded-lg">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-yellow-100/90 font-medium">{label}</span>
        <span className="text-sm text-yellow-400">{value}/{max}</span>
      </div>
      <div className="w-full bg-slate-900/80 rounded-full h-2 overflow-hidden border border-yellow-800/30">
        <div 
          className="h-full bg-gradient-to-r from-yellow-600 to-yellow-500 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
