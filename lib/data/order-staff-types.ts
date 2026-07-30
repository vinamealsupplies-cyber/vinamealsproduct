// Types + labels cho staff order events (client + server).

export type OrderStaffAction =
  | "cancel"
  | "cancel_pickup"
  | "update_notes"
  | "save_tracking"
  | "confirm_shipped"
  | "confirm_pickup"
  | "pickup_ready"
  | "confirm_delivered";

export type OrderStaffEvent = {
  id: string;
  orderId: string;
  actorUserId: string | null;
  actorName: string;
  action: string;
  note: string;
  createdAt: string;
};

export const ORDER_STAFF_ACTION_LABEL: Record<string, string> = {
  cancel: "Huỷ đơn",
  cancel_pickup: "Huỷ pickup",
  update_notes: "Sửa ghi chú",
  save_tracking: "Sửa / lưu tracking",
  confirm_shipped: "Xác nhận đã ship",
  pickup_ready: "Sẵn sàng pickup",
  confirm_pickup: "Xác nhận đã lấy hàng",
  confirm_delivered: "Xác nhận đã giao"
};

const NOTE_MIN = 3;
const NOTE_MAX = 500;

export function normalizeStaffNote(raw: string | null | undefined): string {
  return (typeof raw === "string" ? raw : "").trim().slice(0, NOTE_MAX);
}

/** Note bắt buộc khi huỷ / sửa. */
export function requireStaffNote(
  raw: string | null | undefined
): { ok: true; note: string } | { ok: false; error: string } {
  const note = normalizeStaffNote(raw);
  if (note.length < NOTE_MIN) {
    return {
      ok: false,
      error: `Nhập ghi chú / lý do (tối thiểu ${NOTE_MIN} ký tự). Tên người thao tác lấy từ tài khoản đăng nhập.`
    };
  }
  return { ok: true, note };
}
