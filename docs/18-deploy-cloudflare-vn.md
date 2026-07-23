# 18. Deploy lên Cloudflare Workers

App này có API routes, server actions và trang render động, nên **không export
tĩnh được**. Cách chạy trên Cloudflare là qua `@opennextjs/cloudflare` — adapter
đóng gói Next.js thành một Worker.

## Lệnh

```bash
npm run cf:build     # đóng gói Next.js thành Worker
npm run cf:preview   # chạy thử bằng Workers runtime tại máy
npm run cf:deploy    # đẩy lên Cloudflare
```

`npm run dev` vẫn là Next dev bình thường, dùng khi code hằng ngày. Nhưng trước
khi deploy nên chạy `cf:preview` một lần, vì Workers runtime khác Node —
có thứ chạy được ở dev mà chết trên Worker.

## Bước bắt buộc làm một lần

Tài khoản Cloudflare phải đăng ký subdomain `workers.dev` trước lần deploy đầu:

https://dash.cloudflare.com/83cf54f581db31fb55508d236c0af33a/workers/onboarding

Tên chọn ở đây thành một phần của mọi URL sau này
(`vinameals.<tên-bạn-chọn>.workers.dev`) và không đổi lại dễ dàng.

Nếu dùng tên miền riêng thì bỏ qua bước trên, thêm route vào `wrangler.jsonc`:

```jsonc
"routes": [
  { "pattern": "vinameals.com/*", "zone_name": "vinameals.com" }
]
```

## Đã phải bỏ `proxy.ts` — đọc kỹ phần này

Next.js 16 đổi `middleware.ts` thành `proxy.ts` và **chỉ cho chạy trên Node.js
runtime** (khai báo `runtime: "edge"` bị Next từ chối thẳng: *"Proxy does not
support Edge runtime"*). Nhưng `@opennextjs/cloudflare` 1.20.2 **chưa hỗ trợ
Node.js middleware** — build dừng với *"Node.js middleware is not currently
supported"*. Không có cờ nào bật được, adapter chặn cứng.

Hai bên chưa gặp nhau, nên `proxy.ts` ở thư mục gốc đã bị gỡ.

**Mất gì:** proxy đó gọi `supabase.auth.getClaims()` mỗi request để làm mới
cookie phiên đăng nhập. Không có nó thì khi access token hết hạn (mặc định 1
giờ), Server Component không ghi lại cookie mới được — Next không cho ghi cookie
trong RSC.

**Vì sao vẫn chấp nhận được:**

- Ngay lúc này Supabase chưa được cấu hình, nên hàm đó `return` ngay ở dòng đầu.
  Gỡ đi không đổi hành vi gì.
- Supabase browser client (`lib/supabase/client.ts`) tự làm mới token phía
  trình duyệt và ghi cookie. Khách dùng web bình thường vẫn giữ được phiên.
- Đăng nhập/đăng xuất đi qua Server Action và Route Handler — hai chỗ này ghi
  cookie được.

**Logic vẫn còn nguyên** trong `lib/supabase/proxy.ts`. Muốn khôi phục, tạo lại
`proxy.ts` ở gốc:

```ts
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)"]
};
```

Khôi phục khi: OpenNext hỗ trợ Node middleware, hoặc chuyển sang host khác
(Vercel chạy được ngay). **Kiểm tra lại trước mỗi lần nâng cấp
`@opennextjs/cloudflare`** — hỗ trợ Node middleware là thứ họ đang làm.

## Biến môi trường trên Cloudflare

`.env.local` chỉ dùng ở máy. Biến cho bản deploy đặt bằng:

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put R2_SECRET_ACCESS_KEY
```

Biến `NEXT_PUBLIC_*` phải có sẵn **lúc build** (Next nhúng vào bundle), nên đặt
trong môi trường chạy `cf:build`, không phải bằng `wrangler secret`.

Đừng commit giá trị thật vào `wrangler.jsonc`.

## Bản deploy hiện tại lộ ra những gì

- **Storefront công khai**: trang chủ, danh mục, chi tiết sản phẩm, giỏ hàng,
  trang bán sỉ — chạy trên dữ liệu mẫu.
- **Admin bị khoá**: `NODE_ENV=production` tự tắt demo mode, Supabase chưa cấu
  hình nên `getViewer()` trả null, `/admin` redirect 307 sang `/login`. Đã kiểm
  chứng trên bản preview Workers.
- **Không có dữ liệu thật nào** — chưa nối database.
