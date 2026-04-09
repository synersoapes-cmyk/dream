import { setRequestLocale } from 'next-intl/server';

import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { SimulatorLabSessionAdminPanel } from '@/shared/blocks/simulator/lab-session-admin-panel';
import { listAdminSimulatorLabSessions } from '@/shared/models/simulator-admin';

import {
  getSimulatorAdminCrumbs,
  getSimulatorAdminSection,
  getSimulatorAdminTabs,
  requireSimulatorAdminAccess,
} from '../_lib';

export default async function SimulatorLabSessionsAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireSimulatorAdminAccess(locale);
  const section = getSimulatorAdminSection('lab-sessions');
  const labSessions = await listAdminSimulatorLabSessions({
    limit: 30,
  });

  return (
    <>
      <Header crumbs={getSimulatorAdminCrumbs('lab-sessions')} />
      <Main>
        <MainHeader
          title={section.title}
          description={section.description}
          tabs={getSimulatorAdminTabs('lab-sessions')}
        />
        <SimulatorLabSessionAdminPanel initialItems={labSessions} />
      </Main>
    </>
  );
}
