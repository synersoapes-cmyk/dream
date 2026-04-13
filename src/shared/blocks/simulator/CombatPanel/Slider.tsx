import { useId, type InputHTMLAttributes } from 'react';

import { cn } from '@/shared/lib/utils';

type SliderProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
> & {
  value?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
};

export function Slider({
  value = [0],
  onValueChange,
  className,
  min = 0,
  max = 100,
  step = 1,
  id,
  name,
  ...props
}: SliderProps) {
  const generatedId = useId().replace(/:/g, '');
  const resolvedId = id ?? `simulator-slider-${generatedId}`;
  const resolvedName = name ?? resolvedId;
  const currentValue = value[0] ?? min;
  const progress =
    max <= min ? 0 : ((currentValue - min) / (max - min)) * 100;

  return (
    <input
      id={resolvedId}
      name={resolvedName}
      type="range"
      min={min}
      max={max}
      step={step}
      value={currentValue}
      onInput={(event) =>
        onValueChange?.([Number((event.target as HTMLInputElement).value)])
      }
      onChange={(event) => onValueChange?.([Number(event.target.value)])}
      style={{
        background: `linear-gradient(90deg, rgba(250, 204, 21, 0.98) 0%, rgba(251, 191, 36, 0.94) ${progress}%, rgba(51, 65, 85, 0.82) ${progress}%, rgba(15, 23, 42, 0.92) 100%)`,
      }}
      className={cn(
        'h-2 w-full cursor-pointer appearance-none rounded-full border border-yellow-700/25 shadow-[inset_0_1px_2px_rgba(15,23,42,0.55)] transition-[background,box-shadow] duration-75 ease-linear accent-yellow-500',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/45 focus-visible:ring-offset-0',
        '[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-slate-950 [&::-moz-range-thumb]:bg-yellow-400 [&::-moz-range-thumb]:shadow-[0_0_0_3px_rgba(234,179,8,0.16)]',
        '[&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full',
        '[&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-slate-950 [&::-webkit-slider-thumb]:bg-yellow-400 [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_rgba(234,179,8,0.16)]',
        'active:[&::-moz-range-thumb]:cursor-grabbing active:[&::-webkit-slider-thumb]:cursor-grabbing active:shadow-[0_0_0_1px_rgba(250,204,21,0.28),inset_0_1px_2px_rgba(15,23,42,0.55)]',
        className
      )}
      {...props}
    />
  );
}
