import { AdminPageHeader } from "@/components/admin-page-header";
import { OrdersManager } from "@/components/orders-manager";
import { requireAdminAccessPage } from "@/lib/auth";
import { getOrdersForStaff } from "@/lib/data/orders";

export const metadata = { title: "Orders" };

// Seller + staff: quản lý đơn + xác nhận pickup.
export default async function OrdersPage() {
  await requireAdminAccessPage();
  const orders = await getOrdersForStaff();

  return (
    <>
      <AdminPageHeader
        eyebrow="Sales"
        title="Orders"
        description="Theo dõi đơn và xác nhận pickup. Đơn nhận-tại-cửa-hàng chưa lấy sẽ nhấp nháy đỏ cho tới khi xác nhận."
      />
      <OrdersManager orders={orders} />
    </>
  );
}
