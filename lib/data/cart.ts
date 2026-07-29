import "server-only";

import type { CartItem } from "@/lib/cart-types";
import { normalizeCartNote, normalizeCartQuantity } from "@/lib/cart-types";
import { createAdminClient } from "@/lib/supabase/admin";

type DbCartRow = {
  product_id: string;
  quantity: number;
  note: string | null;
};

function mapRow(row: DbCartRow): CartItem {
  const note = normalizeCartNote(row.note);
  return {
    productId: row.product_id,
    quantity: normalizeCartQuantity(row.quantity),
    ...(note ? { note } : {})
  };
}

/** Giỏ hàng của user đăng nhập (service role — bypass RLS, đã filter user_id). */
export async function getOwnCartItems(userId: string): Promise<CartItem[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("cart_items")
    .select("product_id, quantity, note")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return (data as DbCartRow[]).map(mapRow);
}

/**
 * Đồng bộ giỏ: upsert từng dòng, rồi xóa product không còn trong list.
 * Không delete-all trước — tránh mất giỏ nếu insert lỗi giữa chừng.
 */
export async function replaceOwnCartItems(
  userId: string,
  items: CartItem[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient();

  const cleaned: { product_id: string; quantity: number; note: string | null }[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const productId = typeof item.productId === "string" ? item.productId.trim() : "";
    if (!productId || seen.has(productId)) continue;
    seen.add(productId);
    const quantity = normalizeCartQuantity(item.quantity);
    if (quantity <= 0) continue;
    cleaned.push({
      product_id: productId,
      quantity,
      note: normalizeCartNote(item.note) ?? null
    });
  }

  if (cleaned.length === 0) {
    const { error } = await supabase.from("cart_items").delete().eq("user_id", userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  // Bỏ product_id không còn tồn tại (FK) — tránh fail cả batch.
  const productIds = cleaned.map((row) => row.product_id);
  const { data: existingProducts } = await supabase
    .from("products")
    .select("id")
    .in("id", productIds);
  const validIds = new Set((existingProducts ?? []).map((row: { id: string }) => row.id));
  const rows = cleaned.filter((row) => validIds.has(row.product_id));

  if (rows.length === 0) {
    const { error } = await supabase.from("cart_items").delete().eq("user_id", userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const { error: upsertErr } = await supabase.from("cart_items").upsert(
    rows.map((row) => ({
      user_id: userId,
      product_id: row.product_id,
      quantity: row.quantity,
      note: row.note
    })),
    { onConflict: "user_id,product_id" }
  );
  if (upsertErr) return { ok: false, error: upsertErr.message };

  const keep = new Set(rows.map((row) => row.product_id));
  const { data: existingRows, error: listErr } = await supabase
    .from("cart_items")
    .select("product_id")
    .eq("user_id", userId);
  if (listErr) return { ok: false, error: listErr.message };

  const staleIds = (existingRows ?? [])
    .map((row: { product_id: string }) => row.product_id)
    .filter((id) => !keep.has(id));
  if (staleIds.length > 0) {
    const { error: delErr } = await supabase
      .from("cart_items")
      .delete()
      .eq("user_id", userId)
      .in("product_id", staleIds);
    if (delErr) return { ok: false, error: delErr.message };
  }
  return { ok: true };
}

export async function clearOwnCartItems(
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("cart_items").delete().eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
