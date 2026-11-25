"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Building2, Check, CreditCard, FileText, Package, Palette, Percent, Sparkles, Truck } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/components/i18n-provider";
import type { MessageKey } from "@/lib/i18n/en";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Checkbox, Input, Textarea } from "@/components/ui/fields";
import type { ActionState } from "@/lib/action";

type Action = (s: ActionState, fd: FormData) => Promise<ActionState>;
export type StepKey = "business" | "taxes" | "payments" | "shipping" | "legal" | "product" | "design";
const ICONS = { business: Building2, taxes: Percent, payments: CreditCard, shipping: Truck, legal: FileText, product: Package, design: Palette };
const ease = [0.22, 1, 0.36, 1] as const;

export function SetupWizard({ slug, done, defaults, actions, upload, aiEnabled, currency }: {
  slug: string;
  done: Record<StepKey, boolean>;
  defaults: { legalName: string; vatNumber: string; address1: string; city: string; zip: string; province: string; phone: string; email: string; rate: string; taxesIncluded: boolean; taxShipping: boolean; cod: boolean; bank: boolean; shippingPrice: string; freeOver: string; country: string };
  actions: Record<Exclude<StepKey, "design">, Action>;
  upload: (fd: FormData) => Promise<{ url?: string; error?: string }>;
  aiEnabled: boolean;
  currency: string;
}) {
  const t = useT();
  const tk = (k: string, v?: Record<string, string | number>) => t(k as MessageKey, v);
  const router = useRouter();
  const reduce = useReducedMotion();
  const order: StepKey[] = ["business", "taxes", "payments", "shipping", "legal", "product", "design"];
  const [completed, setCompleted] = useState(done);
  const [current, setCurrent] = useState<StepKey | "finished">(order.find((k) => !done[k]) ?? "finished");
  const [dir, setDir] = useState(1);
  const go = (k: StepKey | "finished") => { setDir(k === "finished" || order.indexOf(k as StepKey) > order.indexOf(current as StepKey) ? 1 : -1); setCurrent(k); };
  const advance = (k: StepKey) => {
    setCompleted((c) => ({ ...c, [k]: true }));
    const next = order.slice(order.indexOf(k) + 1).find((s) => !completed[s]) ?? order.find((s) => s !== k && !completed[s]);
    go(next ?? "finished");
    router.refresh();
  };
  const count = order.filter((k) => completed[k]).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <nav aria-label={tk("setup.wizard.steps")} className="lg:sticky lg:top-6 lg:self-start">
        <div className="mb-3 flex items-center justify-between text-xs text-muted">
          <span>{tk("setup.wizard.progress", { done: count, total: order.length })}</span>
          <span className="tabular-nums">{Math.round((count / order.length) * 100)}%</span>
        </div>
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-surface-3">
          <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${(count / order.length) * 100}%` }} transition={{ duration: 0.6, ease }} />
        </div>
        <ol className="space-y-1">
          {order.map((k, i) => {
            const Icon = ICONS[k];
            const active = current === k;
            return (
              <li key={k}>
                <button type="button" onClick={() => go(k)} aria-current={active ? "step" : undefined}
                  className={cn("relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors", active ? "text-text" : "text-muted hover:bg-surface-2 hover:text-text")}>
                  {active && <motion.span layoutId="setup-active" className="absolute inset-0 rounded-lg bg-surface-2" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                  <span className={cn("relative flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors duration-300", completed[k] ? "border-success bg-success text-white" : active ? "border-text" : "border-border")}>
                    <AnimatePresence mode="wait" initial={false}>
                      {completed[k]
                        ? <motion.span key="c" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}><Check className="size-3.5" aria-hidden /></motion.span>
                        : <motion.span key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Icon className="size-3.5" aria-hidden /></motion.span>}
                    </AnimatePresence>
                  </span>
                  <span className="relative min-w-0">
                    <span className="block truncate font-medium">{tk(`setup.wizard.${k}.title`)}</span>
                    <span className="block text-[11px] text-muted">{tk("setup.wizard.stepN", { n: i + 1 })}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="relative min-w-0 overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div key={current} custom={dir}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 32, filter: "blur(4px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -32, filter: "blur(4px)" }}
            transition={{ duration: 0.32, ease }}>
            {current === "finished" ? (
              <div className="py-6 text-center">
                <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }} className="mx-auto flex size-16 items-center justify-center rounded-full bg-success text-white">
                  <Check className="size-8" aria-hidden />
                </motion.div>
                <h2 className="mt-5 text-2xl font-semibold tracking-tight">{tk("setup.wizard.finished.title")}</h2>
                <p className="mx-auto mt-2 max-w-md text-muted">{tk("setup.wizard.finished.body")}</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <Link href={`/admin/${slug}`} className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-contrast">{tk("setup.wizard.finished.dashboard")}</Link>
                  <Link href={`/admin/${slug}/online-store/theme`} className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-2">{tk("setup.wizard.design.editor")}</Link>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-semibold tracking-tight">{tk(`setup.wizard.${current}.title`)}</h2>
                <p className="mt-1 mb-6 text-sm text-muted">{tk(`setup.wizard.${current}.body`)}</p>
                <StepBody step={current} slug={slug} defaults={defaults} actions={actions} upload={upload} aiEnabled={aiEnabled} currency={currency} onDone={() => advance(current)} />
                {current !== "design" && (
                  <button type="button" onClick={() => go(order.slice(order.indexOf(current) + 1)[0] ?? "finished")} className="mt-4 text-sm text-muted underline-offset-4 hover:text-text hover:underline">{tk("setup.wizard.skip")}</button>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function StepBody({ step, slug, defaults: d, actions, upload, aiEnabled, currency, onDone }: {
  step: StepKey; slug: string; defaults: Parameters<typeof SetupWizard>[0]["defaults"]; actions: Parameters<typeof SetupWizard>[0]["actions"];
  upload: (fd: FormData) => Promise<{ url?: string; error?: string }>; aiEnabled: boolean; currency: string; onDone: () => void;
}) {
  const t = useT();
  const tk = (k: string, v?: Record<string, string | number>) => t(k as MessageKey, v);
  const [bank, setBank] = useState(d.bank);
  const [image, setImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const submit = <SubmitButton className="mt-6">{tk("setup.wizard.saveContinue")}</SubmitButton>;

  switch (step) {
    case "business":
      return (
        <ActionForm action={actions.business} onSuccess={onDone} className="grid gap-4 sm:grid-cols-2">
          <Input name="legalName" label={tk("setup.business.legalName")} defaultValue={d.legalName} autoComplete="organization" required wrapperClassName="sm:col-span-2" />
          <Input name="vatNumber" label={tk("setup.business.vat")} hint={tk("setup.business.vatHint", { country: d.country })} defaultValue={d.vatNumber} required />
          <Input name="phone" type="tel" label={t("checkout.phone")} defaultValue={d.phone} autoComplete="tel" />
          <Input name="address1" label={t("checkout.address1")} defaultValue={d.address1} autoComplete="address-line1" required wrapperClassName="sm:col-span-2" />
          <Input name="zip" label={t("checkout.zip")} defaultValue={d.zip} autoComplete="postal-code" required />
          <Input name="city" label={t("checkout.city")} defaultValue={d.city} autoComplete="address-level2" required />
          <Input name="province" label={t("checkout.province")} defaultValue={d.province} autoComplete="address-level1" />
          <Input name="email" type="email" label={tk("setup.business.email")} hint={tk("setup.business.emailHint")} defaultValue={d.email} autoComplete="email" required />
          <div className="sm:col-span-2">{submit}</div>
        </ActionForm>
      );
    case "taxes":
      return (
        <ActionForm action={actions.taxes} onSuccess={onDone} className="space-y-4">
          <Input name="rate" inputMode="decimal" label={tk("setup.taxes.rate", { country: d.country })} hint={tk("setup.taxes.rateHint")} defaultValue={d.rate} required wrapperClassName="max-w-48" />
          <Checkbox name="taxesIncluded" label={tk("setup.taxes.included")} hint={tk("setup.taxes.includedHint")} defaultChecked={d.taxesIncluded} />
          <Checkbox name="taxShipping" label={tk("setup.taxes.shipping")} defaultChecked={d.taxShipping} />
          {submit}
        </ActionForm>
      );
    case "payments":
      return (
        <ActionForm action={actions.payments} onSuccess={onDone} className="space-y-4">
          <Checkbox name="cod" label={tk("setup.payments.cod")} hint={tk("setup.payments.codHint")} defaultChecked={d.cod} />
          <Checkbox name="bank" label={tk("setup.payments.bank")} hint={tk("setup.payments.bankHint")} checked={bank} onChange={(e) => setBank(e.target.checked)} />
          <AnimatePresence initial={false}>
            {bank && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease }} className="grid gap-4 overflow-hidden pl-7 sm:grid-cols-2">
                <Input name="holder" label={tk("setup.payments.holder")} autoComplete="organization" />
                <Input name="iban" label="IBAN" placeholder="IT60 X054 2811 1010 0000 0123 456" autoComplete="off" spellCheck={false} />
              </motion.div>
            )}
          </AnimatePresence>
          <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs text-muted">{tk("setup.payments.cards")} <Link href={`/admin/${slug}/settings/payments`} className="font-medium text-text underline">{tk("setup.payments.cardsLink")}</Link></p>
          {submit}
        </ActionForm>
      );
    case "shipping":
      return (
        <ActionForm action={actions.shipping} onSuccess={onDone} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input name="price" inputMode="decimal" label={tk("setup.shipping.price", { currency })} hint={tk("setup.shipping.priceHint")} defaultValue={d.shippingPrice} required />
            <Input name="freeOver" inputMode="decimal" label={tk("setup.shipping.freeOver", { currency })} hint={tk("setup.shipping.freeOverHint")} defaultValue={d.freeOver} />
          </div>
          <p className="text-xs text-muted">{tk("setup.shipping.more")} <Link href={`/admin/${slug}/settings/shipping`} className="underline">{t("nav.shipping")}</Link></p>
          {submit}
        </ActionForm>
      );
    case "legal":
      return (
        <ActionForm action={actions.legal} onSuccess={onDone}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {["privacy", "terms", "returns", "shipping"].map((p) => (
              <li key={p} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm"><FileText className="size-4 text-muted" aria-hidden />{tk(`setup.legal.${p}`)}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">{tk("setup.legal.note")}</p>
          <SubmitButton className="mt-6">{tk("setup.legal.create")}</SubmitButton>
        </ActionForm>
      );
    case "product":
      return (
        <div>
          {aiEnabled && (
            <Link href={`?assistant=build`} className="mb-5 flex items-center gap-3 rounded-xl border border-border p-4 text-sm transition-colors hover:border-text/40 hover:bg-surface-2">
              <Sparkles className="size-5 shrink-0" aria-hidden /><span><span className="block font-medium">{tk("ai.build.cardTitle")}</span><span className="text-muted">{tk("setup.product.ai")}</span></span>
            </Link>
          )}
          <ActionForm action={actions.product} onSuccess={onDone} className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <div className="space-y-4">
              <Input name="title" label={t("products.field.title")} required maxLength={150} />
              <div className="grid grid-cols-2 gap-4">
                <Input name="price" inputMode="decimal" label={`${t("products.field.price")} (${currency})`} required />
                <Input name="stock" type="number" min={0} label={tk("setup.product.stock")} defaultValue="10" />
              </div>
              <Textarea name="description" label={t("products.field.description")} rows={3} maxLength={5000} />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">{tk("setup.product.photo")}</p>
              <input type="hidden" name="imageUrl" value={image} />
              <label className="flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-border-strong bg-surface-2 text-xs text-muted hover:border-text">
                {image ? <img src={image} alt="" className="size-full object-cover" /> : uploading ? "…" : tk("editor.image.drop")}
                <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setUploading(true); setUploadError(null);
                  const fd = new FormData(); fd.append("file", f);
                  const res = await upload(fd);
                  setUploading(false);
                  if (res.url) setImage(res.url); else setUploadError(res.error ?? t("upload.failed"));
                }} />
              </label>
              {uploadError && <p className="mt-1 text-xs text-danger">{uploadError}</p>}
            </div>
            <div className="sm:col-span-2">{submit}</div>
          </ActionForm>
        </div>
      );
    case "design":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href={`/admin/${slug}/online-store/theme`} onClick={onDone} className="group rounded-xl border border-border p-4 transition-colors hover:border-text/40 hover:bg-surface-2">
            <Palette className="size-5" aria-hidden /><p className="mt-2 font-medium">{tk("setup.wizard.design.editor")}</p><p className="text-sm text-muted">{tk("setup.wizard.design.editorHint")}</p>
          </Link>
          {aiEnabled && (
            <Link href={`?assistant=build`} onClick={onDone} className="group rounded-xl border border-border p-4 transition-colors hover:border-text/40 hover:bg-surface-2">
              <Sparkles className="size-5" aria-hidden /><p className="mt-2 font-medium">{tk("ai.build.cardTitle")}</p><p className="text-sm text-muted">{tk("setup.wizard.design.aiHint")}</p>
            </Link>
          )}
        </div>
      );
  }
}
