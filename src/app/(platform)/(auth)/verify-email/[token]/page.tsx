import { getPlatformT } from "@/lib/i18n/server";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { confirmEmailAction } from "../../actions";

export const metadata = { title: "Verify email", robots: { index: false } };

/**
 * The link only opens this page; the address is confirmed by a click (POST). Mail security
 * scanners pre-open links, and would otherwise use up the token before the person sees it.
 */
export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { t } = await getPlatformT();
  return (
    <>
      <h1 className="mb-1 text-lg font-semibold">{t("auth.verify.title")}</h1>
      <p className="mb-5 text-sm text-muted">{t("auth.verify.subtitle")}</p>
      <ActionForm action={confirmEmailAction.bind(null, token)}>
        <SubmitButton className="w-full">{t("auth.verify.submit")}</SubmitButton>
      </ActionForm>
    </>
  );
}
