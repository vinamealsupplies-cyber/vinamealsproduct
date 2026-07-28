"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, PackageOpen, Pencil, Truck, XCircle } from "lucide-react";
import {
  cancelOrder,
  confirmDelivered,
  confirmPickup,
  updateOrderNotes
} from "@/app/admin/orders/actions";
import type { StaffOrder } from "@/lib/data/orders";
import { formatDate, usd } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  confirmed: "Đã xác nhận",
  fulfilled: "Đã hoàn tất",
  cancelled: "Đã huỷ"
};

export function OrdersManager({ orders }: { orders: StaffOrder[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<StaffOrder | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [canceling, setCanceling] = useState<StaffOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");

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
          {awaitingCount} đơn đang chờ giao / pickup — xác nhận sau khi hoàn tất.
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
            {orders.map((order) => (
              <tr
                key={order.id}
                className={
                  order.awaitingPickup || order.awaitingDelivery ? "row-awaiting-pickup" : ""
                }
              >
                <td>
                  <span className="order-number">{order.number}</span>
                  <span className="order-itemcount">{order.itemCount} món</span>
                  {order.notes ? <span className="field-hint">{order.notes}</span> : null}
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
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
