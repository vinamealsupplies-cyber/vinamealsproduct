"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MessageSquareText,
  PackageCheck,
  PackageOpen,
  Pencil,
  Search,
  Truck,
  X,
  XCircle
} from "lucide-react";
import {
  cancelOrder,
  cancelPickup,
  confirmOrderPayment,
  confirmPickup,
  markPickupReady,
  saveShipmentTracking,
  updateOrderNotes
} from "@/app/admin/orders/actions";
import { PAYMENT_METHOD_LABELS } from "@/lib/business-order";
import { ORDER_STAFF_ACTION_LABEL } from "@/lib/data/order-staff-types";
import type { StaffOrder } from "@/lib/data/orders";
import { formatDate, formatDateTime, usd } from "@/lib/format";
import {
  carrierLabel,
  SHIPPING_CARRIERS,
  type ShippingCarrier
} from "@/lib/shipping-tracking";

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  confirmed: "Đã xác nhận",
  fulfilled: "Đã hoàn tất",
  cancelled: "Đã huỷ"
};

const STAFF_NOTE_HINT =
  "Ghi chú / lý do (bắt buộc, tối thiểu 3 ký tự). Tên bạn được gắn tự động từ tài khoản.";

/** Lý do huỷ đơn có sẵn — chọn nhanh cho đỡ gõ. */
const CANCEL_REASONS = [
  "Khách yêu cầu huỷ",
  "Hết hàng / thiếu hàng",
  "Sai địa chỉ giao",
  "Trùng đơn",
  "Khách không phản hồi",
  "Đơn thử / test"
];

