import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { countryName, EU_STANDARD_VAT_BPS } from "@/lib/geo";
import { centsToInput } from "@/lib/money";
import { parseTheme } from "@/lib/theme";
import { availablePaymentMethods, parseManualPayments } from "@/server/payments";
import { aiConfig } from "@/server/ai/provider";
import { uploadImageAction } from "../products/actions";
import { SetupWizard, type StepKey } from "./wizard";
import { setupBusinessAction, setupLegalAction, setupPaymentsAction, setupProductAction, setupShippingAction, setupTaxesAction } from "./actions";

export const metadata = { title: "Setup" };

export default async function SetupPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const [products, rates, legal, taxRate] = await Promise.all([
    db.product.count({ where: { storeId: store.id } }),
    db.shippingRate.findMany({ where: { zone: { storeId: store.id, countries: { has: store.countryCode } } }, orderBy: { priceCents: "desc" } }),
    db.page.count({ where: { storeId: store.id, handle: { in: ["privacy-policy", "terms-of-sale", "returns", "shipping"] } } }),
    db.taxRate.findFirst({ where: { storeId: store.id, countryCode: store.countryCode } }),
  ]);
  const manual = parseManualPayments(store.manualPayments);
  const theme = parseTheme(store.theme);
  // New stores start with one free domestic rate: shipping counts as set only once the merchant chose prices.
  const shippingChosen = rates.length > 1 || rates.some((r) => r.priceCents > 0 || r.minSubtotalCents !== null);
  const done: Record<StepKey, boolean> = {
    business: !!(store.legalName && store.vatNumber && store.address1),
    taxes: !!taxRate && !!store.vatNumber,
    payments: availablePaymentMethods(store).some((m) => m !== "test"),
    shipping: shippingChosen,
    legal: legal >= 4,
    product: products > 0,
    design: !!(theme.logoUrl || Array.isArray((store.theme as { sections?: unknown } | null)?.sections)),
  };
  const paid = rates.find((r) => r.priceCents > 0);
  const free = rates.find((r) => r.priceCents === 0 && r.minSubtotalCents !== null);
  const rateBps = taxRate?.rateBps ?? EU_STANDARD_VAT_BPS[store.countryCode] ?? 0;
  return (
    <>
      <PageHeader back={<BackLink href={`/admin/${slug}`} label={t("nav.home")} />} title={t("setup.wizard.title")} subtitle={t("setup.wizard.subtitle")} />
      <SetupWizard
        slug={slug}
        done={done}
        currency={store.currency}
        aiEnabled={aiConfig().enabled}
        upload={uploadImageAction.bind(null, slug)}
        actions={{
          business: setupBusinessAction.bind(null, slug),
          taxes: setupTaxesAction.bind(null, slug),
          payments: setupPaymentsAction.bind(null, slug),
          shipping: setupShippingAction.bind(null, slug),
          legal: setupLegalAction.bind(null, slug),
          product: setupProductAction.bind(null, slug),
        }}
        defaults={{
          legalName: store.legalName ?? "", vatNumber: store.vatNumber ?? "", address1: store.address1 ?? "", city: store.city ?? "", zip: store.zip ?? "",
          province: store.province ?? "", phone: store.phone ?? "", email: store.email, country: countryName(store.countryCode, store.locale),
          rate: String(rateBps / 100), taxesIncluded: store.taxesIncluded, taxShipping: store.taxShipping,
          cod: manual.cod.enabled, bank: manual.bankTransfer.enabled,
          shippingPrice: paid ? centsToInput(paid.priceCents) : "", freeOver: free?.minSubtotalCents ? centsToInput(free.minSubtotalCents) : "",
        }}
      />
    </>
  );
}
