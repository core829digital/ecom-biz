import { loadStorefront } from "@/server/storefront";
import { SimpleActionForm } from "@/components/storefront/simple-action";
import { AuthShell } from "../../auth-shell";
import { customerVerifyEmailAction } from "../../actions";

export const metadata = { robots: { index: false } };

/** Confirms the shopper's email. A button (POST) rather than a plain link, so mail scanners can't trigger it. */
export default async function CustomerVerify({ params }: { params: Promise<{ site: string; token: string }> }) {
  const { site, token } = await params;
  const sf = await loadStorefront(site);
  return (
    <AuthShell title={sf.t("sf.account.verify.title")} subtitle={sf.t("sf.account.verify.body")}>
      <SimpleActionForm action={customerVerifyEmailAction.bind(null, site, token)} submitLabel={sf.t("sf.account.verify.cta")}
        buttonClassName="inline-flex h-11 w-full items-center justify-center gap-2 rounded-btn bg-brand px-6 text-sm font-medium text-brand-contrast disabled:opacity-60" />
    </AuthShell>
  );
}
