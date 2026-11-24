import Link from "next/link";
import { ArrowRight, Check, PartyPopper, X } from "lucide-react";
import type { Store, User } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { Translator, MessageKey } from "@/lib/i18n";
import { parseTheme } from "@/lib/theme";
import { availablePaymentMethods } from "@/server/payments";
import { accountActive } from "@/server/plans";
import { ConfirmSubmit } from "@/components/ui/form";
import { dismissSetupAction } from "./setup-actions";

type Step = { key: string; done: boolean; href: string; minutes: number };

/** The setup steps of a store, computed from its real data (nothing to keep in sync). */
export async function setupSteps(store: Store, owner: Pick<User, "emailVerifiedAt" | "subscriptionStatus" | "trialEndsAt" | "pastDueSince" | "billingHold"> | null) {
  const base = `/admin/${store.slug}`;
  const [products, rates, legal] = await Promise.all([
    db.product.count({ where: { storeId: store.id } }),
    db.shippingRate.count({ where: { zone: { storeId: store.id } } }),
    db.page.count({ where: { storeId: store.id, published: true, handle: { in: ["privacy-policy", "terms-of-sale"] } } }),
  ]);
  const theme = parseTheme(store.theme);
  const steps: Step[] = [
    { key: "email", done: !!owner?.emailVerifiedAt, href: "/account/billing", minutes: 1 },
    { key: "business", done: !!(store.legalName && store.vatNumber && store.address1), href: `${base}/settings/general`, minutes: 3 },
    { key: "product", done: products > 0, href: `${base}/products/new`, minutes: 5 },
    { key: "shipping", done: rates > 0, href: `${base}/settings/shipping`, minutes: 3 },
    { key: "payments", done: availablePaymentMethods(store).some((m) => m !== "test"), href: `${base}/settings/payments`, minutes: 5 },
    { key: "theme", done: !!(theme.logoUrl || theme.heroImageUrl || theme.primaryColor !== "#111827"), href: `${base}/online-store/theme`, minutes: 5 },
    { key: "legal", done: legal >= 2, href: `${base}/online-store/pages`, minutes: 5 },
  ];
  if (env.billingEnforced) steps.push({ key: "plan", done: !!owner && accountActive(owner), href: "/account/billing", minutes: 2 });
  return steps;
}

export function SetupGuide({ store, steps, t }: { store: Store; steps: Step[]; t: Translator }) {
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  const pct = Math.round((done / steps.length) * 100);
  return (
    <section className="mb-5 overflow-hidden rounded-xl border border-border bg-surface shadow-sm" aria-labelledby="setup-title">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div>
          <h2 id="setup-title" className="font-semibold">{next ? t("setup.title") : t("setup.doneTitle")}</h2>
          <p className="mt-0.5 text-sm text-muted">{next ? t("setup.progress", { done, total: steps.length }) : t("setup.doneBody")}</p>
        </div>
        <form action={dismissSetupAction.bind(null, store.slug)}>
          <ConfirmSubmit variant="ghost" className="gap-1 text-muted">
            <X className="size-4" aria-hidden /><span>{next ? t("setup.hide") : t("setup.close")}</span>
          </ConfirmSubmit>
        </form>
      </div>
      <div className="mx-5 mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label={t("setup.title")}>
        <div className="h-full rounded-full bg-success transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      {next ? (
        <ol className="mt-4 divide-y divide-border border-t border-border">
          {steps.map((s, i) => {
            const isNext = s === next;
            return (
              <li key={s.key}>
                <Link href={s.href} className={`group flex items-start gap-3 px-5 py-3 transition-colors hover:bg-surface-2 ${isNext ? "bg-accent/5" : ""}`}>
                  <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${s.done ? "bg-success text-white" : isNext ? "bg-accent text-accent-contrast" : "border border-border text-muted"}`} aria-hidden>
                    {s.done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-medium ${s.done ? "text-muted line-through" : ""}`}>{t(`setup.${s.key}.title` as MessageKey)}</span>
                    {!s.done && <span className="mt-0.5 block text-xs text-muted">{t(`setup.${s.key}.body` as MessageKey)} · {t("setup.minutes", { minutes: s.minutes })}</span>}
                    <span className="sr-only">{s.done ? t("dashboard.setup.done") : ""}</span>
                  </span>
                  {isNext && <span className="hidden items-center gap-1 self-center text-sm font-medium sm:flex">{t("setup.start")}<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></span>}
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="flex items-center gap-2 px-5 py-4 text-sm"><PartyPopper className="size-4 text-success" aria-hidden />{t("setup.doneHint")}</p>
      )}
    </section>
  );
}
