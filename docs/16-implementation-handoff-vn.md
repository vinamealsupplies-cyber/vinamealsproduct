# 16. Handoff triển khai thực tế

## 1. Tạo GitHub repository

Từ thư mục `starter/`:

```bash
git init
git add .
git commit -m "chore: initialize Vinameals starter"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Bật branch protection cho `main`, yêu cầu CI pass và review trước merge. Dùng ít nhất hai environment: staging và production; không dùng chung Supabase/R2 secrets.

## 2. Chuẩn bị môi trường local

```bash
cd starter
nvm use
cp .env.example .env.local
npm install --no-audit --no-fund
npm run dev
```

Node 22 được ghi trong `.nvmrc` và `package.json`. Sau lần cài dependency thành công đầu tiên, commit `package-lock.json`, đổi CI từ `npm install` sang `npm ci`.

## 3. Khởi tạo Supabase

1. Tạo project development.
2. Chạy `database/001` đến `004`, sau đó `006_transactional_admin_rpcs.sql`.
3. Chỉ chạy `005_seed_demo.sql` ở local/dev.
4. Chạy `database/tests/001_smoke_test.sql`; transaction sẽ rollback dữ liệu test.
5. Generate lại `starter/types/database.generated.ts`.

Tạo admin đầu tiên sau khi user đã đăng ký:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where lower(email) = lower('OWNER_EMAIL@example.com')
);
```

Lệnh nâng role chỉ chạy trong Supabase SQL Editor hoặc server administration workflow; không đưa vào client.

## 4. Kết nối Cloudflare R2

- Tạo bucket riêng cho development và production.
- Tạo API token chỉ có quyền object cần thiết trên bucket.
- Cấu hình CORS chỉ cho origin storefront/admin đã duyệt.
- Dùng custom media domain làm `R2_PUBLIC_BASE_URL`.
- Điền biến trong `.env.local`; không prefix secret bằng `NEXT_PUBLIC_`.
- API presign chỉ tạo URL upload; API complete phải HEAD object và lưu metadata sau khi upload thành công.

Tài liệu tax-exempt, receipt hoặc file riêng tư không dùng public bucket URL. Tạo bucket/private route riêng và signed download ngắn hạn.

## 5. Kết nối video

Cloudflare Stream là lựa chọn mặc định trong starter cho video product. Hoàn thiện webhook để đổi `product_media.status` từ pending/processing sang ready/failed và chỉ publish video khi playback sẵn sàng.

## 6. Thứ tự nối UI với database

### Catalog trước

1. Tạo repository/query cho `v_product_listing`.
2. Tạo product detail query từ `products`, `product_variants`, `product_media`, `categories`.
3. Chuyển search/filter/sort sang server query có pagination.
4. Thêm loading/empty/error states.

### Admin catalog và media

1. Tạo server action/route transaction để insert/update product, variant và categories.
2. Upload ảnh R2 bằng flow presign → PUT → complete; complete route dùng RPC atomic có trong migration 006.
3. Reorder media bằng transaction; enforce positions 1–10.
4. Không truyền service-role key xuống browser.

### Inventory

1. Không update `inventory_balances` trực tiếp.
2. Mọi receiving, sale, waste, return, adjustment, reserve/release tạo `inventory_movements`.
3. Fulfillment phải idempotent để retry không trừ tồn hai lần.
4. Transfer location phải tạo cặp `transfer_out`/`transfer_in` trong cùng transaction.

### Customers/invoices

1. Tạo guest customer cho walk-in/manual invoice khi cần.
2. Wholesale price chỉ dùng khi account được staff gán wholesale.
3. Tax exemption chỉ dùng khi status approved và còn hiệu lực.
4. Snapshot giá, cost và exemption khi tạo invoice.
5. Payment record là nguồn cho `amount_received`; không nhập tay trực tiếp vào invoice.

### Reports

1. Dùng views quản trị, không query cost columns từ browser/customer client.
2. Thêm date range và business timezone.
3. Export CSV/XLSX từ server route có role check.
4. Viết reconciliation test giữa views và source transactions.

## 7. Hoàn thiện Excel import

Flow chuẩn:

1. Upload workbook.
2. Parse/normalize trên server.
3. Trả preview và lỗi theo row/column, chưa thay đổi database.
4. User xác nhận mode create/update/upsert.
5. Commit bằng một RPC/transaction có idempotency key.
6. Opening quantity tạo inventory movement, không ghi balance trực tiếp.
7. Media URL được đưa vào queue để kiểm tra/copy sang R2.
8. Lưu `import_jobs`, `import_job_rows` và audit log.

## 8. Payment và sales tax ở phase riêng

Không nhận hoặc lưu card number/CVV trong ứng dụng. Khi chọn provider, thêm checkout session server-side, verified webhook, idempotency, refund và reconciliation. Sales tax phải dựa trên nexus, địa chỉ, product taxability và exemption certificate; xác nhận với chuyên gia phù hợp trước production.

## 9. CI/CD tối thiểu

Mỗi pull request phải chạy:

```bash
npm run lint
npm run typecheck
npm run build
```

Thêm secret scanning, dependency review và migration check. Deploy staging trước, chạy smoke/UAT, sau đó mới promote production.

## 10. Definition of Done cho từng module

Một module chỉ hoàn thành khi có: quyền server + RLS, validation, success/error/empty/loading UI, audit cần thiết, test positive/negative, responsive/keyboard QA, logging và tài liệu vận hành.

## 11. File map để bắt đầu nhanh

| Công việc | File/thư mục chính |
|---|---|
| Storefront UI | `starter/app/page.tsx`, `starter/app/products/`, `starter/components/product-*` |
| Header/account/admin link | `starter/components/site-header.tsx`, `starter/lib/auth.ts` |
| Admin screens | `starter/app/admin/`, `starter/components/admin-*` |
| Supabase SSR | `starter/lib/supabase/`, `starter/proxy.ts` |
| R2 upload | `starter/lib/r2.ts`, `starter/app/api/admin/media/` |
| Stream upload | `starter/app/api/admin/video/direct-upload/route.ts` |
| Excel preview | `starter/lib/import/product-import.ts`, `starter/app/api/admin/imports/` |
| Schema/RLS/reports/RPC | `database/001`–`004`, `database/006_transactional_admin_rpcs.sql` |
| Database verification | `database/tests/001_smoke_test.sql` |
| Import workbook | `import-templates/product-import-template.xlsx` |
| Backlog | `import-templates/implementation-backlog.xlsx` |
