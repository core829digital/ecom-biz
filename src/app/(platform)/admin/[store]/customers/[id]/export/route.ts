import { requireStoreAccess } from "@/lib/auth/staff";
import { exportCustomerData } from "@/server/gdpr";
import { audit } from "@/server/audit";

export const dynamic = "force-dynamic";

/** GDPR art. 15/20 on behalf of a shopper: the merchant downloads that customer's data. */
export async function GET(_: Request, { params }: { params: Promise<{ store: string; id: string }> }) {
  const { store: slug, id } = await params;
  const { store, user } = await requireStoreAccess(slug, "ADMIN");
  const data = await exportCustomerData(store.id, id);
  if (!data) return new Response("Not found", { status: 404 });
  await audit({ userId: user.id, storeId: store.id, action: "customer.data_export", target: id });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="customer-${id}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
