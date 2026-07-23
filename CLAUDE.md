# CLAUDE.md — Vinameals

Hướng dẫn cho Claude Code khi làm việc trong repo này.

## Quyền hạn (autonomy) — KHÔNG hỏi lại
- Người dùng đã cấp **toàn quyền** trong thư mục này: chạy mọi lệnh (git/GitHub `gh`, Cloudflare `wrangler`, Supabase CLI), đọc/sửa/tạo file, dùng MCP Supabase & Vercel — **không cần hỏi xác nhận**.
- Cấu hình quyền ở `.claude/settings.local.json` (đã gitignore, chỉ giữ trong máy — không commit).
- Cứ chủ động thực hiện. Chỉ dừng khi thiếu **credential mà chỉ người dùng có**: mật khẩu DB, key Supabase/Cloudflare, hoặc thao tác cần đăng nhập dashboard.
- Giữ file bí mật/local trong máy, không đẩy lên repo: `.env.local`, `.dev.vars`, `.claude/settings.local.json`, `*.local.md`.

## Tổng quan
- **Vinameals** — storefront Next.js (App Router) + Supabase (Postgres/Auth) + Cloudflare (Workers qua OpenNext, R2 cho ảnh, Stream cho video).
- Deploy: `npx wrangler deploy` (OpenNext). Cần đăng ký **workers.dev subdomain** hoặc thêm `routes` trong `wrangler.jsonc` thì deploy mới ra link.
- Supabase project ref: `zoegstxkzdetcckgjqkj`. Migrations ở `supabase/migrations/`.

## Chế độ DEMO vs THẬT
- `lib/env.ts`: `isLocalDemoMode()` = `NODE_ENV!=='production' && APP_DEMO_MODE==='true'`; `isSupabaseConfigured()` cần `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Hiện tại `.env.local` để `APP_DEMO_MODE=true` và các key Supabase/Cloudflare **đang rỗng** → app chạy **demo**: dữ liệu mẫu (`lib/admin-sample-data.ts`) + **admin giả** (`getViewer()` trả Demo Admin role=admin). Không có backend thật.
- Để chạy **THẬT**: điền `.env.local` (URL + publishable key + service role key + Cloudflare/R2), đặt `APP_DEMO_MODE=false`, rồi push migrations.

## Phân quyền admin (đã đúng theo yêu cầu)
- Enum `public.app_role`: `customer | staff | manager | admin`.
- Bảng `public.profiles(id → auth.users, role, status, …)`. Trigger `on_auth_user_created` tự tạo profile khi có user mới (mặc định `role=customer`).
- Gate quyền:
  - DB/RLS: `private.is_admin()` = `role='admin'` (kèm `is_staff()`, `is_manager()`).
  - App: `lib/auth.ts::getViewer()` đọc `profiles.role`; `isAdmin = role==='admin'`.
  - **Khách hàng (role=customer) KHÔNG thấy khu vực admin** — đảm bảo sẵn bằng thiết kế, không cần thêm gì.

## Tạo tài khoản admin (khi chạy THẬT)
1. Push migrations (cần mật khẩu DB — đi thẳng, tránh lỗi profile):
   `supabase db push --db-url "postgresql://postgres.zoegstxkzdetcckgjqkj:<DB_PASSWORD>@aws-1-us-west-2.pooler.supabase.com:5432/postgres"`
2. Tạo user bằng service role key: `POST <SUPABASE_URL>/auth/v1/admin/users` với `{"email":..., "password":..., "email_confirm":true}` (header `apikey` + `Authorization: Bearer <SERVICE_ROLE_KEY>`).
3. Nâng quyền: `update public.profiles set role='admin' where email='<email>';`

## Gotchas môi trường
- `rtk` KHÔNG được cài (dù CLAUDE.md global có nhắc RTK) — mọi lệnh chạy trực tiếp, không qua proxy.
- Supabase CLI: profile mặc định `~/.supabase/profile` từng bị hỏng (bare string) gây lỗi `Unsupported Config Type`; đã đổi tên thành `~/.supabase/profile.disabled`. Với `db push` nên dùng `--db-url` thay vì `--linked` để tránh lỗi profile.
- Supabase CLI ghi secret `sb_secret_*` dạng plaintext vào `~/.supabase/traces/*.ndjson` — cân nhắc dọn định kỳ.
