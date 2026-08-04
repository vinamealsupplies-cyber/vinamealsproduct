import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PurchaseHistory } from "@/components/purchase-history";
import { getViewer } from "@/lib/auth";
import { getOwnOrderByIdentifier } from "@/lib/data/customer-orders";

export const metadata = { title: "Order details" };

export default async function CustomerOrderDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) {
    const next = encodeURIComponent(`/account/orders/${id}`);
    redirect(`/login?next=${next}&message=Sign%20in%20to%20view%20your%20order.`);
  }

  const order = await getOwnOrderByIdentifier(viewer.id, id);
  if (!order) notFound();

  return (
    <div className="page-shell shell account-page">
      <header className="page-heading">
        <Link className="text-link" href="/account/orders">
          <ArrowLeft size={15} aria-hidden="true" /> Back to all orders
        </Link>
        <span className="kicker">My account</span>
        <h1>Order {order.number}</h1>
        <p>This private page shows the latest status, payment information, items, and invoice.</p>
      </header>

      <PurchaseHistory orders={[order]} expandAll />
    </div>
  );
}
