import { setRequestLocale } from 'next-intl/server';

import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { RulePlaygroundPanel } from '@/shared/blocks/simulator/rule-playground';
import { listDamageRuleVersions } from '@/shared/models/damage-rules';
import { listRuleSimulationCases } from '@/shared/models/rule-simulation-cases';

import {
  getSimulatorAdminCrumbs,
  getSimulatorAdminSection,
  getSimulatorAdminTabs,
  requireSimulatorAdminAccess,
} from '../_lib';

export default async function SimulatorRulePlaygroundAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { writableUser } = await requireSimulatorAdminAccess(locale);
  const section = getSimulatorAdminSection('rule-playground');
  const ruleVersions = await listDamageRuleVersions();
  const simulationCases = await listRuleSimulationCases();

  return (
    <>
      <Header crumbs={getSimulatorAdminCrumbs('rule-playground')} />
      <Main>
        <MainHeader
          title={section.title}
          description={section.description}
          tabs={getSimulatorAdminTabs('rule-playground')}
        />
        <RulePlaygroundPanel
          canEdit={Boolean(writableUser)}
          initialVersions={ruleVersions}
          initialCases={simulationCases}
        />
      </Main>
    </>
  );
}
