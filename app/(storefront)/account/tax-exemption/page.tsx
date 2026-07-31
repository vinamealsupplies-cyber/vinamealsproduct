import { redirect } from "next/navigation";

/** Legacy URL — wholesale & resale application lives at /account/business-application. */
export default function TaxExemptionRedirectPage() {
  redirect("/account/business-application");
}
