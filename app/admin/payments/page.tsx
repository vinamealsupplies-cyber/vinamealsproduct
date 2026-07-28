import { AdminPageHeader } from "@/components/admin-page-header";
import { SearchableTable } from "@/components/searchable-table";
import { requireAdminAccessPage } from "@/lib/auth";
import { getPayments } from "@/lib/data/reporting";

export const metadata = { title: "Payments" };

export default async function PaymentsPage() {
  await requireAdminAccessPage();
  const payments = await getPayments();
  const rows = payments.map((payment) => ({
    reference: payment.reference,
    customer: payment.customer,
    date: payment.receivedAt,
    method: payment.method,
    amount: payment.amount,
    invoice: payment.invoiceNumber,
    status: payment.status
  }));

  return (
    <>
      <AdminPageHeader
        eyebrow="Cash"
        title="Payments"
        description="Post receipts independently from invoices so amount received and outstanding balances remain accurate."
      />
      <SearchableTable
        columns={[
          { key: "reference", label: "Payment" },
          { key: "customer", label: "Customer" },
          { key: "date", label: "Date", kind: "date" },
          { key: "method", label: "Method" },
          { key: "amount", label: "Amount", kind: "currency", align: "right" },
          { key: "invoice", label: "Applied invoice" },
          { key: "status", label: "Status", kind: "status" }
        ]}
        rows={rows}
        searchPlaceholder="Search payment, customer, or invoice"
        defaultSortKey="date"
        emptyMessage="No payments recorded yet. Receipts are posted against invoices."
      />
    </>
  );
}
