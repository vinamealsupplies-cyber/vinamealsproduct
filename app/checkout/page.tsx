import { redirect } from "next/navigation";
import { CheckoutView } from "@/components/checkout-view";
import { getViewer } from "@/lib/auth";
import { getProducts } from "@/lib/data/products";

export const metadata = { title: "Checkout" };

// Checkout yêu cầu đăng nhập THẬT (để gắn đơn với một khách hàng). Demo mode
// không có tài khoản thật nên cũng chặn.
export default async function CheckoutPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.demo) {
    redirect("/login?next=/checkout&message=Please%20sign%20in%20to%20place%20an%20order.");
  }

  const catalog = await getProducts();

  return (
    <CheckoutView
      catalog={catalog}
      customerName={viewer.fullName || viewer.email}
      pickupLocationName="Vinameals store pickup"
    />
  );
}
