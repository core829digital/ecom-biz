import Link from "next/link";
import { getPlatformT } from "@/lib/i18n/server";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/fields";
import { forgotPasswordAction } from "../actions";

export const metadata = { title: "Reset password" };

export default async function ForgotPasswordPage() {
  const { t } = await getPlatformT();
  return (
    <>
      <h1 className="mb-1 text-lg font-semibold">{t("auth.forgot.title")}</h1>
      <p className="mb-5 text-sm text-muted">{t("auth.forgot.subtitle")}</p>
      <ActionForm action={forgotPasswordAction} className="space-y-4">
        <Input name="email" type="email" label={t("field.email")} autoComplete="email" required />
        <SubmitButton className="w-full">{t("auth.forgot.submit")}</SubmitButton>
      </ActionForm>
      <p className="mt-5 text-center text-sm"><Link href="/login" className="text-muted hover:text-text">{t("common.back")}</Link></p>
    </>
  );
}
