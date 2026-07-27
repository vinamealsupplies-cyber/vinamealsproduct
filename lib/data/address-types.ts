import { formatUsPhoneDisplay } from "@/lib/data/us-states";

export type AddressType = "billing" | "shipping" | "other";

export type CustomerAddress = {
  id: string;
  customerId: string;
  addressType: AddressType;
  label: string | null;
  recipientName: string | null;
  companyName: string | null;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  stateRegion: string;
  postalCode: string;
  countryCode: string;
  isDefault: boolean;
  createdAt: string;
};

/** Một dòng địa chỉ kiểu USA: "Jane Doe · 123 Main St, City, CA 92840". */
export function formatAddressLine(address: CustomerAddress) {
  const street = [address.line1, address.line2].filter(Boolean).join(", ");
  const cityLine = `${address.city}, ${address.stateRegion} ${address.postalCode}`;
  const who = address.recipientName?.trim() || address.companyName?.trim() || null;
  const base = who ? `${who} · ${street}, ${cityLine}` : `${street}, ${cityLine}`;
  const phone = formatUsPhoneDisplay(address.phone);
  return phone ? `${base} · ${phone}` : base;
}

export function formatAddressMultiline(address: CustomerAddress) {
  const phone = formatUsPhoneDisplay(address.phone);
  const lines = [
    address.recipientName,
    address.companyName,
    phone ? `Phone: ${phone}` : null,
    address.line1,
    address.line2,
    `${address.city}, ${address.stateRegion} ${address.postalCode}`,
    address.countryCode === "US" ? "United States" : address.countryCode
  ].filter((line): line is string => Boolean(line && line.trim()));
  return lines;
}
