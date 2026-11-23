import { getPlatformT } from "@/lib/i18n/server";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/fields";
import { resetPasswordAction } from "../../actions";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { t } = await getPlatformT();
  const { token } = await params;
  return (
    <>
      <h1 className="mb-5 text-lg font-semibold">{t("auth.reset.title")}</h1>
      <ActionForm action={resetPasswordAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <Input name="password" type="password" label={t("field.newPassword")} autoComplete="new-password" hint={t("validation.passwordLength")} required />
        <SubmitButton className="w-full">{t("auth.reset.submit")}</SubmitButton>
      </ActionForm>
    </>
  );
}
