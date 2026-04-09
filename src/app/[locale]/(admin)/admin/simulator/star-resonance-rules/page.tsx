import { setRequestLocale } from 'next-intl/server';

import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { SimulatorStarResonanceRulePanel } from '@/shared/blocks/simulator/star-resonance-rule-panel';
import { listAdminSimulatorStarResonanceRules } from '@/shared/models/simulator-admin';

import { requireSimulatorAdminAccess } from '../_lib';

export default async function SimulatorStarResonanceRulesAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { writableUser } = await requireSimulatorAdminAccess(locale);
  const items = await listAdminSimulatorStarResonanceRules({
    limit: 100,
  });

  return (
    <>
      <Header />
      <Main>
        <MainHeader
          title="星相互合规则"
          description="维护部位、组合名、颜色清单、单件奖励和六件全局奖励。"
        />
        <SimulatorStarResonanceRulePanel
          canEdit={Boolean(writableUser)}
          initialItems={items}
        />
      </Main>
    </>
  );
}
