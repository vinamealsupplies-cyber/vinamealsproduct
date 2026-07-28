import "server-only";

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { isLocalDemoMode, isSupabaseConfigured } from "@/lib/env";
import type { AppRole } from "@/lib/roles";
import { createOptionalClient } from "@/lib/supabase/server";

// "seller" = vai trò fulfillment: chỉ quản lý inventory, orders, invoices,
// payments. KHÔNG nằm trong chuỗi staff/manager/admin (không thấy products,
// customers, expenses, reports, settings…). Quyền vào khu /admin của seller đi
// qua canAccessAdmin, còn từng trang cấm seller tự chặn bằng requireStaffPage().
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
  /** Được vào khu /admin (staff-trở-lên HOẶC seller). */
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

/**
 * Guard cho các trang khu /admin mà SELLER KHÔNG được vào (products, categories,
 * imports, customers, tax-exemptions, expenses, reports, tax, settings). Seller
 * đăng nhập → đẩy về /admin/orders; khách/chưa đăng nhập → /login. Staff trở lên
 * đi tiếp bình thường. Dùng ở đầu mỗi trang admin dành riêng cho staff.
 */
export async function requireStaffPage(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer?.isStaff) {
    redirect(
      viewer?.isSeller
        ? "/admin/orders"
        : "/login?next=/admin&message=Staff%20access%20is%20required."
    );
  }
  return viewer;
}

/**
 * Chỉ role admin. Dùng cho quản lý tài khoản / role (tránh staff tự nâng quyền).
 * Staff/manager/seller → /admin; khách → /login.
 */
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
