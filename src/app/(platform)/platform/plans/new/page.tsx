import { getPlatformT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { PlanForm } from "../form";
import { savePlanAction } from "../../actions";

export default async function NewPlan() {
  const { t } = await getPlatformT();
  return (
    <>
      <PageHeader back={<BackLink href="/platform/plans" label={t("platform.plans")} />} title={t("platform.addPlan")} />
      <PlanForm action={savePlanAction.bind(null, null)} t={t} />
    </>
  );
}
