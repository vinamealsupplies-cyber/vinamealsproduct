import "server-only";

import {
  normalizeStaffNote,
  type OrderStaffAction,
  type OrderStaffEvent
} from "@/lib/data/order-staff-types";
import { createAdminClient } from "@/lib/supabase/admin";

export type { OrderStaffAction, OrderStaffEvent };
export { ORDER_STAFF_ACTION_LABEL, requireStaffNote } from "@/lib/data/order-staff-types";

export async function recordOrderStaffEvent(input: {
  orderId: string;
  actorUserId: string;
  actorName: string;
  action: OrderStaffAction | string;
  note: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const note = normalizeStaffNote(input.note);
  if (!note) return { ok: false, error: "Thiếu note thao tác." };

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { error: evErr } = await supabase.from("sales_order_staff_events").insert({
    order_id: input.orderId,
    actor_user_id: input.actorUserId,
    actor_name: input.actorName,
    action: input.action,
    note,
    created_at: now
  });
  if (evErr) {
    if (evErr.message.includes("sales_order_staff_events")) {
      return {
        ok: false,
        error: "Database chưa có bảng log staff. Chạy migration 20260728270000_order_staff_actions.sql."
      };
    }
    return { ok: false, error: evErr.message };
  }

  const orderPatch: Record<string, unknown> = {
    last_staff_action: input.action,
    last_staff_actor_id: input.actorUserId,
    last_staff_actor_name: input.actorName,
    last_staff_note: note,
    last_staff_at: now,
    updated_at: now
  };
  if (input.action === "cancel") {
    orderPatch.cancelled_by = input.actorUserId;
    orderPatch.cancelled_by_name = input.actorName;
    orderPatch.cancelled_at = now;
    orderPatch.cancel_note = note;
  }

  const { error: ordErr } = await supabase
    .from("sales_orders")
    .update(orderPatch)
    .eq("id", input.orderId);
  if (ordErr) {
    // Event đã ghi — không fail cả thao tác chính; log soft.
    console.error("recordOrderStaffEvent order patch:", ordErr.message);
  }

  return { ok: true };
}

export async function getStaffEventsForOrders(
  orderIds: string[]
): Promise<Map<string, OrderStaffEvent[]>> {
  const map = new Map<string, OrderStaffEvent[]>();
  if (!orderIds.length) return map;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_order_staff_events")
    .select("id, order_id, actor_user_id, actor_name, action, note, created_at")
    .in("order_id", orderIds)
    .order("created_at", { ascending: false });

  if (error || !data) return map;

  for (const row of data as {
    id: string;
    order_id: string;
    actor_user_id: string | null;
    actor_name: string;
    action: string;
    note: string;
    created_at: string;
  }[]) {
    const list = map.get(row.order_id) ?? [];
    list.push({
      id: row.id,
      orderId: row.order_id,
      actorUserId: row.actor_user_id,
      actorName: row.actor_name,
      action: row.action,
      note: row.note,
      createdAt: row.created_at
    });
    map.set(row.order_id, list);
  }
  return map;
}
