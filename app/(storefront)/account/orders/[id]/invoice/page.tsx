import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import {
  CustomerInvoiceDocument,
  InvoicePrintActions
} from "@/components/customer-invoice-document";
import { getViewer } from "@/lib/auth";
import { getOwnOrderInvoice } from "@/lib/data/customer-invoice";
import { getStoreProfileFromDb } from "@/lib/data/store-settings";

export const metadata: Metadata = { title: "Invoice" };

export default async function CustomerOrderInvoicePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account");

  const { id } = await params;
  const [invoice, store] = await Promise.all([
    getOwnOrderInvoice(viewer.id, id),
    getStoreProfileFromDb()
  ]);
  if (!invoice) notFound();

  return (
    <div className="page-shell shell invoice-page">
      <nav className="breadcrumbs no-print" aria-label="Breadcrumb">
        <Link href="/account">
          <ChevronLeft size={14} /> Account
        </Link>
      </nav>

      <header className="page-heading no-print">
        <span className="kicker">Invoice</span>
        <h1>
          Invoice {invoice.invoiceNumber}
        </h1>
        <p>
          Order {invoice.orderNumber}. Open this page anytime from your order history to print or
          save as PDF.
        </p>
      </header>

      <InvoicePrintActions />

      <CustomerInvoiceDocument invoice={invoice} store={store} />

      <div className="button-row no-print" style={{ marginTop: 20 }}>
        <Link className="button secondary" href="/account#purchase-history">
          Back to orders
        </Link>
      </div>
    </div>
  );
}
