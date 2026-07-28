"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { writeAuditLog } from "@/lib/data/audit-log";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

// Checkout "đặt thử" — KHÔNG thu tiền. Mục tiêu: tạo sales_orders confirmed +
// pickup, kèm line_note từng món (yêu cầu đặc biệt của khách).

const PICKUP_LOCATION_CODE = "STORE-PICKUP";
const LINE_NOTE_MAX = 300;

export type CheckoutItem = {
  productId: string;
  quantity: number;
  /** Yêu cầu đặc biệt cho món (tùy chọn). */
  note?: string;
};

export type CheckoutResult =
  | { ok: true; orderNumber: string; total: number }
  | { ok: false; error: string };

type VariantRow = {
  id: string;
  sku: string;
  retail_price: number | string;
  sale_price: number | string | null;
  cost_price: number | string | null;
  is_default: boolean;
  is_active: boolean;
};

type ProductRow = {
  id: string;
  name: string;
  status: string;
  product_variants: VariantRow[];
};

function num(value: number | string | null | undefined): number {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

function cleanNote(note: unknown): string | null {
  if (typeof note !== "string") return null;
  const trimmed = note.trim().slice(0, LINE_NOTE_MAX);
  return trimmed || null;
}

export async function placeTestOrder(items: CheckoutItem[]): Promise<CheckoutResult> {
  const viewer = await getViewer();
  if (!viewer || viewer.demo) {
    return { ok: false, error: "Vui lòng đăng nhập để đặt hàng." };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "Giỏ hàng trống." };
  }
  if (!(await checkRateLimit(await callerKey("checkout", viewer.id), RATE_LIMITS.mutation))) {
    return { ok: false, error: "Bạn thao tác quá nhanh. Đợi một phút rồi thử lại." };
  }

  // Gộp trùng productId: cộng qty, gộp ghi chú (nếu khác nhau).
  const wanted = new Map<string, { quantity: number; notes: string[] }>();
  for (const item of items) {
    const id = String(item?.productId ?? "").trim();
    const qty = Math.floor(Number(item?.quantity));
    if (!id || !Number.isFinite(qty) || qty <= 0) continue;
    const note = cleanNote(item?.note);
    const existing = wanted.get(id);
    if (existing) {
      existing.quantity += qty;
      if (note && !existing.notes.includes(note)) existing.notes.push(note);
    } else {
      wanted.set(id, { quantity: qty, notes: note ? [note] : [] });
    }
  }
  if (wanted.size === 0) return { ok: false, error: "Giỏ hàng không hợp lệ." };

  const supabase = createAdminClient();

  const { data: productRows, error: prodErr } = await supabase
    .from("products")
    .select(
      "id, name, status, product_variants ( id, sku, retail_price, sale_price, cost_price, is_default, is_active )"
    )
    .in("id", [...wanted.keys()]);
  if (prodErr) return { ok: false, error: "Không đọc được sản phẩm. Thử lại." };

  const orderItems: {
    product_id: string;
    variant_id: string | null;
    product_name_snapshot: string;
    sku_snapshot: string;
    quantity: number;
    unit_price: number;
    unit_cost_snapshot: number;
    line_note: string | null;
  }[] = [];

  for (const row of (productRows ?? []) as unknown as ProductRow[]) {
    if (row.status !== "active") continue;
    const wantedLine = wanted.get(row.id);
    if (!wantedLine) continue;
    const variants = row.product_variants ?? [];
    const variant =
      variants.find((v) => v.is_default) ?? variants.find((v) => v.is_active) ?? variants[0];
    if (!variant) continue;

    const retail = num(variant.retail_price);
    const rawSale =
      variant.sale_price == null || variant.sale_price === "" ? null : num(variant.sale_price);
    const unitPrice = rawSale != null && rawSale >= 0 && rawSale < retail ? rawSale : retail;

    orderItems.push({
      product_id: row.id,
      variant_id: variant.id ?? null,
      product_name_snapshot: row.name,
      sku_snapshot: variant.sku ?? "",
      quantity: wantedLine.quantity,
      unit_price: unitPrice,
      unit_cost_snapshot: num(variant.cost_price),
      line_note: wantedLine.notes.length ? wantedLine.notes.join("; ").slice(0, LINE_NOTE_MAX) : null
    });
  }

  if (orderItems.length === 0) return { ok: false, error: "Không có sản phẩm hợp lệ trong giỏ." };

  const { data: location } = await supabase
    .from("inventory_locations")
    .select("id")
    .eq("code", PICKUP_LOCATION_CODE)
    .maybeSingle();
  if (!location?.id) {
    return { ok: false, error: "Chưa cấu hình địa điểm nhận hàng (STORE-PICKUP)." };
  }

  let customerId: string | null = null;
  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("id")
    .eq("auth_user_id", viewer.id)
    .maybeSingle();
  customerId = existingCustomer?.id ?? null;
  if (!customerId) {
    const { data: createdCustomer } = await supabase
      .from("customers")
      .insert({
        auth_user_id: viewer.id,
        email: viewer.email || null,
        customer_type: "retail",
        status: "active"
      })
      .select("id")
      .single();
    customerId = createdCustomer?.id ?? null;
  }

  const subtotal = orderItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  const { data: order, error: orderErr } = await supabase
    .from("sales_orders")
    .insert({
      customer_id: customerId,
      channel: "web",
      status: "confirmed",
      currency: "USD",
      fulfillment_method: "pickup",
      pickup_location_id: location.id,
      shipping_amount: 0,
      subtotal,
      total_amount: subtotal,
      placed_at: new Date().toISOString(),
      created_by: viewer.id,
      notes: "Đơn đặt thử (không thanh toán) từ storefront."
    })
    .select("id, order_number")
    .single();
  if (orderErr || !order) return { ok: false, error: "Không tạo được đơn hàng. Thử lại." };

  const { error: itemsErr } = await supabase
    .from("sales_order_items")
    .insert(orderItems.map((item) => ({ ...item, order_id: order.id })));
  if (itemsErr) {
    await supabase.from("sales_orders").delete().eq("id", order.id);
    // Cột line_note chưa migration → báo rõ.
    if (itemsErr.message.includes("line_note")) {
      return {
        ok: false,
        error: "Database chưa có cột line_note. Chạy migration 20260728210000_order_item_line_note.sql."
      };
    }
    return { ok: false, error: "Không lưu được chi tiết đơn. Thử lại." };
  }

  await writeAuditLog({
    actorUserId: viewer.id,
    action: "order.create",
    entityType: "sales_order",
    entityId: order.id,
    after: {
      orderNumber: order.order_number,
      status: "confirmed",
      fulfillmentMethod: "pickup",
      total: subtotal,
      itemCount: orderItems.length,
      channel: "web",
      items: orderItems.map((i) => ({
        name: i.product_name_snapshot,
        qty: i.quantity,
        note: i.line_note
      }))
    },
    metadata: {
      actorRole: viewer.role,
      actorEmail: viewer.email,
      orderNumber: order.order_number
    }
  });

  revalidatePath("/admin/orders");
  revalidatePath("/account");
  return { ok: true, orderNumber: order.order_number ?? order.id, total: subtotal };
}
