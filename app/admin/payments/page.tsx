import { Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { SearchableTable } from "@/components/searchable-table";

const rows = [
  { reference: "PAY-000882", customer: "Sunrise Market LLC", date: "2026-07-18", method: "ACH", amount: 920, invoice: "INV-2026-0001182", status: "Posted" },
  { reference: "PAY-000881", customer: "Harbor Cafe", date: "2026-07-17", method: "Check", amount: 1284.5, invoice: "INV-2026-0001181", status: "Posted" },
  { reference: "PAY-000880", customer: "Ava Johnson", date: "2026-07-16", method: "Card", amount: 68.24, invoice: "INV-2026-0001180", status: "Posted" }
];

export default function PaymentsPage() {
  return <><AdminPageHeader eyebrow="Cash" title="Payments" description="Post receipts independently from invoices so amount received and outstanding balances remain accurate." action={<button className="button primary" type="button"><Plus size={17} /> Record payment</button>} /><SearchableTable columns={[{ key: "reference", label: "Payment" }, { key: "customer", label: "Customer" }, { key: "date", label: "Date", kind: "date" }, { key: "method", label: "Method" }, { key: "amount", label: "Amount", kind: "currency", align: "right" }, { key: "invoice", label: "Applied invoice" }, { key: "status", label: "Status", kind: "status" }]} rows={rows} searchPlaceholder="Search payment, customer, or invoice" defaultSortKey="date" /></>;
}
