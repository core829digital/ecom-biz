import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadStorefront } from "@/server/storefront";
import { SimpleActionForm } from "@/components/storefront/simple-action";
import { sendContactAction } from "./actions";

export async function generateMetadata({ params }: { params: Promise<{ site: string }> }): Promise<Metadata> {
  const sf = await loadStorefront((await params).site);
  return { title: sf.t("sf.contact.title"), alternates: { canonical: "/contact" } };
}

export default async function ContactPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const sf = await loadStorefront(site);
  const { t, store } = sf;
  if (!store.contactEnabled) notFound();
  const field = "h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-text";
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1fr_1.4fr]">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("sf.contact.title")}</h1>
        <p className="mt-3 text-muted">{t("sf.contact.intro")}</p>
        <dl className="mt-8 space-y-4 text-sm">
          <div><dt className="font-medium">{t("field.email")}</dt><dd className="text-muted"><a href={`mailto:${store.email}`} className="hover:underline">{store.email}</a></dd></div>
          {store.phone && <div><dt className="font-medium">{t("checkout.phone")}</dt><dd className="text-muted"><a href={`tel:${store.phone.replace(/\s/g, "")}`} className="hover:underline">{store.phone}</a></dd></div>}
          {(store.address1 || store.city) && <div><dt className="font-medium">{t("sf.contact.address")}</dt><dd className="text-muted">{[store.legalName || store.name, store.address1, [store.zip, store.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</dd></div>}
        </dl>
      </div>
      <SimpleActionForm action={sendContactAction.bind(null, site)} submitLabel={t("sf.contact.send")} className="space-y-4">
        {/* Anti-spam: hidden honeypot and the time the form was rendered. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        <input type="hidden" name="startedAt" value={Date.now()} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm"><span className="mb-1 block font-medium">{t("sf.reviews.name")}</span><input name="name" required maxLength={100} autoComplete="name" className={field} /></label>
          <label className="block text-sm"><span className="mb-1 block font-medium">{t("field.email")}</span><input name="email" type="email" required maxLength={200} autoComplete="email" className={field} /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <label className="block text-sm"><span className="mb-1 block font-medium">{t("sf.contact.subject")}</span><input name="subject" maxLength={150} className={field} /></label>
          <label className="block text-sm"><span className="mb-1 block font-medium">{t("sf.contact.order")}</span><input name="orderRef" maxLength={30} inputMode="numeric" autoComplete="off" className={field} /></label>
        </div>
        <label className="block text-sm"><span className="mb-1 block font-medium">{t("sf.contact.message")}</span><textarea name="message" required minLength={10} maxLength={5000} rows={6} className="w-full rounded-lg border border-border bg-bg p-3 text-sm outline-none focus:border-text" /></label>
        <p className="text-xs text-muted">{t("sf.contact.privacy")}</p>
      </SimpleActionForm>
    </div>
  );
}
