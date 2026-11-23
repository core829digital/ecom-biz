import { loadStorefront } from "@/server/storefront";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/fields";
import { AuthShell } from "../../auth-shell";
import { customerSetPasswordAction } from "../../actions";

export const metadata = { robots: { index: false } };

export default async function CustomerReset({ params }: { params: Promise<{ site: string; token: string }> }) {
  const { site, token } = await params;
  const sf = await loadStorefront(site);
  return (
    <AuthShell title={sf.t("sf.account.setPassword")}>
      <ActionForm action={customerSetPasswordAction.bind(null, site, token)} className="space-y-4">
        <Input name="password" type="password" label={sf.t("field.newPassword")} autoComplete="new-password" hint={sf.t("validation.passwordLength")} required />
        <SubmitButton variant="brand" className="w-full rounded-full">{sf.t("sf.account.setPassword")}</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
