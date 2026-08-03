import { createAdminClient } from "@/lib/supabase/admin";
import { requireMobileAdminOnly } from "@/lib/mobile-api/auth";
import { jsonError, jsonOk } from "@/lib/mobile-api/http";
import { writeAuditLog, actorAuditMeta } from "@/lib/data/audit-log";
import type { AppRole } from "@/lib/roles";

export const runtime = "nodejs";

/** PATCH { role?, status? } — admin only */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requireMobileAdminOnly(request);
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  let body: { role?: AppRole; status?: "active" | "disabled" };
  try {
    body = await request.json();
  } catch {
    return jsonError("BAD_REQUEST", "Invalid JSON body.");
  }

  const allowedRoles: AppRole[] = ["customer", "seller", "staff", "manager", "admin"];
  if (body.role && !allowedRoles.includes(body.role)) {
    return jsonError("BAD_REQUEST", "Invalid role.");
  }
  if (body.status && !["active", "disabled"].includes(body.status)) {
    return jsonError("BAD_REQUEST", "Invalid status.");
  }
  if (id === gate.viewer.id && body.status === "disabled") {
    return jsonError("FORBIDDEN", "You cannot disable your own account.", 403);
  }

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("profiles")
    .select("id, email, role, status")
    .eq("id", id)
    .maybeSingle();
  if (!before) return jsonError("NOT_FOUND", "Account not found.", 404);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.role) patch.role = body.role;
  if (body.status) patch.status = body.status;

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", id)
    .select("id, email, full_name, phone, role, status, created_at, updated_at")
    .maybeSingle();

  if (error) return jsonError("UPDATE_FAILED", error.message, 400);

  await writeAuditLog({
    actorUserId: gate.viewer.id,
    action: "account.update",
    entityType: "profile",
    entityId: id,
    before,
    after: data,
    metadata: actorAuditMeta(gate.viewer)
  });

  return jsonOk({
    account: data
      ? {
          id: data.id,
          email: data.email,
          fullName: data.full_name,
          phone: data.phone,
          role: data.role,
          status: data.status,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        }
      : null
  });
}
