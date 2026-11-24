import { loadStorefront } from "@/server/storefront";
import { SimpleActionForm } from "@/components/storefront/simple-action";
import { confirmNewsletterAction } from "../../actions";

export const metadata = { robots: { index: false } };

/** Opened from an email: one explicit click (link scanners must not confirm on the person's behalf). */
export default async function Page({ params }: { params: Promise<{ site: string; token: string }> }) {
  const { site, token } = await params;
  const sf = await loadStorefront(site);
  const { t } = sf;
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{t("sf.newsletter.confirm.title")}</h1>
      <p className="mt-2 text-muted">{t("sf.newsletter.confirm.body", { store: sf.store.name })}</p>
      <div className="mt-8 flex justify-center">
        <SimpleActionForm action={confirmNewsletterAction.bind(null, site, token)} submitLabel={t("sf.newsletter.confirm.cta")} />
      </div>
    </div>
  );
}
