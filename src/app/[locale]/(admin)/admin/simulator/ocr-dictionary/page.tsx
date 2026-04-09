import { setRequestLocale } from 'next-intl/server';

import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { SimulatorOcrDictionaryPanel } from '@/shared/blocks/simulator/ocr-dictionary-panel';
import { listAdminSimulatorOcrDictionary } from '@/shared/models/simulator';

import {
  getSimulatorAdminCrumbs,
  getSimulatorAdminSection,
  getSimulatorAdminTabs,
  requireSimulatorAdminAccess,
} from '../_lib';

export default async function SimulatorOcrDictionaryAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { writableUser } = await requireSimulatorAdminAccess(locale);
  const section = getSimulatorAdminSection('ocr-dictionary');
  const items = await listAdminSimulatorOcrDictionary({
    dictType: 'all',
    limit: 200,
  });

  return (
    <>
      <Header crumbs={getSimulatorAdminCrumbs('ocr-dictionary')} />
      <Main>
        <MainHeader
          title={section.title}
          description={section.description}
          tabs={getSimulatorAdminTabs('ocr-dictionary')}
        />
        <SimulatorOcrDictionaryPanel
          canEdit={Boolean(writableUser)}
          initialItems={items}
        />
      </Main>
    </>
  );
}
