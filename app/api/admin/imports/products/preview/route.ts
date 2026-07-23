import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/auth";
import { parseProductWorkbook } from "@/lib/import/product-import";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await requireStaffApi("manager");
  if (!access.ok) return access.response;
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: { code: "FILE_REQUIRED", message: "Choose an .xlsx workbook." } }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".xlsx")) return NextResponse.json({ error: { code: "INVALID_FILE_TYPE", message: "Only .xlsx workbooks are accepted." } }, { status: 415 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: { code: "FILE_TOO_LARGE", message: "The workbook must be 10 MB or smaller." } }, { status: 413 });

  try {
    const preview = await parseProductWorkbook(Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ data: preview });
  } catch (error) {
    return NextResponse.json({ error: { code: "WORKBOOK_INVALID", message: error instanceof Error ? error.message : "The workbook could not be read." } }, { status: 400 });
  }
}
