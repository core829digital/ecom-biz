import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getPendingTwoFactorSession } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/fields";
import { verifyTwoFactorAction, logoutAction } from "../../actions";

export const metadata = { title: "Two-factor authentication" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await getPendingTwoFactorSession();
  if (!session) redirect("/login");
  const { t } = await getPlatformT();
  const { next } = await searchParams;
  return (
    <>
      <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-surface-2"><ShieldCheck className="size-5" aria-hidden /></span>
      <h1 className="mb-1 text-lg font-semibold">{t("security.verifyTitle")}</h1>
      <p className="mb-5 text-sm text-muted">{t("security.verifySubtitle")}</p>
      <ActionForm action={verifyTwoFactorAction} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <Input name="code" label={t("security.code")} inputMode="text" autoComplete="one-time-code" autoFocus required placeholder="123 456" className="text-center font-mono text-lg tracking-[0.3em]" hint={t("security.recoveryHint")} />
        <SubmitButton className="w-full">{t("security.verify")}</SubmitButton>
      </ActionForm>
      <form action={logoutAction} className="mt-4 text-center"><button className="text-sm text-muted hover:text-text">{t("common.cancel")}</button></form>
    </>
  );
}
