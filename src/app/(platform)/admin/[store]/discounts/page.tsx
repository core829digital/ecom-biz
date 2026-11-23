import Link from "next/link";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/money";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { discountStatus } from "@/server/discounts";

export default async function DiscountsPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store } = await requireStoreAccess(slug);
  const { t, locale } = await getPlatformT();
  const base = `/admin/${slug}/discounts`;
  const discounts = await db.discount.findMany({ where: { storeId: store.id }, orderBy: { createdAt: "desc" } });
  const tone = { active: "success", scheduled: "info", expired: "neutral", disabled: "neutral" } as const;
  return (
    <>
      <PageHeader title={t("nav.discounts")} actions={<LinkButton href={`${base}/new`} size="sm">{t("discounts.add")}</LinkButton>} />
      <Card className="[&>div]:p-0">
        {discounts.length === 0 ? (
          <EmptyState title={t("discounts.empty.title")} description={t("discounts.empty.description")} action={<LinkButton href={`${base}/new`}>{t("discounts.add")}</LinkButton>} />
        ) : (
          <Table>
            <thead><tr><Th>{t("discounts.code")}</Th><Th>{t("discounts.value")}</Th><Th>{t("common.status")}</Th><Th>{t("discounts.used")}</Th></tr></thead>
            <tbody>
              {discounts.map((d) => {
                const s = discountStatus(d);
                return (
                  <tr key={d.id} className="hover:bg-surface-2/50">
                    <Td><Link href={`${base}/${d.id}`} className="font-mono font-semibold hover:underline">{d.code}</Link></Td>
                    <Td>
                      {d.type === "PERCENTAGE" ? `${d.value / 100}%` : d.type === "FIXED_AMOUNT" ? formatMoney(d.value, store.currency, locale) : t("checkout.freeShipping")}
                      {d.minSubtotalCents > 0 && <span className="text-muted"> · {t("discounts.minShort", { amount: formatMoney(d.minSubtotalCents, store.currency, locale) })}</span>}
                    </Td>
                    <Td><Badge tone={tone[s]}>{t(`discounts.status.${s}`)}</Badge></Td>
                    <Td className="tabular-nums">{d.usageCount}{d.usageLimit !== null && ` / ${d.usageLimit}`}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
