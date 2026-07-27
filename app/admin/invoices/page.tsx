import { AdminPageHeader } from "@/components/admin-page-header";
import { SearchableTable } from "@/components/searchable-table";
import { getInvoices } from "@/lib/data/reporting";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage() {
  const invoices = await getInvoices();
  const rows = invoices.map((invoice) => ({
    number: invoice.number,
    customer: invoice.customer,
    issueDate: invoice.issueDate,
    total: invoice.total,
    paid: invoice.paid,
    balance: invoice.balanceDue,
    status: invoice.status
  }));

  return (
    <>
      <AdminPageHeader
        eyebrow="Billing"
        title="Invoices"
        description="Track invoice totals, payments, balances, dates, customers, and status."
      />
      <SearchableTable
        columns={[
          { key: "number", label: "Invoice" },
          { key: "customer", label: "Customer" },
          { key: "issueDate", label: "Issue date", kind: "date" },
          { key: "total", label: "Total", kind: "currency", align: "right" },
          { key: "paid", label: "Received", kind: "currency", align: "right" },
          { key: "balance", label: "Balance", kind: "currency", align: "right" },
          { key: "status", label: "Status", kind: "status" }
        ]}
        rows={rows}
        searchPlaceholder="Search invoice number or customer"
        defaultSortKey="issueDate"
        emptyMessage="No invoices yet. Invoices are created from sales orders once the ordering flow is connected."
      />
    </>
  );
}
