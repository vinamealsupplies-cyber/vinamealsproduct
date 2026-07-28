import type { Metadata } from "next";
import { StorePolicies } from "@/components/store-policies";

export const metadata: Metadata = {
  title: "Store policies",
  description:
    "Vinameals store policies: privacy, cookies, terms of sale, shipping, returns, payments, promotions, accessibility, and contact."
};

export default function PoliciesPage() {
  return (
    <div className="page-shell shell policy-shell" id="top">
      <StorePolicies />
    </div>
  );
}
