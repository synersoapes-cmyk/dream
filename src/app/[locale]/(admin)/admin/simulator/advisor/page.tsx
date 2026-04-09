import { setRequestLocale } from 'next-intl/server';

import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { SimulatorAdvisorConfigPanel } from '@/shared/blocks/simulator/advisor-config-panel';
import { getSimulatorAdvisorAdminConfig } from '@/shared/services/simulator-advisor';

import {
  getSimulatorAdminCrumbs,
  getSimulatorAdminSection,
  getSimulatorAdminTabs,
  requireSimulatorAdminAccess,
} from '../_lib';

export default async function SimulatorAdvisorAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { writableUser } = await requireSimulatorAdminAccess(locale);
  const section = getSimulatorAdminSection('advisor');
  const advisorConfig = await getSimulatorAdvisorAdminConfig();

  return (
    <>
      <Header crumbs={getSimulatorAdminCrumbs('advisor')} />
      <Main>
        <MainHeader
          title={section.title}
          description={section.description}
          tabs={getSimulatorAdminTabs('advisor')}
        />
        <SimulatorAdvisorConfigPanel
          canEdit={Boolean(writableUser)}
          initialConfig={advisorConfig}
        />
      </Main>
    </>
  );
}
