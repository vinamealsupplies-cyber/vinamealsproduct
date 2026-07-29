"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MessageSquareText,
  PackageCheck,
  PackageOpen,
  Pencil,
  Truck,
  XCircle
} from "lucide-react";
import {
  cancelOrder,
  cancelPickup,
  confirmPickup,
  saveShipmentTracking,
  updateOrderNotes
} from "@/app/admin/orders/actions";
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

function formatDayKeyLabel(dayKey: string): string {
  if (!dayKey) return "—";
  const [y, m, d] = dayKey.split("-").map(Number);
  if (!y || !m || !d) return dayKey;
  return formatDate(new Date(y, m - 1, d));
}

function fulfillmentLabel(order: StaffOrder) {
  if (order.status === "fulfilled") {
    return order.fulfillmentMethod === "pickup" ? "Đã pickup" : "Đã ship / giao";
  }
  if (order.awaitingPickup) return "Chờ pickup";
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
                order.awaitingPickup || order.awaitingDelivery ? "row-awaiting-pickup" : "",
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
              </td>
              <td>
                {order.status === "fulfilled" ? (
                  <span className="pickup-badge done">
                    <CheckCircle2 size={14} aria-hidden="true" />{" "}
                    {order.fulfillmentMethod === "pickup" ? "Đã pickup" : "Đã ship / giao"}
                  </span>
                ) : order.awaitingPickup ? (
                  <span className="pickup-badge waiting blink-red">
                    <AlertTriangle size={14} aria-hidden="true" /> CHỜ PICKUP
                  </span>
                ) : order.awaitingDelivery ? (
                  <span className="pickup-badge waiting blink-red">
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
                {order.awaitingPickup ? (
                  <button
                    className="button primary compact"
                    type="button"
                    disabled={pendingId === order.id}
                    onClick={() => run(order.id, () => confirmPickup(order.id))}
                  >
                    {pendingId === order.id ? "…" : "Xác nhận pickup"}
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
            {expanded ? (
              <tr className="order-detail-row">
                <td colSpan={9}>
                  <OrderDetail order={order} />
                </td>
              </tr>
            ) : null}
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
  /** Note bắt buộc khi sửa ghi chú / shipping. */
  const [staffActionNote, setStaffActionNote] = useState("");
  /**
   * Ngày filter cho mục đã hoàn tất / đã huỷ.
   * null = chưa chọn (dùng ngày gần nhất có đơn).
   */
  const [completedDay, setCompletedDay] = useState<string | null>(null);

  // Phần 1: chờ giao / ship / pickup (confirmed) — luôn hiện đủ.
  const openOrders = orders.filter((o) => o.status === "confirmed");
  // Phần 2: đã hoàn tất + đã huỷ — lọc theo ngày.
  const allCompleted = useMemo(
    () => orders.filter((o) => o.status === "fulfilled" || o.status === "cancelled"),
    [orders]
  );

  /** Các ngày có đơn hoàn tất/huỷ, mới nhất trước. */
  const completedDayKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const o of allCompleted) {
      const key = completedOrderDayKey(o);
      if (key) keys.add(key);
    }
    return [...keys].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  }, [allCompleted]);

  const defaultCompletedDay = completedDayKeys[0] ?? "";
  const activeCompletedDay =
    completedDay && completedDayKeys.includes(completedDay)
      ? completedDay
      : defaultCompletedDay;

  const completedOrders = useMemo(() => {
    if (!activeCompletedDay) return [];
    return allCompleted.filter((o) => completedOrderDayKey(o) === activeCompletedDay);
  }, [allCompleted, activeCompletedDay]);

  const dayIndex = completedDayKeys.indexOf(activeCompletedDay);
  const canPrevDay = dayIndex >= 0 && dayIndex < completedDayKeys.length - 1; // older
  const canNextDay = dayIndex > 0; // newer

  const awaitingCount = openOrders.filter((o) => o.awaitingPickup || o.awaitingDelivery).length;

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

  return (
    <>
      {awaitingCount > 0 ? (
        <div className="pickup-alert-banner blink-red" role="status">
          <AlertTriangle size={18} aria-hidden="true" />
          {awaitingCount} đơn đang chờ giao / ship / pickup — bấm vào đơn để xem món + ghi chú khách.
        </div>
      ) : null}

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {editingNotes ? (
        <div className="form-card compact-form-card orders-inline-panel">
          <h2>Sửa ghi chú — {editingNotes.number}</h2>
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
      ) : null}

      {canceling ? (
        <div className="form-card compact-form-card orders-inline-panel">
          <h2>Huỷ đơn {canceling.number}?</h2>
          <p className="field-hint">
            Bắt buộc note. Tên bạn (từ tài khoản) được ghi lại. Không huỷ đơn đã giao.
          </p>
          <label className="orders-staff-note-field">
            Lý do huỷ (bắt buộc)
            <input
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Vd. khách yêu cầu huỷ, hết hàng…"
              maxLength={500}
              required
            />
          </label>
          <div className="button-row">
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
      ) : null}

      {cancelPickupOrder ? (
        <div className="form-card compact-form-card orders-inline-panel">
          <h2>Huỷ pickup — {cancelPickupOrder.number}?</h2>
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
      ) : null}

      {shippingOrder ? (
        <div className="form-card compact-form-card orders-inline-panel">
          <h2>
            <Truck size={18} aria-hidden="true" /> Shipping info — {shippingOrder.number}
          </h2>
          <p className="field-hint">
            Đơn <strong>ship</strong>. Nhập hãng + tracking. <strong>Note thao tác bắt buộc</strong>{" "}
            — tên bạn được ghi lại.
          </p>
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
              Note thao tác (bắt buộc)
              <input
                value={staffActionNote}
                onChange={(e) => setStaffActionNote(e.target.value)}
                placeholder="Vd. cập nhật tracking FedEx, ship lần 1…"
                maxLength={500}
                required
              />
            </label>
          </div>
          <div className="button-row">
            {shippingOrder.status === "confirmed" ? (
              <button
                className="button primary"
                type="button"
                disabled={pendingId === shippingOrder.id || staffActionNote.trim().length < 3}
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
              disabled={pendingId === shippingOrder.id || staffActionNote.trim().length < 3}
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
        <div className="orders-section-heading orders-section-heading-with-date">
          <div>
            <h2>
              <PackageCheck size={20} aria-hidden="true" />
              Đã hoàn tất / đã huỷ
              <span className="orders-section-count">{completedOrders.length}</span>
            </h2>
            <p>
              Chỉ hiện đơn hoàn tất hoặc huỷ trong{" "}
              <strong>{activeCompletedDay ? formatDayKeyLabel(activeCompletedDay) : "—"}</strong>
              {defaultCompletedDay && activeCompletedDay === defaultCompletedDay
                ? " (ngày gần nhất có đơn)"
                : ""}
              . Chọn ngày khác để xem lịch sử.
            </p>
          </div>
          {completedDayKeys.length > 0 ? (
            <div className="orders-day-picker" role="group" aria-label="Chọn ngày đơn hoàn tất">
              <button
                type="button"
                className="button secondary compact"
                disabled={!canPrevDay}
                aria-label="Ngày cũ hơn có đơn"
                onClick={() => {
                  if (canPrevDay) setCompletedDay(completedDayKeys[dayIndex + 1]!);
                }}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <label className="orders-day-picker-field">
                <CalendarDays size={15} aria-hidden="true" />
                <span className="visually-hidden">Ngày</span>
                <input
                  type="date"
                  value={activeCompletedDay}
                  max={completedDayKeys[0]}
                  min={completedDayKeys[completedDayKeys.length - 1]}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (!next) return;
                    // Nếu chọn ngày không có đơn → nhảy về ngày có đơn gần nhất (≤ chọn).
                    if (completedDayKeys.includes(next)) {
                      setCompletedDay(next);
                      return;
                    }
                    const olderOrSame = completedDayKeys.find((k) => k <= next);
                    setCompletedDay(olderOrSame ?? completedDayKeys[0]!);
                  }}
                />
              </label>
              <button
                type="button"
                className="button secondary compact"
                disabled={!canNextDay}
                aria-label="Ngày mới hơn có đơn"
                onClick={() => {
                  if (canNextDay) setCompletedDay(completedDayKeys[dayIndex - 1]!);
                }}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
              {activeCompletedDay !== defaultCompletedDay ? (
                <button
                  type="button"
                  className="button secondary compact"
                  onClick={() => setCompletedDay(null)}
                >
                  Ngày gần nhất
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {!allCompleted.length ? (
          <p className="field-hint orders-section-empty">Chưa có đơn hoàn tất hoặc đã huỷ.</p>
        ) : !completedOrders.length ? (
          <p className="field-hint orders-section-empty">
            Không có đơn hoàn tất / huỷ trong ngày {formatDayKeyLabel(activeCompletedDay)}.
          </p>
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
                <OrderRows orders={completedOrders} handlers={handlers} />
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
