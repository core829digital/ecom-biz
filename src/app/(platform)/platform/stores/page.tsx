import Link from "next/link";
import { db } from "@/lib/db";
import { getPlatformT } from "@/lib/i18n/server";
import { Badge, Card, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { Pagination, SearchBox, parsePage } from "@/components/admin/list";

const PER_PAGE = 50;

export default async function PlatformStores({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { t, locale } = await getPlatformT();
  const page = parsePage(sp.page);
  const q = sp.q?.trim();
  const where = q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { slug: { contains: q.toLowerCase() } }, { email: { contains: q, mode: "insensitive" as const } }] } : {};
  const [total, stores] = await Promise.all([
    db.store.count({ where }),
    db.store.findMany({ where, include: { memberships: { where: { role: "OWNER" }, take: 1, include: { user: { select: { email: true, subscriptionStatus: true, plan: { select: { name: true } } } } } }, _count: { select: { orders: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const date = new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { dateStyle: "medium" });
  return (
    <>
      <PageHeader title={t("platform.stores")} subtitle={String(total)} />
      <Card className="[&>div]:p-0">
        <SearchBox basePath="/platform/stores" params={sp} placeholder={t("common.search")} />
        <Table>
          <thead><tr><Th>{t("field.storeName")}</Th><Th>{t("platform.plan")}</Th><Th>{t("common.status")}</Th><Th>{t("nav.orders")}</Th><Th>{t("platform.created")}</Th></tr></thead>
          <tbody>
            {stores.map((s) => (
              <tr key={s.id} className="hover:bg-surface-2/50">
                <Td><Link href={`/platform/stores/${s.id}`} className="font-medium hover:underline">{s.name}</Link><span className="block text-xs text-muted">{s.slug}</span></Td>
                <Td>{s.memberships[0]?.user.plan?.name ?? "—"} {s.memberships[0] && <span className="text-xs text-muted">· {t(`platform.sub.${s.memberships[0].user.subscriptionStatus}`)}</span>}<span className="block text-xs text-muted">{s.memberships[0]?.user.email}</span></Td>
                <Td><Badge tone={s.status === "ACTIVE" ? "success" : "danger"}>{t(`platform.storeStatus.${s.status}`)}</Badge></Td>
                <Td className="tabular-nums">{s._count.orders}</Td>
                <Td className="text-muted">{date.format(s.createdAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Pagination basePath="/platform/stores" params={sp} page={page} pages={pages} labels={{ previous: t("common.previous"), next: t("common.next"), summary: t("common.page", { page, pages }) }} />
      </Card>
    </>
  );
}
