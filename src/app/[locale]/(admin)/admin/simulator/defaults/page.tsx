import { setRequestLocale } from 'next-intl/server';

import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { SimulatorDefaultsEditor } from '@/shared/blocks/simulator/defaults-editor';
import {
  getSimulatorSeedConfig,
  serializeSimulatorSeedConfig,
} from '@/shared/models/simulator-template';

import {
  getSimulatorAdminCrumbs,
  getSimulatorAdminSection,
  getSimulatorAdminTabs,
  requireSimulatorAdminAccess,
} from '../_lib';

export default async function SimulatorDefaultsAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { writableUser } = await requireSimulatorAdminAccess(locale);
  const section = getSimulatorAdminSection('defaults');
  const seedConfig = await getSimulatorSeedConfig();
  const serializedConfig = serializeSimulatorSeedConfig(seedConfig);

  return (
    <>
      <Header crumbs={getSimulatorAdminCrumbs('defaults')} />
      <Main>
        <MainHeader
          title={section.title}
          description={section.description}
          tabs={getSimulatorAdminTabs('defaults')}
        />
        <SimulatorDefaultsEditor
          canEdit={Boolean(writableUser)}
          initialConfig={{
            characterMeta: serializedConfig['simulator.default.character_meta'],
            profile: serializedConfig['simulator.default.profile'],
            skills: serializedConfig['simulator.default.skills'],
            cultivations: serializedConfig['simulator.default.cultivations'],
            equipments: serializedConfig['simulator.default.equipments'],
            battleContext: serializedConfig['simulator.default.battle_context'],
          }}
        />
      </Main>
    </>
  );
}
