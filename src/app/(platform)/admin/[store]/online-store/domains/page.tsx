import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { env } from "@/lib/env";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/fields";
import { addDomainAction, removeDomainAction, setPrimaryDomainAction, verifyDomainAction } from "./actions";

export default async function DomainsPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store, role } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const domains = await db.domain.findMany({ where: { storeId: store.id }, orderBy: { createdAt: "asc" } });
  const platformHost = env.storeAddress(store.slug);
  const target = process.env.CUSTOM_DOMAIN_TARGET || env.storefrontRootDomain.split(":")[0];
  const owner = role === "OWNER";
  return (
    <>
      <PageHeader back={<BackLink href={`/admin/${slug}/online-store`} label={t("nav.onlineStore")} />} title={t("nav.domains")} />
      <div className="space-y-5">
        <Card title={t("domains.platform")}>
          <p className="font-mono text-sm">{platformHost}</p>
          <p className="mt-1 text-xs text-muted">{domains.some((d) => d.isPrimary && d.verifiedAt) ? t("domains.redirectHint") : t("domains.primaryHint")}</p>
        </Card>
        {domains.map((d) => (
          <Card key={d.id} title={<span className="font-mono">{d.hostname}</span>} actions={d.verifiedAt ? <Badge tone={d.isPrimary ? "success" : "info"}>{d.isPrimary ? t("domains.primary") : t("domains.connected")}</Badge> : <Badge tone="warning">{t("domains.pending")}</Badge>}>
            {!d.verifiedAt && (
              <>
                <p className="mb-3 text-sm">{t("domains.instructions")}</p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface-2 text-xs text-muted"><tr><th className="px-3 py-2">{t("domains.type")}</th><th className="px-3 py-2">{t("domains.name")}</th><th className="px-3 py-2">{t("domains.value")}</th></tr></thead>
                    <tbody className="font-mono">
                      <tr className="border-t border-border"><td className="px-3 py-2">CNAME</td><td className="px-3 py-2">{d.hostname}</td><td className="px-3 py-2">{target}</td></tr>
                      <tr className="border-t border-border"><td className="px-3 py-2">TXT</td><td className="px-3 py-2">_commerce-verify.{d.hostname}</td><td className="break-all px-3 py-2">{d.verificationToken}</td></tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-muted">{t("domains.dnsDelay")}</p>
              </>
            )}
            {owner && (
              <div className="mt-4 flex flex-wrap gap-2">
                {!d.verifiedAt && <ActionForm action={verifyDomainAction.bind(null, slug, d.id)}><SubmitButton>{t("domains.verify")}</SubmitButton></ActionForm>}
                {d.verifiedAt && !d.isPrimary && <form action={setPrimaryDomainAction.bind(null, slug, d.id)}><ConfirmSubmit>{t("domains.makePrimary")}</ConfirmSubmit></form>}
                <form action={removeDomainAction.bind(null, slug, d.id)}><ConfirmSubmit variant="ghost" className="text-danger" confirmMessage={t("common.confirmDelete")}>{t("common.delete")}</ConfirmSubmit></form>
              </div>
            )}
          </Card>
        ))}
        {owner ? (
          <Card title={t("domains.connect")}>
            <ActionForm action={addDomainAction.bind(null, slug)} resetOnSuccess className="flex flex-wrap items-end gap-3">
              <Input name="hostname" inputMode="url" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={253} label={t("domains.hostname")} placeholder="shop.example.com" wrapperClassName="min-w-60 flex-1" required />
              <SubmitButton>{t("domains.add")}</SubmitButton>
            </ActionForm>
            <p className="mt-3 text-xs text-muted">{t("domains.sslHint")}</p>
          </Card>
        ) : <p className="text-sm text-muted">{t("settings.payments.ownerOnly")}</p>}
      </div>
    </>
  );
}
