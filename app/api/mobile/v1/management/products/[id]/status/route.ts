import {
  archiveProductAction,
  deleteProductForeverAction,
  restoreProductAction
} from "@/app/admin/products/actions";
import { requireMobileAdmin, requireMobileAdminOnly } from "@/lib/mobile-api/auth";
import { jsonError, jsonOk } from "@/lib/mobile-api/http";
import { runWithViewer } from "@/lib/mobile-api/request-viewer";

export const runtime = "nodejs";

/** POST { action: "archive" | "restore" | "delete_forever" } */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("BAD_REQUEST", "Invalid JSON body.");
  }

  const action = body.action ?? "";
  if (action === "delete_forever") {
    const gate = await requireMobileAdminOnly(request);
    if (!gate.ok) return gate.response;
    const form = new FormData();
    form.set("id", id);
    const result = await runWithViewer(gate.viewer, () =>
      deleteProductForeverAction({ status: "idle", message: "" }, form)
    );
    if (result.status === "error") {
      return jsonError("DELETE_FAILED", result.message ?? "Delete failed.", 400);
    }
    return jsonOk({ message: result.message });
  }

  const gate = await requireMobileAdmin(request);
  if (!gate.ok) return gate.response;

  const form = new FormData();
  form.set("id", id);

  const result = await runWithViewer(gate.viewer, async () => {
    if (action === "archive") return archiveProductAction({ status: "idle", message: "" }, form);
    if (action === "restore") return restoreProductAction({ status: "idle", message: "" }, form);
    return { status: "error" as const, message: `Unknown action: ${action}` };
  });

  if (result.status === "error") {
    return jsonError("STATUS_FAILED", result.message ?? "Update failed.", 400);
  }
  return jsonOk({ message: result.message });
}
