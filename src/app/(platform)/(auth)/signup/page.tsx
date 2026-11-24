import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { ActionForm, FieldError, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/fields";
import { signupAction } from "../actions";

export const metadata = { title: "Sign up" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string; email?: string }> }) {
  if (await getCurrentUser()) redirect("/admin");
  const { t } = await getPlatformT();
  const { next, email } = await searchParams;
  return (
    <>
      <h1 className="mb-1 text-lg font-semibold">{t("auth.signup.title")}</h1>
      <p className="mb-5 text-sm text-muted">{t("auth.signup.subtitle")}</p>
      <ActionForm action={signupAction} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <Input name="name" label={t("field.fullName")} autoComplete="name" required />
        <Input name="email" type="email" label={t("field.email")} autoComplete="email" defaultValue={email} required />
        <Input name="password" type="password" label={t("field.password")} autoComplete="new-password" hint={t("validation.passwordHint")} required />
        <div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="acceptTerms" required className="mt-1" />
            <span>
              {/* One sentence per language with link placeholders, so each language keeps its own grammar. */}
              {t("legal.accept.sentence").split(/(\{\w+\})/).map((part, i) => {
                const m = part.match(/^\{(terms|subscriptions|dpa|privacy)\}$/);
                if (!m) return part;
                const key = m[1] as "terms" | "subscriptions" | "dpa" | "privacy";
                return <Link key={i} href={`/legal/${key}`} target="_blank" className="font-medium underline">{t(`legal.${key}`)}</Link>;
              })}
            </span>
          </label>
          <FieldError name="acceptTerms" />
        </div>
        <SubmitButton className="w-full">{t("auth.signup")}</SubmitButton>
      </ActionForm>
      <p className="mt-5 text-center text-sm text-muted">
        {t("auth.signup.haveAccount")} <Link href="/login" className="font-medium text-text hover:underline">{t("auth.login")}</Link>
      </p>
    </>
  );
}
