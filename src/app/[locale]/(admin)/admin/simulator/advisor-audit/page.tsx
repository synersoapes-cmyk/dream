import { setRequestLocale } from 'next-intl/server';

import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { SimulatorAdvisorAuditAdminPanel } from '@/shared/blocks/simulator/advisor-audit-admin-panel';
import { listAdminSimulatorAdvisorAudits } from '@/shared/models/simulator-admin';

import {
  getSimulatorAdminCrumbs,
  getSimulatorAdminSection,
  getSimulatorAdminTabs,
  requireSimulatorAdminAccess,
} from '../_lib';

export default async function SimulatorAdvisorAuditAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireSimulatorAdminAccess(locale);
  const section = getSimulatorAdminSection('advisor-audit');
  const items = await listAdminSimulatorAdvisorAudits({
    status: 'all',
    limit: 100,
  });

  return (
    <>
      <Header crumbs={getSimulatorAdminCrumbs('advisor-audit')} />
      <Main>
        <MainHeader
          title={section.title}
          description={section.description}
          tabs={getSimulatorAdminTabs('advisor-audit')}
        />
        <SimulatorAdvisorAuditAdminPanel initialItems={items} />
      </Main>
    </>
  );
}
