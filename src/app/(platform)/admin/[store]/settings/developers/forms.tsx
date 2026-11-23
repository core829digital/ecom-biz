"use client";

import { useActionState, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { Input, Select } from "@/components/ui/fields";
import { buttonClass } from "@/components/ui/button";
import type { SecretState } from "./actions";

function SecretReveal({ secret, label }: { secret: string; label: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4 rounded-lg border border-warning/40 bg-warning-bg p-4 text-sm">
      <p className="mb-2 font-medium text-warning">{label}</p>
      <div className="flex gap-2">
        <code className="flex-1 break-all rounded bg-surface px-3 py-2 font-mono text-xs text-text" data-testid="secret">{secret}</code>
        <button type="button" className={buttonClass("secondary", "sm")} onClick={async () => { await navigator.clipboard.writeText(secret); setCopied(true); }}>
          {copied ? t("developers.copied") : t("developers.copy")}
        </button>
      </div>
    </div>
  );
}

export function TokenForm({ action, scopes }: { action: (s: SecretState, fd: FormData) => Promise<SecretState>; scopes: readonly string[] }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-4">
      <Input name="name" label={t("developers.tokenName")} placeholder={t("developers.tokenNamePlaceholder")} maxLength={60} required />
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t("developers.scopes")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {scopes.map((s) => (
            <label key={s} className="flex items-center gap-2 font-mono text-xs"><input type="checkbox" name="scopes" value={s} defaultChecked={s.startsWith("read_")} /> {s}</label>
          ))}
        </div>
      </fieldset>
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending} className={buttonClass("primary")}>{t("developers.createToken")}</button>
      {state?.secret && <SecretReveal secret={state.secret} label={t("developers.tokenOnce")} />}
    </form>
  );
}

export function WebhookForm({ action, topics }: { action: (s: SecretState, fd: FormData) => Promise<SecretState>; topics: readonly string[] }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
        <Select name="topic" label={t("developers.event")}>{topics.map((x) => <option key={x} value={x}>{x}</option>)}</Select>
        <Input name="url" type="url" label={t("developers.url")} placeholder="https://example.com/webhooks" required />
      </div>
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending} className={buttonClass("primary")}>{t("developers.addWebhook")}</button>
      {state?.secret && <SecretReveal secret={state.secret} label={t("developers.secretOnce")} />}
    </form>
  );
}
