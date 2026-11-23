import { db } from "@/lib/db";
import { getPlatformT } from "@/lib/i18n/server";
import { requirePlatformAdmin } from "@/lib/auth/staff";
import { Badge, Card, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { ConfirmSubmit } from "@/components/ui/form";
import { Pagination, SearchBox, parsePage } from "@/components/admin/list";
import { togglePlatformAdminAction } from "../actions";

const PER_PAGE = 50;

export default async function PlatformUsers({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requirePlatformAdmin();
  const sp = await searchParams;
  const { t, locale } = await getPlatformT();
  const page = parsePage(sp.page);
  const q = sp.q?.trim();
  const where = q ? { OR: [{ email: { contains: q, mode: "insensitive" as const } }, { name: { contains: q, mode: "insensitive" as const } }] } : {};
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({ where, include: { memberships: { include: { store: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const date = new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { dateStyle: "medium" });
  return (
    <>
      <PageHeader title={t("platform.users")} subtitle={String(total)} />
      <Card className="[&>div]:p-0">
        <SearchBox basePath="/platform/users" params={sp} placeholder={t("common.search")} />
        <Table>
          <thead><tr><Th>{t("common.name")}</Th><Th>{t("platform.stores")}</Th><Th>{t("platform.created")}</Th><Th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <Td><span className="font-medium">{u.name}</span> {u.isPlatformAdmin && <Badge tone="info">{t("platform.admin")}</Badge>}<span className="block text-xs text-muted">{u.email}</span></Td>
                <Td className="text-muted">{u.memberships.map((m) => m.store.name).join(", ") || "—"}</Td>
                <Td className="text-muted">{date.format(u.createdAt)}</Td>
                <Td className="text-right">
                  {u.id !== me.id && (
                    <form action={togglePlatformAdminAction.bind(null, u.id)}>
                      <ConfirmSubmit variant="ghost" confirmMessage={t("platform.adminConfirm")}>{u.isPlatformAdmin ? t("platform.revokeAdmin") : t("platform.makeAdmin")}</ConfirmSubmit>
                    </form>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Pagination basePath="/platform/users" params={sp} page={page} pages={pages} labels={{ previous: t("common.previous"), next: t("common.next"), summary: t("common.page", { page, pages }) }} />
      </Card>
    </>
  );
}
