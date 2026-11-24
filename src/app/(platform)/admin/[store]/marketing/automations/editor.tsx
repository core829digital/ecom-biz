"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Checkbox, Input, Textarea } from "@/components/ui/fields";
import { useT } from "@/components/i18n-provider";
import type { ActionState } from "@/lib/action";

type Step = { delayHours: number; subject: string; preheader: string; heading: string; body: string; ctaLabel: string; ctaUrl: string };

/** Editor of one automation: on/off and up to five timed emails. */
export function AutomationEditor({ initialSteps, enabled, action, defaults }: { initialSteps: Step[]; enabled: boolean; action: (s: ActionState, fd: FormData) => Promise<ActionState>; defaults: Step }) {
  const t = useT();
  const [steps, setSteps] = useState<Step[]>(initialSteps);
  const update = (i: number, patch: Partial<Step>) => setSteps((s) => s.map((x, n) => (n === i ? { ...x, ...patch } : x)));
  return (
    <ActionForm action={action} className="space-y-4">
      <input type="hidden" name="steps" value={JSON.stringify(steps)} />
      <Checkbox name="enabled" label={t("automations.enabled")} defaultChecked={enabled} />
      <ol className="space-y-3">
        <AnimatePresence initial={false}>
          {steps.map((s, i) => (
            <motion.li key={i} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="relative rounded-lg border border-border bg-surface p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-text text-xs font-semibold text-bg">{i + 1}</span>
                <p className="flex-1 text-sm font-semibold">{t("automations.step", { n: i + 1 })}</p>
                <button type="button" onClick={() => setSteps((x) => x.filter((_, n) => n !== i))} className="flex items-center gap-1 text-xs text-danger hover:underline"><Trash2 className="size-3.5" aria-hidden />{t("automations.removeStep")}</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                <Input type="number" min={0} max={1440} label={t("automations.delay")} hint={t("automations.delayHint")} value={String(s.delayHours)} onChange={(e) => update(i, { delayHours: Math.max(0, Math.min(1440, parseInt(e.target.value || "0", 10) || 0)) })} />
                <Input label={t("campaigns.field.subject")} value={s.subject} maxLength={150} onChange={(e) => update(i, { subject: e.target.value })} required />
              </div>
              <div className="mt-3 space-y-3">
                <Input label={t("campaigns.field.heading")} value={s.heading} maxLength={150} onChange={(e) => update(i, { heading: e.target.value })} />
                <Textarea label={t("campaigns.field.body")} hint={t("campaigns.field.bodyHint")} rows={4} value={s.body} maxLength={5000} onChange={(e) => update(i, { body: e.target.value })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label={t("campaigns.field.ctaLabel")} value={s.ctaLabel} maxLength={40} onChange={(e) => update(i, { ctaLabel: e.target.value })} />
                  <Input label={t("campaigns.field.ctaUrl")} value={s.ctaUrl} maxLength={500} placeholder="/collections/all" onChange={(e) => update(i, { ctaUrl: e.target.value })} />
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      {steps.length < 5 && (
        <button type="button" onClick={() => setSteps((x) => [...x, { ...defaults, delayHours: x.length ? 72 : 0 }])} className="group flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong text-sm font-medium text-muted hover:border-text hover:text-text">
          <Plus className="size-4 transition-transform duration-300 group-hover:rotate-90" aria-hidden />{t("automations.addStep")}
        </button>
      )}
      <SubmitButton>{t("common.save")}</SubmitButton>
    </ActionForm>
  );
}
