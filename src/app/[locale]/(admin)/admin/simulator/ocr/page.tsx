import { setRequestLocale } from 'next-intl/server';

import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { SimulatorOcrConfigPanel } from '@/shared/blocks/simulator/ocr-config-panel';
import { getSimulatorOcrAdminConfig } from '@/shared/services/simulator-ocr';

import {
  getSimulatorAdminCrumbs,
  getSimulatorAdminSection,
  getSimulatorAdminTabs,
  requireSimulatorAdminAccess,
} from '../_lib';

export default async function SimulatorOcrAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { writableUser } = await requireSimulatorAdminAccess(locale);
  const section = getSimulatorAdminSection('ocr');
  const ocrConfig = await getSimulatorOcrAdminConfig();

  return (
    <>
      <Header crumbs={getSimulatorAdminCrumbs('ocr')} />
      <Main>
        <MainHeader
          title={section.title}
          description={section.description}
          tabs={getSimulatorAdminTabs('ocr')}
        />
        <SimulatorOcrConfigPanel
          canEdit={Boolean(writableUser)}
          initialConfig={ocrConfig}
        />
      </Main>
    </>
  );
}
