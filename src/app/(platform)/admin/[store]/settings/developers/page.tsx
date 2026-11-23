import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { env } from "@/lib/env";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { ConfirmSubmit } from "@/components/ui/form";
import { API_SCOPES } from "@/server/api";
import { WEBHOOK_TOPICS } from "@/server/webhooks";
import { TokenForm, WebhookForm } from "./forms";
import { createTokenAction, createWebhookAction, deleteWebhookAction, revokeTokenAction, testWebhookAction } from "./actions";

const ENDPOINTS: [string, string, string][] = [
  ["GET", "/api/v1/shop", "—"],
  ["GET · POST", "/api/v1/products", "read_products · write_products"],
  ["GET · PATCH · DELETE", "/api/v1/products/{id}", "read_products · write_products"],
  ["GET · POST", "/api/v1/inventory", "read_inventory · write_inventory"],
  ["GET", "/api/v1/orders", "read_orders"],
  ["GET", "/api/v1/orders/{id|number}", "read_orders"],
  ["POST", "/api/v1/orders/{id}/fulfillments", "write_orders"],
  ["GET · POST", "/api/v1/customers", "read_customers · write_customers"],
  ["GET", "/api/v1/customers/{id}", "read_customers"],
];

export default async function DevelopersPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t, locale } = await getPlatformT();
  const [tokens, hooks] = await Promise.all([
    db.apiToken.findMany({ where: { storeId: store.id }, orderBy: { createdAt: "desc" } }),
    db.webhookSubscription.findMany({ where: { storeId: store.id }, orderBy: { createdAt: "desc" }, include: { deliveries: { orderBy: { createdAt: "desc" }, take: 5 } } }),
  ]);
  const date = new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: store.timezone });
  return (
    <>
      <PageHeader back={<BackLink href={`/admin/${slug}/settings`} label={t("nav.settings")} />} title={t("nav.developers")} subtitle={t("developers.subtitle")} />
      <div className="space-y-5">
        <Card title={t("developers.tokens")}>
          {tokens.length > 0 && (
            <ul className="mb-5 divide-y divide-border">
              {tokens.map((tk) => (
                <li key={tk.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <span className="flex-1">
                    <span className="block font-medium">{tk.name} <code className="ml-1 text-xs text-muted">sk_{tk.prefix}_…</code></span>
                    <span className="text-xs text-muted">{tk.scopes.join(", ")} · {tk.lastUsedAt ? t("developers.lastUsed", { date: date.format(tk.lastUsedAt) }) : t("developers.neverUsed")}</span>
                  </span>
                  <form action={revokeTokenAction.bind(null, slug, tk.id)}><ConfirmSubmit variant="ghost" className="text-danger" confirmMessage={t("developers.revokeConfirm")}>{t("staff.revoke")}</ConfirmSubmit></form>
                </li>
              ))}
            </ul>
          )}
          <TokenForm action={createTokenAction.bind(null, slug)} scopes={API_SCOPES} />
        </Card>

        <Card title={t("developers.webhooks")}>
          <p className="mb-4 text-sm text-muted">{t("developers.webhooksHint")}</p>
          {hooks.length > 0 && (
            <ul className="mb-5 space-y-4">
              {hooks.map((h) => (
                <li key={h.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="info">{h.topic}</Badge>
                    <span className="min-w-0 flex-1 break-all font-mono text-xs">{h.url}</span>
                    <form action={testWebhookAction.bind(null, slug, h.id)}><ConfirmSubmit>{t("developers.sendTest")}</ConfirmSubmit></form>
                    <form action={deleteWebhookAction.bind(null, slug, h.id)}><ConfirmSubmit variant="ghost" className="text-danger" confirmMessage={t("common.confirmDelete")}>{t("common.delete")}</ConfirmSubmit></form>
                  </div>
                  {h.deliveries.length > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-border pt-2 text-xs">
                      {h.deliveries.map((d) => (
                        <li key={d.id} className="flex flex-wrap gap-2">
                          <Badge tone={d.success ? "success" : d.nextAttemptAt ? "warning" : "danger"}>{d.success ? t("developers.delivered") : d.nextAttemptAt ? t("developers.retrying") : t("developers.failed")}</Badge>
                          <span className="text-muted">{date.format(d.createdAt)} · {t("developers.attempts", { count: d.attempts })}{d.statusCode ? ` · HTTP ${d.statusCode}` : ""}</span>
                          {d.error && <span className="text-danger">{d.error}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
          <WebhookForm action={createWebhookAction.bind(null, slug)} topics={WEBHOOK_TOPICS} />
        </Card>

        <Card title={t("developers.reference")}>
          <p className="mb-3 text-sm">{t("developers.referenceHint")}</p>
          <pre className="mb-4 overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs"><code>{`curl ${env.appUrl}/api/v1/products \\\n  -H "Authorization: Bearer sk_…"`}</code></pre>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <tbody>
                {ENDPOINTS.map(([m, path, scope]) => (
                  <tr key={path} className="border-t border-border"><td className="py-2 pr-3 font-medium">{m}</td><td className="py-2 pr-3 font-mono">{path}</td><td className="py-2 text-muted">{scope}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted">{t("developers.signatureHint")}</p>
        </Card>
      </div>
    </>
  );
}
