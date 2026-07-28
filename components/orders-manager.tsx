"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  MessageSquareText,
  PackageOpen,
  Pencil,
  Truck,
  XCircle
} from "lucide-react";
import {
  cancelOrder,
  confirmDelivered,
  confirmPickup,
  updateOrderNotes
} from "@/app/admin/orders/actions";
import type { StaffOrder } from "@/lib/data/orders";
import { formatDate, formatDateTime, usd } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  confirmed: "Đã xác nhận",
  fulfilled: "Đã hoàn tất",
  cancelled: "Đã huỷ"
};

function OrderDetail({ order }: { order: StaffOrder }) {
  const notesCount = order.items.filter((i) => i.lineNote).length;
  return (
    <div className="order-detail-panel">
      <div className="order-detail-meta">
        <div>
          <strong>Khách</strong>
          <p>{order.customer}</p>
          {order.customerEmail ? <p className="field-hint">{order.customerEmail}</p> : null}
          {order.customerPhone ? <p className="field-hint">{order.customerPhone}</p> : null}
        </div>
        <div>
          <strong>Nhận hàng</strong>
          <p>
            {order.fulfillmentMethod === "pickup"
              ? `Pickup${order.pickupLocation ? ` · ${order.pickupLocation}` : ""}`
              : "Giao hàng"}
          </p>
          <p className="field-hint">Đặt lúc {formatDateTime(order.createdAt)}</p>
        </div>
        <div>
          <strong>Trạng thái</strong>
          <p>{STATUS_LABEL[order.status] ?? order.status}</p>
          {order.notes ? <p className="field-hint">Ghi chú đơn: {order.notes}</p> : null}
        </div>
      </div>

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

export function OrdersManager({ orders }: { orders: StaffOrder[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<StaffOrder | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [canceling, setCanceling] = useState<StaffOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const awaitingCount = orders.filter((order) => order.awaitingPickup || order.awaitingDelivery).length;

  async function run(id: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setPendingId(id);
    setError(null);
    const result = await fn();
    setPendingId(null);
    if (result.ok) {
      setEditingNotes(null);
      setCanceling(null);
      setCancelReason("");
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  function toggleExpand(order: StaffOrder) {
    setExpandedId((current) => (current === order.id ? null : order.id));
  }

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
          {awaitingCount} đơn đang chờ giao / pickup — bấm vào đơn để xem món + ghi chú khách.
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
          <textarea
            rows={4}
            maxLength={2000}
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Ghi chú nội bộ (giao hàng, gọi khách…)"
          />
          <div className="button-row">
            <button
              className="button primary"
              type="button"
              disabled={pendingId === editingNotes.id}
              onClick={() => run(editingNotes.id, () => updateOrderNotes(editingNotes.id, notesDraft))}
            >
              {pendingId === editingNotes.id ? "Đang lưu…" : "Lưu ghi chú"}
            </button>
            <button className="button secondary" type="button" onClick={() => setEditingNotes(null)}>
              Huỷ
            </button>
          </div>
        </div>
      ) : null}

      {canceling ? (
        <div className="form-card compact-form-card orders-inline-panel">
          <h2>Huỷ đơn {canceling.number}?</h2>
          <p className="field-hint">Thao tác được ghi log cho admin. Không thể huỷ đơn đã giao.</p>
          <input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Lý do huỷ (bắt buộc ghi rõ nếu có)"
            maxLength={500}
          />
          <div className="button-row">
            <button
              className="button danger"
              type="button"
              disabled={pendingId === canceling.id}
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
              <th>Giao / Pickup</th>
              <th aria-label="Hành động" />
            </tr>
          </thead>
          <tbody>
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
                          {specialCount > 0 ? ` · ${specialCount} ghi chú` : ""}
                        </span>
                      </button>
                    </td>
                    <td>{order.customer}</td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>
                      {order.fulfillmentMethod === "pickup"
                        ? `Pickup${order.pickupLocation ? ` · ${order.pickupLocation}` : ""}`
                        : "Giao hàng"}
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
                          <CheckCircle2 size={14} aria-hidden="true" /> Đã giao
                        </span>
                      ) : order.awaitingPickup ? (
                        <span className="pickup-badge waiting blink-red">
                          <AlertTriangle size={14} aria-hidden="true" /> CHƯA PICKUP
                        </span>
                      ) : order.awaitingDelivery ? (
                        <span className="pickup-badge waiting blink-red">
                          <Truck size={14} aria-hidden="true" /> CHƯA GIAO
                        </span>
                      ) : order.status === "cancelled" ? (
                        <span className="muted">Đã huỷ</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
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
                      {order.awaitingDelivery ? (
                        <button
                          className="button primary compact"
                          type="button"
                          disabled={pendingId === order.id}
                          onClick={() => run(order.id, () => confirmDelivered(order.id))}
                        >
                          <Truck size={14} aria-hidden="true" />
                          {pendingId === order.id ? "…" : "Đã giao"}
                        </button>
                      ) : null}
                      {order.canEditNotes ? (
                        <button
                          type="button"
                          className="compact"
                          onClick={() => {
                            setError(null);
                            setCanceling(null);
                            setEditingNotes(order);
                            setNotesDraft(order.notes ?? "");
                          }}
                        >
                          <Pencil size={14} aria-hidden="true" /> Ghi chú
                        </button>
                      ) : null}
                      {order.canCancel ? (
                        <button
                          type="button"
                          className="danger compact"
                          onClick={() => {
                            setError(null);
                            setEditingNotes(null);
                            setCanceling(order);
                            setCancelReason("");
                          }}
                        >
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
          </tbody>
        </table>
      </div>
    </>
  );
}
