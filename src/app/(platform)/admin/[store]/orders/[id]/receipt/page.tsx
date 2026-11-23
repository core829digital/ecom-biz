import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { Receipt } from "@/components/receipt";

export default async function AdminReceiptPage({ params }: { params: Promise<{ store: string; id: string }> }) {
  const { store: slug, id } = await params;
  const { store } = await requireStoreAccess(slug);
  const { t, locale } = await getPlatformT();
  const order = await db.order.findFirst({ where: { id, storeId: store.id }, include: { lines: { orderBy: { id: "asc" } } } });
  if (!order) notFound();
  return <Receipt store={store} order={order} lines={order.lines} t={t} locale={locale} backHref={`/admin/${slug}/orders/${order.id}`} />;
}
