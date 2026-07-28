"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, PackageOpen } from "lucide-react";
import { confirmPickup } from "@/app/admin/orders/actions";
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

  const awaitingCount = orders.filter((order) => order.awaitingPickup).length;

  async function onConfirm(id: string) {
    setPendingId(id);
    setError(null);
    const result = await confirmPickup(id);
    setPendingId(null);
    if (result.ok) {
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
        <p>Đơn sẽ xuất hiện ở đây sau khi khách đặt hàng thử ở trang checkout.</p>
      </div>
    );
  }

  return (
    <>
      {awaitingCount > 0 ? (
        <div className="pickup-alert-banner blink-red" role="status">
          <AlertTriangle size={18} aria-hidden="true" />
          {awaitingCount} đơn đang chờ khách tới lấy (pickup) — hãy xác nhận sau khi giao.
        </div>
      ) : null}

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
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
              <th>Pickup</th>
              <th aria-label="Hành động" />
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className={order.awaitingPickup ? "row-awaiting-pickup" : ""}>
                <td>
                  <span className="order-number">{order.number}</span>
                  <span className="order-itemcount">
                    {order.itemCount} món
                  </span>
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
                  {order.fulfillmentMethod !== "pickup" ? (
                    <span className="muted">—</span>
                  ) : order.pickedUpAt ? (
                    <span className="pickup-badge done">
                      <CheckCircle2 size={14} aria-hidden="true" /> Đã pickup
                    </span>
                  ) : order.awaitingPickup ? (
                    <span className="pickup-badge waiting blink-red">
                      <AlertTriangle size={14} aria-hidden="true" /> CHƯA PICKUP
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  {order.awaitingPickup ? (
                    <button
                      className="button primary compact"
                      type="button"
                      disabled={pendingId === order.id}
                      onClick={() => onConfirm(order.id)}
                    >
                      {pendingId === order.id ? "Đang lưu…" : "Xác nhận đã pickup"}
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
