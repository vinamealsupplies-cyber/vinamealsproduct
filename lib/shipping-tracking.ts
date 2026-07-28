/** Tra cứu vận đơn FedEx / USPS / UPS / DHL — không phụ thuộc server-only. */

export type ShippingCarrier = "usps" | "fedex" | "ups" | "dhl" | "other";

export const SHIPPING_CARRIERS: { value: ShippingCarrier; label: string }[] = [
  { value: "usps", label: "USPS" },
  { value: "fedex", label: "FedEx" },
  { value: "ups", label: "UPS" },
  { value: "dhl", label: "DHL" },
  { value: "other", label: "Other / Other carrier" }
];

export function isShippingCarrier(value: string): value is ShippingCarrier {
  return SHIPPING_CARRIERS.some((c) => c.value === value);
}

/** URL public để khách/nhân viên mở tab tra cứu (giống site carrier). */
export function buildTrackingUrl(
  carrier: string | null | undefined,
  trackingNumber: string | null | undefined,
  overrideUrl?: string | null
): string | null {
  const custom = overrideUrl?.trim();
  if (custom && /^https?:\/\//i.test(custom)) return custom;

  const code = trackingNumber?.trim();
  if (!code) return null;
  const encoded = encodeURIComponent(code);
  switch ((carrier ?? "").toLowerCase()) {
    case "usps":
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encoded}`;
    case "fedex":
      return `https://www.fedex.com/fedextrack/?trknbr=${encoded}`;
    case "ups":
      return `https://www.ups.com/track?tracknum=${encoded}`;
    case "dhl":
      return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${encoded}`;
    default:
      // Google search fallback cho carrier khác.
      return `https://www.google.com/search?q=${encodeURIComponent(`${carrier ?? "tracking"} ${code}`)}`;
  }
}

export function carrierLabel(carrier: string | null | undefined): string {
  const found = SHIPPING_CARRIERS.find((c) => c.value === carrier);
  return found?.label ?? (carrier?.trim() || "Carrier");
}
