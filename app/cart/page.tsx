import { CartView } from "@/components/cart-view";

export const metadata = { title: "Cart" };

/**
 * No server data fetch here — only render the client shell.
 * Session + catalog load inside CartView via `loadCartBootstrap`.
 * This avoids Server Components crashes on Cloudflare Free when opening /cart.
 */
export default function CartPage() {
  return <CartView />;
}
