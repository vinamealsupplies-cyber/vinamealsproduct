import Link from "next/link";
import { ChevronDown, FileText, Package, PackageOpen, ShoppingBag } from "lucide-react";
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
    <details
      className={`purchase-order-card ${order.isOpen ? "is-open" : ""}${
        order.pickupReadyAt && order.status === "confirmed" ? " is-pickup-ready" : ""
      }`}
    >
      {/* Thu gọn: mỗi đơn 1 hàng — bấm mới xổ chi tiết. */}
      <summary className="purchase-order-summary">
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
        </div>
        <div className="purchase-order-summary-side">
          <span className={`status-badge ${statusClass(order)}`}>{order.statusLabel}</span>
          <strong className="purchase-order-summary-total">{usd.format(order.total)}</strong>
        </div>
        <ChevronDown className="purchase-order-chevron" size={18} aria-hidden="true" />
      </summary>

      <div className="purchase-order-detail">
        <p className={`purchase-payment-line ${order.paidAt ? "is-paid" : "is-pending"}`}>
          {paymentLine(order)}
        </p>
        {order.statusDetail ? (
          <p className="purchase-status-detail field-hint">{order.statusDetail}</p>
        ) : null}
        {order.pickupReadyAt && order.status === "confirmed" ? (
          <p className="purchase-ready-banner" role="status">
            Ready for pickup — bring order number <strong>{order.number}</strong> and photo ID.
          </p>
        ) : null}

      <div className="table-scroll">
        <table className="data-table purchase-items-table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Qty</th>
              <th className="num">Price</th>
              <th className="num">Total</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.productName}</strong>
                  {item.variantName ? (
                    <span className="field-hint">{item.variantName}</span>
                  ) : null}
                  {item.sku ? <span className="field-hint">SKU {item.sku}</span> : null}
                </td>
                <td className="num">{item.quantity}</td>
                <td className="num">{usd.format(item.unitPrice)}</td>
                <td className="num">{usd.format(item.lineTotal)}</td>
                <td>
                  {item.lineNote ? (
                    <span className="line-note-text">{item.lineNote}</span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="purchase-order-foot">
        <div className="purchase-order-foot-left">
          <span>
            {order.fulfilledAt
              ? `Completed ${formatDate(order.fulfilledAt)}`
              : order.pickedUpAt
                ? `Picked up ${formatDate(order.pickedUpAt)}`
                : order.isOpen
                  ? "We’ll update this status as your order moves."
                  : null}
          </span>
          <Link
            className="button secondary compact"
            href={`/account/orders/${order.id}/invoice`}
          >
            <FileText size={14} aria-hidden="true" /> View invoice
          </Link>
        </div>
      </footer>
      </div>
    </details>
  );
}

export function PurchaseHistory({ orders }: { orders: CustomerOrder[] }) {
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
