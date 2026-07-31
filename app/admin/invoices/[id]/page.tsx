import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  CustomerInvoiceDocument,
  InvoicePrintActions
} from "@/components/customer-invoice-document";
import { InvoiceSendButton } from "@/components/invoice-send-button";
import { requireAdminAccessPage } from "@/lib/auth";
import { getInvoiceForAdmin } from "@/lib/data/customer-invoice";
import { getStoreProfileFromDb } from "@/lib/data/store-settings";

export const metadata = { title: "Invoice" };

export default async function AdminInvoicePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminAccessPage();
  const { id } = await params;

  const [invoice, store] = await Promise.all([
    getInvoiceForAdmin(id),
    getStoreProfileFromDb()
  ]);
  if (!invoice) notFound();

  const settled = invoice.balanceDue <= 0 || invoice.paymentStatus === "paid";

  return (
    <div className="admin-invoice-page">
      <div className="admin-invoice-toolbar no-print">
        <Link className="button ghost" href="/admin/invoices">
          <ArrowLeft size={15} aria-hidden="true" /> Về danh sách
        </Link>
        <div className="admin-invoice-toolbar-right">
          <InvoiceSendButton invoiceId={id} isPaid={settled} />
          <InvoicePrintActions />
        </div>
      </div>

      <CustomerInvoiceDocument invoice={invoice} store={store} />
    </div>
  );
}
