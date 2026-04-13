import { setRequestLocale } from 'next-intl/server';

import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { SimulatorOcrMetricsAdminPanel } from '@/shared/blocks/simulator/ocr-metrics-admin-panel';
import { getAdminSimulatorOcrMetrics } from '@/shared/models/simulator-admin';

import {
  getSimulatorAdminCrumbs,
  getSimulatorAdminSection,
  getSimulatorAdminTabs,
  requireSimulatorAdminAccess,
} from '../_lib';

export default async function SimulatorOcrMetricsAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireSimulatorAdminAccess(locale);
  const section = getSimulatorAdminSection('ocr-metrics');
  const metrics = await getAdminSimulatorOcrMetrics();

  return (
    <>
      <Header crumbs={getSimulatorAdminCrumbs('ocr-metrics')} />
      <Main>
        <MainHeader
          title={section.title}
          description={section.description}
          tabs={getSimulatorAdminTabs('ocr-metrics')}
        />
        <SimulatorOcrMetricsAdminPanel initialMetrics={metrics} />
      </Main>
    </>
  );
}
