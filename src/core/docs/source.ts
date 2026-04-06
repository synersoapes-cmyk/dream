import { docs, logs, pages, posts } from '@/.source';
import type { I18nConfig } from 'fumadocs-core/i18n';
import { loader } from 'fumadocs-core/source';

import { renderNamedIcon } from '@/shared/lib/icon-registry';

export const i18n: I18nConfig = {
  defaultLanguage: 'en',
  languages: ['en', 'zh'],
};

const iconHelper = (icon: string | undefined) => {
  if (!icon) {
    return;
  }
  return renderNamedIcon(icon);
};

// Docs source
export const docsSource = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  i18n,
  icon: iconHelper,
});

// Pages source (using root path)
export const pagesSource = loader({
  baseUrl: '/',
  source: pages.toFumadocsSource(),
  i18n,
  icon: iconHelper,
});

// Posts source
export const postsSource = loader({
  baseUrl: '/blog',
  source: posts.toFumadocsSource(),
  i18n,
  icon: iconHelper,
});

// Logs source
export const logsSource = loader({
  baseUrl: '/logs',
  source: logs.toFumadocsSource(),
  i18n,
  icon: iconHelper,
});

// Keep backward compatibility
export const source = docsSource;
