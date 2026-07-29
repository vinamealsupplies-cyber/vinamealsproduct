import "server-only";

import { CART_NOTE_MAX, normalizeCartNote } from "@/lib/cart-types";
import type { SpecialRequest } from "@/lib/special-request-types";
import { createAdminClient } from "@/lib/supabase/admin";

export type { SpecialRequest };

/** Giữ tối đa N phrase / user — xóa ít dùng nhất khi vượt. */
const MAX_PER_USER = 40;
const LIST_LIMIT = 30;

type DbRow = {
  id: string;
  body: string;
  use_count: number;
  last_used_at: string;
};

function mapRow(row: DbRow): SpecialRequest {
  return {
    id: row.id,
    body: row.body,
    useCount: row.use_count,
    lastUsedAt: row.last_used_at
  };
}

export async function getOwnSpecialRequests(userId: string): Promise<SpecialRequest[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user_special_requests")
    .select("id, body, use_count, last_used_at")
    .eq("user_id", userId)
    .order("last_used_at", { ascending: false })
    .order("use_count", { ascending: false })
    .limit(LIST_LIMIT);

  if (error || !data) return [];
  return (data as DbRow[]).map(mapRow);
}

/**
 * Ghi nhớ / bump phrase khi user dùng special request.
 * Trùng (không phân biệt hoa thường) → tăng use_count + last_used_at.
 */
export async function recordSpecialRequest(
  userId: string,
  rawBody: string
): Promise<{ ok: true; items: SpecialRequest[] } | { ok: false; error: string }> {
  const body = normalizeCartNote(rawBody);
  if (!body) {
    return { ok: true, items: await getOwnSpecialRequests(userId) };
  }

  const supabase = createAdminClient();

  // Tìm bản trùng case-insensitive (unique index lower(btrim(body))).
  const { data: existing, error: findErr } = await supabase
    .from("user_special_requests")
    .select("id, body, use_count, last_used_at")
    .eq("user_id", userId)
    .ilike("body", body.replace(/[%_\\]/g, "\\$&"))
    .maybeSingle();

  if (findErr) return { ok: false, error: findErr.message };

  if (existing) {
    const { error: updErr } = await supabase
      .from("user_special_requests")
      .update({
        body,
        use_count: (existing.use_count ?? 1) + 1,
        last_used_at: new Date().toISOString()
      })
      .eq("id", existing.id)
      .eq("user_id", userId);
    if (updErr) return { ok: false, error: updErr.message };
  } else {
    const { error: insErr } = await supabase.from("user_special_requests").insert({
      user_id: userId,
      body: body.slice(0, CART_NOTE_MAX),
      use_count: 1,
      last_used_at: new Date().toISOString()
    });
    if (insErr) {
      // Race unique → retry as update.
      if (insErr.code === "23505") {
        return recordSpecialRequest(userId, body);
      }
      return { ok: false, error: insErr.message };
    }

    // Prune nếu vượt MAX_PER_USER.
    const { data: allIds } = await supabase
      .from("user_special_requests")
      .select("id")
      .eq("user_id", userId)
      .order("last_used_at", { ascending: true })
      .order("use_count", { ascending: true });

    const rows = allIds ?? [];
    if (rows.length > MAX_PER_USER) {
      const drop = rows.slice(0, rows.length - MAX_PER_USER).map((r: { id: string }) => r.id);
      if (drop.length) {
        await supabase.from("user_special_requests").delete().in("id", drop);
      }
    }
  }

  return { ok: true, items: await getOwnSpecialRequests(userId) };
}

export async function deleteSpecialRequest(
  userId: string,
  requestId: string
): Promise<{ ok: true; items: SpecialRequest[] } | { ok: false; error: string }> {
  const id = requestId?.trim();
  if (!id) return { ok: false, error: "Missing request id." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("user_special_requests")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, items: await getOwnSpecialRequests(userId) };
}

/** Ghi nhớ hàng loạt (sau checkout — mỗi note khác nhau 1 lần). */
export async function recordSpecialRequestsBatch(
  userId: string,
  bodies: string[]
): Promise<void> {
  const seen = new Set<string>();
  for (const raw of bodies) {
    const body = normalizeCartNote(raw);
    if (!body) continue;
    const key = body.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    await recordSpecialRequest(userId, body);
  }
}
