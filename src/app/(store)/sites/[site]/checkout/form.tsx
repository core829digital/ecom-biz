"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js/pure";
import type { Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { PlaceResult, QuoteView } from "./actions";

export type CheckoutLabels = Record<string, string>;
type Address = { firstName: string; lastName: string; company: string; address1: string; address2: string; city: string; province: string; zip: string; countryCode: string; phone: string };
type Method = "stripe" | "cod" | "bank_transfer" | "test";

const field = "h-12 w-full rounded-lg border border-border bg-bg px-3 text-[15px] outline-none focus:border-text";

let stripePromise: Promise<Stripe | null> | null = null;

export function CheckoutForm(props: {
  labels: CheckoutLabels;
  countries: { code: string; name: string }[];
  methods: Method[];
  manualInstructions: { cod: string; bank_transfer: string };
  requirePhone: boolean;
  stripePublishableKey: string;
  cartHref: string;
  /** "By placing the order you accept…" with links to the store's legal pages (server-rendered). */
  legalNotice?: React.ReactNode;
  quote: (input: unknown) => Promise<QuoteView | { error: string }>;
  place: (input: unknown) => Promise<PlaceResult>;
  initial: { email: string; phone: string; discountCode: string; note: string; address: Address };
}) {
  const L = props.labels;
  const router = useRouter();
  const [email, setEmail] = useState(props.initial.email);
  const [phone, setPhone] = useState(props.initial.phone);
  const [marketing, setMarketing] = useState(false);
  const [note, setNote] = useState(props.initial.note);
  const [address, setAddress] = useState<Address>(props.initial.address);
  const [rateId, setRateId] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState(props.initial.discountCode);
  const [appliedCode, setAppliedCode] = useState<string | null>(props.initial.discountCode || null);
  const [method, setMethod] = useState<Method | null>(props.methods[0] ?? null);
  const [view, setView] = useState<QuoteView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [payment, setPayment] = useState<{ clientSecret: string; returnUrl: string } | null>(null);
  const [placing, startPlacing] = useTransition();
  const [quoting, setQuoting] = useState(false);
  const seq = useRef(0);

  const refresh = useCallback(
    async (overrides: { countryCode?: string; shippingRateId?: string | null; discountCode?: string | null } = {}) => {
      const id = ++seq.current;
      setQuoting(true);
      const res = await props.quote({
        countryCode: overrides.countryCode ?? address.countryCode,
        shippingRateId: overrides.shippingRateId !== undefined ? overrides.shippingRateId : rateId,
        discountCode: overrides.discountCode !== undefined ? overrides.discountCode : appliedCode,
        email: email || null,
      });
      if (id !== seq.current) return;
      setQuoting(false);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setView(res);
      setRateId(res.selectedRateId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [address.countryCode, rateId, appliedCode, email],
  );

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-quote when the email changes: it re-checks per-customer discounts and lets
  // the server remember the address for abandoned-checkout reminders.
  const quotedEmail = useRef(props.initial.email);
  const onEmailBlur = () => {
    const value = email.trim().toLowerCase();
    if (value === quotedEmail.current || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return;
    quotedEmail.current = value;
    refresh();
  };

  const setAddr = (patch: Partial<Address>) => setAddress((a) => ({ ...a, ...patch }));
  const free = view?.totalCents === 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    startPlacing(async () => {
      const res = await props.place({
        email, phone, acceptsMarketing: marketing, note, address,
        shippingRateId: rateId, discountCode: appliedCode, paymentMethod: free ? "test" : method,
      });
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        refresh();
        return;
      }
      if ("redirect" in res) router.push(res.redirect);
      else setPayment(res);
    });
  };

  const err = (k: string) => fieldErrors[k] && <p className="mt-1 text-xs text-danger">{fieldErrors[k]}</p>;

  const stripe = useMemo(() => {
    if (!payment || !props.stripePublishableKey) return null;
    stripePromise ??= loadStripe(props.stripePublishableKey);
    return stripePromise;
  }, [payment, props.stripePublishableKey]);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_400px]">
      <form onSubmit={submit} className="space-y-8" noValidate>
        <fieldset disabled={!!payment} className="space-y-8">
          <section>
            <h2 className="mb-3 text-lg font-semibold">{L["checkout.contact"]}</h2>
            <div className="space-y-3">
              <div>
                <input className={field} type="email" autoComplete="email" placeholder={L["checkout.email"]} aria-label={L["checkout.email"]} value={email} onChange={(e) => setEmail(e.target.value)} onBlur={onEmailBlur} required />
                {err("email")}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} /> {L["checkout.marketing"]}
              </label>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">{L["checkout.shippingAddress"]}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <select className={field} aria-label={L["checkout.country"]} value={address.countryCode} autoComplete="country" onChange={(e) => { setAddr({ countryCode: e.target.value }); refresh({ countryCode: e.target.value, shippingRateId: null }); }}>
                  {props.countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
                {err("address.countryCode")}
              </div>
              <div><input className={field} placeholder={L["checkout.firstName"]} aria-label={L["checkout.firstName"]} autoComplete="given-name" value={address.firstName} onChange={(e) => setAddr({ firstName: e.target.value })} />{err("address.firstName")}</div>
              <div><input className={field} placeholder={L["checkout.lastName"]} aria-label={L["checkout.lastName"]} autoComplete="family-name" value={address.lastName} onChange={(e) => setAddr({ lastName: e.target.value })} />{err("address.lastName")}</div>
              <div className="sm:col-span-2"><input className={field} placeholder={`${L["checkout.company"]} (${L["common.optional"]})`} aria-label={L["checkout.company"]} autoComplete="organization" value={address.company} onChange={(e) => setAddr({ company: e.target.value })} /></div>
              <div className="sm:col-span-2"><input className={field} placeholder={L["checkout.address1"]} aria-label={L["checkout.address1"]} autoComplete="address-line1" value={address.address1} onChange={(e) => setAddr({ address1: e.target.value })} />{err("address.address1")}</div>
              <div className="sm:col-span-2"><input className={field} placeholder={`${L["checkout.address2"]} (${L["common.optional"]})`} aria-label={L["checkout.address2"]} autoComplete="address-line2" value={address.address2} onChange={(e) => setAddr({ address2: e.target.value })} /></div>
              <div><input className={field} placeholder={L["checkout.zip"]} aria-label={L["checkout.zip"]} autoComplete="postal-code" value={address.zip} onChange={(e) => setAddr({ zip: e.target.value })} />{err("address.zip")}</div>
              <div><input className={field} placeholder={L["checkout.city"]} aria-label={L["checkout.city"]} autoComplete="address-level2" value={address.city} onChange={(e) => setAddr({ city: e.target.value })} />{err("address.city")}</div>
              <div><input className={field} placeholder={`${L["checkout.province"]} (${L["common.optional"]})`} aria-label={L["checkout.province"]} autoComplete="address-level1" value={address.province} onChange={(e) => setAddr({ province: e.target.value })} /></div>
              <div>
                <input className={field} type="tel" placeholder={props.requirePhone ? L["checkout.phone"] : `${L["checkout.phone"]} (${L["common.optional"]})`} aria-label={L["checkout.phone"]} autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                {err("phone")}
              </div>
            </div>
          </section>

          {view?.requiresShipping !== false && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">{L["checkout.shippingMethod"]}</h2>
              {!view ? (
                <p className="rounded-card bg-surface-2 p-4 text-sm text-muted">{L["checkout.enterAddress"]}</p>
              ) : view.rates.length === 0 ? (
                <p className="rounded-card bg-surface-2 p-4 text-sm text-muted">{L["checkout.noRates"]}</p>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border">
                  {view.rates.map((r) => (
                    <label key={r.id} className="flex cursor-pointer items-center justify-between gap-3 p-4 text-sm">
                      <span className="flex items-center gap-3">
                        <input type="radio" name="rate" checked={rateId === r.id} onChange={() => { setRateId(r.id); refresh({ shippingRateId: r.id }); }} />
                        {r.title}
                      </span>
                      <span className="font-medium tabular-nums">{r.price}</span>
                    </label>
                  ))}
                </div>
              )}
            </section>
          )}

          {!free && (
            <section>
              <h2 className="mb-1 text-lg font-semibold">{L["checkout.payment"]}</h2>
              <p className="mb-3 text-sm text-muted">{L["checkout.secure"]}</p>
              {props.methods.length === 0 ? (
                <p className="rounded-card bg-surface-2 p-4 text-sm text-danger">{L["checkout.noPaymentMethods"]}</p>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border">
                  {props.methods.map((m) => (
                    <label key={m} className="block cursor-pointer p-4 text-sm">
                      <span className="flex items-center gap-3">
                        <input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} />
                        <span className="font-medium">{L[`checkout.method.${m}`]}</span>
                      </span>
                      {method === m && m === "test" && <span className="mt-2 block text-muted">{L["checkout.method.test.hint"]}</span>}
                      {method === m && (m === "cod" || m === "bank_transfer") && props.manualInstructions[m] && (
                        <span className="mt-2 block whitespace-pre-line text-muted">{props.manualInstructions[m]}</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </section>
          )}

          <section>
            <label htmlFor="note" className="mb-2 block text-sm font-medium">{L["checkout.note"]} <span className="font-normal text-muted">({L["common.optional"]})</span></label>
            <textarea id="note" rows={2} maxLength={1000} className="w-full rounded-lg border border-border bg-bg p-3 text-sm" value={note} onChange={(e) => setNote(e.target.value)} />
          </section>
        </fieldset>

        {error && <div role="alert" className="rounded-lg border border-danger/40 bg-danger-bg p-4 text-sm text-danger">{error}</div>}

        {payment ? (
          stripe && (
            <Elements stripe={stripe} options={{ clientSecret: payment.clientSecret, appearance: { theme: "stripe" } }}>
              <StripePay returnUrl={payment.returnUrl} labels={L} onError={setError} />
            </Elements>
          )
        ) : (
          <>
          {props.legalNotice && <p className="text-xs text-muted">{props.legalNotice}</p>}
          <div className="flex flex-col-reverse items-center gap-4 sm:flex-row sm:justify-between">
            <Link href={props.cartHref} className="text-sm underline">← {L["checkout.backToCart"]}</Link>
            <button
              type="submit"
              disabled={placing || quoting || !view || (!free && !method) || (view.requiresShipping && !rateId)}
              className="h-14 w-full rounded-btn bg-brand px-8 text-base font-semibold text-brand-contrast hover:opacity-90 disabled:opacity-50 sm:w-auto"
            >
              {placing ? L["checkout.processing"] : free ? L["checkout.freeOrder"] : method === "stripe" ? L["checkout.payNow"] : L["checkout.placeOrder"]}
            </button>
          </div>
          </>
        )}
      </form>

      <aside className="h-fit rounded-xl bg-surface-2 p-6 lg:sticky lg:top-24" aria-busy={quoting}>
        <h2 className="mb-4 text-lg font-semibold">{L["checkout.summary"]}</h2>
        <ul className="space-y-4">
          {view?.lines.map((l) => (
            <li key={l.key} className="flex items-center gap-3 text-sm">
              <span className="relative size-16 shrink-0">
                <span className="block size-full overflow-hidden rounded-lg border border-border bg-bg">
                  {l.imageUrl && <img src={l.imageUrl} alt="" className="size-full object-cover" />}
                </span>
                <span className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-text text-[11px] font-medium text-bg">{l.quantity}</span>
              </span>
              <span className="flex-1">
                <span className="block font-medium">{l.title}</span>
                {l.variantTitle && <span className="text-muted">{l.variantTitle}</span>}
              </span>
              <span className="tabular-nums">{l.total}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex gap-2">
          <input className={`${field} h-11`} autoComplete="off" autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={40} placeholder={L["checkout.discountCode"]} aria-label={L["checkout.discountCode"]} value={codeInput} onChange={(e) => setCodeInput(e.target.value)} disabled={!!payment} />
          {appliedCode ? (
            <button type="button" className="h-11 shrink-0 rounded-lg border border-border px-4 text-sm" disabled={!!payment} onClick={() => { setAppliedCode(null); setCodeInput(""); refresh({ discountCode: "" }); }}>{L["checkout.remove"]}</button>
          ) : (
            <button type="button" className="h-11 shrink-0 rounded-lg bg-text px-4 text-sm font-medium text-bg disabled:opacity-50" disabled={!codeInput.trim() || !!payment} onClick={() => { const c = codeInput.trim(); setAppliedCode(c); refresh({ discountCode: c }); }}>{L["checkout.apply"]}</button>
          )}
        </div>
        {view?.discountError && appliedCode && <p className="mt-2 text-sm text-danger">{view.discountError}</p>}
        {view?.stockError && <p className="mt-2 text-sm text-danger">{view.stockError}</p>}
        {view && (
          <dl className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
            <div className="flex justify-between"><dt>{L["sf.subtotal"]}</dt><dd className="tabular-nums">{view.subtotal}</dd></div>
            {view.discount && <div className="flex justify-between"><dt>{L["checkout.discount"]} {view.discountCode && <span className="text-muted">({view.discountCode})</span>}</dt><dd className="tabular-nums">{view.discount}</dd></div>}
            {view.requiresShipping && <div className="flex justify-between"><dt>{L["checkout.shipping"]}</dt><dd className="tabular-nums">{view.shipping ?? "—"}</dd></div>}
            {!view.taxesIncluded && <div className="flex justify-between"><dt>{L["checkout.tax"]}</dt><dd className="tabular-nums">{view.tax}</dd></div>}
            <div className="flex justify-between border-t border-border pt-3 text-lg font-semibold"><dt>{L["common.total"]}</dt><dd className="tabular-nums" data-testid="checkout-total">{view.total}</dd></div>
            {view.taxesIncluded && <p className="text-xs text-muted">{L["checkout.taxIncluded"]} {view.tax}</p>}
          </dl>
        )}
      </aside>
    </div>
  );
}

function StripePay({ returnUrl, labels, onError }: { returnUrl: string; labels: CheckoutLabels; onError: (e: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      <PaymentElement />
      <button
        type="button"
        disabled={!stripe || busy}
        onClick={async () => {
          if (!stripe || !elements) return;
          setBusy(true);
          const { error } = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl } });
          // Only reached on immediate errors; success redirects to returnUrl.
          if (error) onError(error.message ?? labels["checkout.processing"]);
          setBusy(false);
        }}
        className="h-14 w-full rounded-btn bg-brand text-base font-semibold text-brand-contrast disabled:opacity-50"
      >
        {busy ? labels["checkout.processing"] : labels["checkout.payNow"]}
      </button>
    </div>
  );
}
