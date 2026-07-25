import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/auth";
import { getPendingApplicationSummary } from "@/lib/data/tax-exemption";

// Nguồn dữ liệu cho popup thông báo trong khu admin. Chỉ trả về con số và tên
// doanh nghiệp mới nhất — không lộ email/điện thoại/giấy tờ.
export async function GET() {
  const access = await requireStaffApi("staff");
  if (!access.ok) return access.response;

  const summary = await getPendingApplicationSummary();
  return NextResponse.json(
    { data: summary },
    { headers: { "Cache-Control": "no-store" } }
  );
}
