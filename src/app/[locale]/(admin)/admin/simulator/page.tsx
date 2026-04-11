import { setRequestLocale } from 'next-intl/server';

import { Link } from '@/core/i18n/navigation';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';

import {
  getSimulatorAdminCrumbs,
  getSimulatorAdminSection,
  getSimulatorAdminSectionUrl,
  requireSimulatorAdminAccess,
  SIMULATOR_ADMIN_WORKFLOWS,
} from './_lib';

export default async function SimulatorAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireSimulatorAdminAccess(locale);
  const section = getSimulatorAdminSection('overview');

  return (
    <>
      <Header crumbs={getSimulatorAdminCrumbs('overview')} />
      <Main>
        <MainHeader title={section.title} description={section.description} />
        <div className="grid gap-4 lg:grid-cols-2">
          {SIMULATOR_ADMIN_WORKFLOWS.map((workflow) => (
            <Card key={workflow.id} className="gap-4 rounded-lg">
              <CardHeader>
                <div className="text-muted-foreground text-xs font-medium">
                  {workflow.label}
                </div>
                <CardTitle>{workflow.title}</CardTitle>
                <CardDescription>{workflow.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <Button asChild className="w-fit">
                  <Link
                    href={getSimulatorAdminSectionUrl(workflow.primarySlug)}
                  >
                    {workflow.primaryText}
                  </Link>
                </Button>
                <div className="grid gap-2 sm:grid-cols-2">
                  {workflow.steps.map((step, idx) => (
                    <Link
                      key={`${workflow.id}-${step.slug}`}
                      href={getSimulatorAdminSectionUrl(step.slug)}
                      className="hover:bg-muted flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors"
                    >
                      <span className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-medium">
                        {idx + 1}
                      </span>
                      <span className="font-medium">{step.title}</span>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Main>
    </>
  );
}
