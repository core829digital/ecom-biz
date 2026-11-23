import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { loadStorefront } from "@/server/storefront";
import { getCurrentCustomer } from "@/lib/auth/customer";
import { countryName, countryOptions } from "@/lib/geo";
import { formatAddressLines } from "@/lib/address";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Checkbox, Input, Select } from "@/components/ui/fields";
import { deleteAddressAction, saveAddressAction } from "../actions";

export const metadata = { robots: { index: false } };

export default async function AddressesPage({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { site } = await params;
  const { edit } = await searchParams;
  const sf = await loadStorefront(site);
  const { t } = sf;
  const customer = await getCurrentCustomer(sf.store.id);
  if (!customer) redirect(sf.href("/account/login"));
  const addresses = await db.customerAddress.findMany({ where: { customerId: customer.id }, orderBy: [{ isDefault: "desc" }, { id: "asc" }] });
  const editing = addresses.find((a) => a.id === edit);
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Link href={sf.href("/account")} className="text-sm underline">← {t("sf.account.title")}</Link>
      <h1 className="mb-8 mt-2 text-3xl font-semibold tracking-tight">{t("sf.account.addresses")}</h1>
      <div className="grid gap-10 md:grid-cols-2">
        <ul className="space-y-4">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-xl border border-border p-4 text-sm">
              {a.isDefault && <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{t("customers.default")}</p>}
              {formatAddressLines(a as never, (c) => countryName(c, sf.locale)).map((l, i) => <span key={i} className="block">{l}</span>)}
              <div className="mt-3 flex gap-4">
                <Link href={sf.href(`/account/addresses?edit=${a.id}`)} className="underline">{t("common.edit")}</Link>
                <form action={deleteAddressAction.bind(null, site, a.id)}><button className="text-muted underline">{t("common.delete")}</button></form>
              </div>
            </li>
          ))}
          {addresses.length === 0 && <p className="text-muted">{t("sf.account.noAddress")}</p>}
        </ul>
        <section>
          <h2 className="mb-4 text-lg font-semibold">{editing ? t("common.edit") : t("sf.account.addAddress")}</h2>
          <ActionForm key={editing?.id ?? "new"} action={saveAddressAction.bind(null, site, editing?.id ?? null)} className="grid grid-cols-2 gap-3">
            <Input name="firstName" label={t("checkout.firstName")} defaultValue={editing?.firstName ?? customer.firstName ?? ""} required />
            <Input name="lastName" label={t("checkout.lastName")} defaultValue={editing?.lastName ?? customer.lastName ?? ""} required />
            <Input name="company" label={t("checkout.company")} defaultValue={editing?.company ?? ""} wrapperClassName="col-span-2" />
            <Input name="address1" label={t("checkout.address1")} defaultValue={editing?.address1 ?? ""} wrapperClassName="col-span-2" required />
            <Input name="address2" label={t("checkout.address2")} defaultValue={editing?.address2 ?? ""} wrapperClassName="col-span-2" />
            <Input name="zip" label={t("checkout.zip")} defaultValue={editing?.zip ?? ""} required />
            <Input name="city" label={t("checkout.city")} defaultValue={editing?.city ?? ""} required />
            <Input name="province" label={t("checkout.province")} defaultValue={editing?.province ?? ""} />
            <Input name="phone" label={t("checkout.phone")} defaultValue={editing?.phone ?? ""} />
            <Select name="countryCode" label={t("checkout.country")} defaultValue={editing?.countryCode ?? sf.store.countryCode} wrapperClassName="col-span-2">
              {countryOptions(sf.locale).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </Select>
            <Checkbox name="isDefault" label={t("sf.account.makeDefault")} defaultChecked={editing?.isDefault} className="col-span-2" />
            <SubmitButton variant="brand" className="col-span-2 rounded-full">{t("common.save")}</SubmitButton>
          </ActionForm>
        </section>
      </div>
    </div>
  );
}
