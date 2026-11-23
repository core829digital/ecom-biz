import "server-only";
import type { Order, OrderLine, Store, Fulfillment } from "@prisma/client";
import { emailButton, emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { getTranslator } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { parseTheme } from "@/lib/theme";
import { formatAddressLines, type Address } from "@/lib/address";
import { countryName } from "@/lib/geo";
import { storePublicUrl } from "@/lib/tenant";
import { env } from "@/lib/env";

type OrderWithLines = Order & { lines: OrderLine[] };

function linesTable(order: OrderWithLines, money: (c: number) => string) {
  const rows = order.lines
    .map(
      (l) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${escapeHtml(l.title)}${l.variantTitle ? `<br><span style="color:#71717a;font-size:13px">${escapeHtml(l.variantTitle)}</span>` : ""}</td>
<td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center">× ${l.quantity}</td>
<td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${money(l.priceCents * l.quantity)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px">${rows}</table>`;
}

function totalsTable(order: OrderWithLines, t: ReturnType<typeof getTranslator>, money: (c: number) => string) {
  const row = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:4px 0;${bold ? "font-weight:600" : "color:#52525b"}">${escapeHtml(label)}</td><td style="padding:4px 0;text-align:right;${bold ? "font-weight:600" : ""}">${value}</td></tr>`;
  return `<table role="presentation" width="100%" style="margin-top:12px;font-size:14px">
${row(t("sf.subtotal"), money(order.subtotalCents))}
${order.discountCents ? row(`${t("checkout.discount")}${order.discountCode ? ` (${escapeHtml(order.discountCode)})` : ""}`, `−${money(order.discountCents)}`) : ""}
${row(t("checkout.shipping"), order.shippingCents ? money(order.shippingCents) : t("checkout.free"))}
${row(order.taxesIncluded ? t("checkout.taxIncluded") : t("checkout.tax"), money(order.taxCents))}
${row(t("common.total"), money(order.totalCents), true)}
</table>`;
}

export async function sendOrderConfirmation(store: Store, order: OrderWithLines) {
  const t = getTranslator(store.locale);
  const theme = parseTheme(store.theme);
  const money = (c: number) => formatMoney(c, order.currency, store.locale);
  const url = `${await storePublicUrl(store)}/orders/${order.statusToken}`;
  const address = formatAddressLines(order.shippingAddress as Address, (c) => countryName(c, store.locale));
  const instructions = order.paymentInstructions
    ? `<div style="margin:16px 0;padding:12px;background:#f4f4f5;border-radius:8px;font-size:14px;white-space:pre-line"><strong>${escapeHtml(t("checkout.paymentInstructions"))}</strong><br>${escapeHtml(order.paymentInstructions)}</div>`
    : "";
  const html = emailLayout({
    heading: t("email.order.heading", { number: order.number }),
    brandColor: theme.primaryColor,
    footer: `${store.name} · ${store.email}`,
    bodyHtml: `<p>${escapeHtml(t("email.order.intro"))}</p>${instructions}
${emailButton(url, t("email.order.cta"), theme.primaryColor)}
${linesTable(order, money)}${totalsTable(order, t, money)}
${address.length ? `<p style="margin-top:20px;font-size:14px"><strong>${escapeHtml(t("checkout.shippingAddress"))}</strong><br>${address.map(escapeHtml).join("<br>")}</p>` : ""}`,
  });
  await sendEmail({
    to: order.email,
    fromName: store.name,
    replyTo: store.email,
    subject: t("email.order.subject", { number: order.number, store: store.name }),
    html,
    text: `${t("email.order.heading", { number: order.number })}\n\n${t("email.order.intro")}\n\n${order.lines.map((l) => `${l.quantity} × ${l.title}${l.variantTitle ? ` (${l.variantTitle})` : ""}`).join("\n")}\n\n${t("common.total")}: ${money(order.totalCents)}\n${order.paymentInstructions ? `\n${order.paymentInstructions}\n` : ""}\n${url}`,
  });
}

export async function sendMerchantNewOrder(store: Store, order: OrderWithLines) {
  const t = getTranslator(store.locale);
  const money = (c: number) => formatMoney(c, order.currency, store.locale);
  const url = `${env.appUrl}/admin/${store.slug}/orders/${order.id}`;
  await sendEmail({
    to: store.email,
    subject: t("email.merchantOrder.subject", { number: order.number, total: money(order.totalCents) }),
    html: emailLayout({
      heading: t("email.merchantOrder.heading", { number: order.number }),
      bodyHtml: `<p>${escapeHtml(order.email)}</p>${linesTable(order, money)}${totalsTable(order, t, money)}${emailButton(url, t("email.merchantOrder.cta"))}`,
    }),
    text: `${t("email.merchantOrder.heading", { number: order.number })}\n${order.email}\n${money(order.totalCents)}\n${url}`,
  });
}

export async function sendShippingConfirmation(store: Store, order: OrderWithLines, fulfillment: Fulfillment) {
  const t = getTranslator(store.locale);
  const theme = parseTheme(store.theme);
  const url = `${await storePublicUrl(store)}/orders/${order.statusToken}`;
  const tracking = fulfillment.trackingNumber
    ? `<p><strong>${escapeHtml(t("orders.tracking"))}:</strong> ${escapeHtml([fulfillment.trackingCompany, fulfillment.trackingNumber].filter(Boolean).join(" · "))}</p>${fulfillment.trackingUrl ? emailButton(fulfillment.trackingUrl, t("email.shipping.track"), theme.primaryColor) : ""}`
    : "";
  await sendEmail({
    to: order.email,
    fromName: store.name,
    replyTo: store.email,
    subject: t("email.shipping.subject", { number: order.number }),
    html: emailLayout({
      heading: t("email.shipping.heading"),
      brandColor: theme.primaryColor,
      footer: `${store.name} · ${store.email}`,
      bodyHtml: `<p>${escapeHtml(t("email.shipping.intro", { number: order.number }))}</p>${tracking}${emailButton(url, t("email.order.cta"), theme.primaryColor)}`,
    }),
    text: `${t("email.shipping.intro", { number: order.number })}\n${fulfillment.trackingNumber ?? ""}\n${fulfillment.trackingUrl ?? ""}\n${url}`,
  });
}

export async function sendRefundNotification(store: Store, order: OrderWithLines, amountCents: number) {
  const t = getTranslator(store.locale);
  const theme = parseTheme(store.theme);
  const money = (c: number) => formatMoney(c, order.currency, store.locale);
  await sendEmail({
    to: order.email,
    fromName: store.name,
    replyTo: store.email,
    subject: t("email.refund.subject", { number: order.number }),
    html: emailLayout({
      heading: t("email.refund.subject", { number: order.number }),
      brandColor: theme.primaryColor,
      footer: `${store.name} · ${store.email}`,
      bodyHtml: `<p>${escapeHtml(t("email.refund.body", { amount: money(amountCents) }))}</p>`,
    }),
    text: t("email.refund.body", { amount: money(amountCents) }),
  });
}

export async function sendOrderCancelled(store: Store, order: OrderWithLines) {
  const t = getTranslator(store.locale);
  const theme = parseTheme(store.theme);
  await sendEmail({
    to: order.email,
    fromName: store.name,
    replyTo: store.email,
    subject: t("email.cancel.subject", { number: order.number }),
    html: emailLayout({
      heading: t("email.cancel.subject", { number: order.number }),
      brandColor: theme.primaryColor,
      footer: `${store.name} · ${store.email}`,
      bodyHtml: `<p>${escapeHtml(t("email.cancel.body"))}</p>`,
    }),
    text: t("email.cancel.body"),
  });
}
