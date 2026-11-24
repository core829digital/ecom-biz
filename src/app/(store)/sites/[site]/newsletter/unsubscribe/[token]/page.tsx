import { loadStorefront } from "@/server/storefront";
import { SimpleActionForm } from "@/components/storefront/simple-action";
import { unsubscribeNewsletterAction } from "../../actions";

export const metadata = { robots: { index: false } };

/** Opened from an email: one explicit click (link scanners must not unsubscribe on the person's behalf). */
export default async function Page({ params }: { params: Promise<{ site: string; token: string }> }) {
  const { site, token } = await params;
  const sf = await loadStorefront(site);
  const { t } = sf;
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{t("sf.newsletter.unsubscribe.title")}</h1>
      <p className="mt-2 text-muted">{t("sf.newsletter.unsubscribe.body", { store: sf.store.name })}</p>
      <div className="mt-8 flex justify-center">
        <SimpleActionForm action={unsubscribeNewsletterAction.bind(null, site, token)} submitLabel={t("sf.newsletter.unsubscribe.cta")} />
      </div>
    </div>
  );
}