/** Ngày local YYYY-MM-DD — filter đơn hoàn tất / huỷ. */
function toDayKey(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Ngày kết thúc đơn: huỷ → cancelledAt; hoàn tất → fulfilledAt; fallback createdAt. */
function completedOrderDayKey(order: StaffOrder): string {
  if (order.status === "cancelled") {
    return toDayKey(order.cancelledAt || order.createdAt);
  }
  return toDayKey(order.fulfilledAt || order.createdAt);
}

const HISTORY_PAGE_SIZE = 20;

/** Danh sách số trang có "…" khi nhiều trang: 1 … 4 5 6 … 20. */
function buildPageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("…");
  for (let p = start; p <= end; p += 1) pages.push(p);
  if (end < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

function fulfillmentLabel(order: StaffOrder) {
  if (order.status === "fulfilled") {
    return order.fulfillmentMethod === "pickup" ? "Đã lấy hàng" : "Đã ship / giao";
  }
  if (order.awaitingPickupPrep) return "Đang chuẩn bị (pickup)";
  if (order.awaitingPickup) return "Sẵn sàng pickup";
  if (order.awaitingDelivery) return "Chờ ship / giao";
  if (order.status === "cancelled") return "Đã huỷ";
  if (order.fulfillmentMethod === "pickup") return "Pickup";
  return "Ship / giao";
}

function OrderDetail({ order }: { order: StaffOrder }) {
  const notesCount = order.items.filter((i) => i.lineNote).length;
  return (
    <div className="order-detail-panel">
      <div className="order-detail-meta">
        <div>
          <strong>Khách</strong>
          <p>{order.customer}</p>
          {order.customerNotes ? (
            <p className="order-customer-note-red" role="note">
              <MessageSquareText size={13} aria-hidden="true" /> {order.customerNotes}
            </p>
          ) : null}
          {order.customerCompany ? <p className="field-hint">{order.customerCompany}</p> : null}
          {order.customerPhone ? (
            <p className="order-customer-phone">{order.customerPhone}</p>
          ) : (
            <p className="field-hint">Chưa có SĐT</p>
          )}
        </div>
        <div>
          <strong>Nhận hàng</strong>
          <p>
            {order.fulfillmentMethod === "pickup"
              ? `Pickup${order.pickupLocation ? ` · ${order.pickupLocation}` : ""}`
              : "Ship / giao hàng"}
          </p>
          {order.fulfillmentMethod === "ship" && order.shippingAddress ? (
            <div className="order-ship-address">
              {order.shippingAddress.recipientName ? (
                <p className="order-ship-name">{order.shippingAddress.recipientName}</p>
              ) : null}
              {order.shippingAddress.companyName ? (
                <p className="field-hint">{order.shippingAddress.companyName}</p>
              ) : null}
              {[order.shippingAddress.line1, order.shippingAddress.line2].filter(Boolean).length ? (
                <p className="field-hint">
                  {[order.shippingAddress.line1, order.shippingAddress.line2]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              ) : null}
              <p className="field-hint">
                {[order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.zip]
                  .filter(Boolean)
                  .join(", ")}
                {order.shippingAddress.country ? ` · ${order.shippingAddress.country}` : ""}
              </p>
              {order.shippingAddress.phone ? (
                <p className="field-hint">SĐT giao: {order.shippingAddress.phone}</p>
              ) : null}
              {order.shippingAddress.note ? (
                <p className="order-delivery-note">
                  <MessageSquareText size={13} aria-hidden="true" /> {order.shippingAddress.note}
                </p>
              ) : null}
            </div>
          ) : null}
          <p className="field-hint">Đặt lúc {formatDateTime(order.createdAt)}</p>
          {order.shippedAt ? (
            <p className="field-hint">Ship lúc {formatDateTime(order.shippedAt)}</p>
          ) : null}
          {order.fulfilledAt ? (
            <p className="field-hint">Hoàn tất {formatDateTime(order.fulfilledAt)}</p>
          ) : null}
          {order.pickedUpByName ? (
            <p className="order-pickup-by">
              Pickup xác nhận bởi <strong>{order.pickedUpByName}</strong>
              {order.pickedUpAt ? ` · ${formatDateTime(order.pickedUpAt)}` : ""}
            </p>
          ) : null}
        </div>
        <div>
          <strong>Trạng thái</strong>
          <p>{STATUS_LABEL[order.status] ?? order.status}</p>
          <p className="field-hint">{fulfillmentLabel(order)}</p>
          {order.trackingNumber ? (
            <p className="order-tracking-inline">
              {carrierLabel(order.shippingCarrier)} · {order.trackingNumber}
              {order.trackingUrl ? (
                <>
                  {" "}
                  <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer">
                    Tra cứu <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
          {order.status === "cancelled" ? (
            <div className="order-cancel-meta" role="status">
              <strong>Đã huỷ</strong>
              <p>
                Người huỷ:{" "}
                <strong className="order-cancel-name">
                  {order.cancelledByName ||
                    order.staffEvents.find((e) => e.action === "cancel")?.actorName ||
                    "Không ghi nhận (đơn huỷ trước khi bật log tên)"}
                </strong>
              </p>
              {order.cancelledAt || order.staffEvents.find((e) => e.action === "cancel")?.createdAt ? (
                <p className="field-hint">
                  Lúc{" "}
                  {formatDateTime(
                    order.cancelledAt ||
                      order.staffEvents.find((e) => e.action === "cancel")!.createdAt
                  )}
                </p>
              ) : null}
              {(order.cancelNote ||
                order.staffEvents.find((e) => e.action === "cancel")?.note) && (
                <p>
                  Note:{" "}
                  {order.cancelNote ||
                    order.staffEvents.find((e) => e.action === "cancel")?.note}
                </p>
              )}
            </div>
          ) : null}
          {order.lastStaffActorName && order.status !== "cancelled" ? (
            <p className="field-hint">
              Sửa gần nhất: <strong>{order.lastStaffActorName}</strong>
              {order.lastStaffAt ? ` · ${formatDateTime(order.lastStaffAt)}` : ""}
              {order.lastStaffNote ? ` — ${order.lastStaffNote}` : ""}
            </p>
          ) : null}
          {order.notes ? <p className="field-hint">Ghi chú đơn: {order.notes}</p> : null}
        </div>
        <div>
          <strong>Thanh toán</strong>
          <p>
            {order.paymentMethod
              ? PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod
              : "Chưa chọn phương thức"}
          </p>
          <p className="field-hint">
            {order.paymentStatus === "paid"
              ? "Đã thanh toán"
              : order.paymentStatus === "partial"
                ? "Trả một phần"
                : order.paymentStatus === "pending"
                  ? "Chờ thanh toán"
                  : "Chưa ghi nhận"}
            {" · "}Đã trả {usd.format(order.amountPaid)}
            {order.balanceDue > 0.009 ? ` · Còn ${usd.format(order.balanceDue)}` : ""}
          </p>
          {order.paymentReference ? (
            <p className="field-hint">Tham chiếu: {order.paymentReference}</p>
          ) : null}
          {order.paymentConfirmedAt ? (
            <p className="field-hint">Xác nhận {formatDateTime(order.paymentConfirmedAt)}</p>
          ) : null}
          {order.invoiceNumber ? (
            <p className="field-hint">Hoá đơn: {order.invoiceNumber}</p>
          ) : null}
          {order.paymentMethod === "card" ? (
            <p className="field-hint">
              Thẻ: chưa nối Stripe nên <strong>không lưu số thẻ</strong> — chỉ ghi nhận phương thức
              + số tiền.
            </p>
          ) : null}
        </div>
      </div>

      {order.staffEvents.length > 0 ? (
        <div className="order-staff-events">
          <h3>Lịch sử huỷ / sửa (nhân viên)</h3>
          <ul>
            {order.staffEvents.map((ev) => (
              <li key={ev.id}>
                <strong>{ORDER_STAFF_ACTION_LABEL[ev.action] ?? ev.action}</strong>
                {" · "}
                <span className="order-staff-actor">{ev.actorName}</span>
                {" · "}
                <time dateTime={ev.createdAt}>{formatDateTime(ev.createdAt)}</time>
                <p className="order-staff-note">{ev.note}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="order-detail-items-head">
        <h3>Món cần giao ({order.itemCount})</h3>
        {notesCount > 0 ? (
          <span className="order-notes-chip">
            <MessageSquareText size={13} aria-hidden="true" /> {notesCount} có yêu cầu đặc biệt
          </span>
        ) : null}
      </div>

      <div className="table-scroll">
        <table className="data-table order-items-detail-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Sản phẩm</th>
              <th className="num">SL</th>
              <th className="num">Đơn giá</th>
              <th className="num">Thành tiền</th>
              <th>Ghi chú / yêu cầu</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={item.id} className={item.lineNote ? "has-line-note" : undefined}>
                <td>{index + 1}</td>
                <td>
                  <strong>{item.productName}</strong>
                  {item.variantName ? <span className="field-hint">{item.variantName}</span> : null}
                  {item.sku ? <span className="field-hint">SKU {item.sku}</span> : null}
                </td>
                <td className="num">{item.quantity}</td>
                <td className="num">{usd.format(item.unitPrice)}</td>
                <td className="num">{usd.format(item.lineTotal)}</td>
                <td>
                  {item.lineNote ? (
                    <span className="line-note-text">
                      <MessageSquareText size={13} aria-hidden="true" /> {item.lineNote}
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
            {!order.items.length ? (
              <tr>
                <td className="empty-table" colSpan={6}>
                  Không có dòng hàng.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="order-detail-total">
        <span>Tổng đơn</span>
        <strong>{usd.format(order.total)}</strong>
      </div>
    </div>
  );
}

type RowHandlers = {
  expandedId: string | null;
  pendingId: string | null;
  toggleExpand: (order: StaffOrder) => void;
  run: (id: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => void;
  onEditNotes: (order: StaffOrder) => void;
  onCancel: (order: StaffOrder) => void;
  onShipTracking: (order: StaffOrder) => void;
  onCancelPickup: (order: StaffOrder) => void;
};

function OrderRows({ orders, handlers }: { orders: StaffOrder[]; handlers: RowHandlers }) {
  const {
    expandedId,
    pendingId,
    toggleExpand,
    run,
    onEditNotes,
    onCancel,
    onShipTracking,
    onCancelPickup
  } = handlers;

  return (
    <>
      {orders.map((order) => {
        const expanded = expandedId === order.id;
        const specialCount = order.items.filter((i) => i.lineNote).length;
        return (
          <Fragment key={order.id}>
            <tr
              className={[
                order.awaitingPickup
                  ? "row-awaiting-pickup"
                  : order.awaitingPickupPrep
                    ? "row-awaiting-prep"
                    : order.awaitingDelivery
                      ? "row-awaiting-ship"
                      : "",
                expanded ? "row-order-expanded" : "",
                "row-order-clickable"
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <td>
                <button
                  type="button"
                  className="order-expand-btn"
                  aria-expanded={expanded}
                  aria-label={expanded ? "Thu gọn chi tiết đơn" : "Xem chi tiết đơn"}
                  onClick={() => toggleExpand(order)}
                >
                  {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>
              </td>
              <td>
                <button type="button" className="order-number-btn" onClick={() => toggleExpand(order)}>
                  <span className="order-number">{order.number}</span>
                  <span className="order-itemcount">
                    {order.itemCount} món
                    {specialCount > 0 ? (
                      <span className="order-note-count">
                        {" "}
                        · {specialCount} ghi chú
                      </span>
                    ) : null}
                  </span>
                </button>
              </td>
              <td>
                <span className="order-customer-name">{order.customer}</span>
                {order.customerCompany ? (
                  <span className="field-hint">{order.customerCompany}</span>
                ) : null}
                {order.customerPhone ? (
                  <span className="order-customer-phone">{order.customerPhone}</span>
                ) : (
                  <span className="field-hint">Chưa có SĐT</span>
                )}
              </td>
              <td>{formatDate(order.createdAt)}</td>
              <td>
                {order.fulfillmentMethod === "pickup"
                  ? `Pickup${order.pickupLocation ? ` · ${order.pickupLocation}` : ""}`
                  : "Ship / giao"}
              </td>
              <td className="num">{usd.format(order.total)}</td>
              <td>
                <span className={`status-badge status-${order.status}`}>
                  {STATUS_LABEL[order.status] ?? order.status}
                </span>
                <div style={{ marginTop: 6 }}>
                  {order.paymentStatus === "paid" ? (
                    <span className="status-pill status-approved">Paid</span>
                  ) : order.paymentStatus === "pending" || order.paymentStatus === "partial" ? (
                    <span className="status-pill status-pending">
                      {order.paymentStatus === "partial" ? "Partial pay" : "Awaiting payment"}
                      {order.paymentMethod
                        ? ` · ${PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}`
                        : ""}
                    </span>
                  ) : (
                    <span className="status-pill status-not-requested">No invoice</span>
                  )}
                </div>
              </td>
              <td>
                {order.status === "fulfilled" ? (
                  <span className="pickup-badge done">
                    <CheckCircle2 size={14} aria-hidden="true" />{" "}
                    {order.fulfillmentMethod === "pickup" ? "Đã lấy hàng" : "Đã ship / giao"}
                  </span>
                ) : order.awaitingPickupPrep ? (
                  <span className="pickup-badge waiting">
                    <PackageOpen size={14} aria-hidden="true" /> ĐANG CHUẨN BỊ
                  </span>
                ) : order.awaitingPickup ? (
                  <span className="pickup-badge waiting blink-red">
                    <AlertTriangle size={14} aria-hidden="true" /> SẴN SÀNG PICKUP
                  </span>
                ) : order.awaitingDelivery ? (
                  <span className="pickup-badge waiting-ship blink-pink">
                    <Truck size={14} aria-hidden="true" /> CHỜ SHIP
                  </span>
                ) : order.status === "cancelled" ? (
                  <span className="muted">
                    Đã huỷ
                    {order.cancelledByName ? ` · ${order.cancelledByName}` : ""}
                  </span>
                ) : (
                  <span className="muted">—</span>
                )}
                {order.trackingNumber ? (
                  <span className="order-tracking-chip">
                    {carrierLabel(order.shippingCarrier)} {order.trackingNumber}
                  </span>
                ) : null}
                {order.pickedUpByName ? (
                  <span className="order-pickup-by-chip">Bởi {order.pickedUpByName}</span>
                ) : null}
                {order.status === "cancelled" && order.cancelNote ? (
                  <span className="order-cancel-note-chip" title={order.cancelNote}>
                    Note: {order.cancelNote}
                  </span>
                ) : null}
              </td>
              <td className="row-actions orders-row-actions">
                {order.canConfirmPayment ? (
                  <button
                    className="button primary compact"
                    type="button"
                    disabled={pendingId === order.id}
                    onClick={() => {
                      const note = window.prompt(
                        "Ghi chú xác nhận thanh toán (bắt buộc):",
                        order.paymentMethod
                          ? `Received ${PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}`
                          : "Payment received"
                      );
                      if (note == null) return;
                      const ref = window.prompt(
                        "Mã tham chiếu (check # / Zelle / transfer) — optional:",
                        order.paymentReference ?? ""
                      );
                      if (ref === null) return;
                      void run(order.id, () => confirmOrderPayment(order.id, note, ref));
                    }}
                  >
                    {pendingId === order.id ? "…" : "Confirm payment"}
                  </button>
                ) : null}
                {order.canMarkPickupReady ? (
                  <button
                    className="button blue compact"
                    type="button"
                    disabled={pendingId === order.id}
                    onClick={() =>
                      run(order.id, () =>
                        markPickupReady(order.id, "Order ready for customer pickup")
                      )
                    }
                    title="Customer will see Ready for pickup on their account"
                  >
                    {pendingId === order.id ? "…" : "Sẵn sàng pickup"}
                  </button>
                ) : null}
                {order.canConfirmPickedUp ? (
                  <button
                    className={
                      order.awaitingPickup ? "button primary compact" : "button secondary compact"
                    }
                    type="button"
                    disabled={pendingId === order.id}
                    onClick={() => run(order.id, () => confirmPickup(order.id))}
                    title="Customer has collected the order at the store"
                  >
                    {pendingId === order.id ? "…" : "Xác nhận đã lấy"}
                  </button>
                ) : null}
                {order.canCancelPickup ? (
                  <button
                    type="button"
                    className="danger compact"
                    onClick={() => onCancelPickup(order)}
                  >
                    Huỷ pickup
                  </button>
                ) : null}
                {order.canEditTracking && !order.awaitingDelivery ? (
                  <button type="button" className="compact" onClick={() => onShipTracking(order)}>
                    <Truck size={14} aria-hidden="true" />
                    {order.trackingNumber ? "Sửa shipping info" : "Shipping info"}
                  </button>
                ) : null}
                {order.trackingUrl ? (
                  <a
                    className="button secondary compact"
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={14} aria-hidden="true" /> Tra cứu
                  </a>
                ) : null}
                {order.awaitingDelivery ? (
                  <button
                    className="button primary compact"
                    type="button"
                    onClick={() => onShipTracking(order)}
                  >
                    <Truck size={14} aria-hidden="true" />
                    {order.trackingNumber ? "Xác nhận đã ship" : "Shipping info + ship"}
                  </button>
                ) : null}
                {order.canEditNotes ? (
                  <button type="button" className="compact" onClick={() => onEditNotes(order)}>
                    <Pencil size={14} aria-hidden="true" /> Ghi chú
                  </button>
                ) : null}
                {order.canCancel ? (
                  <button type="button" className="danger compact" onClick={() => onCancel(order)}>
                    <XCircle size={14} aria-hidden="true" /> Huỷ
                  </button>
                ) : null}
              </td>
            </tr>
          </Fragment>
        );
      })}
    </>
  );
}

function OrdersSection({
  title,
  description,
  icon,
  orders,
  emptyText,
  handlers,
  accent
}: {
  title: string;
  description: string;
  icon: ReactNode;
  orders: StaffOrder[];
  emptyText: string;
  handlers: RowHandlers;
  accent?: "open" | "done";
}) {
  return (
    <section className={`orders-section orders-section-${accent ?? "default"}`}>
      <div className="orders-section-heading">
        <div>
          <h2>
            {icon}
            {title}
            <span className="orders-section-count">{orders.length}</span>
          </h2>
          <p>{description}</p>
        </div>
      </div>

      {!orders.length ? (
        <p className="field-hint orders-section-empty">{emptyText}</p>
      ) : (
        <div className="orders-table-wrap">
          <table className="orders-table">
            <thead>
              <tr>
                <th aria-label="Chi tiết" />
                <th>Đơn</th>
                <th>Khách</th>
                <th>Ngày</th>
                <th>Nhận hàng</th>
                <th className="num">Tổng</th>
                <th>Trạng thái</th>
                <th>Giao / Ship / Pickup</th>
                <th aria-label="Hành động" />
              </tr>
            </thead>
            <tbody>
              <OrderRows orders={orders} handlers={handlers} />
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function OrdersManager({ orders }: { orders: StaffOrder[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<StaffOrder | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [canceling, setCanceling] = useState<StaffOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [shippingOrder, setShippingOrder] = useState<StaffOrder | null>(null);
  const [carrier, setCarrier] = useState<ShippingCarrier>("usps");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [cancelPickupOrder, setCancelPickupOrder] = useState<StaffOrder | null>(null);
  const [cancelPickupReason, setCancelPickupReason] = useState("");
  /** Note khi sửa ghi chú (bắt buộc) / shipping (tuỳ chọn). */
  const [staffActionNote, setStaffActionNote] = useState("");
  /**
   * Ngày filter cho mục đã hoàn tất / đã huỷ.
   * null = chưa chọn (dùng ngày gần nhất có đơn).
   */
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyMode, setHistoryMode] = useState<"all" | "day" | "month">("all");
  const [historyDay, setHistoryDay] = useState("");
  const [historyMonth, setHistoryMonth] = useState("");
  const [historyPage, setHistoryPage] = useState(1);

  // Phần 1: chờ giao / ship / pickup (confirmed) — luôn hiện đủ.
  const openOrders = orders.filter((o) => o.status === "confirmed");
  // Phần 2: đã hoàn tất + đã huỷ — search khách + lọc ngày/tháng + phân trang.
  const allCompleted = useMemo(
    () => orders.filter((o) => o.status === "fulfilled" || o.status === "cancelled"),
    [orders]
  );

  const filteredCompleted = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    return allCompleted.filter((o) => {
      if (q) {
        const hay =
          `${o.customer} ${o.customerCompany ?? ""} ${o.customerPhone ?? ""} ${o.number}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (historyMode === "day" && historyDay) {
        return completedOrderDayKey(o) === historyDay;
      }
      if (historyMode === "month" && historyMonth) {
        return completedOrderDayKey(o).startsWith(historyMonth);
      }
      return true;
    });
  }, [allCompleted, historyQuery, historyMode, historyDay, historyMonth]);

  const historyTotalPages = Math.max(1, Math.ceil(filteredCompleted.length / HISTORY_PAGE_SIZE));
  const historyPageClamped = Math.min(Math.max(1, historyPage), historyTotalPages);
  const pagedCompleted = useMemo(
    () =>
      filteredCompleted.slice(
        (historyPageClamped - 1) * HISTORY_PAGE_SIZE,
        historyPageClamped * HISTORY_PAGE_SIZE
      ),
    [filteredCompleted, historyPageClamped]
  );

  const awaitingCount = openOrders.filter(
    (o) => o.awaitingPickupPrep || o.awaitingPickup || o.awaitingDelivery
  ).length;

  async function run(id: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setPendingId(id);
    setError(null);
    const result = await fn();
    setPendingId(null);
    if (result.ok) {
      setEditingNotes(null);
      setCanceling(null);
      setCancelReason("");
      setShippingOrder(null);
      setCancelPickupOrder(null);
      setCancelPickupReason("");
      setStaffActionNote("");
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  const handlers: RowHandlers = {
    expandedId,
    pendingId,
    toggleExpand: (order) => setExpandedId((current) => (current === order.id ? null : order.id)),
    run,
    onEditNotes: (order) => {
      setError(null);
      setCanceling(null);
      setShippingOrder(null);
      setCancelPickupOrder(null);
      setEditingNotes(order);
      setNotesDraft(order.notes ?? "");
      setStaffActionNote("");
    },
    onCancel: (order) => {
      setError(null);
      setEditingNotes(null);
      setShippingOrder(null);
      setCancelPickupOrder(null);
      setCanceling(order);
      setCancelReason("");
    },
    onShipTracking: (order) => {
      setError(null);
      setEditingNotes(null);
      setCanceling(null);
      setCancelPickupOrder(null);
      setShippingOrder(order);
      setStaffActionNote("");
      setCarrier(
        (order.shippingCarrier as ShippingCarrier) &&
          SHIPPING_CARRIERS.some((c) => c.value === order.shippingCarrier)
          ? (order.shippingCarrier as ShippingCarrier)
          : "usps"
      );
      setTrackingNumber(order.trackingNumber ?? "");
      setCustomUrl("");
    },
    onCancelPickup: (order) => {
      setError(null);
      setEditingNotes(null);
      setCanceling(null);
      setShippingOrder(null);
      setCancelPickupOrder(order);
      setCancelPickupReason("");
    }
  };

  if (!orders.length) {
    return (
      <div className="empty-state large">
        <PackageOpen size={34} aria-hidden="true" />
        <h2>Chưa có đơn hàng</h2>
        <p>Đơn sẽ xuất hiện ở đây sau khi khách đặt hàng ở trang checkout.</p>
      </div>
    );
  }

  const detailOrder = expandedId ? orders.find((o) => o.id === expandedId) ?? null : null;

  return (
    <>
      {awaitingCount > 0 ? (
        <div className="pickup-alert-banner blink-red" role="status">
          <AlertTriangle size={18} aria-hidden="true" />
          {awaitingCount} đơn đang chờ giao / ship / pickup — bấm vào đơn để xem món + ghi chú khách.
        </div>
      ) : null}

      {detailOrder ? (
        <div
          className="orders-action-modal orders-detail-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="orders-detail-title"
        >
          <button
            type="button"
            className="orders-action-modal-backdrop"
            aria-label="Đóng"
            onClick={() => setExpandedId(null)}
          />
          <div className="form-card orders-action-modal-panel orders-detail-modal-panel">
            <div className="orders-detail-modal-head">
              <h2 id="orders-detail-title">Đơn {detailOrder.number}</h2>
              <button
                type="button"
                className="orders-detail-close"
                aria-label="Đóng"
                onClick={() => setExpandedId(null)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <OrderDetail order={detailOrder} />
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {editingNotes ? (
        <div className="orders-action-modal" role="dialog" aria-modal="true" aria-labelledby="orders-edit-notes-title">
          <button
            type="button"
            className="orders-action-modal-backdrop"
            aria-label="Đóng"
            onClick={() => setEditingNotes(null)}
          />
          <div className="form-card compact-form-card orders-action-modal-panel">
            <h2 id="orders-edit-notes-title">Sửa ghi chú — {editingNotes.number}</h2>
            <p className="field-hint">{STAFF_NOTE_HINT}</p>
            <textarea
              rows={4}
              maxLength={2000}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="Ghi chú nội bộ trên đơn (giao hàng, gọi khách…)"
            />
            <label className="orders-staff-note-field">
              Note thao tác (bắt buộc)
              <input
                value={staffActionNote}
                onChange={(e) => setStaffActionNote(e.target.value)}
                placeholder="Vd. cập nhật SĐT khách, ghi chú ship…"
                maxLength={500}
                required
              />
            </label>
            <div className="button-row">
              <button
                className="button primary"
                type="button"
                disabled={pendingId === editingNotes.id || staffActionNote.trim().length < 3}
                onClick={() =>
                  run(editingNotes.id, () =>
                    updateOrderNotes(editingNotes.id, notesDraft, staffActionNote)
                  )
                }
              >
                {pendingId === editingNotes.id ? "Đang lưu…" : "Lưu ghi chú"}
              </button>
              <button className="button secondary" type="button" onClick={() => setEditingNotes(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {canceling ? (
        <div className="orders-action-modal" role="dialog" aria-modal="true" aria-labelledby="orders-cancel-title">
          <button
            type="button"
            className="orders-action-modal-backdrop"
            aria-label="Đóng"
            onClick={() => setCanceling(null)}
          />
          <div className="form-card compact-form-card orders-action-modal-panel">
            <h2 id="orders-cancel-title">Huỷ đơn {canceling.number}?</h2>
            <p className="field-hint">
              Bắt buộc note. Tên bạn (từ tài khoản) được ghi lại. Không huỷ đơn đã giao.
            </p>
            <label className="orders-staff-note-field">
              Lý do huỷ (bắt buộc)
              <select
                className="orders-cancel-reason-select"
                value={CANCEL_REASONS.includes(cancelReason) ? cancelReason : ""}
                onChange={(e) => {
                  if (e.target.value) setCancelReason(e.target.value);
                }}
              >
                <option value="">— Chọn lý do có sẵn —</option>
                {CANCEL_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
              <input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Hoặc tự nhập lý do…"
                maxLength={500}
                required
              />
            </label>
            <div className="button-row orders-modal-actions">
              <button
                className="button danger"
                type="button"
                disabled={pendingId === canceling.id || cancelReason.trim().length < 3}
                onClick={() => run(canceling.id, () => cancelOrder(canceling.id, cancelReason))}
              >
                <XCircle size={16} aria-hidden="true" />
                {pendingId === canceling.id ? "Đang huỷ…" : "Xác nhận huỷ đơn"}
              </button>
              <button className="button secondary" type="button" onClick={() => setCanceling(null)}>
                Không huỷ
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cancelPickupOrder ? (
        <div className="orders-action-modal" role="dialog" aria-modal="true" aria-labelledby="orders-cancel-pickup-title">
          <button
            type="button"
            className="orders-action-modal-backdrop"
            aria-label="Đóng"
            onClick={() => setCancelPickupOrder(null)}
          />
          <div className="form-card compact-form-card orders-action-modal-panel">
            <h2 id="orders-cancel-pickup-title">Huỷ pickup — {cancelPickupOrder.number}?</h2>
            <p className="field-hint">
              Đơn sẽ trở lại <strong>chờ pickup</strong>.
              {cancelPickupOrder.pickedUpByName
                ? ` Trước đó do ${cancelPickupOrder.pickedUpByName} xác nhận.`
                : ""}{" "}
              Bắt buộc note + tên người huỷ.
            </p>
            <label className="orders-staff-note-field">
              Lý do huỷ pickup (bắt buộc)
              <input
                value={cancelPickupReason}
                onChange={(e) => setCancelPickupReason(e.target.value)}
                placeholder="Vd. nhầm đơn, khách chưa lấy…"
                maxLength={500}
                required
              />
            </label>
            <div className="button-row">
              <button
                className="button danger"
                type="button"
                disabled={pendingId === cancelPickupOrder.id || cancelPickupReason.trim().length < 3}
                onClick={() =>
                  run(cancelPickupOrder.id, () =>
                    cancelPickup(cancelPickupOrder.id, cancelPickupReason)
                  )
                }
              >
                {pendingId === cancelPickupOrder.id ? "Đang huỷ…" : "Xác nhận huỷ pickup"}
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => setCancelPickupOrder(null)}
              >
                Không huỷ
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {shippingOrder ? (
        <div className="orders-action-modal" role="dialog" aria-modal="true" aria-labelledby="orders-shipping-title">
          <button
            type="button"
            className="orders-action-modal-backdrop"
            aria-label="Đóng"
            onClick={() => setShippingOrder(null)}
          />
          <div className="form-card compact-form-card orders-action-modal-panel">
            <h2 id="orders-shipping-title">
              <Truck size={18} aria-hidden="true" /> Shipping info — {shippingOrder.number}
            </h2>
            <p className="field-hint">
              Đơn <strong>ship</strong>. Nhập hãng + tracking. Note thao tác{" "}
              <strong>tuỳ chọn</strong> — tên bạn vẫn được ghi lại.
            </p>
            {shippingOrder.shippingAddress ? (
              <div className="orders-ship-address-box">
                <strong>Giao đến</strong>
                {shippingOrder.shippingAddress.recipientName ? (
                  <p className="order-ship-name">{shippingOrder.shippingAddress.recipientName}</p>
                ) : null}
                <p>
                  {[shippingOrder.shippingAddress.line1, shippingOrder.shippingAddress.line2]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                <p>
                  {[
                    shippingOrder.shippingAddress.city,
                    shippingOrder.shippingAddress.state,
                    shippingOrder.shippingAddress.zip
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {shippingOrder.shippingAddress.phone ? (
                  <p className="field-hint">SĐT: {shippingOrder.shippingAddress.phone}</p>
                ) : null}
                {shippingOrder.shippingAddress.note ? (
                  <p className="order-delivery-note">
                    <MessageSquareText size={13} aria-hidden="true" />{" "}
                    {shippingOrder.shippingAddress.note}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="form-grid two-columns">
              <label>
                Hãng vận chuyển
                <select
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value as ShippingCarrier)}
                >
                  {SHIPPING_CARRIERS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Mã số giao hàng (tracking)
                <input
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="VD: 9400 1000 0000 0000 0000 00"
                  maxLength={80}
                  autoComplete="off"
                />
              </label>
              <label className="full-width">
                Link tra cứu tùy chỉnh (tuỳ chọn)
                <input
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://… — để trống sẽ dùng link FedEx/USPS/UPS/DHL"
                  maxLength={500}
                />
              </label>
              <label className="full-width orders-staff-note-field">
                Note thao tác (tuỳ chọn)
                <input
                  value={staffActionNote}
                  onChange={(e) => setStaffActionNote(e.target.value)}
                  placeholder="Vd. cập nhật tracking FedEx, ship lần 1…"
                  maxLength={500}
                />
              </label>
            </div>
            <div className="button-row">
              {shippingOrder.status === "confirmed" ? (
                <button
                  className="button primary"
                  type="button"
                  disabled={pendingId === shippingOrder.id}
                  onClick={() =>
                    run(shippingOrder.id, () =>
                      saveShipmentTracking(
                        shippingOrder.id,
                        carrier,
                        trackingNumber,
                        customUrl,
                        true,
                        staffActionNote
                      )
                    )
                  }
                >
                  <Truck size={16} aria-hidden="true" />
                  {pendingId === shippingOrder.id ? "Đang lưu…" : "Xác nhận đã ship"}
                </button>
              ) : null}
              <button
                className="button secondary"
                type="button"
                disabled={pendingId === shippingOrder.id}
                onClick={() =>
                  run(shippingOrder.id, () =>
                    saveShipmentTracking(
                      shippingOrder.id,
                      carrier,
                      trackingNumber,
                      customUrl,
                      false,
                      staffActionNote
                    )
                  )
                }
              >
                {pendingId === shippingOrder.id ? "…" : "Chỉ lưu tracking"}
              </button>
              {shippingOrder.trackingUrl || trackingNumber ? (
                <a
                  className="button secondary"
                  href={
                    shippingOrder.trackingUrl ||
                    `https://www.google.com/search?q=${encodeURIComponent(`${carrier} ${trackingNumber}`)}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={16} aria-hidden="true" /> Tra cứu
                </a>
              ) : null}
              <button
                className="button secondary"
                type="button"
                onClick={() => setShippingOrder(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <OrdersSection
        accent="open"
        title="Chờ giao / ship / pickup"
        description="Đơn đã xác nhận — cần giao hàng, ship, hoặc khách tới pickup. Bấm xác nhận khi xong."
        icon={<Truck size={20} aria-hidden="true" />}
        orders={openOrders}
        emptyText="Không có đơn đang chờ giao / ship / pickup."
        handlers={handlers}
      />

      <section className="orders-section orders-section-done">
        <div className="orders-section-heading">
          <div>
            <h2>
              <PackageCheck size={20} aria-hidden="true" />
              Đã hoàn tất / đã huỷ
              <span className="orders-section-count">{filteredCompleted.length}</span>
            </h2>
            <p>Đơn đã hoàn tất hoặc đã huỷ. Tìm theo khách, lọc theo ngày / tháng.</p>
          </div>
        </div>

        <div className="orders-history-filters">
          <label className="table-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={historyQuery}
              onChange={(e) => {
                setHistoryQuery(e.target.value);
                setHistoryPage(1);
              }}
              placeholder="Tìm khách (tên / SĐT / số đơn)…"
            />
          </label>
          <div className="orders-history-mode" role="group" aria-label="Lọc thời gian">
            {(
              [
                ["all", "Tất cả"],
                ["day", "Theo ngày"],
                ["month", "Theo tháng"]
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={historyMode === value ? "active" : ""}
                onClick={() => {
                  setHistoryMode(value);
                  setHistoryPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {historyMode === "day" ? (
            <input
              type="date"
              className="orders-history-date"
              value={historyDay}
              onChange={(e) => {
                setHistoryDay(e.target.value);
                setHistoryPage(1);
              }}
            />
          ) : historyMode === "month" ? (
            <input
              type="month"
              className="orders-history-date"
              value={historyMonth}
              onChange={(e) => {
                setHistoryMonth(e.target.value);
                setHistoryPage(1);
              }}
            />
          ) : null}
        </div>

        {!allCompleted.length ? (
          <p className="field-hint orders-section-empty">Chưa có đơn hoàn tất hoặc đã huỷ.</p>
        ) : !filteredCompleted.length ? (
          <p className="field-hint orders-section-empty">Không có đơn khớp bộ lọc.</p>
        ) : (
          <>
            <div className="orders-table-wrap">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th aria-label="Chi tiết" />
                    <th>Đơn</th>
                    <th>Khách</th>
                    <th>Ngày</th>
                    <th>Nhận hàng</th>
                    <th className="num">Tổng</th>
                    <th>Trạng thái</th>
                    <th>Giao / Ship / Pickup</th>
                    <th aria-label="Hành động" />
                  </tr>
                </thead>
                <tbody>
                  <OrderRows orders={pagedCompleted} handlers={handlers} />
                </tbody>
              </table>
            </div>
            {historyTotalPages > 1 ? (
              <div className="orders-pagination" role="navigation" aria-label="Trang">
                <span className="orders-pagination-info">
                  Trang {historyPageClamped}/{historyTotalPages} · {filteredCompleted.length} đơn
                </span>
                <div className="orders-pagination-pages">
                  <button
                    type="button"
                    className="orders-page-btn"
                    disabled={historyPageClamped <= 1}
                    aria-label="Trang trước"
                    onClick={() => setHistoryPage(historyPageClamped - 1)}
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                  </button>
                  {buildPageList(historyPageClamped, historyTotalPages).map((p, i) =>
                    p === "…" ? (
                      <span key={`e${i}`} className="orders-page-ellipsis">
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        className={p === historyPageClamped ? "orders-page-btn active" : "orders-page-btn"}
                        aria-current={p === historyPageClamped ? "page" : undefined}
                        onClick={() => setHistoryPage(p)}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    className="orders-page-btn"
                    disabled={historyPageClamped >= historyTotalPages}
                    aria-label="Trang sau"
                    onClick={() => setHistoryPage(historyPageClamped + 1)}
                  >
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </>
  );
}
