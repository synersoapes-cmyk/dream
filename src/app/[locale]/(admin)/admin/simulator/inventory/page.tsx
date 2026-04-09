import { setRequestLocale } from 'next-intl/server';

import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { SimulatorInventoryAdminPanel } from '@/shared/blocks/simulator/inventory-admin-panel';
import { listAdminSimulatorInventoryEntries } from '@/shared/models/simulator-admin';

import {
  getSimulatorAdminCrumbs,
  getSimulatorAdminSection,
  getSimulatorAdminTabs,
  requireSimulatorAdminAccess,
} from '../_lib';

export default async function SimulatorInventoryAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { writableUser } = await requireSimulatorAdminAccess(locale);
  const section = getSimulatorAdminSection('inventory');
  const items = await listAdminSimulatorInventoryEntries({
    status: 'all',
    limit: 200,
  });

  return (
    <>
      <Header crumbs={getSimulatorAdminCrumbs('inventory')} />
      <Main>
        <MainHeader
          title={section.title}
          description={section.description}
          tabs={getSimulatorAdminTabs('inventory')}
        />
        <SimulatorInventoryAdminPanel
          initialItems={items}
          canEdit={Boolean(writableUser)}
        />
      </Main>
    </>
  );
}
