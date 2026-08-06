import Link from "next/link";
import { ChevronRight, Package, PackageOpen, ShoppingBag } from "lucide-react";
import type { CustomerOrder } from "@/lib/data/customer-orders";
import { formatDate, formatDateTime, usd } from "@/lib/format";

function statusClass(order: CustomerOrder) {
  if (order.status === "cancelled") return "status-cancelled";
  if (order.status === "fulfilled") return "status-fulfilled";
  if (
    order.fulfillmentMethod === "pickup" &&
    order.status === "confirmed" &&
    order.pickupReadyAt
  ) {
    return "status-approved";
  }
  if (order.isOpen) return "status-confirmed";
  return "status-draft";
}

function paymentLine(order: CustomerOrder) {
  if (order.paidAt) {
    const method = order.paymentMethod ? ` · ${order.paymentMethod}` : "";
    return `Paid ${formatDateTime(order.paidAt)}${method}`;
  }
  if (order.paymentStatus === "partial") {
    return "Partially paid — remaining balance due";
  }
  if (order.paymentStatus === "pending") {
    return "Payment pending";
  }
  if (order.status === "cancelled") {
    return "No payment";
  }
  return "Payment not recorded";
}

function OrderCard({ order }: { order: CustomerOrder }) {
  return (
    <Link
      href={`/account/orders/${encodeURIComponent(order.number || order.id)}`}
      className={`purchase-order-card ${order.isOpen ? "is-open" : ""}${
        order.pickupReadyAt && order.status === "confirmed" ? " is-pickup-ready" : ""
      } purchase-order-link`}
      aria-label={`View details for order ${order.number}`}
    >
      <div className="purchase-order-summary">
        <div className="purchase-order-summary-main">
          <p className="purchase-order-number">
            Order {order.number}
            {order.isOpen ? (
              <span className="order-open-dot" title="In progress" aria-label="In progress" />
            ) : null}
          </p>
          <p className="purchase-order-meta">
            {formatDate(order.placedAt)}
            {" · "}
            {order.fulfillmentMethod === "pickup" ? "Pickup" : "Shipping"}
            {" · "}
            {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
          </p>
          <p className={`purchase-order-payment ${order.paymentStatus === "paid" ? "is-paid" : ""}`}>
            {paymentLine(order)}
          </p>
        </div>
        <div className="purchase-order-summary-side">
          <span className={`status-badge ${statusClass(order)}`}>{order.statusLabel}</span>
          <strong className="purchase-order-summary-total">{usd.format(order.total)}</strong>
        </div>
        <ChevronRight className="purchase-order-chevron" size={19} aria-hidden="true" />
      </div>
    </Link>
  );
}

export function PurchaseHistory({
  orders
}: {
  orders: CustomerOrder[];
}) {
  const openOrders = orders.filter((o) => o.isOpen);
  const pastOrders = orders.filter((o) => !o.isOpen);
  const openCount = openOrders.length;

  if (!orders.length) {
    return (
      <section className="purchase-history empty">
        <div className="empty-state">
          <PackageOpen size={32} aria-hidden="true" />
          <h2>No purchases yet</h2>
          <p>When you place an order, it will show up here with live status.</p>
          <Link className="button primary" href="/products">
            <ShoppingBag size={17} aria-hidden="true" /> Shop products
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="purchase-history">
      <div className="section-heading split-heading">
        <div>
          <h2>
            <Package size={20} aria-hidden="true" /> Purchase history
            {openCount > 0 ? (
              <span className="order-count-badge" aria-label={`${openCount} open orders`}>
                {openCount}
              </span>
            ) : null}
          </h2>
          <p>Orders you placed — in progress and completed. Payment time shows when paid.</p>
        </div>
      </div>

      {openOrders.length ? (
        <div className="purchase-group">
          <h3>
            In progress{" "}
            <span className="order-count-badge inline" aria-hidden="true">
              {openCount}
            </span>
          </h3>
          <div className="purchase-order-list">
            {openOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        </div>
      ) : null}

      {pastOrders.length ? (
        <div className="purchase-group">
          <h3>Past orders ({pastOrders.length})</h3>
          <div className="purchase-order-list">
            {pastOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
