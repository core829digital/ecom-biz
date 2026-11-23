import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { Pagination, parsePage } from "@/components/admin/list";

const PER_PAGE = 50;

export default async function AuditPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { store: slug } = await params;
  const sp = await searchParams;
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t, locale } = await getPlatformT();
  const page = parsePage(sp.page);
  const [total, logs] = await Promise.all([
    db.auditLog.count({ where: { storeId: store.id } }),
    db.auditLog.findMany({ where: { storeId: store.id }, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const date = new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { dateStyle: "medium", timeStyle: "medium", timeZone: store.timezone });
  return (
    <>
      <PageHeader back={<BackLink href={`/admin/${slug}/settings`} label={t("nav.settings")} />} title={t("nav.audit")} subtitle={t("audit.subtitle")} />
      <Card className="[&>div]:p-0">
        {logs.length === 0 ? <EmptyState title={t("audit.empty")} /> : (
          <Table>
            <thead><tr><Th>{t("common.date")}</Th><Th>{t("audit.who")}</Th><Th>{t("audit.action")}</Th><Th>{t("audit.target")}</Th><Th>IP</Th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <Td className="whitespace-nowrap text-muted">{date.format(l.createdAt)}</Td>
                  <Td>{l.user ? <><span className="font-medium">{l.user.name}</span><span className="block text-xs text-muted">{l.user.email}</span></> : <span className="text-muted">{t("audit.system")}</span>}</Td>
                  <Td><code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">{l.action}</code></Td>
                  <Td className="max-w-64 truncate">{l.target}</Td>
                  <Td className="font-mono text-xs text-muted">{l.ip}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination basePath={`/admin/${slug}/settings/audit`} params={sp} page={page} pages={pages} labels={{ previous: t("common.previous"), next: t("common.next"), summary: t("common.page", { page, pages }) }} />
      </Card>
    </>
  );
}
