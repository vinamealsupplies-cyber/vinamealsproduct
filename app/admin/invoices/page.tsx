import { Download, FilePlus2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { SearchableTable } from "@/components/searchable-table";
import { invoiceRows } from "@/lib/admin-sample-data";

export default function InvoicesPage() {
  const rows = invoiceRows.map((row) => ({ ...row, balance: row.total - row.paid }));
  return (
    <>
      <AdminPageHeader eyebrow="Billing" title="Invoices" description="Track invoice totals, payments, balances, dates, customers, and status." action={<div className="button-row"><button className="button secondary" type="button"><Download size={17} /> Export</button><button className="button primary" type="button"><FilePlus2 size={17} /> Create invoice</button></div>} />
      <SearchableTable columns={[
        { key: "number", label: "Invoice" }, { key: "customer", label: "Customer" }, { key: "issueDate", label: "Issue date", kind: "date" }, { key: "total", label: "Total", kind: "currency", align: "right" },
        { key: "paid", label: "Received", kind: "currency", align: "right" }, { key: "balance", label: "Balance", kind: "currency", align: "right" }, { key: "status", label: "Status", kind: "status" }
      ]} rows={rows} searchPlaceholder="Search invoice number or customer" defaultSortKey="issueDate" />
    </>
  );
}
