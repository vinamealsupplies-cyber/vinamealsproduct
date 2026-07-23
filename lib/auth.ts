import "server-only";

import { NextResponse } from "next/server";
import { isLocalDemoMode, isSupabaseConfigured } from "@/lib/env";
import { createOptionalClient } from "@/lib/supabase/server";

export type AppRole = "customer" | "staff" | "manager" | "admin";

export type Viewer = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  isStaff: boolean;
  isManager: boolean;
  isAdmin: boolean;
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
  return {
    id: input.id,
    email: input.email ?? "",
    fullName: input.fullName ?? "",
    role: input.role,
    isStaff,
    isManager,
    isAdmin: input.role === "admin",
    demo: input.demo ?? false
  };
}

export async function getViewer(): Promise<Viewer | null> {
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
