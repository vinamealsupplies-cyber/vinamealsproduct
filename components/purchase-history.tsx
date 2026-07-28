import Link from "next/link";
import { Package, PackageOpen, ShoppingBag } from "lucide-react";
import type { CustomerOrder } from "@/lib/data/customer-orders";
import { formatDate, usd } from "@/lib/format";

function statusClass(status: CustomerOrder["status"], isOpen: boolean) {
  if (status === "cancelled") return "status-cancelled";
  if (status === "fulfilled") return "status-fulfilled";
  if (isOpen) return "status-confirmed";
  return "status-draft";
}

function OrderCard({ order }: { order: CustomerOrder }) {
  return (
    <article className={`purchase-order-card ${order.isOpen ? "is-open" : ""}`}>
      <header className="purchase-order-head">
        <div>
          <p className="purchase-order-number">Order {order.number}</p>
          <p className="purchase-order-meta">
            Placed {formatDate(order.placedAt)}
            {" · "}
            {order.fulfillmentMethod === "pickup" ? "Store pickup" : "Shipping"}
            {" · "}
            {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="purchase-order-status">
          <span className={`status-badge ${statusClass(order.status, order.isOpen)}`}>
            {order.statusLabel}
          </span>
          <p>{order.statusDetail}</p>
        </div>
      </header>

      <div className="table-scroll">
        <table className="data-table purchase-items-table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Qty</th>
              <th className="num">Price</th>
              <th className="num">Total</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="purchase-order-foot">
        <span>
          {order.fulfilledAt
            ? `Completed ${formatDate(order.fulfilledAt)}`
            : order.pickedUpAt
              ? `Picked up ${formatDate(order.pickedUpAt)}`
              : order.isOpen
                ? "We’ll update this status as your order moves."
                : null}
        </span>
        <strong>{usd.format(order.total)}</strong>
      </footer>
    </article>
  );
}

export function PurchaseHistory({ orders }: { orders: CustomerOrder[] }) {
  const openOrders = orders.filter((o) => o.isOpen);
  const pastOrders = orders.filter((o) => !o.isOpen);

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
          </h2>
          <p>Orders you placed — in progress and completed.</p>
        </div>
      </div>

      {openOrders.length ? (
        <div className="purchase-group">
          <h3>In progress ({openOrders.length})</h3>
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
