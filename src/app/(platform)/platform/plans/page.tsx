import Link from "next/link";
import { db } from "@/lib/db";
import { getPlatformT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/money";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";

export default async function PlansPage() {
  const { t, locale } = await getPlatformT();
  const plans = await db.plan.findMany({ orderBy: { position: "asc" }, include: { _count: { select: { users: true } } } });
  return (
    <>
      <PageHeader title={t("platform.plans")} subtitle={t("platform.plansHint")} actions={<LinkButton href="/platform/plans/new" size="sm">{t("platform.addPlan")}</LinkButton>} />
      <Card className="[&>div]:p-0">
        {plans.length === 0 ? <EmptyState title={t("platform.noPlans")} action={<LinkButton href="/platform/plans/new">{t("platform.addPlan")}</LinkButton>} /> : (
          <Table>
            <thead><tr><Th>{t("common.name")}</Th><Th>{t("products.field.price")}</Th><Th>{t("platform.transactionFee")}</Th><Th>{t("platform.maxStores")}</Th><Th>{t("platform.accounts")}</Th><Th>{t("common.status")}</Th></tr></thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <Td><Link href={`/platform/plans/${p.id}`} className="font-medium hover:underline">{p.name}</Link></Td>
                  <Td className="tabular-nums">{formatMoney(p.priceCents, p.currency, locale)} / {t(`platform.interval.${p.interval as "month"}`)}</Td>
                  <Td className="tabular-nums">{(p.transactionFeeBps / 100).toFixed(2)}%</Td>
                  <Td className="tabular-nums">{p.maxStores}</Td><Td>{p._count.users}</Td>
                  <Td><Badge tone={p.active ? "success" : "neutral"}>{p.active ? t("discounts.status.active") : t("discounts.status.disabled")}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
