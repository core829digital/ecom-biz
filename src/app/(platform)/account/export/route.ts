import { getCurrentUser } from "@/lib/auth/staff";
import { rateLimit } from "@/lib/rate-limit";
import { exportUserData } from "@/server/gdpr";
import { audit } from "@/server/audit";

export const dynamic = "force-dynamic";

/** GDPR art. 15/20: the signed-in merchant downloads their personal data as JSON. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!(await rateLimit(`export:${user.id}`, 5, 3600))) return new Response("Too many requests", { status: 429 });
  const data = await exportUserData(user.id);
  await audit({ userId: user.id, action: "account.data_export" });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
