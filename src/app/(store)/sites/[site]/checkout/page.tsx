import Link from "next/link";
import { redirect } from "next/navigation";
import { loadStorefront } from "@/server/storefront";
import { getCart } from "@/server/cart";
import { shippableCountries } from "@/server/shipping";
import { availablePaymentMethods, parseManualPayments } from "@/server/payments";
import { getCurrentCustomer } from "@/lib/auth/customer";
import { db } from "@/lib/db";
import { countryName } from "@/lib/geo";
import { env } from "@/lib/env";
import { CheckoutForm, type CheckoutLabels } from "./form";
import { placeOrderAction, quoteAction } from "./actions";

export const metadata = { title: "Checkout", robots: { index: false } };

const LABEL_KEYS = [
  "checkout.contact", "checkout.email", "checkout.phone", "checkout.marketing", "checkout.shippingAddress", "checkout.firstName",
  "checkout.lastName", "checkout.company", "checkout.address1", "checkout.address2", "checkout.city", "checkout.province",
  "checkout.zip", "checkout.country", "checkout.shippingMethod", "checkout.enterAddress", "checkout.noRates", "checkout.payment",
  "checkout.method.stripe", "checkout.method.cod", "checkout.method.bank_transfer", "checkout.method.test", "checkout.method.test.hint",
  "checkout.discountCode", "checkout.apply", "checkout.remove", "checkout.summary", "checkout.shipping", "checkout.tax", "checkout.taxIncluded",
  "checkout.discount", "checkout.placeOrder", "checkout.payNow", "checkout.processing", "checkout.note", "checkout.noPaymentMethods",
  "checkout.backToCart", "checkout.secure", "checkout.freeOrder", "sf.subtotal", "common.total", "common.optional",
] as const;

export default async function CheckoutPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const sf = await loadStorefront(site);
  const { store, t } = sf;
  const cart = await getCart(store.id);
  if (!cart || !cart.lines.length) redirect(sf.href("/cart"));

  const [countries, customer, legal] = await Promise.all([
    shippableCountries(store.id),
    getCurrentCustomer(store.id),
    db.page.findMany({ where: { storeId: store.id, published: true, handle: { in: ["terms-of-sale", "privacy-policy"] } }, select: { handle: true, title: true } }),
  ]);
  const terms = legal.find((p) => p.handle === "terms-of-sale");
  const privacy = legal.find((p) => p.handle === "privacy-policy");
  const legalLink = (p: { handle: string; title: string }) => <Link href={sf.href(`/pages/${p.handle}`)} target="_blank" className="underline">{p.title}</Link>;
  // Shown only when the pages exist, so it never points to a missing page.
  const legalNotice = terms ? (
    <>{t("checkout.legal.terms")} {legalLink(terms)}{privacy && <>{t("checkout.legal.privacy")} {legalLink(privacy)}</>}.</>
  ) : null;
  const defaultAddress = customer
    ? await db.customerAddress.findFirst({ where: { customerId: customer.id }, orderBy: { isDefault: "desc" } })
    : null;
  const methods = availablePaymentMethods(store);
  const manual = parseManualPayments(store.manualPayments);
  const labels = Object.fromEntries(LABEL_KEYS.map((k) => [k, t(k)])) as CheckoutLabels;
  const countryList = (countries.length ? countries : [store.countryCode]).map((c) => ({ code: c, name: countryName(c, store.locale) })).sort((a, b) => a.name.localeCompare(b.name));
  const initialCountry = defaultAddress?.countryCode && countryList.some((c) => c.code === defaultAddress.countryCode)
    ? defaultAddress.countryCode
    : countryList.some((c) => c.code === store.countryCode) ? store.countryCode : countryList[0]?.code ?? "";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">{t("sf.checkout")}</h1>
      <CheckoutForm
        labels={labels}
        countries={countryList}
        methods={methods}
        manualInstructions={{ cod: manual.cod.instructions, bank_transfer: manual.bankTransfer.instructions }}
        requirePhone={store.checkoutRequirePhone}
        stripePublishableKey={env.stripePublishableKey}
        cartHref={sf.href("/cart")}
        legalNotice={legalNotice}
        quote={quoteAction.bind(null, site)}
        place={placeOrderAction.bind(null, site)}
        initial={{
          email: customer?.email ?? "",
          phone: customer?.phone ?? "",
          discountCode: cart.discountCode ?? "",
          note: cart.note ?? "",
          address: {
            firstName: defaultAddress?.firstName ?? customer?.firstName ?? "",
            lastName: defaultAddress?.lastName ?? customer?.lastName ?? "",
            company: defaultAddress?.company ?? "",
            address1: defaultAddress?.address1 ?? "",
            address2: defaultAddress?.address2 ?? "",
            city: defaultAddress?.city ?? "",
            province: defaultAddress?.province ?? "",
            zip: defaultAddress?.zip ?? "",
            countryCode: initialCountry,
            phone: defaultAddress?.phone ?? "",
          },
        }}
      />
    </div>
  );
}
