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

## Auth OAuth (Google)
- Code: `signInWithGoogle` trong `app/login/actions.ts`; callback `app/auth/callback/route.ts` (exchange code → session).
- UI: `components/oauth-buttons.tsx` trên `/login`.
- **Bắt buộc cấu hình Supabase Dashboard** (Authentication → Providers):
  1. **Google**: bật provider, dán Client ID + Client Secret từ Google Cloud Console (OAuth 2.0 Web client). Authorized redirect URI của Google = `https://<project-ref>.supabase.co/auth/v1/callback`.
  2. ~~Redirect URLs~~ — **ĐÃ XONG**, khai báo trong `supabase/config.toml`
     (`[auth] site_url` + `additional_redirect_urls`) và đã push lên project.
- Profile: trigger `on_auth_user_created` vẫn tạo `profiles` (role customer) cho user OAuth mới.
- **Đăng nhập Apple đã gỡ** (28/7): bỏ nút UI + `signInWithApple` + nhánh apple trong `/auth/oauth` + block `[auth.external.apple]` trong `config.toml`. Provider Apple trên Dashboard (nếu từng bật) có thể tắt cho gọn.

## `supabase config push` — CẨN THẬN
`supabase/config.toml` giờ là **nguồn sự thật cho auth config production**. Chạy
`supabase config push --project-ref zoegstxkzdetcckgjqkj` sẽ ghi đè remote bằng
**toàn bộ** file, không chỉ phần bạn vừa sửa.

File gốc do `supabase init` sinh ra là template **dành cho local dev**, nên nhiều
mặc định của nó sẽ *kéo tụt* production nếu push nguyên si. Các giá trị đã được
chỉnh lại cho khớp production — **đừng revert về mặc định**:

| Khoá | Mặc định template | Production (đúng) |
|---|---|---|
| `[auth] site_url` | `http://127.0.0.1:3000` | `https://vinamealsupplies.com` |
| `[auth] additional_redirect_urls` | `["https://127.0.0.1:3000"]` | 4 URL `/auth/callback` |
| `[auth.email] enable_confirmations` | `false` | `true` (app gửi link `/auth/confirm`) |
| `[auth.email] max_frequency` | `1s` | `60s` (chống bơm email) |
| `[auth.email] otp_length` | `6` | `8` |
| `[auth.mfa.totp] enroll/verify_enabled` | `false` | `true` |
| `[auth.external.google] enabled` | `false` | `true` |
| `[auth.external.google] client_id` | `env(...)` | Client ID thật (viết thẳng) |

**Quy tắc ghi đè của CLI** (rút ra sau 2 lần làm gãy đăng nhập Google, 31/7):
giá trị **rỗng** thì không đẩy (Dashboard giữ nguyên); giá trị **khác rỗng** thì
đẩy đè — *kể cả khi đó là placeholder `env(...)` chưa expand*. Lần 1 `enabled=false`
tắt hẳn Google; lần 2 `client_id="env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"`
ghi nguyên chuỗi đó vào client_id production. Vì vậy Client ID viết thẳng giá trị
thật (không phải bí mật), còn `secret = ""` để Dashboard giữ bản thật.

Quy trình an toàn: chạy push → **đọc kỹ diff CLI in ra** → nếu thấy dòng `-` nào
là thứ production đang bật thì sửa `config.toml` cho khớp rồi push lại, đến khi
CLI báo `Remote Auth config is up to date`. Sau khi push đụng auth, kiểm chứng
provider bằng `curl <SUPABASE_URL>/auth/v1/settings` — đừng tin mỗi diff.

### Email xác nhận — SMTP Resend (XONG 31/7)
Built-in email của Supabase luôn gửi từ `noreply@mail.app.supabase.io` (khoá cứng)
và trần 2 email/giờ. Đã chuyển sang SMTP Resend, gửi từ
`"Vinameals" <support@vinamealsupplies.com>` — đã kiểm chứng bằng email thật
(Resend → Delivered).

- `[auth.email.smtp]` trong `config.toml`; `pass = "env(SMTP_PASSWORD)"`.
- `SMTP_PASSWORD` = API key Resend (scope *sending only*) trong `.env.local`.
  Key này gọi `GET /domains` sẽ trả 401 "restricted to only send emails" —
  **đó là bình thường**, không phải key hỏng.
- DNS trên **Cloudflare** (Squarespace chỉ là registrar, sửa DNS ở đó vô tác dụng):
  `resend._domainkey` TXT, `send` MX → `feedback-smtp.us-east-1.amazonses.com`,
  `send` TXT → `v=spf1 include:amazonses.com ~all`.
- **KHÔNG đụng SPF gốc** `v=spf1 -all`. Resend dùng return-path
  `send.vinamealsupplies.com` nên SPF kiểm trên subdomain; `-all` ở gốc là lớp
  chống giả mạo, giữ nguyên.
- Token wrangler chỉ có `zone (read)` → không thêm DNS bằng CLI được. Đã tạo qua
  API dashboard trong phiên trình duyệt (`POST /api/v4/zones/<id>/dns_records`).

⚠️ **DMARC đang rất chặt**: `p=reject; adkim=s; aspf=s`. Với `aspf=s`, SPF
KHÔNG tính (envelope là subdomain). Thư qua được **chỉ nhờ DKIM** (`d=` khớp
khít). DKIM hỏng = thư bị **từ chối thẳng**, không vào spam. Cân nhắc đổi
`aspf=s` → `aspf=r` để có hai chân.

Domain chưa có MX ở gốc → `support@` **không nhận** được thư. Cần nhận thì bật
Cloudflare Email Routing (token có `email_routing (write)`).

## Phân quyền admin (đã đúng theo yêu cầu)
- Enum `public.app_role`: `customer | seller | staff | manager | admin`.
- **Role `seller`** (28/7): chỉ quản lý fulfillment. Vào CHUNG khu `/admin` nhưng nav
  (`components/admin-nav.tsx`) chỉ hiện **Inventory / Orders / Invoices / Payments**;
  các trang khác tự chặn bằng `requireStaffPage()` (đẩy seller về `/admin/orders`).
  Vào khu admin qua `viewer.canAccessAdmin` (= `isStaff || isSeller`) ở `app/admin/layout.tsx`;
  action sửa kho (`app/admin/inventory/actions.ts`) cũng dùng `canAccessAdmin`. Enforcement ở
  tầng app (service role) như mọi luồng admin; DB thêm enum value + `private.is_seller()`.
  Tạo seller: `update public.profiles set role='seller' where email='…';`
- **Checkout đặt thử — KHÔNG thanh toán** (28/7): `/checkout` (yêu cầu đăng nhập) →
  `placeTestOrder` (`app/checkout/actions.ts`) tạo `sales_orders` status `confirmed`,
  fulfillment `pickup` tại `STORE-PICKUP`, không thu tiền. Seller xác nhận ở `/admin/orders`
  (`confirmPickup` → `picked_up_at` + status `fulfilled`); đơn pickup chưa lấy nhấp nháy đỏ
  (`.blink-red`). Stripe/thanh toán vẫn là phase sau. Nút vào từ `components/cart-view.tsx`.
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
