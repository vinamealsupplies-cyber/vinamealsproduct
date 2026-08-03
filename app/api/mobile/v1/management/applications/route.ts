import { listBusinessApplicationsForStaff } from "@/lib/data/business-applications";
import { getApplicationsForStaff } from "@/lib/data/tax-exemption";
import { requireMobileManager } from "@/lib/mobile-api/auth";
import { jsonError, jsonOk } from "@/lib/mobile-api/http";
import { runWithViewer } from "@/lib/mobile-api/request-viewer";

export const runtime = "nodejs";

/** Business applications + tax exemptions for manager review. */
export async function GET(request: Request) {
  const gate = await requireMobileManager(request);
  if (!gate.ok) return gate.response;

  try {
    const [businessApplications, taxExemptions] = await runWithViewer(gate.viewer, async () => {
      const biz = await listBusinessApplicationsForStaff({}).catch(() => []);
      const tax = await getApplicationsForStaff().catch(() => []);
      return [biz, tax] as const;
    });

    return jsonOk({ businessApplications, taxExemptions });
  } catch (error) {
    return jsonError(
      "LOAD_FAILED",
      error instanceof Error ? error.message : "Could not load applications.",
      500
    );
  }
}
