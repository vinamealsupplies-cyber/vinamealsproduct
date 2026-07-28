"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { countAdmins } from "@/lib/data/accounts";
import type { AdminFormState } from "@/lib/data/admin-form";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import type { AccountStatus, AppRole } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";

const ROLES = new Set<AppRole>(["customer", "seller", "staff", "manager", "admin"]);
const STATUSES = new Set<AccountStatus>(["active", "disabled"]);

function fail(message: string): AdminFormState {
  return { status: "error", message };
}

async function requireAdminActor() {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return null;
  if (!(await checkRateLimit(await callerKey("admin-accounts", viewer.id), RATE_LIMITS.mutation))) {
    return "rate-limited" as const;
  }
  return viewer;
}

function revalidate() {
  revalidatePath("/admin/accounts");
  revalidatePath("/admin");
}

/**
 * Cập nhật role / status / tên / phone của một profile.
 * Chỉ admin. Không cho tự hạ role hoặc tự disable nếu còn là admin duy nhất.
 */
export async function updateAccountAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const actor = await requireAdminActor();
  if (actor === "rate-limited") {
    return fail("Too many changes in a short time. Wait a minute and try again.");
  }
  if (!actor) return fail("Admin access is required.");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return fail("Missing account id.");

  const roleRaw = String(formData.get("role") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim().slice(0, 160) || null;
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 40) || null;

  if (!ROLES.has(roleRaw as AppRole)) return fail("Invalid role.");
  if (!STATUSES.has(statusRaw as AccountStatus)) return fail("Invalid status.");
  const role = roleRaw as AppRole;
  const status = statusRaw as AccountStatus;

  const supabase = createAdminClient();
  const { data: existing, error: loadError } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, status")
    .eq("id", id)
    .maybeSingle();

  if (loadError) return fail(loadError.message);
  if (!existing) return fail("Account not found.");

  const wasActiveAdmin = existing.role === "admin" && existing.status === "active";
  const willBeActiveAdmin = role === "admin" && status === "active";

  // Không cho admin tự hạ quyền / tự khóa nếu là admin active duy nhất.
  if (wasActiveAdmin && !willBeActiveAdmin) {
    const admins = await countAdmins();
    if (admins <= 1) {
      return fail("Cannot remove or disable the last active admin account.");
    }
  }

  // Tránh tự khóa/tự hạ quyền chính mình (dễ lock-out).
  if (id === actor.id) {
    if (role !== "admin") {
      return fail("You cannot change your own role away from admin. Ask another admin.");
    }
    if (status !== "active") {
      return fail("You cannot disable your own account.");
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      role,
      status,
      full_name: fullName,
      phone,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if (error) return fail(error.message);

  revalidate();
  const label = fullName || existing.email || existing.full_name || "account";
  return {
    status: "success",
    message: `Saved ${label} (${role}, ${status}).`
  };
}
