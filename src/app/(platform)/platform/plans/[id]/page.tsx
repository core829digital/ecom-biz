import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getPlatformT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { PlanForm } from "../form";
import { savePlanAction } from "../../actions";

export default async function EditPlan({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getPlatformT();
  const plan = await db.plan.findUnique({ where: { id } });
  if (!plan) notFound();
  return (
    <>
      <PageHeader back={<BackLink href="/platform/plans" label={t("platform.plans")} />} title={plan.name} />
      <PlanForm action={savePlanAction.bind(null, plan.id)} plan={plan} t={t} />
    </>
  );
}
