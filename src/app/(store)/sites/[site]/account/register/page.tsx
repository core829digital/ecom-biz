import Link from "next/link";
import { loadStorefront } from "@/server/storefront";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Checkbox, Input } from "@/components/ui/fields";
import { AuthShell } from "../auth-shell";
import { customerRegisterAction } from "../actions";

export const metadata = { robots: { index: false } };

export default async function CustomerRegister({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const sf = await loadStorefront(site);
  const { t } = sf;
  return (
    <AuthShell title={t("auth.signup")} subtitle={t("sf.account.registerHint")}>
      <ActionForm action={customerRegisterAction.bind(null, site)} resetOnSuccess className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input name="firstName" label={t("checkout.firstName")} autoComplete="given-name" />
          <Input name="lastName" label={t("checkout.lastName")} autoComplete="family-name" />
        </div>
        <Input name="email" type="email" label={t("field.email")} autoComplete="email" required />
        <Checkbox name="acceptsMarketing" label={t("checkout.marketing")} />
        <SubmitButton variant="brand" className="w-full rounded-full">{t("auth.signup")}</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm">{t("auth.signup.haveAccount")} <Link href={sf.href("/account/login")} className="underline">{t("auth.login")}</Link></p>
    </AuthShell>
  );
}
