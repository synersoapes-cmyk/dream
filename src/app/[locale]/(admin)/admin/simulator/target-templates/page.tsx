import { setRequestLocale } from 'next-intl/server';

import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { SimulatorTargetTemplatePanel } from '@/shared/blocks/simulator/target-template-panel';
import { listAdminBattleTargetTemplates } from '@/shared/models/simulator-admin';

import {
  getSimulatorAdminCrumbs,
  getSimulatorAdminSection,
  getSimulatorAdminTabs,
  requireSimulatorAdminAccess,
} from '../_lib';

export default async function SimulatorTargetTemplatesAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { writableUser } = await requireSimulatorAdminAccess(locale);
  const section = getSimulatorAdminSection('target-templates');
  const targetTemplates = await listAdminBattleTargetTemplates({
    limit: 100,
  });

  return (
    <>
      <Header crumbs={getSimulatorAdminCrumbs('target-templates')} />
      <Main>
        <MainHeader
          title={section.title}
          description={section.description}
          tabs={getSimulatorAdminTabs('target-templates')}
        />
        <SimulatorTargetTemplatePanel
          canEdit={Boolean(writableUser)}
          initialItems={targetTemplates}
        />
      </Main>
    </>
  );
}
