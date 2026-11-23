import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStoreAccess, hasRole } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/money";
import { formatAddressLines, type Address } from "@/lib/address";
import { countryName } from "@/lib/geo";
import { Card, PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { LinkButton } from "@/components/ui/button";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/ui/form";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/fields";
import { FinancialBadge, FulfillmentBadge, OrderStatusBadge } from "@/components/admin/status-badges";
import { RefundForm } from "./refund-form";
import { archiveAction, cancelAction, commentAction, fulfillAction, markPaidAction, refundAction, saveOrderNoteAction } from "../actions";

type Props = { params: Promise<{ store: string; id: string }>; searchParams: Promise<{ action?: string }> };

export default async function OrderPage({ params, searchParams }: Props) {
  const { store: slug, id } = await params;
  const { action } = await searchParams;
  const { store, role } = await requireStoreAccess(slug);
  const { t, locale } = await getPlatformT();
  const order = await db.order.findFirst({
    where: { id, storeId: store.id },
    include: {
      lines: true,
      fulfillments: { include: { lines: true }, orderBy: { createdAt: "asc" } },
      refunds: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "desc" } },
      customer: { include: { _count: { select: { orders: true } } } },
    },
  });
  if (!order) notFound();

  const base = `/admin/${slug}/orders/${order.id}`;
  const money = (c: number) => formatMoney(c, order.currency, locale);
  const date = new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: store.timezone });
  const cancelled = order.status === "CANCELLED";
  const unfulfilledLines = order.lines.filter((l) => l.requiresShipping && l.quantity - l.refundedQty - l.fulfilledQty > 0);
  const canFulfill = !cancelled && unfulfilledLines.length > 0;
  const canMarkPaid = !cancelled && order.financialStatus === "PENDING";
  const isAdmin = hasRole(role, "ADMIN");
  const canRefund = isAdmin && !cancelled && (order.totalCents - order.refundedCents > 0 || order.lines.some((l) => l.quantity > l.refundedQty));
  const canCancel = isAdmin && !cancelled && !(order.fulfillmentStatus === "FULFILLED" && order.lines.some((l) => l.requiresShipping));
  const address = formatAddressLines(order.shippingAddress as Address, (c) => countryName(c, locale));

  return (
    <>
      <PageHeader
        back={<BackLink href={`/admin/${slug}/orders`} label={t("nav.orders")} />}
        title={
          <span className="flex flex-wrap items-center gap-2">
            #{order.number}
            <FinancialBadge status={order.financialStatus} t={t} />
            <FulfillmentBadge status={order.fulfillmentStatus} t={t} />
            <OrderStatusBadge status={order.status} t={t} />
          </span>
        }
        subtitle={`${date.format(order.createdAt)} · ${t(`checkout.method.${order.paymentMethod as "cod"}`) ?? order.paymentMethod}`}
        actions={
          <>
            <a href={`${base}/print`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2">{t("orders.print")}</a>
            <a href={`${base}/receipt`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2">{t("receipt.title")}</a>
            {canRefund && <LinkButton href={`${base}?action=refund`} variant="secondary" size="sm">{t("orders.refund")}</LinkButton>}
            {canCancel && <LinkButton href={`${base}?action=cancel`} variant="secondary" size="sm">{t("orders.cancel")}</LinkButton>}
            {!cancelled && (
              <form action={archiveAction.bind(null, slug, order.id, order.status !== "ARCHIVED")}>
                <ConfirmSubmit>{order.status === "ARCHIVED" ? t("orders.unarchive") : t("orders.archive")}</ConfirmSubmit>
              </form>
            )}
          </>
        }
      />

      {action === "fulfill" && canFulfill && (
        <Card className="mb-5 border-accent" title={t("orders.fulfill")} actions={<Link href={base} className="text-sm text-muted hover:text-text">{t("common.cancel")}</Link>}>
          <ActionForm action={fulfillAction.bind(null, slug, order.id)} className="space-y-4">
            <ul className="divide-y divide-border">
              {unfulfilledLines.map((l) => {
                const remaining = l.quantity - l.refundedQty - l.fulfilledQty;
                return (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>{l.title}{l.variantTitle && <span className="text-muted"> · {l.variantTitle}</span>}{l.sku && <span className="text-muted"> · {l.sku}</span>}</span>
                    <span className="flex items-center gap-2">
                      <input type="number" name={`qty:${l.id}`} min={0} max={remaining} defaultValue={remaining} aria-label={`${l.title} ${t("sf.quantity")}`} className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-right tabular-nums" />
                      <span className="text-muted">/ {remaining}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input name="trackingCompany" label={t("orders.trackingCompany")} placeholder="FAN Courier, Sameday, DHL…" />
              <Input name="trackingNumber" label={t("orders.trackingNumber")} />
              <Input name="trackingUrl" label={t("orders.trackingUrl")} placeholder="https://" />
            </div>
            <Checkbox name="notify" label={t("orders.notifyCustomer")} defaultChecked />
            <SubmitButton>{t("orders.fulfillItems")}</SubmitButton>
          </ActionForm>
        </Card>
      )}

      {action === "refund" && canRefund && (
        <Card className="mb-5 border-accent" title={t("orders.refund")} actions={<Link href={base} className="text-sm text-muted hover:text-text">{t("common.cancel")}</Link>}>
          {order.financialStatus === "PENDING" && <p className="mb-3 text-sm text-warning">{t("orders.refund.pendingNote")}</p>}
          {order.paymentMethod !== "stripe" && order.financialStatus !== "PENDING" && <p className="mb-3 text-sm text-muted">{t("orders.refund.manualNote")}</p>}
          <RefundForm
            action={refundAction.bind(null, slug, order.id)}
            lines={order.lines.map((l) => ({ id: l.id, title: l.title, variantTitle: l.variantTitle, quantity: l.quantity, refundedQty: l.refundedQty, priceCents: l.priceCents, discountCents: l.discountCents, taxCents: l.taxCents }))}
            taxesIncluded={order.taxesIncluded}
            remainingCents={order.totalCents - order.refundedCents}
            shippingCents={order.shippingCents}
            currency={order.currency}
            canRefundMoney={order.financialStatus !== "PENDING"}
          />
        </Card>
      )}

      {action === "cancel" && canCancel && (
        <Card className="mb-5 border-danger/40" title={t("orders.cancel")} actions={<Link href={base} className="text-sm text-muted hover:text-text">{t("common.back")}</Link>}>
          <ActionForm action={cancelAction.bind(null, slug, order.id)} className="space-y-4">
            <Select name="reason" label={t("orders.cancel.reason")} defaultValue="customer">
              {(["customer", "inventory", "fraud", "declined", "other"] as const).map((r) => <option key={r} value={r}>{t(`orders.cancel.reason.${r}`)}</option>)}
            </Select>
            <div className="space-y-2">
              <Checkbox name="restock" label={t("orders.refund.restock")} defaultChecked />
              {order.financialStatus !== "PENDING" && order.totalCents > order.refundedCents && (
                <Checkbox name="refund" label={t("orders.cancel.refund", { amount: money(order.totalCents - order.refundedCents) })} defaultChecked />
              )}
              <Checkbox name="notify" label={t("orders.notifyCustomer")} defaultChecked />
            </div>
            <SubmitButton variant="danger">{t("orders.cancel.submit")}</SubmitButton>
          </ActionForm>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {unfulfilledLines.length > 0 && !cancelled && (
            <Card title={<span className="flex items-center gap-2">{t("orders.fulfillment.UNFULFILLED")} <span className="text-muted">({unfulfilledLines.reduce((n, l) => n + l.quantity - l.refundedQty - l.fulfilledQty, 0)})</span></span>}
              actions={action !== "fulfill" ? <LinkButton href={`${base}?action=fulfill`} size="sm">{t("orders.fulfillItems")}</LinkButton> : null}>
              <LineList lines={unfulfilledLines.map((l) => ({ ...l, shownQty: l.quantity - l.refundedQty - l.fulfilledQty }))} money={money} />
            </Card>
          )}
          {order.fulfillments.map((f, i) => (
            <Card key={f.id} title={`${t("orders.fulfillment.FULFILLED")} #${i + 1} · ${date.format(f.createdAt)}`}>
              {(f.trackingNumber || f.trackingCompany) && (
                <p className="mb-3 text-sm">
                  {t("orders.tracking")}: {[f.trackingCompany, f.trackingNumber].filter(Boolean).join(" · ")}
                  {f.trackingUrl && <> — <a href={f.trackingUrl} target="_blank" rel="noopener noreferrer" className="underline">{t("email.shipping.track")}</a></>}
                </p>
              )}
              <LineList lines={f.lines.map((fl) => { const l = order.lines.find((x) => x.id === fl.orderLineId)!; return { ...l, shownQty: fl.quantity }; }).filter((l) => l.id)} money={money} />
            </Card>
          ))}
          {order.lines.filter((l) => !l.requiresShipping).length > 0 && (
            <Card title={t("orders.digital")}>
              <LineList lines={order.lines.filter((l) => !l.requiresShipping).map((l) => ({ ...l, shownQty: l.quantity }))} money={money} />
            </Card>
          )}

          <Card title={t("orders.payment")} actions={<FinancialBadge status={order.financialStatus} t={t} />}>
            <dl className="space-y-1.5 text-sm">
              <Row label={t("sf.subtotal")} value={money(order.subtotalCents)} />
              {order.discountCents > 0 && <Row label={`${t("checkout.discount")}${order.discountCode ? ` (${order.discountCode})` : ""}`} value={`−${money(order.discountCents)}`} />}
              {order.shippingTitle && <Row label={`${t("checkout.shipping")} · ${order.shippingTitle}`} value={money(order.shippingCents)} />}
              <Row label={`${order.taxesIncluded ? t("checkout.taxIncluded") : t("checkout.tax")} (${(order.taxRateBps / 100).toFixed(2)}%)`} value={money(order.taxCents)} />
              <Row label={t("common.total")} value={money(order.totalCents)} strong />
              {order.refundedCents > 0 && <Row label={t("orders.refunded")} value={`−${money(order.refundedCents)}`} />}
              {order.refundedCents > 0 && <Row label={t("orders.netPayment")} value={money(order.totalCents - order.refundedCents)} strong />}
              {order.platformFeeCents > 0 && <Row label={t("orders.platformFee")} value={money(order.platformFeeCents)} />}
            </dl>
            {canMarkPaid && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-warning-bg p-3 text-sm text-warning">
                <span>{t("orders.awaitingPayment")}</span>
                <form action={markPaidAction.bind(null, slug, order.id)}><ConfirmSubmit variant="primary" confirmMessage={t("orders.markPaidConfirm")}>{t("orders.markPaid")}</ConfirmSubmit></form>
              </div>
            )}
            {order.paymentRef && <p className="mt-3 text-xs text-muted">{t("orders.paymentRef")}: <code>{order.paymentRef}</code></p>}
          </Card>

          <Card title={t("orders.timeline")}>
            <ActionForm action={commentAction.bind(null, slug, order.id)} resetOnSuccess className="mb-5 flex gap-2">
              <input name="message" placeholder={t("orders.comment")} aria-label={t("orders.comment")} maxLength={2000} className="h-10 flex-1 rounded-lg border border-border bg-surface px-3 text-sm" />
              <SubmitButton variant="secondary">{t("orders.post")}</SubmitButton>
            </ActionForm>
            <ol className="space-y-4 border-l border-border pl-4">
              {order.events.map((e) => (
                <li key={e.id} className="relative text-sm">
                  <span className={`absolute -left-[21px] top-1.5 size-2.5 rounded-full ${e.type === "warning" ? "bg-danger" : e.type === "comment" ? "bg-info" : "bg-muted"}`} aria-hidden />
                  <p className={e.type === "warning" ? "text-danger" : ""}>{e.message}</p>
                  <p className="text-xs text-muted">{date.format(e.createdAt)}{e.author && ` · ${e.author}`}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title={t("orders.customer")}>
            {order.customer ? (
              <Link href={`/admin/${slug}/customers/${order.customer.id}`} className="font-medium hover:underline">
                {[order.customer.firstName, order.customer.lastName].filter(Boolean).join(" ") || order.customer.email}
              </Link>
            ) : <span className="text-muted">—</span>}
            {order.customer && <p className="text-sm text-muted">{t("customers.ordersCount", { count: order.customer._count.orders })}</p>}
            <div className="mt-4 space-y-1 text-sm">
              <p className="font-medium">{t("checkout.contact")}</p>
              <a href={`mailto:${order.email}`} className="block break-all text-info hover:underline">{order.email}</a>
              {order.phone && <a href={`tel:${order.phone}`} className="block text-info hover:underline">{order.phone}</a>}
            </div>
            {address.length > 0 && (
              <div className="mt-4 text-sm">
                <p className="font-medium">{t("checkout.shippingAddress")}</p>
                <p className="text-muted">{address.map((l, i) => <span key={i} className="block">{l}</span>)}</p>
              </div>
            )}
          </Card>
          <Card title={t("orders.notes")}>
            <ActionForm action={saveOrderNoteAction.bind(null, slug, order.id)} className="space-y-3">
              <Textarea name="note" rows={3} defaultValue={order.note ?? ""} aria-label={t("orders.notes")} />
              <SubmitButton variant="secondary">{t("common.save")}</SubmitButton>
            </ActionForm>
          </Card>
          {cancelled && order.cancelReason && (
            <Card title={t("orders.status.CANCELLED")}>
              <p className="text-sm">{t(`orders.cancel.reason.${order.cancelReason as "other"}`) ?? order.cancelReason}</p>
              {order.cancelledAt && <p className="text-xs text-muted">{date.format(order.cancelledAt)}</p>}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "border-t border-border pt-1.5 font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-muted"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function LineList({ lines, money }: { lines: { id: string; title: string; variantTitle: string | null; sku: string | null; imageUrl: string | null; priceCents: number; shownQty: number }[]; money: (c: number) => string }) {
  return (
    <ul className="divide-y divide-border">
      {lines.map((l) => (
        <li key={l.id} className="flex items-center gap-3 py-2.5 text-sm">
          <span className="size-11 shrink-0 overflow-hidden rounded-md border border-border bg-surface-2">{l.imageUrl && <img src={l.imageUrl} alt="" className="size-full object-cover" />}</span>
          <span className="flex-1">
            <span className="block font-medium">{l.title}</span>
            <span className="text-xs text-muted">{[l.variantTitle, l.sku].filter(Boolean).join(" · ")}</span>
          </span>
          <span className="tabular-nums text-muted">{money(l.priceCents)} × {l.shownQty}</span>
          <span className="w-24 text-right tabular-nums">{money(l.priceCents * l.shownQty)}</span>
        </li>
      ))}
    </ul>
  );
}
