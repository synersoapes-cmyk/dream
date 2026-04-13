import { setRequestLocale } from 'next-intl/server';

import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { EquipmentExtensionAdminPanel } from '@/shared/blocks/simulator/equipment-extension-admin-panel';
import {
  getDamageRuleVersionDetail,
  listDamageRuleVersions,
} from '@/shared/models/damage-rules';
import { listAdminSimulatorStarResonanceRules } from '@/shared/models/simulator-admin';

import {
  getSimulatorAdminCrumbs,
  getSimulatorAdminSection,
  getSimulatorAdminTabs,
  requireSimulatorAdminAccess,
} from '../_lib';

export default async function SimulatorEquipmentExtensionsAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { writableUser } = await requireSimulatorAdminAccess(locale);
  const section = getSimulatorAdminSection('equipment-extensions');
  const versions = await listDamageRuleVersions();
  const selectedVersionId =
    versions.find((item) => item.isActive)?.id ?? versions[0]?.id;
  const detail = selectedVersionId
    ? await getDamageRuleVersionDetail({ versionId: selectedVersionId })
    : null;
  const starResonanceRuleCount = (
    await listAdminSimulatorStarResonanceRules({ limit: 1000 })
  ).length;

  return (
    <>
      <Header crumbs={getSimulatorAdminCrumbs('equipment-extensions')} />
      <Main>
        <MainHeader
          title={section.title}
          description={section.description}
          tabs={getSimulatorAdminTabs('equipment-extensions')}
        />
        <EquipmentExtensionAdminPanel
          canEdit={Boolean(writableUser)}
          initialVersions={versions}
          initialDetail={detail}
          starResonanceRuleCount={starResonanceRuleCount}
        />
      </Main>
    </>
  );
}
