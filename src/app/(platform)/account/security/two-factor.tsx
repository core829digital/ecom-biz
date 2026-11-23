"use client";

import { useActionState, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, Download, ShieldCheck, ShieldOff } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/fields";
import { toast } from "@/components/ui/toast";
import { beginEnrollAction, confirmEnrollAction, disableTwoFactorAction, regenerateRecoveryCodesAction, type EnrollState } from "./actions";

function RecoveryCodes({ codes }: { codes: string[] }) {
  const t = useT();
  const text = codes.join("\n");
  return (
    <div className="mt-4 rounded-xl border border-warning/40 bg-warning-bg p-4">
      <p className="text-sm font-medium text-warning">{t("security.recoveryOnce")}</p>
      <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm">{codes.map((c) => <li key={c} className="rounded bg-surface px-2 py-1 text-center">{c}</li>)}</ul>
      <div className="mt-3 flex gap-2">
        <button type="button" className={buttonClass("secondary", "sm")} onClick={async () => { await navigator.clipboard.writeText(text); toast(t("developers.copied")); }}><Copy className="size-4" /> {t("developers.copy")}</button>
        <a className={buttonClass("secondary", "sm")} href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`} download="recovery-codes.txt"><Download className="size-4" /> {t("security.download")}</a>
      </div>
    </div>
  );
}

export function TwoFactor({ enabled, remaining }: { enabled: boolean; remaining: number }) {
  const t = useT();
  const [enroll, setEnroll] = useState<EnrollState>(null);
  const [pending, start] = useTransition();
  const [confirmState, confirm, confirming] = useActionState(confirmEnrollAction, null);
  const [disableState, disable, disabling] = useActionState(disableTwoFactorAction, null);
  const [regenState, regen, regenerating] = useActionState(regenerateRecoveryCodesAction, null);

  if (confirmState?.codes) {
    return (
      <div>
        <p className="flex items-center gap-2 font-medium text-success"><ShieldCheck className="size-5" aria-hidden /> {t("security.enabled")}</p>
        <RecoveryCodes codes={confirmState.codes} />
      </div>
    );
  }

  if (enabled && !disableState?.done) {
    return (
      <div className="space-y-5">
        <p className="flex items-center gap-2 font-medium text-success"><ShieldCheck className="size-5" aria-hidden /> {t("security.enabled")}</p>
        <p className="text-sm text-muted">{t("security.remaining", { count: remaining })}</p>
        <form action={regen} className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium">{t("security.regenerate")}</span>
            <input name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className={`${inputClass} w-36 font-mono`} required />
          </label>
          <button disabled={regenerating} className={buttonClass("secondary")}>{t("security.regenerateCta")}</button>
        </form>
        {regenState?.error && <p className="text-sm text-danger">{regenState.error}</p>}
        {regenState?.codes && <RecoveryCodes codes={regenState.codes} />}
        <details className="rounded-xl border border-border p-4">
          <summary className="cursor-pointer text-sm font-medium text-danger">{t("security.disable")}</summary>
          <form action={disable} className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
            <label className="text-sm"><span className="mb-1 block">{t("field.password")}</span><input name="password" type="password" autoComplete="current-password" className={inputClass} required /></label>
            <label className="text-sm"><span className="mb-1 block">{t("security.code")}</span><input name="code" inputMode="numeric" autoComplete="one-time-code" className={`${inputClass} font-mono`} required /></label>
            <button disabled={disabling} className={buttonClass("danger")}><ShieldOff className="size-4" /> {t("security.disableCta")}</button>
          </form>
          {disableState?.error && <p className="mt-2 text-sm text-danger">{disableState.error}</p>}
        </details>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted">{t("security.intro")}</p>
      <AnimatePresence mode="wait">
        {!enroll?.qr ? (
          <motion.div key="start" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" disabled={pending} onClick={() => start(async () => setEnroll(await beginEnrollAction()))} className={`${buttonClass("primary")} mt-4`}>
              <ShieldCheck className="size-4" /> {t("security.enable")}
            </button>
          </motion.div>
        ) : (
          <motion.div key="enroll" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 grid gap-6 sm:grid-cols-[180px_1fr]">
            <img src={enroll.qr} alt={t("security.qrAlt")} className="size-44 rounded-xl border border-border bg-white p-2" />
            <div className="space-y-4 text-sm">
              <ol className="list-decimal space-y-1 pl-5 text-muted">
                <li>{t("security.step1")}</li>
                <li>{t("security.step2")}</li>
              </ol>
              <p>{t("security.manualKey")} <code className="mt-1 block break-all rounded bg-surface-2 px-2 py-1 font-mono text-xs" data-testid="totp-secret">{enroll.secret}</code></p>
              <form action={confirm} className="flex flex-wrap items-end gap-2">
                <label><span className="mb-1 block font-medium">{t("security.code")}</span><input name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className={`${inputClass} w-36 font-mono`} required autoFocus /></label>
                <button disabled={confirming} className={buttonClass("primary")}>{t("security.verify")}</button>
              </form>
              {confirmState?.error && <p className="text-danger">{confirmState.error}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
