import { AdminPageHeader } from "@/components/admin-page-header";
import { OrdersManager } from "@/components/orders-manager";
import { getOrdersForStaff } from "@/lib/data/orders";

export const metadata = { title: "Orders" };

// Trang seller/staff quản lý đơn + xác nhận pickup. Gate khu /admin (staff hoặc
// seller) đã nằm ở app/admin/layout.tsx nên trang này không cần chặn thêm.
export default async function OrdersPage() {
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
