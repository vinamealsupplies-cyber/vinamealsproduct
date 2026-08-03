import { getCustomersForStaff } from "@/lib/data/customers";
import { requireMobileAdmin } from "@/lib/mobile-api/auth";
import { jsonError, jsonOk } from "@/lib/mobile-api/http";
import { runWithViewer } from "@/lib/mobile-api/request-viewer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireMobileAdmin(request);
  if (!gate.ok) return gate.response;

  const q = new URL(request.url).searchParams.get("q")?.toLowerCase().trim() ?? "";

  try {
    let customers = await runWithViewer(gate.viewer, () => getCustomersForStaff());
    if (q) {
      customers = customers.filter((c) => {
        const hay = [c.firstName, c.lastName, c.email, c.phone, c.companyName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return jsonOk({ customers });
  } catch (error) {
    return jsonError(
      "LOAD_FAILED",
      error instanceof Error ? error.message : "Could not load customers.",
      500
    );
  }
}
