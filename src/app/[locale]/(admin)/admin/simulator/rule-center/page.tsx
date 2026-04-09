import { setRequestLocale } from 'next-intl/server';

import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { RuleCenterPanel } from '@/shared/blocks/simulator/rule-center';
import {
  getDamageRuleVersionDetail,
  listDamageRuleVersions,
} from '@/shared/models/damage-rules';

import {
  getSimulatorAdminCrumbs,
  getSimulatorAdminSection,
  getSimulatorAdminTabs,
  requireSimulatorAdminAccess,
} from '../_lib';

export default async function SimulatorRuleCenterAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { writableUser } = await requireSimulatorAdminAccess(locale);
  const section = getSimulatorAdminSection('rule-center');
  const ruleVersions = await listDamageRuleVersions();
  const activeVersion =
    ruleVersions.find((item) => item.isActive) ?? ruleVersions[0] ?? null;
  const initialRuleDetail = activeVersion
    ? await getDamageRuleVersionDetail({ versionId: activeVersion.id })
    : null;

  return (
    <>
      <Header crumbs={getSimulatorAdminCrumbs('rule-center')} />
      <Main>
        <MainHeader
          title={section.title}
          description={section.description}
          tabs={getSimulatorAdminTabs('rule-center')}
        />
        <RuleCenterPanel
          canEdit={Boolean(writableUser)}
          initialVersions={ruleVersions}
          initialDetail={initialRuleDetail}
        />
      </Main>
    </>
  );
}
