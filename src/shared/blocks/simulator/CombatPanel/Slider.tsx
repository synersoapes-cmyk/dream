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

  return (
    <input
      id={resolvedId}
      name={resolvedName}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value[0] ?? min}
      onChange={(event) => onValueChange?.([Number(event.target.value)])}
      className={cn('h-2 w-full cursor-pointer accent-yellow-500', className)}
      {...props}
    />
  );
}
