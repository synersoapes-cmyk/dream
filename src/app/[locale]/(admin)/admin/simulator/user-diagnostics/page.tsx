import { setRequestLocale } from 'next-intl/server';

import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { SimulatorUserDiagnosticsPanel } from '@/shared/blocks/simulator/user-diagnostics-panel';
import { listAdminSimulatorUserDiagnostics } from '@/shared/models/simulator';

import {
  getSimulatorAdminCrumbs,
  getSimulatorAdminSection,
  getSimulatorAdminTabs,
  requireSimulatorAdminAccess,
} from '../_lib';

export default async function SimulatorUserDiagnosticsAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireSimulatorAdminAccess(locale);
  const section = getSimulatorAdminSection('user-diagnostics');
  const userDiagnostics = await listAdminSimulatorUserDiagnostics({
    limit: 20,
  });

  return (
    <>
      <Header crumbs={getSimulatorAdminCrumbs('user-diagnostics')} />
      <Main>
        <MainHeader
          title={section.title}
          description={section.description}
          tabs={getSimulatorAdminTabs('user-diagnostics')}
        />
        <SimulatorUserDiagnosticsPanel initialItems={userDiagnostics} />
      </Main>
    </>
  );
}
