import { createAdminClient } from "@/lib/supabase/admin";
import { requireMobileAdminOnly } from "@/lib/mobile-api/auth";
import { jsonError, jsonOk } from "@/lib/mobile-api/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireMobileAdminOnly(request);
  if (!gate.ok) return gate.response;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, phone, role, status, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return jsonOk({
      accounts: (data ?? []).map((p) => ({
        id: p.id,
        email: p.email,
        fullName: p.full_name,
        phone: p.phone,
        role: p.role,
        status: p.status,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }))
    });
  } catch (error) {
    return jsonError(
      "LOAD_FAILED",
      error instanceof Error ? error.message : "Could not load accounts.",
      500
    );
  }
}
