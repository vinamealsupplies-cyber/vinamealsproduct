import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createRouteHandlerClient } from "@/lib/supabase/route";

// Đăng xuất là thao tác đổi trạng thái dựa trên cookie phiên. Route handler
// (khác Server Action) KHÔNG có sẵn kiểm tra CSRF, nên trước đây một trang bất
// kỳ có thể tự submit form tới đây để đá người dùng ra khỏi phiên.
// Chỉ chấp nhận request cùng nguồn.
function isSameOrigin(request: NextRequest) {
  // Trình duyệt hiện đại: Sec-Fetch-Site là tín hiệu đáng tin nhất và không
  // thể bị trang khác giả mạo.
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none";

  // Trình duyệt cũ: đối chiếu Origin/Referer với host của chính request.
  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (!origin) return false;
  try {
    const expected = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return Boolean(expected) && new URL(origin).host === expected;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: { code: "CROSS_ORIGIN_BLOCKED", message: "Sign out must be requested from the site itself." } },
      { status: 403 }
    );
  }

  // Cookie session phải được clear TRÊN response redirect.
  // createOptionalClient() + cookies() không gắn Set-Cookie vào NextResponse
  // redirect (đặc biệt trên OpenNext/Cloudflare) → đăng xuất "thành công" nhưng
  // browser vẫn giữ cookie → vào lại vẫn logged in.
  const response = NextResponse.redirect(new URL("/", request.url), { status: 303 });

  if (isSupabaseConfigured()) {
    const supabase = createRouteHandlerClient(request, response);
    await supabase.auth.signOut();
  }

  return response;
}
