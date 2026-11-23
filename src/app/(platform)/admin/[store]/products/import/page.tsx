import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { Card, PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { PRODUCT_CSV_HEADERS } from "@/server/product-csv";
import { ImportForm } from "./form";

export default async function ImportPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  return (
    <>
      <PageHeader back={<BackLink href={`/admin/${slug}/products`} label={t("nav.products")} />} title={t("products.import")} />
      <Card>
        <p className="mb-4 text-sm text-muted">{t("import.help")}</p>
        <ImportForm slug={slug} />
        <details className="mt-6 text-sm">
          <summary className="cursor-pointer text-muted">{t("import.columns")}</summary>
          <code className="mt-2 block break-words rounded-lg bg-surface-2 p-3 text-xs">{PRODUCT_CSV_HEADERS.join(", ")}</code>
        </details>
      </Card>
    </>
  );
}
