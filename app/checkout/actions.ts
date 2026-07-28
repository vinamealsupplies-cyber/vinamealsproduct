"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { writeAuditLog } from "@/lib/data/audit-log";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

// Checkout "đặt thử" — KHÔNG thu tiền. Mục tiêu: tạo một sales_orders có thật ở
// trạng thái `confirmed`, phương thức `pickup` tại địa điểm nhận hàng mặc định,
// để seller thấy trong /admin/orders và bấm xác nhận đã pickup. Thanh toán
// online (Stripe) là phase sau — chưa nối ở đây.
//
// Ghi/đọc bằng service role (bypass RLS) đúng như mọi luồng nghiệp vụ khác của
// khu này; gate ở tầng app (viewer phải đăng nhập thật).

const PICKUP_LOCATION_CODE = "STORE-PICKUP";

export type CheckoutItem = { productId: string; quantity: number };

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

  // Gộp trùng + chuẩn hoá số lượng.
  const wanted = new Map<string, number>();
  for (const item of items) {
    const id = String(item?.productId ?? "").trim();
    const qty = Math.floor(Number(item?.quantity));
    if (!id || !Number.isFinite(qty) || qty <= 0) continue;
    wanted.set(id, (wanted.get(id) ?? 0) + qty);
  }
  if (wanted.size === 0) return { ok: false, error: "Giỏ hàng không hợp lệ." };

  const supabase = createAdminClient();

  // Giá/tên/sku lấy lại từ DB (không tin giá client gửi lên).
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
  }[] = [];

  for (const row of (productRows ?? []) as unknown as ProductRow[]) {
    if (row.status !== "active") continue;
    const qty = wanted.get(row.id);
    if (!qty) continue;
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
      quantity: qty,
      unit_price: unitPrice,
      unit_cost_snapshot: num(variant.cost_price)
    });
  }

  if (orderItems.length === 0) return { ok: false, error: "Không có sản phẩm hợp lệ trong giỏ." };

  // Địa điểm nhận hàng mặc định (migration 20260723090500 đã seed STORE-PICKUP).
  const { data: location } = await supabase
    .from("inventory_locations")
    .select("id")
    .eq("code", PICKUP_LOCATION_CODE)
    .maybeSingle();
  if (!location?.id) {
    return { ok: false, error: "Chưa cấu hình địa điểm nhận hàng (STORE-PICKUP)." };
  }

  // Lấy hoặc tạo hồ sơ khách gắn với tài khoản đăng nhập.
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

  // Tạo đơn: confirmed + pickup (đủ điều kiện constraint pickup_location_required
  // vì đã set pickup_location_id và status <> draft; shipping = 0 cho pickup).
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

  // Thêm dòng hàng — trigger sẽ tự tính lại subtotal/total của đơn.
  const { error: itemsErr } = await supabase
    .from("sales_order_items")
    .insert(orderItems.map((item) => ({ ...item, order_id: order.id })));
  if (itemsErr) {
    // Tránh để lại một đơn confirmed rỗng nếu chèn item lỗi.
    await supabase.from("sales_orders").delete().eq("id", order.id);
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
      channel: "web"
    },
    metadata: {
      actorRole: viewer.role,
      actorEmail: viewer.email,
      orderNumber: order.order_number
    }
  });

  revalidatePath("/admin/orders");
  return { ok: true, orderNumber: order.order_number ?? order.id, total: subtotal };
}
