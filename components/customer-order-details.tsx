import Link from "next/link";
import {
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileText,
  MapPin,
  PackageCheck,
  ReceiptText,
  Truck
} from "lucide-react";
import type { CustomerOrder, CustomerOrderAddress } from "@/lib/data/customer-orders";
import { formatDate, formatDateTime, usd } from "@/lib/format";

function paymentMethodLabel(method: string | null) {
  if (!method) return "Not selected / not recorded";
  const labels: Record<string, string> = {
    card: "Credit or debit card",
    check: "Check",
    zelle: "Zelle",
    bank_transfer: "Bank transfer",
    test_checkout: "Test checkout",
    cash: "Cash",
    offline: "Offline payment",
    other: "Other"
  };
  return labels[method.toLowerCase()] ?? method.replaceAll("_", " ");
}

function paymentStatusLabel(order: CustomerOrder) {
  if (order.paymentStatus === "paid") return "Paid";
  if (order.paymentStatus === "partial") return "Partially paid";
  if (order.paymentStatus === "pending") return "Payment pending";
  return order.status === "cancelled" ? "No payment" : "Not recorded";
}

function addressLines(address: CustomerOrderAddress) {
  const city = [address.city, [address.state, address.postalCode].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [
    address.recipientName,
    address.companyName,
    address.line1,
    address.line2,
    city || null,
    address.country && address.country !== "US" ? address.country : null
  ].filter((line): line is string => Boolean(line));
}

function statusClass(order: CustomerOrder) {
  if (order.status === "cancelled") return "status-cancelled";
  if (order.status === "fulfilled") return "status-fulfilled";
  if (order.pickupReadyAt) return "status-approved";
  return "status-confirmed";
}

export function CustomerOrderDetails({ order }: { order: CustomerOrder }) {
  const shipTo = order.shippingAddress ? addressLines(order.shippingAddress) : [];
  const carrier = order.shippingCarrier?.toUpperCase();

  return (
    <section className="customer-order-detail" aria-label={`Order ${order.number} details`}>
      <div className="customer-order-overview">
        <article className="customer-order-overview-card">
          <div className="customer-order-card-icon"><PackageCheck size={20} /></div>
          <div>
            <span>Order status</span>
            <strong className={`status-badge ${statusClass(order)}`}>{order.statusLabel}</strong>
            <p>{order.statusDetail}</p>
          </div>
        </article>
        <article className="customer-order-overview-card">
          <div className="customer-order-card-icon"><CreditCard size={20} /></div>
          <div>
            <span>Payment</span>
            <strong>{paymentStatusLabel(order)}</strong>
            <p>{paymentMethodLabel(order.paymentMethod)}</p>
          </div>
        </article>
        <article className="customer-order-overview-card">
          <div className="customer-order-card-icon">
            {order.fulfillmentMethod === "ship" ? <Truck size={20} /> : <MapPin size={20} />}
          </div>
          <div>
            <span>Fulfillment</span>
            <strong>{order.fulfillmentMethod === "ship" ? "Shipping" : "Store pickup"}</strong>
            <p>{order.itemCount} item{order.itemCount === 1 ? "" : "s"}</p>
          </div>
        </article>
      </div>

      {order.pickupReadyAt && order.status === "confirmed" ? (
        <div className="customer-order-notice success" role="status">
          <CheckCircle2 size={19} />
          <span>Ready for pickup. Bring order number <strong>{order.number}</strong> and a photo ID.</span>
        </div>
      ) : null}
      {order.status === "cancelled" ? (
        <div className="customer-order-notice cancelled" role="status">
          <ReceiptText size={19} />
          <span>
            This order was cancelled{order.cancelledAt ? ` on ${formatDate(order.cancelledAt)}` : ""}.
            {order.cancelNote ? <> Reason: <strong>{order.cancelNote}</strong></> : null}
          </span>
        </div>
      ) : null}

      <div className="customer-order-info-grid">
        <article className="customer-order-panel">
          <header><MapPin size={18} /><h2>{order.fulfillmentMethod === "ship" ? "Ship to" : "Pickup location"}</h2></header>
          {order.fulfillmentMethod === "ship" ? (
            shipTo.length ? (
              <address>
                {shipTo.map((line) => <span key={line}>{line}</span>)}
                {order.shippingAddress?.phone ? <span>{order.shippingAddress.phone}</span> : null}
              </address>
            ) : (
              <p className="muted">Shipping address is not available yet.</p>
            )
          ) : order.pickupLocation ? (
            <div className="customer-order-address">
              <strong>{order.pickupLocation.name}</strong>
              {order.pickupLocation.addressLines.map((line) => <span key={line}>{line}</span>)}
              {order.pickupLocation.instructions ? <p>{order.pickupLocation.instructions}</p> : null}
            </div>
          ) : (
            <p className="muted">Pickup location will appear here when confirmed.</p>
          )}
          {order.shippingAddress?.note ? (
            <p className="customer-order-address-note">Delivery note: {order.shippingAddress.note}</p>
          ) : null}
        </article>

        <article className="customer-order-panel">
          <header><CircleDollarSign size={18} /><h2>Payment details</h2></header>
          <dl className="customer-order-facts">
            <div><dt>Status</dt><dd>{paymentStatusLabel(order)}</dd></div>
            <div><dt>Method</dt><dd>{paymentMethodLabel(order.paymentMethod)}</dd></div>
            {order.invoiceNumber ? <div><dt>Invoice</dt><dd>{order.invoiceNumber}</dd></div> : null}
            {order.paymentReference ? <div><dt>Reference</dt><dd>{order.paymentReference}</dd></div> : null}
            {order.paidAt ? <div><dt>Paid</dt><dd>{formatDateTime(order.paidAt)}</dd></div> : null}
            <div><dt>Amount paid</dt><dd>{usd.format(order.amountPaid)}</dd></div>
            <div><dt>Balance due</dt><dd>{usd.format(order.balanceDue)}</dd></div>
          </dl>
        </article>

        <article className="customer-order-panel">
          <header><Truck size={18} /><h2>Shipping &amp; tracking</h2></header>
          {order.fulfillmentMethod === "ship" ? (
            <dl className="customer-order-facts">
              <div><dt>Carrier</dt><dd>{carrier || "Not assigned"}</dd></div>
              <div><dt>Tracking number</dt><dd>{order.trackingNumber || "Not available yet"}</dd></div>
              {order.shippedAt ? <div><dt>Shipped</dt><dd>{formatDateTime(order.shippedAt)}</dd></div> : null}
              {order.trackingUrl ? (
                <div className="customer-order-track-row">
                  <dt>Tracking</dt>
                  <dd><a className="text-link" href={order.trackingUrl} target="_blank" rel="noreferrer">Track package</a></dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <dl className="customer-order-facts">
              {order.pickupReadyAt ? <div><dt>Ready at</dt><dd>{formatDateTime(order.pickupReadyAt)}</dd></div> : null}
              {order.pickedUpAt ? <div><dt>Picked up</dt><dd>{formatDateTime(order.pickedUpAt)}</dd></div> : null}
              {!order.pickupReadyAt && !order.pickedUpAt ? <div><dt>Status</dt><dd>Preparing for pickup</dd></div> : null}
            </dl>
          )}
        </article>

        <article className="customer-order-panel">
          <header><Clock3 size={18} /><h2>Order timeline</h2></header>
          <ol className="customer-order-timeline">
            <li><strong>Order placed</strong><span>{formatDateTime(order.placedAt)}</span></li>
            {order.pickupReadyAt ? <li><strong>Ready for pickup</strong><span>{formatDateTime(order.pickupReadyAt)}</span></li> : null}
            {order.shippedAt ? <li><strong>Shipped</strong><span>{formatDateTime(order.shippedAt)}</span></li> : null}
            {order.pickedUpAt ? <li><strong>Picked up</strong><span>{formatDateTime(order.pickedUpAt)}</span></li> : null}
            {order.fulfilledAt ? <li><strong>Completed</strong><span>{formatDateTime(order.fulfilledAt)}</span></li> : null}
            {order.cancelledAt ? <li className="cancelled"><strong>Cancelled</strong><span>{formatDateTime(order.cancelledAt)}</span></li> : null}
          </ol>
        </article>
      </div>

      <article className="customer-order-panel customer-order-items-panel">
        <header><ReceiptText size={18} /><h2>Items ordered</h2></header>
        <div className="table-scroll">
          <table className="data-table customer-order-items-table">
            <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Total</th></tr></thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.productName}</strong>
                    {item.variantName ? <span className="field-hint">{item.variantName}</span> : null}
                    {item.sku ? <span className="field-hint">SKU {item.sku}</span> : null}
                    {item.lineNote ? <span className="line-note-text">Note: {item.lineNote}</span> : null}
                  </td>
                  <td className="num">{item.quantity}</td>
                  <td className="num">{usd.format(item.unitPrice)}</td>
                  <td className="num"><strong>{usd.format(item.lineTotal)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <div className="customer-order-bottom-grid">
        <article className="customer-order-panel">
          <header><FileText size={18} /><h2>Order notes</h2></header>
          <p>{order.notes || "No order notes."}</p>
        </article>
        <article className="customer-order-panel customer-order-totals">
          <div><span>Subtotal</span><strong>{usd.format(order.subtotal)}</strong></div>
          {order.discount > 0 ? <div><span>Discount</span><strong>−{usd.format(order.discount)}</strong></div> : null}
          <div><span>Shipping</span><strong>{order.shipping > 0 ? usd.format(order.shipping) : "Free"}</strong></div>
          <div><span>Tax</span><strong>{usd.format(order.tax)}</strong></div>
          <div className="grand-total"><span>Total</span><strong>{usd.format(order.total)}</strong></div>
        </article>
      </div>

      <div className="customer-order-actions">
        <Link className="button secondary" href={`/account/orders/${order.id}/invoice`}>
          <FileText size={16} /> View or print invoice
        </Link>
        <Link className="button primary" href="/products">Shop again</Link>
      </div>
    </section>
  );
}
