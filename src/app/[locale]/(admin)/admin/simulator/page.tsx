import { setRequestLocale } from 'next-intl/server';

import {
  getCurrentUserWithPermission,
  PERMISSIONS,
  requirePermission,
} from '@/core/rbac';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { SimulatorDefaultsEditor } from '@/shared/blocks/simulator/defaults-editor';
import { RulePlaygroundPanel } from '@/shared/blocks/simulator/rule-playground';
import { RuleCenterPanel } from '@/shared/blocks/simulator/rule-center';
import {
  getDamageRuleVersionDetail,
  listDamageRuleVersions,
} from '@/shared/models/damage-rules';
import { listRuleSimulationCases } from '@/shared/models/rule-simulation-cases';
import { getSimulatorSeedConfig, serializeSimulatorSeedConfig } from '@/shared/models/simulator-seed';
import { Crumb } from '@/shared/types/blocks/common';

export default async function SimulatorAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requirePermission({
    code: PERMISSIONS.SETTINGS_READ,
    redirectUrl: '/admin/no-permission',
    locale,
  });
  const writableUser = await getCurrentUserWithPermission({
    code: PERMISSIONS.SETTINGS_WRITE,
    locale,
  });

  const seedConfig = await getSimulatorSeedConfig();
  const serializedConfig = serializeSimulatorSeedConfig(seedConfig);
  const ruleVersions = await listDamageRuleVersions();
  const simulationCases = await listRuleSimulationCases();
  const activeVersion =
    ruleVersions.find((item) => item.isActive) ?? ruleVersions[0] ?? null;
  const initialRuleDetail = activeVersion
    ? await getDamageRuleVersionDetail({ versionId: activeVersion.id })
    : null;

  const crumbs: Crumb[] = [
    { title: 'Admin', url: '/admin' },
    { title: 'Simulator', is_active: true },
  ];

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader
          title="Simulator"
          description="Manage the default simulator profile template stored in Cloudflare D1 config."
        />
        <SimulatorDefaultsEditor
          canEdit={Boolean(writableUser)}
          initialConfig={{
            characterMeta: serializedConfig['simulator.default.character_meta'],
            profile: serializedConfig['simulator.default.profile'],
            skills: serializedConfig['simulator.default.skills'],
            cultivations: serializedConfig['simulator.default.cultivations'],
            equipments: serializedConfig['simulator.default.equipments'],
          }}
        />
        <RuleCenterPanel
          canEdit={Boolean(writableUser)}
          initialVersions={ruleVersions}
          initialDetail={initialRuleDetail}
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
