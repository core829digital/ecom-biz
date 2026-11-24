import { loadStorefront } from "@/server/storefront";
import { getCurrentCustomer } from "@/lib/auth/customer";
import { rateLimit } from "@/lib/rate-limit";
import { exportCustomerData } from "@/server/gdpr";

export const dynamic = "force-dynamic";

/** GDPR art. 15/20, self-service: the signed-in shopper downloads their data from this store. */
export async function GET(_: Request, { params }: { params: Promise<{ site: string }> }) {
  const sf = await loadStorefront((await params).site);
  const customer = await getCurrentCustomer(sf.store.id);
  if (!customer) return new Response("Unauthorized", { status: 401 });
  // Guest orders are matched by email: only a verified owner of the address may download them.
  if (!customer.emailVerifiedAt) return new Response(sf.t("sf.account.verify.required"), { status: 403 });
  if (!(await rateLimit(`sf-export:${customer.id}`, 5, 3600))) return new Response("Too many requests", { status: 429 });
  const data = await exportCustomerData(sf.store.id, customer.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="my-data.json"`, "Cache-Control": "no-store" },
  });
}
