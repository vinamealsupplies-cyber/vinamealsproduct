import { Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { SearchableTable } from "@/components/searchable-table";

const rows = [
  { number: "SO-2026-0001428", customer: "Sunrise Market LLC", date: "2026-07-18", channel: "Admin", total: 1840, status: "Invoiced" },
  { number: "SO-2026-0001427", customer: "Harbor Cafe", date: "2026-07-17", channel: "Storefront", total: 1284.5, status: "Fulfilled" },
  { number: "SO-2026-0001426", customer: "Ava Johnson", date: "2026-07-16", channel: "Storefront", total: 68.24, status: "Fulfilled" }
];

export default function OrdersPage() {
  return <><AdminPageHeader eyebrow="Sales" title="Orders" description="Manage guest, retail, and wholesale sales orders before invoicing and fulfillment." action={<button className="button primary" type="button"><Plus size={17} /> New order</button>} /><SearchableTable columns={[{ key: "number", label: "Order" }, { key: "customer", label: "Customer" }, { key: "date", label: "Date", kind: "date" }, { key: "channel", label: "Channel" }, { key: "total", label: "Total", kind: "currency", align: "right" }, { key: "status", label: "Status", kind: "status" }]} rows={rows} searchPlaceholder="Search order or customer" defaultSortKey="date" /></>;
}
