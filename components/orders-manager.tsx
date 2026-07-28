"use client";

import { Fragment, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  MessageSquareText,
  PackageCheck,
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
            <p className="order-customer-phone">
              <a href={`tel:${order.customerPhone.replace(/[^\d+]/g, "")}`}>{order.customerPhone}</a>
            </p>
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
          {order.fulfilledAt ? (
            <p className="field-hint">Hoàn tất {formatDateTime(order.fulfilledAt)}</p>
          ) : null}
        </div>
        <div>
          <strong>Trạng thái</strong>
          <p>{STATUS_LABEL[order.status] ?? order.status}</p>
          <p className="field-hint">{fulfillmentLabel(order)}</p>
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

type RowHandlers = {
  expandedId: string | null;
  pendingId: string | null;
  toggleExpand: (order: StaffOrder) => void;
  run: (id: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => void;
  onEditNotes: (order: StaffOrder) => void;
  onCancel: (order: StaffOrder) => void;
};

function OrderRows({ orders, handlers }: { orders: StaffOrder[]; handlers: RowHandlers }) {
  const { expandedId, pendingId, toggleExpand, run, onEditNotes, onCancel } = handlers;

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
                    {specialCount > 0 ? ` · ${specialCount} ghi chú` : ""}
                  </span>
                </button>
              </td>
              <td>
                <span className="order-customer-name">{order.customer}</span>
                {order.customerCompany ? (
                  <span className="field-hint">{order.customerCompany}</span>
                ) : null}
                {order.customerPhone ? (
                  <span className="order-customer-phone">
                    <a href={`tel:${order.customerPhone.replace(/[^\d+]/g, "")}`}>
                      {order.customerPhone}
                    </a>
                  </span>
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
                    <Truck size={14} aria-hidden="true" /> CHỜ SHIP / GIAO
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

  // Phần 1: chờ giao / ship / pickup (confirmed).
  const openOrders = orders.filter((o) => o.status === "confirmed");
  // Phần 2: đã hoàn tất (fulfilled) + đã huỷ (kết thúc).
  const completedOrders = orders.filter((o) => o.status === "fulfilled" || o.status === "cancelled");
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
      setEditingNotes(order);
      setNotesDraft(order.notes ?? "");
    },
    onCancel: (order) => {
      setError(null);
      setEditingNotes(null);
      setCanceling(order);
      setCancelReason("");
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
              Đóng
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

      <OrdersSection
        accent="open"
        title="Chờ giao / ship / pickup"
        description="Đơn đã xác nhận — cần giao hàng, ship, hoặc khách tới pickup. Bấm xác nhận khi xong."
        icon={<Truck size={20} aria-hidden="true" />}
        orders={openOrders}
        emptyText="Không có đơn đang chờ giao / ship / pickup."
        handlers={handlers}
      />

      <OrdersSection
        accent="done"
        title="Đã hoàn tất"
        description="Đơn đã pickup, đã ship / giao, hoặc đã huỷ."
        icon={<PackageCheck size={20} aria-hidden="true" />}
        orders={completedOrders}
        emptyText="Chưa có đơn hoàn tất."
        handlers={handlers}
      />
    </>
  );
}
