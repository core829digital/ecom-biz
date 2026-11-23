import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { getCurrentUser } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { LinkButton } from "@/components/ui/button";
import { logoutAction } from "../../(auth)/actions";

export const metadata = { title: "Invitation" };

async function acceptInvite(token: string) {
  "use server";
  const user = await getCurrentUser();
  const invite = await db.staffInvite.findUnique({ where: { tokenHash: sha256(token) }, include: { store: true } });
  if (!user || !invite || invite.acceptedAt || invite.expiresAt < new Date() || invite.email !== user.email) redirect(`/invite/${token}`);
  await db.$transaction([
    db.membership.upsert({
      where: { userId_storeId: { userId: user.id, storeId: invite.storeId } },
      create: { userId: user.id, storeId: invite.storeId, role: invite.role },
      update: {},
    }),
    db.staffInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
  ]);
  redirect(`/admin/${invite.store.slug}`);
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { t } = await getPlatformT();
  const invite = await db.staffInvite.findUnique({ where: { tokenHash: sha256(token) }, include: { store: { select: { name: true } } } });
  const user = await getCurrentUser();
  const valid = invite && !invite.acceptedAt && invite.expiresAt > new Date();
  const next = encodeURIComponent(`/invite/${token}`);
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 text-center shadow-sm">
        {!valid ? (
          <>
            <h1 className="text-lg font-semibold">{t("staff.inviteInvalidTitle")}</h1>
            <p className="mt-2 text-sm text-muted">{t("staff.inviteInvalid")}</p>
            <LinkButton href={user ? "/admin" : "/login"} variant="secondary" className="mt-5 w-full">{user ? t("nav.allStores") : t("auth.login")}</LinkButton>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold">{t("staff.inviteTitle", { store: invite.store.name })}</h1>
            <p className="mt-2 text-sm text-muted">{t("staff.inviteFor", { email: invite.email, role: t(`role.${invite.role}`) })}</p>
            {!user ? (
              <div className="mt-6 flex flex-col gap-2">
                <LinkButton href={`/signup?next=${next}&email=${encodeURIComponent(invite.email)}`}>{t("auth.signup")}</LinkButton>
                <LinkButton href={`/login?next=${next}`} variant="secondary">{t("auth.login")}</LinkButton>
              </div>
            ) : user.email !== invite.email ? (
              <div className="mt-6 space-y-3 text-sm">
                <p className="text-danger">{t("staff.wrongAccount", { email: user.email })}</p>
                <form action={logoutAction}><button className="underline">{t("auth.logout")}</button></form>
              </div>
            ) : (
              <form action={acceptInvite.bind(null, token)} className="mt-6">
                <button className="h-10 w-full rounded-lg bg-accent text-sm font-medium text-accent-contrast">{t("staff.accept")}</button>
              </form>
            )}
          </>
        )}
        <Link href="/admin" className="mt-6 block text-xs text-muted hover:text-text">{t("nav.allStores")}</Link>
      </div>
    </main>
  );
}
