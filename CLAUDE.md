# CLAUDE.md — Vinameals

Hướng dẫn cho Claude Code khi làm việc trong repo này.

## Quyền hạn (autonomy) — KHÔNG hỏi lại
- Người dùng đã cấp **toàn quyền** trong thư mục này: chạy mọi lệnh (git/GitHub `gh`, Cloudflare `wrangler`, Supabase CLI), đọc/sửa/tạo file, dùng MCP Supabase & Vercel — **không cần hỏi xác nhận**.
- Cấu hình quyền ở `.claude/settings.local.json` (đã gitignore, chỉ giữ trong máy — không commit).
- Cứ chủ động thực hiện. Chỉ dừng khi thiếu **credential mà chỉ người dùng có**: mật khẩu DB, key Supabase/Cloudflare, hoặc thao tác cần đăng nhập dashboard.
- Giữ file bí mật/local trong máy, không đẩy lên repo: `.env.local`, `.dev.vars`, `.claude/settings.local.json`, `*.local.md`.

## Tổng quan
- **Vinameals** — storefront Next.js (App Router) + Supabase (Postgres/Auth) + Cloudflare (Workers qua OpenNext, R2 cho ảnh, Stream cho video).
- Production domain: `vinamealsupplies.com` (+ `www`) → Worker `vinamealsproduct` (routes trong `wrangler.jsonc`).
- Workers.dev: `https://vinamealsproduct.vinameals.workers.dev`
- Supabase project ref: `zoegstxkzdetcckgjqkj`. Migrations ở `supabase/migrations/`.
- GitHub: `https://github.com/vinamealsupplies-cyber/vinamealsproduct` (account `vinamealsupplies-cyber` qua `gh`).

## Deploy Cloudflare (OpenNext)
```bash
# 1) Login nếu wrangler whoami báo chưa auth
npx wrangler login

# 2) Build sạch (BẮT BUỘC — `cf:deploy` có thể tái dùng .open-next cũ)
rm -rf .open-next .next
set -a && source .env.local && set +a
export NEXT_PUBLIC_SITE_ORIGIN="https://vinamealsupplies.com"
export APP_DEMO_MODE="false"
npm run cf:build

# 3) Deploy
npx opennextjs-cloudflare deploy
# hoặc: npm run cf:deploy  (sau khi đã build sạch)
```
- Secrets Worker (đã set): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_DEMO_MODE`, `NEXT_PUBLIC_SITE_ORIGIN`, R2 keys, `R2_DOCUMENTS_BUCKET`, `CLOUDFLARE_ACCOUNT_ID`.
- **Không** commit `.env.local`. Không dùng `wrangler deploy` thuần nếu chưa có bundle OpenNext.

## Chế độ DEMO vs THẬT
- `lib/env.ts`: `isLocalDemoMode()` = `NODE_ENV!=='production' && APP_DEMO_MODE==='true'`; `isSupabaseConfigured()` cần URL + publishable key.
- **Production / local thật**: `APP_DEMO_MODE=false` + keys Supabase/R2 trong `.env.local` → admin đọc/ghi Supabase (service role qua `createAdminClient()`).
- Sample data `lib/admin-sample-data.ts` **đã xoá** — admin products/inventory/customers/expenses/reporting lấy từ DB.

## Admin — hành vi cần nhớ
- **Inventory** (`/admin/inventory`): chỉnh số lượng (ledger `inventory_movements`), **giá nhập** (`cost_price`) + **giá bán** (`retail_price`) trên `product_variants`. **Không** còn UI reorder point (cột DB vẫn default 0).
- **Products** (`/admin/products`): tab filter **Catalog | Active | Draft | Archived | All**. Archive **không xoá** — ẩn storefront, tìm lại ở tab **Archived** (Edit / Restore). Archive xong UI tự mở tab Archived.
- **Delete forever** (manager, chỉ khi đã archived): RPC `admin_delete_product_forever` xoá `inventory_movements` + `inventory_balances` + product (cascade variants/media). Migration `20260727120000_admin_delete_product_forever.sql`.
- **Thuế giỏ hàng**: app **không** tự tính sales tax; fulfillment hiện "Calculated at checkout" (Stripe Tax khi cài). Bảng tax admin chỉ tham chiếu.
- Xoá vĩnh viễn product: chỉ manager/admin; nếu đã có inventory movements thì DB chặn delete → giữ archived.

## Auth OAuth (Google + Apple)
- Code: `signInWithGoogle` / `signInWithApple` trong `app/login/actions.ts`; callback `app/auth/callback/route.ts` (exchange code → session).
- UI: `components/oauth-buttons.tsx` trên `/login`.
- **Bắt buộc cấu hình Supabase Dashboard** (Authentication → Providers):
  1. **Google**: bật provider, dán Client ID + Client Secret từ Google Cloud Console (OAuth 2.0 Web client). Authorized redirect URI của Google = `https://<project-ref>.supabase.co/auth/v1/callback`.
  2. **Apple**: bật provider, Services ID, Team ID, Key ID, private key (.p8). Return URL Apple = `https://<project-ref>.supabase.co/auth/v1/callback`.
  3. Authentication → URL Configuration → **Redirect URLs** thêm:
     - `https://vinamealsupplies.com/auth/callback`
     - `https://www.vinamealsupplies.com/auth/callback`
     - `https://vinamealsproduct.vinameals.workers.dev/auth/callback`
     - `http://localhost:3000/auth/callback` (dev)
- Profile: trigger `on_auth_user_created` vẫn tạo `profiles` (role customer) cho user OAuth mới.

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
- GitHub push: remote HTTPS + `gh auth login` (account `vinamealsupplies-cyber`). Token hết hạn → `gh auth login -h github.com -p https -w`. SSH user `trannguyen86` **không** có quyền repo này.
- Cloudflare: OAuth token trong `~/.wrangler/config/default.enc` (macOS Keychain). Hết hạn → `npx wrangler login`.
- Schema inventory pricing (`cost_price`, `retail_price`, view `v_inventory_detail`) **đã có sẵn** — feature chỉnh giá inventory **không** cần migration mới.
