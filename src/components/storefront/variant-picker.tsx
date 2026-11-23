"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type V = { id: string; values: (string | null)[]; price: string; compareAt: string | null; available: number };

export function VariantPicker({
  options,
  variants,
  initialVariantId,
  addToCart,
  notifyMe,
  cartHref,
  labels,
}: {
  options: { name: string; values: string[] }[];
  variants: V[];
  initialVariantId?: string;
  addToCart: (variantId: string, qty: number) => Promise<{ ok: boolean; error?: string }>;
  notifyMe?: (variantId: string, email: string) => Promise<{ ok: boolean; message: string }>;
  cartHref: string;
  labels: { add: string; soldOut: string; unavailable: string; quantity: string; added: string; viewCart: string; lowStock: string; notifyTitle?: string; notifyCta?: string; email?: string };
}) {
  const router = useRouter();
  const initial = variants.find((v) => v.id === initialVariantId) ?? variants.find((v) => v.available > 0) ?? variants[0];
  const [selected, setSelected] = useState<(string | null)[]>(initial.values);
  const [qty, setQty] = useState(1);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [alertEmail, setAlertEmail] = useState("");
  const [alertMsg, setAlertMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const variant = useMemo(() => variants.find((v) => v.values.every((x, i) => x === selected[i])), [variants, selected]);

  const choose = (index: number, value: string) => {
    const next = [...selected];
    next[index] = value;
    setSelected(next);
    setMessage(null);
    const match = variants.find((v) => v.values.every((x, i) => x === next[i]));
    if (match) {
      const url = new URL(window.location.href);
      url.searchParams.set("variant", match.id);
      window.history.replaceState(null, "", url);
    }
  };

  /** A value is selectable if some in-stock variant has it alongside the other current selections. */
  const valueAvailable = (index: number, value: string) =>
    variants.some((v) => v.values[index] === value && v.available > 0 && v.values.every((x, i) => i === index || x === selected[i]));

  const soldOut = !variant || variant.available <= 0;

  return (
    <div className="space-y-6">
      <p className="text-2xl tabular-nums" aria-live="polite">
        {variant ? (
          <>
            <span className={variant.compareAt ? "text-brand font-medium" : ""}>{variant.price}</span>
            {variant.compareAt && <s className="ml-3 text-lg text-muted">{variant.compareAt}</s>}
          </>
        ) : (
          <span className="text-muted">{labels.unavailable}</span>
        )}
      </p>

      {options.map((o, i) => (
        <fieldset key={o.name}>
          <legend className="mb-2 text-sm font-medium">
            {o.name}: <span className="font-normal text-muted">{selected[i]}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {o.values.map((val) => {
              const active = selected[i] === val;
              const avail = valueAvailable(i, val);
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => choose(i, val)}
                  aria-pressed={active}
                  className={`min-w-12 rounded-full border px-4 py-2 text-sm transition-colors ${active ? "border-text bg-text text-bg" : "border-border hover:border-text"} ${!avail ? "text-muted line-through decoration-1" : ""}`}
                >
                  {val}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      {variant && variant.available > 0 && variant.available <= 5 && <p className="text-sm text-brand">{labels.lowStock.replace("{count}", String(variant.available))}</p>}

      <div className="flex gap-3">
        <label className="sr-only" htmlFor="qty">{labels.quantity}</label>
        <div className="flex h-12 items-center rounded-full border border-border">
          <button type="button" className="h-full px-4" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="−">−</button>
          <input id="qty" inputMode="numeric" className="w-10 bg-transparent text-center tabular-nums outline-none" value={qty} onChange={(e) => setQty(Math.max(1, Math.min(999, parseInt(e.target.value || "1", 10) || 1)))} />
          <button type="button" className="h-full px-4" onClick={() => setQty((q) => Math.min(999, q + 1))} aria-label="+">+</button>
        </div>
        <button
          type="button"
          disabled={soldOut || pending}
          onClick={() =>
            variant &&
            start(async () => {
              const res = await addToCart(variant.id, qty);
              setMessage({ ok: res.ok, text: res.ok ? labels.added : res.error ?? labels.unavailable });
              if (res.ok) router.refresh();
            })
          }
          className="h-12 flex-1 rounded-full bg-brand px-6 font-medium text-brand-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "…" : soldOut ? (variant ? labels.soldOut : labels.unavailable) : labels.add}
        </button>
      </div>
      {soldOut && variant && notifyMe && (
        <form
          className="rounded-xl border border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await notifyMe(variant.id, alertEmail);
              setAlertMsg({ ok: r.ok, text: r.message });
            });
          }}
        >
          <p className="mb-2 text-sm font-medium">{labels.notifyTitle}</p>
          {alertMsg?.ok ? (
            <p role="status" className="text-sm">{alertMsg.text}</p>
          ) : (
            <div className="flex gap-2">
              <input type="email" required value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)} placeholder={labels.email} aria-label={labels.email} className="h-11 min-w-0 flex-1 rounded-full border border-border bg-bg px-4 text-sm" />
              <button disabled={pending} className="h-11 shrink-0 rounded-full border border-text px-5 text-sm font-medium hover:bg-text hover:text-bg">{labels.notifyCta}</button>
            </div>
          )}
          {alertMsg && !alertMsg.ok && <p className="mt-2 text-sm text-danger">{alertMsg.text}</p>}
        </form>
      )}
      {message && (
        <p role="status" className={`text-sm ${message.ok ? "" : "text-danger"}`}>
          {message.text} {message.ok && <Link href={cartHref} className="font-medium underline">{labels.viewCart} →</Link>}
        </p>
      )}
    </div>
  );
}
