import "server-only";

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { isLocalDemoMode, isSupabaseConfigured } from "@/lib/env";
import type { AppRole } from "@/lib/roles";
import { createOptionalClient } from "@/lib/supabase/server";

// "seller" = fulfillment role: inventory, orders, invoices, payments only.
export type { AppRole };

export type Viewer = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  isStaff: boolean;
  isManager: boolean;
  isAdmin: boolean;
  isSeller: boolean;
  /** Staff-or-higher OR seller may enter /admin. */
  canAccessAdmin: boolean;
  demo: boolean;
};

function viewerFromRole(input: {
  id: string;
  email?: string | null;
  fullName?: string | null;
  role: AppRole;
  demo?: boolean;
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
    demo: input.demo ?? false
  };
}

/**
 * Read signed-in viewer from session + profiles.
 * Do NOT wrap cookies()/auth in a catch-all — Next uses DYNAMIC_SERVER_USAGE
 * to mark routes dynamic; swallowing it breaks Server Components in production.
 */
export async function getViewer(): Promise<Viewer | null> {
  // Mobile API injects the Bearer-authenticated viewer for the request lifetime
  // so existing server actions can be reused without cookie sessions.
  try {
    const { getRequestViewer } = await import("@/lib/mobile-api/request-viewer");
    const injected = getRequestViewer();
    if (injected) return injected;
  } catch {
    // ignore — module only available on Node server runtime
  }

  if (isLocalDemoMode()) {
    return viewerFromRole({
      id: "local-demo-admin",
      email: "admin@example.com",
      fullName: "Demo Admin",
      role: "admin",
      demo: true
    });
  }

  const supabase = await createOptionalClient();
  if (!supabase) return null;

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (typeof userId !== "string") return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, status")
    .eq("id", userId)
    .maybeSingle();

  if (!profile || profile.status !== "active") return null;

  return viewerFromRole({
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role as AppRole
  });
}

export async function requireStaffApi(minimum: "staff" | "manager" | "admin" = "staff") {
  const viewer = await getViewer();
  const allowed =
    viewer &&
    (minimum === "staff"
      ? viewer.isStaff
      : minimum === "manager"
        ? viewer.isManager
        : viewer.isAdmin);

  if (!allowed) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have access to this action." } },
        { status: isSupabaseConfigured() ? 403 : 503 }
      )
    };
  }

  return { ok: true as const, viewer };
}

/**
 * Guard for /admin pages sellers must not open (products, categories, …).
 * Seller → /admin; guest → /login.
 */
export async function requireStaffPage(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer?.isStaff) {
    redirect(
      viewer?.isSeller
        ? "/admin"
        : "/login?next=/admin&message=Staff%20access%20is%20required."
    );
  }
  return viewer;
}

/** Staff OR seller — daily ops pages. */
export async function requireAdminAccessPage(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer?.canAccessAdmin) {
    redirect("/login?next=/admin&message=Staff%20access%20is%20required.");
  }
  return viewer;
}

/** Admin only — accounts / role management. */
export async function requireAdminPage(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) {
    redirect(
      viewer?.canAccessAdmin
        ? "/admin"
        : "/login?next=/admin&message=Admin%20access%20is%20required."
    );
  }
  return viewer;
}
