"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { ActionForm, SubmitButton, useFieldError } from "@/components/ui/form";
import { Input, Select } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { handleize } from "@/lib/slug";
import { contrastText, THEME_PRESETS } from "@/lib/theme";
import { STARTER_IDS, type StarterId } from "@/lib/theme-starters";
import { createStoreAction } from "./actions";

type Labels = Record<
  "name" | "slug" | "email" | "country" | "currency" | "locale" | "submit" | "slugExample" | "continue" | "back" | "styleTitle" | "styleBody" | "lookTitle" | "homeTitle" | "styleHint",
  string
> & { starters: Record<StarterId, { name: string; body: string }> };

export function NewStoreForm(props: {
  /** Where the store will live, with "{slug}" as placeholder. */
  addressPattern: string;
  defaultEmail: string;
  defaultLocale: string;
  countries: { code: string; name: string }[];
  currencies: string[];
  defaultCountry: string;
  /** Suggested currency per country (applied until the merchant picks one). */
  currencyFor: Record<string, string>;
  locales: { value: string; label: string }[];
  labels: Labels;
}) {
  const [step, setStep] = useState<0 | 1>(0);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [country, setCountry] = useState(props.defaultCountry);
  const [currency, setCurrency] = useState(props.currencyFor[props.defaultCountry] ?? "EUR");
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const [preset, setPreset] = useState("minimal");
  const [starter, setStarter] = useState<StarterId>("classic");
  const details = useRef<HTMLDivElement>(null);
  const { labels } = props;

  const next = () => {
    const fields = details.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select") ?? [];
    for (const f of fields) if (!f.reportValidity()) return;
    setStep(1);
  };

  return (
    <ActionForm action={createStoreAction} className="space-y-4">
      <BackOnDetailsError onError={() => setStep(0)} />
      <input type="hidden" name="preset" value={preset} />
      <input type="hidden" name="starter" value={starter} />
      {/* Step 1 stays mounted (hidden) so its fields are submitted with step 2. */}
      <div ref={details} className={cn("space-y-4", step !== 0 && "hidden")}>
        <Input name="name" label={labels.name} value={name} required maxLength={80}
          onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(handleize(e.target.value).slice(0, 40)); }} />
        <Input name="slug" autoCapitalize="none" autoCorrect="off" spellCheck={false} label={labels.slug} value={slug} required
          onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()); }}
          hint={props.addressPattern.replace("{slug}", slug || labels.slugExample)} />
        <Input name="email" type="email" autoComplete="email" label={labels.email} defaultValue={props.defaultEmail} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select name="countryCode" autoComplete="country" label={labels.country} value={country} onChange={(e) => {
            setCountry(e.target.value);
            if (!currencyTouched) setCurrency(props.currencyFor[e.target.value] ?? "EUR");
          }}>
            {props.countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </Select>
          <Select name="currency" label={labels.currency} value={currency} onChange={(e) => { setCurrency(e.target.value); setCurrencyTouched(true); }}>
            {props.currencies.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
        <Select name="locale" label={labels.locale} defaultValue={props.defaultLocale}>
          {props.locales.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </Select>
        <Button className="w-full" onClick={next}>{labels.continue}</Button>
      </div>

      <AnimatePresence initial={false}>
        {step === 1 && (
          <motion.div key="style" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="space-y-6">
            <div>
              <p className="font-semibold">{labels.styleTitle}</p>
              <p className="mt-0.5 text-sm text-muted">{labels.styleBody}</p>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">{labels.lookTitle}</legend>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {THEME_PRESETS.map((p) => {
                  const active = preset === p.id;
                  return (
                    <button key={p.id} type="button" aria-pressed={active} onClick={() => setPreset(p.id)}
                      className={cn("overflow-hidden rounded-lg border text-left transition-all hover:-translate-y-0.5", active ? "border-text ring-1 ring-text" : "border-border")}>
                      <span className="block px-2.5 pb-2 pt-2.5" style={{ background: p.backgroundColor, color: p.textColor }}>
                        <span className="block text-sm font-semibold leading-none">Aa</span>
                        <span className="mt-2 inline-block px-1.5 py-0.5 text-[8px] font-semibold" style={{ background: p.primaryColor, color: contrastText(p.primaryColor), borderRadius: p.buttonShape === "pill" ? 999 : p.buttonShape === "rounded" ? 4 : 0 }}>Shop</span>
                      </span>
                      <span className="flex items-center justify-between bg-surface px-2 py-1 text-[10px] font-medium">{p.name}{active && <Check className="size-3" aria-hidden />}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">{labels.homeTitle}</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {STARTER_IDS.map((id) => {
                  const active = starter === id;
                  return (
                    <button key={id} type="button" aria-pressed={active} onClick={() => setStarter(id)}
                      className={cn("rounded-lg border p-3 text-left transition-all hover:-translate-y-0.5", active ? "border-text ring-1 ring-text" : "border-border")}>
                      <StarterSketch id={id} />
                      <span className="mt-2.5 block text-sm font-medium">{labels.starters[id].name}</span>
                      <span className="block text-xs text-muted">{labels.starters[id].body}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted">{labels.styleHint}</p>
            </fieldset>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep(0)}>{labels.back}</Button>
              <SubmitButton className="flex-1">{labels.submit}</SubmitButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </ActionForm>
  );
}

/** If the server rejects a field from step 1 (e.g. the address is taken), go back to show it. */
function BackOnDetailsError({ onError }: { onError: () => void }) {
  const name = useFieldError("name");
  const slug = useFieldError("slug");
  const email = useFieldError("email");
  const country = useFieldError("countryCode");
  const any = !!(name || slug || email || country);
  useEffect(() => { if (any) onError(); }, [any, onError]);
  return null;
}

/** Tiny wireframe of the starter homepage. */
function StarterSketch({ id }: { id: StarterId }) {
  const bar = "rounded-sm bg-surface-3";
  const rows: Record<StarterId, React.ReactNode> = {
    classic: <><span className={cn(bar, "h-6")} /><span className="grid grid-cols-4 gap-0.5">{[0, 1, 2, 3].map((i) => <span key={i} className={cn(bar, "h-1.5")} />)}</span><span className="grid grid-cols-4 gap-0.5">{[0, 1, 2, 3].map((i) => <span key={i} className={cn(bar, "h-3")} />)}</span><span className="grid grid-cols-2 gap-0.5"><span className={cn(bar, "h-3")} /><span className="h-3" /></span></>,
    editorial: <><span className="h-6 rounded-sm bg-text/70" /><span className={cn(bar, "mx-auto h-1.5 w-2/3")} /><span className="grid grid-cols-2 gap-0.5"><span className="h-3" /><span className={cn(bar, "h-3")} /></span><span className="grid grid-cols-4 gap-0.5">{[0, 1, 2, 3].map((i) => <span key={i} className={cn(bar, "h-3")} />)}</span></>,
    minimal: <><span className={cn(bar, "h-3")} /><span className="grid grid-cols-4 gap-0.5">{[0, 1, 2, 3].map((i) => <span key={i} className={cn(bar, "h-3")} />)}</span><span className="grid grid-cols-3 gap-0.5">{[0, 1, 2].map((i) => <span key={i} className={cn(bar, "h-2.5")} />)}</span></>,
  };
  return <span className="flex flex-col gap-1 rounded-md border border-border bg-surface p-1.5" aria-hidden>{rows[id]}</span>;
}
