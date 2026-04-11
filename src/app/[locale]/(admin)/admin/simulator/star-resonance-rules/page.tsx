import { setRequestLocale } from 'next-intl/server';

import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { SimulatorStarResonanceRulePanel } from '@/shared/blocks/simulator/star-resonance-rule-panel';
import { listAdminSimulatorStarResonanceRules } from '@/shared/models/simulator-admin';

import {
  getSimulatorAdminCrumbs,
  getSimulatorAdminSection,
  getSimulatorAdminTabs,
  requireSimulatorAdminAccess,
} from '../_lib';

export default async function SimulatorStarResonanceRulesAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { writableUser } = await requireSimulatorAdminAccess(locale);
  const section = getSimulatorAdminSection('star-resonance-rules');
  const items = await listAdminSimulatorStarResonanceRules({
    limit: 100,
  });

  return (
    <>
      <Header crumbs={getSimulatorAdminCrumbs('star-resonance-rules')} />
      <Main>
        <MainHeader
          title={section.title}
          description={section.description}
          tabs={getSimulatorAdminTabs('star-resonance-rules')}
        />
        <SimulatorStarResonanceRulePanel
          canEdit={Boolean(writableUser)}
          initialItems={items}
        />
      </Main>
    </>
  );
}
