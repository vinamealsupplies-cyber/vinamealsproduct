import { CartView } from "@/components/cart-view";
import { getViewer } from "@/lib/auth";
import { getOwnShippingAddresses } from "@/lib/data/addresses";
import { getProducts } from "@/lib/data/products";
import { isSupabaseAdminConfigured } from "@/lib/env";

export const metadata = { title: "Cart" };

export default async function CartPage() {
  const [catalog, viewer] = await Promise.all([getProducts(), getViewer()]);

  const shippingAddresses =
    viewer && !viewer.demo && isSupabaseAdminConfigured()
      ? await getOwnShippingAddresses(viewer.id)
      : [];

  return (
    <CartView
      catalog={catalog}
      shippingAddresses={shippingAddresses}
      signedIn={Boolean(viewer) && !viewer?.demo}
    />
  );
}
