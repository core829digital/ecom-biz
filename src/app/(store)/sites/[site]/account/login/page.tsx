import Link from "next/link";
import { redirect } from "next/navigation";
import { loadStorefront } from "@/server/storefront";
import { getCurrentCustomer } from "@/lib/auth/customer";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/fields";
import { AuthShell } from "../auth-shell";
import { customerForgotAction, customerLoginAction } from "../actions";

export const metadata = { robots: { index: false } };

export default async function CustomerLogin({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ forgot?: string }> }) {
  const { site } = await params;
  const { forgot } = await searchParams;
  const sf = await loadStorefront(site);
  if (await getCurrentCustomer(sf.store.id)) redirect(sf.href("/account"));
  const { t } = sf;
  if (forgot) {
    return (
      <AuthShell title={t("auth.forgot.title")} subtitle={t("auth.forgot.subtitle")}>
        <ActionForm action={customerForgotAction.bind(null, site)} className="space-y-4">
          <Input name="email" type="email" label={t("field.email")} autoComplete="email" required />
          <SubmitButton variant="brand" className="w-full rounded-full">{t("auth.forgot.submit")}</SubmitButton>
        </ActionForm>
        <p className="mt-6 text-center text-sm"><Link href={sf.href("/account/login")} className="underline">{t("common.back")}</Link></p>
      </AuthShell>
    );
  }
  return (
    <AuthShell title={t("auth.login")}>
      <ActionForm action={customerLoginAction.bind(null, site)} className="space-y-4">
        <Input name="email" type="email" label={t("field.email")} autoComplete="email" required />
        <Input name="password" type="password" label={t("field.password")} autoComplete="current-password" required />
        <SubmitButton variant="brand" className="w-full rounded-full">{t("auth.login")}</SubmitButton>
      </ActionForm>
      <div className="mt-6 flex justify-between text-sm">
        <Link href={sf.href("/account/login?forgot=1")} className="text-muted underline">{t("auth.forgot.link")}</Link>
        <Link href={sf.href("/account/register")} className="underline">{t("auth.signup")}</Link>
      </div>
    </AuthShell>
  );
}
