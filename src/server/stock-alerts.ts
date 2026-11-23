import "server-only";
import { after } from "next/server";
import { db } from "@/lib/db";
import { emailButton, emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { getTranslator } from "@/lib/i18n";
import { parseTheme } from "@/lib/theme";
import { storePublicUrl } from "@/lib/tenant";

/** Subscribe an email to a sold-out variant. Idempotent per (variant, email). */
export async function subscribeStockAlert(storeId: string, variantId: string, email: string) {
  await db.stockAlert.upsert({
    where: { variantId_email: { variantId, email } },
    create: { storeId, variantId, email },
    update: { notifiedAt: null },
  });
}

/** Email everyone waiting on variants that are now purchasable. Safe to call after any stock change. */
export async function notifyBackInStock(variantIds: string[]) {
  if (!variantIds.length) return;
  const run = async () => {
    const alerts = await db.stockAlert.findMany({
      where: {
        variantId: { in: variantIds },
        notifiedAt: null,
        variant: { OR: [{ inventoryQty: { gt: 0 } }, { trackInventory: false }, { allowBackorder: true }], product: { status: "ACTIVE" } },
      },
      include: { store: true, variant: { include: { product: { select: { title: true, handle: true } } } } },
      take: 1000,
    });
    for (const a of alerts) {
      const claimed = await db.stockAlert.updateMany({ where: { id: a.id, notifiedAt: null }, data: { notifiedAt: new Date() } });
      if (!claimed.count) continue;
      const t = getTranslator(a.store.locale);
      const theme = parseTheme(a.store.theme);
      const title = `${a.variant.product.title}${a.variant.title !== "Default" ? ` (${a.variant.title})` : ""}`;
      const url = `${await storePublicUrl(a.store)}/products/${a.variant.product.handle}?variant=${a.variant.id}`;
      await sendEmail({
        to: a.email,
        fromName: a.store.name,
        replyTo: a.store.email,
        subject: t("email.restock.subject", { title }),
        html: emailLayout({
          heading: t("email.restock.heading"),
          brandColor: theme.primaryColor,
          footer: `${a.store.name} · ${a.store.email}`,
          bodyHtml: `<p>${escapeHtml(t("email.restock.body", { title }))}</p>${emailButton(url, t("email.restock.cta"), theme.primaryColor)}`,
        }),
        text: `${t("email.restock.body", { title })}\n${url}`,
      });
    }
  };
  try {
    after(run);
  } catch {
    await run(); // outside a request (scripts/tests)
  }
}
