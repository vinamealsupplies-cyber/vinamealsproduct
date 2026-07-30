/**
 * Seller identity + offline payment details for invoices.
 * Prefer DB (admin-editable); env is fallback when DB empty.
 */

export type StoreBusinessProfile = {
  legalName: string;
  displayName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  logoPath: string;
  /** Checks payable to */
  payableTo: string;
  paymentTermsNote: string;
  checkPayableTo: string;
  checkMailingNote: string;
  zelleName: string;
  zelleEmailOrPhone: string;
  zelleInstructions: string;
  bankName: string;
  bankAccountName: string;
  bankRoutingNumber: string;
  bankAccountNumber: string;
  bankAccountType: string;
  bankInstructions: string;
};

/** @deprecated use StoreBusinessProfile — kept for invoice component alias */
export type StoreProfile = StoreBusinessProfile & {
  addressLines: string[];
};

export const STORE_PROFILE_SETTING_KEY = "business.invoice_profile";

export function defaultStoreBusinessProfile(): StoreBusinessProfile {
  const legalName =
    process.env.STORE_LEGAL_NAME?.trim() ||
    process.env.NEXT_PUBLIC_STORE_LEGAL_NAME?.trim() ||
    "Vinameals";
  const website =
    process.env.NEXT_PUBLIC_SITE_ORIGIN?.replace(/\/$/, "") ||
    "https://vinamealsupplies.com";
  const email =
    process.env.STORE_EMAIL?.trim() ||
    process.env.SUPPORT_EMAIL?.trim() ||
    "support@vinamealsupplies.com";

  return {
    legalName,
    displayName: process.env.STORE_DISPLAY_NAME?.trim() || legalName,
    addressLine1: process.env.STORE_ADDRESS_LINE1?.trim() || "Garden Grove, CA",
    addressLine2: process.env.STORE_ADDRESS_LINE2?.trim() || "",
    city: process.env.STORE_CITY?.trim() || "Garden Grove",
    state: process.env.STORE_STATE?.trim() || "CA",
    postalCode: process.env.STORE_POSTAL_CODE?.trim() || "",
    country: process.env.STORE_COUNTRY?.trim() || "US",
    phone: process.env.STORE_PHONE?.trim() || "",
    email,
    website,
    logoPath: process.env.STORE_LOGO_PATH?.trim() || "/logo-vinameals.png",
    payableTo: process.env.STORE_PAYABLE_TO?.trim() || legalName,
    paymentTermsNote:
      process.env.STORE_PAYMENT_TERMS?.trim() ||
      "Total payment due as arranged. Include your order or invoice number on every payment.",
    checkPayableTo: process.env.STORE_CHECK_PAYABLE_TO?.trim() || legalName,
    checkMailingNote:
      process.env.STORE_CHECK_MAILING_NOTE?.trim() ||
      "Mail or drop off checks with the order number on the memo line.",
    zelleName: process.env.STORE_ZELLE_NAME?.trim() || "",
    zelleEmailOrPhone: process.env.STORE_ZELLE_HANDLE?.trim() || "",
    zelleInstructions:
      process.env.STORE_ZELLE_INSTRUCTIONS?.trim() ||
      "Send via Zelle. Put your order number in the memo.",
    bankName: process.env.STORE_BANK_NAME?.trim() || "",
    bankAccountName: process.env.STORE_BANK_ACCOUNT_NAME?.trim() || "",
    bankRoutingNumber: process.env.STORE_BANK_ROUTING?.trim() || "",
    bankAccountNumber: process.env.STORE_BANK_ACCOUNT?.trim() || "",
    bankAccountType: process.env.STORE_BANK_ACCOUNT_TYPE?.trim() || "checking",
    bankInstructions:
      process.env.STORE_BANK_INSTRUCTIONS?.trim() ||
      "Use ACH / bank transfer. Use your order number as the payment reference."
  };
}

export function normalizeStoreProfile(
  raw: Partial<StoreBusinessProfile> | null | undefined
): StoreBusinessProfile {
  const base = defaultStoreBusinessProfile();
  if (!raw || typeof raw !== "object") return base;
  const out = { ...base };
  for (const key of Object.keys(base) as (keyof StoreBusinessProfile)[]) {
    const v = raw[key];
    if (typeof v === "string") out[key] = v.trim();
  }
  if (!out.payableTo) out.payableTo = out.legalName;
  if (!out.checkPayableTo) out.checkPayableTo = out.payableTo || out.legalName;
  if (!out.displayName) out.displayName = out.legalName;
  if (!out.logoPath) out.logoPath = "/logo-vinameals.png";
  return out;
}

export function storeAddressLines(profile: StoreBusinessProfile): string[] {
  const lines: string[] = [];
  if (profile.addressLine1) lines.push(profile.addressLine1);
  if (profile.addressLine2) lines.push(profile.addressLine2);
  const cityLine = [profile.city, profile.state, profile.postalCode]
    .filter(Boolean)
    .join(", ")
    .replace(/,\s*$/, "");
  // Prefer "City, ST ZIP"
  const city = profile.city?.trim();
  const st = profile.state?.trim();
  const zip = profile.postalCode?.trim();
  if (city || st || zip) {
    const formatted = [city, [st, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    if (formatted && !lines.includes(formatted) && formatted !== profile.addressLine1) {
      lines.push(formatted);
    } else if (!lines.length && formatted) {
      lines.push(formatted);
    }
  } else if (cityLine && !lines.length) {
    lines.push(cityLine);
  }
  if (profile.country && profile.country !== "US") lines.push(profile.country);
  return lines;
}

/** Sync helper for env-only contexts (no DB). Prefer getStoreProfileFromDb. */
export function getStoreProfile(): StoreProfile {
  const p = defaultStoreBusinessProfile();
  return { ...p, addressLines: storeAddressLines(p) };
}

export function toStoreProfileView(p: StoreBusinessProfile): StoreProfile {
  return { ...p, addressLines: storeAddressLines(p) };
}
