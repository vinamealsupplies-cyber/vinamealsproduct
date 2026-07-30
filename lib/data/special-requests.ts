import "server-only";

import { CART_NOTE_MAX, normalizeCartNote } from "@/lib/cart-types";
import type { SpecialRequest } from "@/lib/special-request-types";
import { createAdminClient } from "@/lib/supabase/admin";

export type { SpecialRequest };

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
    .limit(LIST_LIMIT);

  if (error) {
    console.error("[special-requests] list", error.message);
    return [];
  }
  return ((data ?? []) as DbRow[]).map(mapRow);
}

/**
 * Remember / bump a phrase. Match case-insensitively in JS (avoids flaky ilike).
 * Always returns the full saved list for the user.
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
  const existingList = await getOwnSpecialRequests(userId);
  const match = existingList.find((item) => item.body.toLowerCase() === body.toLowerCase());
  const now = new Date().toISOString();

  if (match) {
    const { error: updErr } = await supabase
      .from("user_special_requests")
      .update({
        body,
        use_count: (match.useCount ?? 1) + 1,
        last_used_at: now
      })
      .eq("id", match.id)
      .eq("user_id", userId);
    if (updErr) return { ok: false, error: updErr.message };
  } else {
    const { error: insErr } = await supabase.from("user_special_requests").insert({
      user_id: userId,
      body: body.slice(0, CART_NOTE_MAX),
      use_count: 1,
      last_used_at: now
    });
    if (insErr) {
      if (insErr.code === "23505") {
        // Unique race — bump the existing row.
        const again = await getOwnSpecialRequests(userId);
        const hit = again.find((item) => item.body.toLowerCase() === body.toLowerCase());
        if (hit) {
          await supabase
            .from("user_special_requests")
            .update({ use_count: hit.useCount + 1, last_used_at: now, body })
            .eq("id", hit.id);
        }
      } else {
        return { ok: false, error: insErr.message };
      }
    } else {
      // Prune oldest when over cap.
      const { data: allIds } = await supabase
        .from("user_special_requests")
        .select("id")
        .eq("user_id", userId)
        .order("last_used_at", { ascending: true });

      const rows = allIds ?? [];
      if (rows.length > MAX_PER_USER) {
        const drop = rows.slice(0, rows.length - MAX_PER_USER).map((r: { id: string }) => r.id);
        if (drop.length) {
          await supabase.from("user_special_requests").delete().in("id", drop);
        }
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

/** Remember many phrases (e.g. after checkout). */
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
