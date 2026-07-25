import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Làm mới phiên Supabase trên mỗi request trang/API.
//
// Trước đây updateSession() là code chết vì không có file middleware nào ở
// root gọi tới, dù lib/supabase/server.ts nuốt lỗi ghi cookie kèm ghi chú
// "The root proxy refreshes sessions". Hệ quả: access token hết hạn không được
// làm mới, người dùng đang thao tác thì bị đá về /login.
//
// Dùng convention `middleware.ts` (chạy Edge) chứ KHÔNG dùng `proxy.ts` của
// Next 16: proxy luôn chạy runtime Node, mà OpenNext/Cloudflare hiện chỉ hỗ
// trợ Edge middleware ("Node.js middleware is not currently supported").
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Bỏ qua tài nguyên tĩnh để không tốn CPU và không đụng cache ảnh.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|woff2?)$).*)"
  ]
};
