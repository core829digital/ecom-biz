import Link from "next/link";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { Badge, Card, PageHeader, Stat } from "@/components/ui/primitives";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Textarea } from "@/components/ui/fields";
import { aiConfig } from "@/server/ai/provider";
import { usageToday } from "@/server/ai/assistant";
import { saveMemoryAction } from "./actions";

export default async function AssistantPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store, user } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const cfg = aiConfig();
  const [memory, usage, conversations] = await Promise.all([
    db.aiMemory.findUnique({ where: { storeId: store.id } }),
    usageToday(store.id),
    db.aiConversation.count({ where: { storeId: store.id } }),
  ]);
  const facts = Array.isArray(memory?.facts) ? (memory!.facts as string[]) : [];
  return (
    <>
      <PageHeader title={t("nav.assistant")} subtitle={t("ai.page.subtitle")}
        actions={cfg.enabled ? <Link href="?assistant=1" className="inline-flex h-8 items-center rounded-lg bg-accent px-3 text-sm font-medium text-accent-contrast">{t("ai.open")}</Link> : null} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label={t("ai.page.status")} value={cfg.enabled ? <Badge tone="success">{t("ai.page.connected")}</Badge> : <Badge tone="warning">{t("ai.page.notConnected")}</Badge>} hint={cfg.enabled ? `${cfg.provider} · ${cfg.model}` : undefined} />
        <Stat label={t("ai.page.today")} value={`${usage.used}/${usage.limit}`} hint={t("ai.page.todayHint")} />
        <Stat label={t("ai.page.conversations")} value={conversations} />
      </div>
      {!cfg.enabled && (
        <Card title={t("ai.off.title")} className="mb-6">
          <p className="text-sm text-muted">{user.isPlatformAdmin ? t("ai.setup.admin") : t("ai.off.body")}</p>
          {user.isPlatformAdmin && (
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
              <li>{t("ai.setup.step1")}</li>
              <li>{t("ai.setup.step2")}</li>
              <li>{t("ai.setup.step3")}</li>
            </ol>
          )}
        </Card>
      )}
      <Card title={t("ai.memory.title")}>
        <p className="mb-4 text-sm text-muted">{t("ai.memory.hint")}</p>
        <ActionForm action={saveMemoryAction.bind(null, slug)} className="space-y-4">
          <Textarea name="profile" label={t("ai.memory.profile")} hint={t("ai.memory.profileHint")} rows={5} maxLength={2000} defaultValue={memory?.profile ?? ""} />
          <Textarea name="facts" label={t("ai.memory.facts")} hint={t("ai.memory.factsHint")} rows={6} defaultValue={facts.join("\n")} />
          <SubmitButton>{t("common.save")}</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
