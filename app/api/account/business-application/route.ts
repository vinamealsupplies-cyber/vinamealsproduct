import { NextResponse } from "next/server";
import { submitBusinessApplication } from "@/app/account/business-application/actions";
import { initialBusinessApplicationFormState } from "@/lib/business-application/types";

/**
 * POST multipart form — avoids Server Action ID mismatch after deploy
 * (same pattern as /api/account/addresses).
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const result = await submitBusinessApplication(initialBusinessApplicationFormState, formData);
    return NextResponse.json(result, {
      status: result.status === "success" ? 200 : 400
    });
  } catch (err) {
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Could not submit application.";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
