import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";
import { PurchaseHistory } from "@/components/purchase-history";
import { getViewer } from "@/lib/auth";
import { getOwnOrders } from "@/lib/data/customer-orders";
import { isSupabaseAdminConfigured } from "@/lib/env";

export const metadata = { title: "Orders & purchase history" };

// Trạng thái đơn đang mở + lịch sử mua GỘP CHUNG một trang (trước đây là 2 khối
// rời trên /account, phải nhảy anchor #purchase-history).
export default async function AccountOrdersPage() {
  const viewer = await getViewer();
  if (!viewer) {
    redirect("/login?next=/account/orders&message=Sign%20in%20to%20view%20your%20orders.");
  }

  const canLoad = !viewer.demo && isSupabaseAdminConfigured();
  const orders = canLoad ? await getOwnOrders(viewer.id) : [];
  const openCount = orders.filter((order) => order.isOpen).length;
  const pastCount = orders.length - openCount;

  return (
    <div className="page-shell shell account-page">
      <header className="page-heading">
        <Link className="text-link" href="/account">
          <ArrowLeft size={15} aria-hidden="true" /> Back to account
        </Link>
        <span className="kicker">My account</span>
        <h1>Orders &amp; purchase history</h1>
        <p>
          {orders.length
            ? `${openCount > 0 ? `${openCount} order${openCount === 1 ? "" : "s"} in progress` : "No open orders right now"}${
                pastCount > 0 ? ` · ${pastCount} completed or cancelled` : ""
              }. Open any order to view or print its invoice.`
            : "Your orders and invoices appear here after you place an order."}
        </p>
      </header>

      {orders.length ? (
        <div className="account-orders-summary">
          <span className={`status-pill ${openCount ? "status-confirmed" : "status-fulfilled"}`}>
            <Package size={14} aria-hidden="true" />{" "}
            {openCount ? `${openCount} in progress` : "All caught up"}
          </span>
          {pastCount > 0 ? (
            <span className="status-pill status-approved">{pastCount} past</span>
          ) : null}
        </div>
      ) : null}

      <PurchaseHistory orders={orders} />
    </div>
  );
}
