import { useLocale } from 'next-intl';

import { formatDateValue, formatRelativeTime } from '@/shared/lib/date';

export function Time({
  value,
  placeholder,
  metadata,
  className,
}: {
  value: string | Date;
  placeholder?: string;
  metadata?: Record<string, any>;
  className?: string;
}) {
  if (!value) {
    if (placeholder) {
      return <div className={className}>{placeholder}</div>;
    }

    return null;
  }

  const locale = useLocale();

  return (
    <div className={className}>
      {metadata?.format
        ? formatDateValue(value, metadata?.format, locale)
        : formatRelativeTime(value, locale)}
    </div>
  );
}
