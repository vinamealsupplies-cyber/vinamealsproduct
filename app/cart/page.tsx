import { CartView } from "@/components/cart-view";
import { getProducts } from "@/lib/data/products";

export const metadata = { title: "Cart" };

export default async function CartPage() {
  const catalog = await getProducts();
  return <CartView catalog={catalog} />;
}
