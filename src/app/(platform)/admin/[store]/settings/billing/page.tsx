import { redirect } from "next/navigation";

/** Billing is account-level: one subscription covers all of the owner's stores. */
export default function StoreBillingRedirect() {
  redirect("/account/billing");
}
