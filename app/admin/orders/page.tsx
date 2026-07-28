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
        description="Bấm vào đơn để xem chi tiết món cần giao và ghi chú/yêu cầu đặc biệt của khách. Đơn pickup chưa lấy nhấp nháy đỏ."
      />
      <OrdersManager orders={orders} />
    </>
  );
}
