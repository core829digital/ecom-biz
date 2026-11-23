import { requireUser } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Input, Select } from "@/components/ui/fields";
import { Card } from "@/components/ui/primitives";
import { changePasswordAction, updateProfileAction } from "./actions";

export default async function ProfilePage() {
  const user = await requireUser();
  const { t } = await getPlatformT();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t("account.profile")}</h1>
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5">
        <span className="flex size-16 items-center justify-center rounded-full bg-accent text-xl font-semibold text-accent-contrast">
          {user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
        </span>
        <div>
          <p className="text-lg font-semibold">{user.name}</p>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
      </div>
      <Card title={t("account.details")}>
        <ActionForm action={updateProfileAction} className="space-y-4">
          <Input name="name" label={t("field.fullName")} defaultValue={user.name} autoComplete="name" required />
          <Input name="email" type="email" label={t("field.email")} defaultValue={user.email} autoComplete="email" required />
          <Input name="currentPassword" type="password" label={t("account.currentPassword")} hint={t("account.emailChangeHint")} autoComplete="current-password" />
          <Select name="locale" label={t("account.language")} defaultValue={user.locale}>
            {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}
          </Select>
          <div className="flex justify-end"><SubmitButton>{t("common.save")}</SubmitButton></div>
        </ActionForm>
      </Card>
      <Card title={t("account.password")}>
        <ActionForm action={changePasswordAction} resetOnSuccess className="space-y-4">
          <Input name="currentPassword" type="password" label={t("account.currentPassword")} autoComplete="current-password" required />
          <Input name="newPassword" type="password" label={t("field.newPassword")} hint={t("account.passwordHint")} autoComplete="new-password" required />
          <div className="flex justify-end"><SubmitButton>{t("auth.reset.submit")}</SubmitButton></div>
        </ActionForm>
      </Card>
    </div>
  );
}
