import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { FulfillmentPicker } from "@/components/fulfillment-picker";
import { SetupNotice } from "@/components/setup-notice";

export const metadata = { title: "Cart" };

export default function CartPage() {
  return (
    <div className="page-shell shell narrow-page">
      <div className="empty-state large">
        <ShoppingBag size={36} />
        <h1>Your cart is empty</h1>
        <p>Browse the catalog to add items. Delivery options and tax are shown below.</p>
        <Link className="button primary" href="/products">
          Browse products
        </Link>
      </div>

      <SetupNotice>
        Cart items and payment are not connected yet. The section below runs the real pickup/shipping and
        sales-tax logic against a sample subtotal so the totals can be checked before checkout is wired up.
      </SetupNotice>

      <FulfillmentPicker retailSubtotal={86.4} wholesaleSubtotal={61.2} />
    </div>
  );
}
