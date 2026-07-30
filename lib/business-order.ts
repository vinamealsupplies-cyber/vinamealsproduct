/** Business / payment helpers — client + server safe. */

/** Offline methods — staff confirms after funds arrive. */
export const OFFLINE_PAYMENT_METHODS = ["check", "zelle", "bank_transfer"] as const;

export type OfflinePaymentMethod = (typeof OFFLINE_PAYMENT_METHODS)[number];

/**
 * Payment choices for approved business accounts.
 * Card = same path as retail shoppers (Stripe later; test-paid for now).
 */
export const BUSINESS_PAYMENT_METHODS = [
  "card",
  "check",
  "zelle",
  "bank_transfer"
] as const;

export type BusinessPaymentMethod = (typeof BUSINESS_PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  check: "Check",
  zelle: "Zelle",
  bank_transfer: "Bank transfer",
  card: "Card",
  test_checkout: "Test checkout",
  other: "Other"
};

export function isOfflinePaymentMethod(value: unknown): value is OfflinePaymentMethod {
  return (
    typeof value === "string" &&
    (OFFLINE_PAYMENT_METHODS as readonly string[]).includes(value)
  );
}

export function isBusinessPaymentMethod(value: unknown): value is BusinessPaymentMethod {
  return (
    typeof value === "string" &&
    (BUSINESS_PAYMENT_METHODS as readonly string[]).includes(value)
  );
}

export type BusinessAccount = {
  customerId: string;
  companyName: string | null;
  /** Approved business account (legacy customer_type=wholesale). */
  isBusiness: boolean;
  /** 0–100; null = no automatic discount. */
  discountPercent: number | null;
};

export function computeBusinessDiscount(
  subtotal: number,
  discountPercent: number | null | undefined
): number {
  if (discountPercent == null || !Number.isFinite(discountPercent) || discountPercent <= 0) {
    return 0;
  }
  const pct = Math.min(100, Math.max(0, discountPercent));
  return Math.round(subtotal * (pct / 100) * 100) / 100;
}

export const PAYMENT_INSTRUCTIONS: Record<OfflinePaymentMethod, string> = {
  check:
    "Make the check payable to Vinameals. Include your order number on the memo line. We will confirm when the check clears.",
  zelle:
    "Send payment via Zelle using the details our team provides for your order. Include your order number in the memo.",
  bank_transfer:
    "Transfer the order total via bank transfer / ACH. Use your order number as the payment reference. We confirm after funds arrive."
};

export const BUSINESS_PAYMENT_HINTS: Record<BusinessPaymentMethod, string> = {
  card: "Pay by card — same as retail customers (Stripe). Test checkout marks paid until Stripe is live.",
  check: "Mail or drop off a check with your order number.",
  zelle: "Send Zelle with your order number in the memo.",
  bank_transfer: "ACH / bank transfer with order number as reference."
};
