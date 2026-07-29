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
        description="(1) Chờ giao / ship / pickup — (2) Đã hoàn tất / huỷ theo ngày (mặc định ngày gần nhất có đơn). Bấm đơn để xem chi tiết."
      />
      <OrdersManager orders={orders} />
    </>
  );
}
