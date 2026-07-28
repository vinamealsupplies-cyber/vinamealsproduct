import { CartView } from "@/components/cart-view";
import { getViewer } from "@/lib/auth";
import { getOwnShippingAddresses } from "@/lib/data/addresses";
import { getProducts } from "@/lib/data/products";
import {
  getOwnWholesaleAccount,
  getWholesalePriceMap
} from "@/lib/data/wholesale-account";
import { isSupabaseAdminConfigured } from "@/lib/env";

export const metadata = { title: "Cart" };

export default async function CartPage() {
  const [catalog, viewer] = await Promise.all([getProducts(), getViewer()]);

  const canLoad = Boolean(viewer && !viewer.demo && isSupabaseAdminConfigured());
  const shippingAddresses = canLoad ? await getOwnShippingAddresses(viewer!.id) : [];
  const wholesaleAccount = canLoad ? await getOwnWholesaleAccount(viewer!.id) : null;

  let wholesalePriceByProductId: Record<string, number> = {};
  if (wholesaleAccount?.isWholesale) {
    const map = await getWholesalePriceMap(catalog.map((p) => p.id));
    wholesalePriceByProductId = Object.fromEntries(map.entries());
  }

  return (
    <CartView
      catalog={catalog}
      shippingAddresses={shippingAddresses}
      signedIn={Boolean(viewer) && !viewer?.demo}
      wholesaleAccount={wholesaleAccount}
      wholesalePriceByProductId={wholesalePriceByProductId}
    />
  );
}
