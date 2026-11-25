import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStoreAccess, hasRole } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/ui/primitives";
import { FilterTabs, Pagination, SearchBox, parsePage } from "@/components/admin/list";
import { MAX_UPLOAD_MB } from "@/lib/storage";
import { fileReferences, storageUsage } from "@/server/media";
import { FileLibrary } from "./library";

const PER_PAGE = 60;

export default async function FilesPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { store: slug } = await params;
  const sp = await searchParams;
  const { store, role } = await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  const base = `/admin/${slug}/files`;
  const page = parsePage(sp.page);
  const q = sp.q?.trim();
  const where: Prisma.StoredFileWhereInput = {
    storeId: store.id,
    ...(sp.view === "images" ? { contentType: { startsWith: "image/" } } : sp.view === "documents" ? { contentType: "application/pdf" } : {}),
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
  };
  const [total, rows, usage] = await Promise.all([
    db.storedFile.count({ where }),
    db.storedFile.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    storageUsage(store.id),
  ]);
  const refs = await fileReferences(store, rows.map((r) => r.url));
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const usedMb = usage.usedBytes / 1048576;
  const pct = usage.limitMb ? Math.min(100, (usedMb / usage.limitMb) * 100) : 0;
  return (
    <>
      <PageHeader title={t("nav.files")} subtitle={t("media.subtitle", { max: MAX_UPLOAD_MB })} />
      <div className="mb-5 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">{t("media.space")}</span>
          <span className="tabular-nums text-muted">{usage.limitMb === null ? t("media.usedUnlimited", { used: usedMb.toFixed(1), files: usage.files }) : t("media.used", { used: usedMb.toFixed(1), limit: usage.limitMb, files: usage.files })}</span>
        </div>
        {usage.limitMb !== null && (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3">
            <div className={`h-full rounded-full transition-[width] duration-700 ${pct > 90 ? "bg-danger" : pct > 75 ? "bg-warning" : "bg-accent"}`} style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <div className="mb-4 overflow-hidden rounded-xl border border-border bg-surface">
        <FilterTabs basePath={base} params={sp} name="view" options={[
          { value: null, label: t("common.all") },
          { value: "images", label: t("media.images") },
          { value: "documents", label: t("media.documents") },
        ]} />
        <SearchBox basePath={base} params={sp} placeholder={t("media.search")} />
      </div>
      <FileLibrary slug={slug} canDelete={hasRole(role, "ADMIN")} accept="image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf"
        files={rows.map((f) => ({ id: f.id, url: f.url, name: f.name, contentType: f.contentType, size: f.size, createdAt: f.createdAt.toISOString(), places: refs.get(f.url) ?? [] }))} />
      <Pagination basePath={base} params={sp} page={page} pages={pages} labels={{ previous: t("common.previous"), next: t("common.next"), summary: t("common.page", { page, pages }) }} />
    </>
  );
}
