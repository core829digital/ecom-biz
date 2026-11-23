import Link from "next/link";
import type { Prisma, ReviewStatus } from "@prisma/client";
import { BadgeCheck, MessageSquareReply } from "lucide-react";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { Badge, Card, EmptyState, PageHeader, Stat } from "@/components/ui/primitives";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/ui/form";
import { Checkbox, Textarea } from "@/components/ui/fields";
import { FilterTabs, Pagination, SearchBox, parsePage } from "@/components/admin/list";
import { Stars } from "@/components/storefront/stars";
import { bulkReviewAction, deleteReviewAction, replyReviewAction, saveReviewSettingsAction, setReviewStatusAction } from "./actions";

const PER_PAGE = 25;
const VIEWS: Record<string, ReviewStatus> = { pending: "PENDING", approved: "APPROVED", rejected: "REJECTED" };
const TONE = { PENDING: "warning", APPROVED: "success", REJECTED: "neutral" } as const;

export default async function ReviewsPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { store: slug } = await params;
  const sp = await searchParams;
  const { store, role } = await requireStoreAccess(slug);
  const { t, locale } = await getPlatformT();
  const base = `/admin/${slug}/reviews`;
  const page = parsePage(sp.page);
  const q = sp.q?.trim();
  const status = sp.view ? VIEWS[sp.view] : undefined;

  const where: Prisma.ProductReviewWhereInput = {
    storeId: store.id,
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { body: { contains: q, mode: "insensitive" } }, { product: { title: { contains: q, mode: "insensitive" } } }] } : {}),
  };
  const [total, reviews, counts, approvedAgg] = await Promise.all([
    db.productReview.count({ where }),
    db.productReview.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { product: { select: { id: true, title: true } } } }),
    db.productReview.groupBy({ by: ["status"], where: { storeId: store.id }, _count: true }),
    db.productReview.aggregate({ where: { storeId: store.id, status: "APPROVED" }, _avg: { rating: true }, _count: true }),
  ]);
  const countOf = (s: ReviewStatus) => counts.find((c) => c.status === s)?._count ?? 0;
  const all = counts.reduce((n, c) => n + c._count, 0);
  const pending = countOf("PENDING");
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const date = new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { dateStyle: "medium", timeZone: store.timezone });
  const avg = approvedAgg._avg.rating ?? 0;
  const withCount = (label: string, n: number) => (n ? `${label} · ${n}` : label);

  return (
    <>
      <PageHeader
        title={t("nav.reviews")}
        subtitle={t("reviews.subtitle")}
        actions={pending > 0 ? (
          <div className="flex gap-2">
            <form action={bulkReviewAction.bind(null, slug, "REJECTED")}><ConfirmSubmit variant="ghost" confirmMessage={t("reviews.rejectAllConfirm", { count: pending })}>{t("reviews.rejectAll")}</ConfirmSubmit></form>
            <form action={bulkReviewAction.bind(null, slug, "APPROVED")}><ConfirmSubmit variant="primary" confirmMessage={t("reviews.approveAllConfirm", { count: pending })}>{t("reviews.approveAll")}</ConfirmSubmit></form>
          </div>
        ) : null}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label={t("reviews.average")} value={<span className="flex items-center gap-2">{approvedAgg._count ? avg.toFixed(1) : "—"}<Stars value={avg} size={14} /></span>} hint={t("reviews.publishedCount", { count: approvedAgg._count })} />
        <Stat label={t("reviews.pendingCount")} value={pending} hint={pending ? t("reviews.pendingHint") : t("reviews.allCaughtUp")} />
        <Stat label={t("reviews.total")} value={all} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_18rem]">
        <section className="min-w-0 rounded-xl border border-border bg-surface shadow-sm">
          <FilterTabs
            basePath={base}
            params={sp}
            name="view"
            options={[
              { value: null, label: withCount(t("common.all"), all) },
              { value: "pending", label: withCount(t("reviews.status.PENDING"), pending) },
              { value: "approved", label: withCount(t("reviews.status.APPROVED"), countOf("APPROVED")) },
              { value: "rejected", label: withCount(t("reviews.status.REJECTED"), countOf("REJECTED")) },
            ]}
          />
          <SearchBox basePath={base} params={sp} placeholder={t("reviews.search")} />
          {reviews.length === 0 ? (
            q ? <p className="px-4 py-10 text-center text-sm text-muted">{t("products.noResults")}</p> : <EmptyState title={t("reviews.empty.title")} description={t("reviews.empty.description")} />
          ) : (
            <ul className="divide-y divide-border">
              {reviews.map((r) => (
                <li key={r.id} className="px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars value={r.rating} size={14} label={t("reviews.ratingLabel", { rating: r.rating })} />
                    <Badge tone={TONE[r.status]}>{t(`reviews.status.${r.status}`)}</Badge>
                    {r.verifiedPurchase && <span className="inline-flex items-center gap-1 text-xs text-success"><BadgeCheck className="size-3.5" aria-hidden />{t("sf.reviews.verified")}</span>}
                    <span className="ml-auto text-xs text-muted">{date.format(r.createdAt)}</span>
                  </div>
                  {r.title && <p className="mt-2 font-medium">{r.title}</p>}
                  <p className="mt-1 whitespace-pre-line text-sm text-text/90">{r.body}</p>
                  <p className="mt-2 text-xs text-muted">
                    {r.name} · <a href={`mailto:${r.email}`} className="hover:underline">{r.email}</a> · <Link href={`/admin/${slug}/products/${r.product.id}`} className="hover:underline">{r.product.title}</Link>
                  </p>
                  {r.reply && (
                    <div className="mt-3 rounded-lg border-l-2 border-accent bg-surface-2 px-3 py-2 text-sm">
                      <p className="text-xs font-medium text-muted">{t("sf.reviews.replyFrom", { store: store.name })}</p>
                      <p className="mt-0.5 whitespace-pre-line">{r.reply}</p>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {r.status !== "APPROVED" && <form action={setReviewStatusAction.bind(null, slug, r.id, "APPROVED")}><ConfirmSubmit variant="primary">{t("reviews.approve")}</ConfirmSubmit></form>}
                    {r.status !== "REJECTED" && <form action={setReviewStatusAction.bind(null, slug, r.id, "REJECTED")}><ConfirmSubmit>{t("reviews.reject")}</ConfirmSubmit></form>}
                    <details className="group open:order-last open:basis-full">
                      <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-text [&::-webkit-details-marker]:hidden">
                        <MessageSquareReply className="size-4" aria-hidden />{r.reply ? t("reviews.editReply") : t("reviews.reply")}
                      </summary>
                      <ActionForm action={replyReviewAction.bind(null, slug, r.id)} className="mt-2 max-w-xl space-y-2">
                        <Textarea name="reply" rows={3} maxLength={2000} defaultValue={r.reply ?? ""} label={t("reviews.replyLabel")} hint={t("reviews.replyHint")} />
                        <div className="flex justify-end"><SubmitButton>{t("common.save")}</SubmitButton></div>
                      </ActionForm>
                    </details>
                    <form action={deleteReviewAction.bind(null, slug, r.id)} className="ml-auto"><ConfirmSubmit variant="ghost" className="text-danger" confirmMessage={t("common.confirmDelete")}>{t("common.delete")}</ConfirmSubmit></form>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Pagination basePath={base} params={sp} page={page} pages={pages} labels={{ previous: t("common.previous"), next: t("common.next"), summary: t("common.page", { page, pages }) }} />
        </section>

        <Card title={t("reviews.settings")}>
          {role === "OWNER" || role === "ADMIN" ? (
            <ActionForm action={saveReviewSettingsAction.bind(null, slug)} className="space-y-4">
              <Checkbox name="reviewsEnabled" label={t("reviews.enabled")} hint={t("reviews.enabledHint")} defaultChecked={store.reviewsEnabled} />
              <Checkbox name="reviewsAutoPublish" label={t("reviews.autoPublish")} hint={t("reviews.autoPublishHint")} defaultChecked={store.reviewsAutoPublish} />
              <div className="flex justify-end"><SubmitButton>{t("common.save")}</SubmitButton></div>
            </ActionForm>
          ) : (
            <p className="text-sm text-muted">{store.reviewsEnabled ? (store.reviewsAutoPublish ? t("reviews.autoPublish") : t("reviews.enabled")) : t("sf.reviews.disabled")}</p>
          )}
        </Card>
      </div>
    </>
  );
}
