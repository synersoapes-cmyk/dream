const DEFAULT_LOCALE = 'en';

function pad(value: number) {
  return value.toString().padStart(2, '0');
}

export function normalizeDateLocale(locale?: string | null) {
  if (!locale) {
    return DEFAULT_LOCALE;
  }

  if (locale === 'zh') {
    return 'zh-CN';
  }

  return locale;
}

export function toDate(value: string | number | Date | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function formatDateValue(
  value: string | number | Date | null | undefined,
  pattern = 'YYYY-MM-DD',
  locale?: string | null
) {
  const date = toDate(value);
  if (!date) {
    return '';
  }

  const normalizedLocale = normalizeDateLocale(locale);

  switch (pattern) {
    case 'YYYY-MM-DD':
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    case 'YYYY/MM/DD':
      return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
    case 'MMM D, YYYY':
      return new Intl.DateTimeFormat(normalizedLocale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(date);
    default:
      return new Intl.DateTimeFormat(normalizedLocale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
  }
}

export function formatRelativeTime(
  value: string | number | Date | null | undefined,
  locale?: string | null
) {
  const date = toDate(value);
  if (!date) {
    return '';
  }

  const normalizedLocale = normalizeDateLocale(locale);
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(normalizedLocale, {
    numeric: 'auto',
  });

  const divisions: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['week', 60 * 60 * 24 * 7],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
    ['second', 1],
  ];

  for (const [unit, secondsInUnit] of divisions) {
    if (Math.abs(diffSeconds) >= secondsInUnit || unit === 'second') {
      return formatter.format(
        Math.round(diffSeconds / secondsInUnit),
        unit
      );
    }
  }

  return '';
}
