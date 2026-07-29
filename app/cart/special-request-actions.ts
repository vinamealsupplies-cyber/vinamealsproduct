"use server";

import { getViewer } from "@/lib/auth";
import {
  deleteSpecialRequest,
  getOwnSpecialRequests,
  recordSpecialRequest
} from "@/lib/data/special-requests";
import { isLocalDemoMode, isSupabaseAdminConfigured } from "@/lib/env";
import type { SpecialRequest } from "@/lib/special-request-types";

// File "use server" CHỈ được export async function. Re-export type ở đây
// (`export type { SpecialRequest }`) làm server-actions loader của Next sinh
// tham chiếu runtime → "ReferenceError: SpecialRequest is not defined" khi
// evaluate module → MỌI server action của /cart trả 500. Type dùng chung nằm ở
// `lib/special-request-types.ts`, import thẳng từ đó.
type SpecialRequestResult =
  | { ok: true; items: SpecialRequest[] }
  | { ok: false; error: string; items?: SpecialRequest[] };

async function requireUser(): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  if (isLocalDemoMode()) return { ok: false, error: "Demo mode has no saved requests." };
  if (!isSupabaseAdminConfigured()) return { ok: false, error: "Not configured." };
  const viewer = await getViewer();
  if (!viewer || viewer.demo) return { ok: false, error: "Sign in required." };
  return { ok: true, userId: viewer.id };
}

export async function loadSpecialRequests(): Promise<SpecialRequestResult> {
  const gate = await requireUser();
  if (!gate.ok) return { ok: false, error: gate.error, items: [] };
  const items = await getOwnSpecialRequests(gate.userId);
  return { ok: true, items };
}

/** Lưu / bump phrase khi user chọn từ list hoặc gõ mới (blur). */
export async function rememberSpecialRequest(body: string): Promise<SpecialRequestResult> {
  const gate = await requireUser();
  if (!gate.ok) return { ok: false, error: gate.error };
  return recordSpecialRequest(gate.userId, body);
}

export async function removeSpecialRequest(id: string): Promise<SpecialRequestResult> {
  const gate = await requireUser();
  if (!gate.ok) return { ok: false, error: gate.error };
  return deleteSpecialRequest(gate.userId, id);
}
