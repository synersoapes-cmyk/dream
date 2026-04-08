'use client';

import * as React from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { cn } from '@/shared/lib/utils';

type SimpleSelectProps = {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  triggerId?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  value?: string;
  onValueChange?: (value: string) => void;
};

type SelectOptionElement = React.ReactElement<{
  value?: string;
  children?: React.ReactNode;
}>;

function getOptionLabel(option: SelectOptionElement): string {
  if (typeof option.props.children === 'string') {
    return option.props.children;
  }

  return String(option.props.value ?? '');
}

export function SimpleSelect({
  className,
  children,
  disabled,
  placeholder,
  triggerId,
  ariaLabel,
  ariaLabelledBy,
  value,
  onValueChange,
}: SimpleSelectProps) {
  const options = React.Children.toArray(children).filter(React.isValidElement);

  return (
    <Select
      disabled={disabled}
      value={value}
      onValueChange={onValueChange}
    >
      <SelectTrigger
        id={triggerId}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={cn(
          'h-10 w-full border-yellow-700/60 bg-slate-950/80 text-yellow-100 shadow-none focus-visible:border-yellow-500 focus-visible:ring-yellow-500/20',
          className,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="min-w-[var(--radix-select-trigger-width)] border-yellow-700/60 bg-slate-900 text-yellow-100">
        {(options as SelectOptionElement[]).map((option) => {
          const itemValue = String(option.props.value ?? '');

          return (
            <SelectItem
              key={itemValue}
              value={itemValue}
              className="text-yellow-100 focus:bg-blue-600 focus:text-white"
            >
              {getOptionLabel(option)}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
