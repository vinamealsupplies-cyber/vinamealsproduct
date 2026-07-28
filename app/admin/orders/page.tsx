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
        description="Hai phần: (1) chờ giao / ship / pickup — (2) đã hoàn tất. Bấm đơn để xem món và ghi chú khách."
      />
      <OrdersManager orders={orders} />
    </>
  );
}
