import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/ui/form";
import { Input, Select } from "@/components/ui/fields";
import { changeRoleAction, inviteStaffAction, removeMemberAction, revokeInviteAction } from "./actions";

export default async function StaffSettings({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store, role, user } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const [members, invites] = await Promise.all([
    db.membership.findMany({ where: { storeId: store.id }, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
    db.staffInvite.findMany({ where: { storeId: store.id, acceptedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <>
      <PageHeader back={<BackLink href={`/admin/${slug}/settings`} label={t("nav.settings")} />} title={t("nav.staff")} />
      <div className="space-y-5">
        <Card title={t("staff.members", { count: members.length })}>
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <span className="flex-1"><span className="block font-medium">{m.user.name}{m.userId === user.id && <span className="text-muted"> ({t("staff.you")})</span>}</span><span className="text-muted">{m.user.email}</span></span>
                {role === "OWNER" && m.role !== "OWNER" ? (
                  <form action={changeRoleAction.bind(null, slug, m.id)} className="flex items-center gap-2">
                    <select name="role" defaultValue={m.role} aria-label={t("staff.role")} className="h-8 rounded-md border border-border bg-surface px-2 text-sm">
                      <option value="ADMIN">{t("role.ADMIN")}</option>
                      <option value="STAFF">{t("role.STAFF")}</option>
                    </select>
                    <button className="text-sm underline">{t("common.save")}</button>
                  </form>
                ) : <Badge>{t(`role.${m.role}`)}</Badge>}
                {m.role !== "OWNER" && m.userId !== user.id && (role === "OWNER" || m.role === "STAFF") && (
                  <form action={removeMemberAction.bind(null, slug, m.id)}><ConfirmSubmit variant="ghost" className="text-danger" confirmMessage={t("staff.removeConfirm")}>{t("staff.remove")}</ConfirmSubmit></form>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">{t("staff.rolesHint")}</p>
        </Card>
        {invites.length > 0 && (
          <Card title={t("staff.pending")}>
            <ul className="divide-y divide-border">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="flex-1">{i.email}</span>
                  <Badge>{t(`role.${i.role}`)}</Badge>
                  <form action={revokeInviteAction.bind(null, slug, i.id)}><button className="text-sm text-danger hover:underline">{t("staff.revoke")}</button></form>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Card title={t("staff.invite")}>
          <ActionForm action={inviteStaffAction.bind(null, slug)} resetOnSuccess className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
            <Input name="email" type="email" label={t("field.email")} autoComplete="off" spellCheck={false} required />
            <Select name="role" label={t("staff.role")} defaultValue="STAFF">
              <option value="STAFF">{t("role.STAFF")}</option>
              <option value="ADMIN">{t("role.ADMIN")}</option>
            </Select>
            <SubmitButton>{t("staff.send")}</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
