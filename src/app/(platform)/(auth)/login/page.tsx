import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getPendingTwoFactorSession } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/fields";
import { loginAction } from "../actions";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/admin");
  if (await getPendingTwoFactorSession()) redirect("/login/verify");
  const { t } = await getPlatformT();
  const { next } = await searchParams;
  return (
    <>
      <h1 className="mb-1 text-lg font-semibold">{t("auth.login.title")}</h1>
      <p className="mb-5 text-sm text-muted">{t("auth.login.subtitle")}</p>
      <ActionForm action={loginAction} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <Input name="email" type="email" label={t("field.email")} autoComplete="email" required />
        <Input name="password" type="password" label={t("field.password")} autoComplete="current-password" required />
        <SubmitButton className="w-full">{t("auth.login")}</SubmitButton>
      </ActionForm>
      <div className="mt-5 flex justify-between text-sm">
        <Link href="/forgot-password" className="text-muted hover:text-text">{t("auth.forgot.link")}</Link>
        <Link href="/signup" className="font-medium hover:underline">{t("auth.signup")}</Link>
      </div>
    </>
  );
}
