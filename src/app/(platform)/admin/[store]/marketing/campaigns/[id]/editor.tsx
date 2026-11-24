"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/fields";
import { Card } from "@/components/ui/primitives";
import { useT } from "@/components/i18n-provider";
import { bodyToHtml } from "@/lib/marketing-render";
import type { ActionState } from "@/lib/action";

type Msg = { subject: string; preheader: string; heading: string; body: string; ctaLabel: string; ctaUrl: string };

/** Campaign composer with a live inbox-style preview. */
export function CampaignEditor({ initial, action, audience, brandColor, storeName, disabledSend }: {
  initial: Msg; action: (s: ActionState, fd: FormData) => Promise<ActionState>; audience: number; brandColor: string; storeName: string; disabledSend: boolean;
}) {
  const t = useT();
  const [m, setM] = useState<Msg>(initial);
  const [scheduling, setScheduling] = useState(false);
  const [when, setWhen] = useState("");
  const set = (k: keyof Msg) => (e: { target: { value: string } }) => setM((p) => ({ ...p, [k]: e.target.value }));
  const at = when ? new Date(when).toISOString() : "";
  return (
    <ActionForm action={action} className="grid items-start gap-6 lg:grid-cols-[1fr_420px]">
      <div className="space-y-5">
        <Card>
          <div className="space-y-4">
            <Input name="subject" label={t("campaigns.field.subject")} value={m.subject} onChange={set("subject")} maxLength={150} required />
            <Input name="preheader" label={t("campaigns.field.preheader")} hint={t("campaigns.field.preheaderHint")} value={m.preheader} onChange={set("preheader")} maxLength={150} />
            <Input name="heading" label={t("campaigns.field.heading")} value={m.heading} onChange={set("heading")} maxLength={150} />
            <Textarea name="body" label={t("campaigns.field.body")} hint={t("campaigns.field.bodyHint")} rows={10} value={m.body} onChange={set("body")} maxLength={5000} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input name="ctaLabel" label={t("campaigns.field.ctaLabel")} value={m.ctaLabel} onChange={set("ctaLabel")} maxLength={40} />
              <Input name="ctaUrl" label={t("campaigns.field.ctaUrl")} placeholder="/collections/all" value={m.ctaUrl} onChange={set("ctaUrl")} maxLength={500} />
            </div>
          </div>
        </Card>
        <Card>
          <p className="text-sm text-muted">{audience === 1 ? t("campaigns.audienceOne") : t("campaigns.audience", { count: audience })}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <SubmitButton name="intent" value="save" variant="secondary">{t("common.save")}</SubmitButton>
            <SubmitButton name="intent" value="test" variant="secondary">{t("campaigns.sendTest")}</SubmitButton>
            <span className="flex-1" />
            {!scheduling && <button type="button" onClick={() => setScheduling(true)} disabled={disabledSend} className="h-10 rounded-lg px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-text disabled:opacity-40">{t("campaigns.schedule")}…</button>}
            <SubmitButton name="intent" value="send" disabled={disabledSend || audience === 0} onClick={(e) => { if (!window.confirm(t("campaigns.sendConfirm", { count: audience }))) e.preventDefault(); }}>{t("campaigns.sendNow")}</SubmitButton>
          </div>
          {scheduling && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 flex flex-wrap items-end gap-2 overflow-hidden">
              <Input type="datetime-local" label={t("campaigns.scheduleAt")} value={when} onChange={(e) => setWhen(e.target.value)} wrapperClassName="flex-1" />
              <input type="hidden" name="at" value={at} />
              <SubmitButton name="intent" value="schedule" disabled={!at || disabledSend}>{t("campaigns.schedule")}</SubmitButton>
            </motion.div>
          )}
        </Card>
      </div>
      <div className="lg:sticky lg:top-6">
        <p className="mb-2 text-sm font-medium">{t("campaigns.preview")}</p>
        <div className="overflow-hidden rounded-xl border border-border bg-[#f4f4f5] shadow-sm">
          <div className="border-b border-black/5 bg-white px-4 py-3 text-[13px] text-zinc-900">
            <p className="font-semibold">{storeName}</p>
            <p className="truncate"><span className="font-medium">{m.subject || "—"}</span> <span className="text-zinc-500">— {m.preheader}</span></p>
          </div>
          <div className="p-4">
            <div className="overflow-hidden rounded-lg bg-white text-zinc-900">
              <div className="h-1" style={{ background: brandColor }} />
              <div className="p-5 text-[14px]">
                <h2 className="mb-3 text-lg font-semibold">{m.heading || m.subject}</h2>
                {/* bodyToHtml escapes all text: only its own tags are produced. */}
                <div dangerouslySetInnerHTML={{ __html: bodyToHtml(m.body) }} />
                {m.ctaLabel && <span className="mt-2 inline-block rounded-lg px-4 py-2.5 text-sm font-semibold text-white" style={{ background: brandColor }}>{m.ctaLabel}</span>}
                <p className="mt-6 text-[11px] text-zinc-500">{t("marketing.email.unsubscribe")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ActionForm>
  );
}
