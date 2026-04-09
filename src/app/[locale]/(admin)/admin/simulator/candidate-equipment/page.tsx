import { setRequestLocale } from 'next-intl/server';

import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { SimulatorPendingReviewPanel } from '@/shared/blocks/simulator/pending-review-panel';
import { listAdminSimulatorCandidateEquipment } from '@/shared/models/simulator-admin';

import {
  getSimulatorAdminCrumbs,
  getSimulatorAdminSection,
  getSimulatorAdminTabs,
  requireSimulatorAdminAccess,
} from '../_lib';

export default async function SimulatorCandidateEquipmentAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { writableUser } = await requireSimulatorAdminAccess(locale);
  const section = getSimulatorAdminSection('candidate-equipment');
  const items = await listAdminSimulatorCandidateEquipment({
    status: 'all',
    limit: 500,
  });

  return (
    <>
      <Header crumbs={getSimulatorAdminCrumbs('candidate-equipment')} />
      <Main>
        <MainHeader
          title={section.title}
          description={section.description}
          tabs={getSimulatorAdminTabs('candidate-equipment')}
        />
        <SimulatorPendingReviewPanel
          canEdit={Boolean(writableUser)}
          initialItems={items}
          title="候选装备库管理"
          description="这里汇总所有 pending / confirmed / replaced 候选装备，便于按用户排查脏数据、重复数据和 OCR 识别误差。"
          initialStatus="all"
          availableStatuses={['all', 'pending', 'confirmed', 'replaced']}
          listEndpoint="/api/admin/simulator/candidate-equipment"
          detailEndpointBase="/api/admin/simulator/candidate-equipment"
          saveButtonLabel="保存候选装备"
          saveNotice="当前修改会直接写回候选装备库记录。"
          emptyMessage="当前候选装备库还没有数据。"
          loadLimit={500}
          remoteSearch
        />
      </Main>
    </>
  );
}
