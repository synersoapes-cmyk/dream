import { setRequestLocale } from 'next-intl/server';

import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { SimulatorOcrJobAdminPanel } from '@/shared/blocks/simulator/ocr-job-admin-panel';
import { listAdminSimulatorOcrJobs } from '@/shared/models/simulator-admin';

import {
  getSimulatorAdminCrumbs,
  getSimulatorAdminSection,
  getSimulatorAdminTabs,
  requireSimulatorAdminAccess,
} from '../_lib';

export default async function SimulatorOcrJobsAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireSimulatorAdminAccess(locale);
  const section = getSimulatorAdminSection('ocr-jobs');
  const items = await listAdminSimulatorOcrJobs({
    status: 'all',
    limit: 100,
  });

  return (
    <>
      <Header crumbs={getSimulatorAdminCrumbs('ocr-jobs')} />
      <Main>
        <MainHeader
          title={section.title}
          description={section.description}
          tabs={getSimulatorAdminTabs('ocr-jobs')}
        />
        <SimulatorOcrJobAdminPanel initialItems={items} />
      </Main>
    </>
  );
}
