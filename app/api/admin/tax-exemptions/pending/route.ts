import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/auth";
import { getPendingBusinessApplicationSummary } from "@/lib/data/business-applications";
import { getPendingApplicationSummary } from "@/lib/data/tax-exemption";

// Popup source for admin toast. Prefers new business applications queue;
// falls back to legacy tax-only applications.
export async function GET() {
  const access = await requireStaffApi("staff");
  if (!access.ok) return access.response;

  const [business, legacy] = await Promise.all([
    getPendingBusinessApplicationSummary().catch(() => ({
      pendingCount: 0,
      latestId: null as string | null,
      latestBusinessName: null as string | null
    })),
    getPendingApplicationSummary()
  ]);

  const pendingCount = (business.pendingCount || 0) + (legacy.pendingCount || 0);
  const useBusiness = (business.pendingCount || 0) > 0;
  const summary = {
    pendingCount,
    latestId: useBusiness ? business.latestId : legacy.latestId,
    latestBusinessName: useBusiness
      ? business.latestBusinessName
      : legacy.latestBusinessName,
    href: useBusiness
      ? business.latestId
        ? `/admin/business-applications/${business.latestId}`
        : "/admin/business-applications"
      : legacy.latestId
        ? `/admin/tax-exemptions/${legacy.latestId}`
        : "/admin/tax-exemptions"
  };

  return NextResponse.json(
    { data: summary },
    { headers: { "Cache-Control": "no-store" } }
  );
}
