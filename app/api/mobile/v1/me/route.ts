import { requireMobileUser } from "@/lib/mobile-api/auth";
import { jsonOk } from "@/lib/mobile-api/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireMobileUser(request);
  if (!gate.ok) return gate.response;

  const v = gate.viewer;
  return jsonOk({
    id: v.id,
    email: v.email,
    fullName: v.fullName,
    role: v.role,
    isStaff: v.isStaff,
    isManager: v.isManager,
    isAdmin: v.isAdmin,
    isSeller: v.isSeller,
    canAccessManagement: v.canAccessAdmin
  });
}
