import { AdminPageHeader } from "@/components/admin-page-header";
import { SearchableTable } from "@/components/searchable-table";
import { getSalesOrders } from "@/lib/data/reporting";

export const metadata = { title: "Orders" };

export default async function OrdersPage() {
  const orders = await getSalesOrders();
  const rows = orders.map((order) => ({
    number: order.number,
    customer: order.customer,
    date: order.date,
    channel: order.channel,
    total: order.total,
    status: order.status
  }));

  return (
    <>
      <AdminPageHeader
        eyebrow="Sales"
        title="Orders"
        description="Manage guest, retail, and wholesale sales orders before invoicing and fulfillment."
      />
      <SearchableTable
        columns={[
          { key: "number", label: "Order" },
          { key: "customer", label: "Customer" },
          { key: "date", label: "Date", kind: "date" },
          { key: "channel", label: "Channel" },
          { key: "total", label: "Total", kind: "currency", align: "right" },
          { key: "status", label: "Status", kind: "status" }
        ]}
        rows={rows}
        searchPlaceholder="Search order or customer"
        defaultSortKey="date"
        emptyMessage="No sales orders yet. Orders appear here once checkout or admin order entry is connected."
      />
    </>
  );
}
