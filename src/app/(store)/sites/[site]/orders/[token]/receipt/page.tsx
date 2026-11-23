import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { loadStorefront } from "@/server/storefront";
import { Receipt } from "@/components/receipt";

export const metadata = { robots: { index: false } };

export default async function StoreReceiptPage({ params }: { params: Promise<{ site: string; token: string }> }) {
  const { site, token } = await params;
  const sf = await loadStorefront(site);
  const order = await db.order.findFirst({ where: { statusToken: token, storeId: sf.store.id }, include: { lines: { orderBy: { id: "asc" } } } });
  if (!order) notFound();
  return <Receipt store={sf.store} order={order} lines={order.lines} t={sf.t} locale={sf.locale} backHref={sf.href(`/orders/${token}`)} />;
}
