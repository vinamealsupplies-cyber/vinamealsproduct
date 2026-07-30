import "server-only";

/**
 * Runtime tax-exempt eligibility.
 *
 * Rules (product policy):
 * - Wholesale approval does NOT grant tax exemption.
 * - Business account alone does NOT grant tax exemption.
 * - Uploaded permit alone does NOT grant tax exemption.
 * - Only customers.tax_exempt_status === 'approved' with valid dates.
 */

export type CustomerTaxExemptRow = {
  tax_exempt_status: string | null;
  tax_exempt_expires_at?: string | null;
  tax_exempt_effective_at?: string | null;
  tax_exempt_certificate_number?: string | null;
  tax_exempt_reason?: string | null;
};

export function isCustomerTaxExempt(customer: CustomerTaxExemptRow | null | undefined, onDate = new Date()) {
  if (!customer) return { exempt: false as const, reason: "No customer" };
  if (customer.tax_exempt_status !== "approved") {
    return {
      exempt: false as const,
      reason: `Status is ${customer.tax_exempt_status ?? "not_requested"}`
    };
  }

  const day = onDate.toISOString().slice(0, 10);
  if (customer.tax_exempt_effective_at && customer.tax_exempt_effective_at > day) {
    return { exempt: false as const, reason: "Certificate not yet effective" };
  }
  if (customer.tax_exempt_expires_at && customer.tax_exempt_expires_at < day) {
    return { exempt: false as const, reason: "Certificate expired" };
  }

  return {
    exempt: true as const,
    reason: customer.tax_exempt_reason || "Approved tax exemption",
    certificateNumber: customer.tax_exempt_certificate_number ?? null
  };
}
