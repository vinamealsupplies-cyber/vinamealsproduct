import { CheckoutView } from "@/components/checkout-view";

export const metadata = { title: "Checkout" };

/**
 * No server data fetch / no getViewer here.
 * Auth + catalog load inside CheckoutView via `loadCheckoutBootstrap`.
 * Avoids Server Components digest errors on Cloudflare Free.
 */
export default function CheckoutPage() {
  return <CheckoutView pickupLocationName="Vinameals store pickup" />;
}
