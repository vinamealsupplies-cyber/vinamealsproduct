import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Viewer } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import type { AppRole } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/mobile-api/http";
import { getRequestViewer } from "@/lib/mobile-api/request-viewer";

function viewerFromRole(input: {
  id: string;
  email?: string | null;
  fullName?: string | null;
  role: AppRole;
}): Viewer {
  const isStaff = ["staff", "manager", "admin"].includes(input.role);
  const isManager = ["manager", "admin"].includes(input.role);
  const isSeller = input.role === "seller";
  return {
    id: input.id,
    email: input.email ?? "",
    fullName: input.fullName ?? "",
    role: input.role,
    isStaff,
    isManager,
    isAdmin: input.role === "admin",
    isSeller,
    canAccessAdmin: isStaff || isSeller,
    demo: false
  };
}

export async function getViewerFromBearer(request: Request): Promise<Viewer | null> {
  const injected = getRequestViewer();
  if (injected) return injected;

  if (!isSupabaseConfigured()) return null;

  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const authClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, full_name, role, status")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active") return null;

  return viewerFromRole({
    id: profile.id,
    email: profile.email ?? data.user.email,
    fullName: profile.full_name,
    role: profile.role as AppRole
  });
}

export async function requireMobileUser(request: Request) {
  const viewer = await getViewerFromBearer(request);
  if (!viewer) {
    return {
      ok: false as const,
      response: jsonError("UNAUTHORIZED", "Sign in required.", 401)
    };
  }
  return { ok: true as const, viewer };
}

export async function requireMobileAdmin(request: Request) {
  const gate = await requireMobileUser(request);
  if (!gate.ok) return gate;
  if (!gate.viewer.canAccessAdmin) {
    return {
      ok: false as const,
      response: jsonError("FORBIDDEN", "Management access required.", 403)
    };
  }
  return gate;
}

export async function requireMobileStaff(request: Request) {
  const gate = await requireMobileUser(request);
  if (!gate.ok) return gate;
  if (!gate.viewer.isStaff) {
    return {
      ok: false as const,
      response: jsonError("FORBIDDEN", "Staff access required.", 403)
    };
  }
  return gate;
}

export async function requireMobileManager(request: Request) {
  const gate = await requireMobileUser(request);
  if (!gate.ok) return gate;
  if (!gate.viewer.isManager) {
    return {
      ok: false as const,
      response: jsonError("FORBIDDEN", "Manager access required.", 403)
    };
  }
  return gate;
}

export async function requireMobileAdminOnly(request: Request) {
  const gate = await requireMobileUser(request);
  if (!gate.ok) return gate;
  if (!gate.viewer.isAdmin) {
    return {
      ok: false as const,
      response: jsonError("FORBIDDEN", "Admin access required.", 403)
    };
  }
  return gate;
}

/** Strip unit cost for seller responses. */
export function redactInventoryForRole<T extends { costPrice?: number; inventoryValue?: number }>(
  rows: T[],
  viewer: Viewer
): T[] {
  if (!viewer.isSeller) return rows;
  return rows.map((row) => ({
    ...row,
    costPrice: undefined,
    inventoryValue: undefined
  }));
}
