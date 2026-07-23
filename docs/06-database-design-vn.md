# 06. Thiết kế database Supabase

## 1. Nhóm bảng chính

### Identity and customers

- `profiles`: profile và role cho Supabase user.
- `customers`: retail/wholesale/guest business record.
- `customer_addresses`: billing/shipping addresses.

### Catalog

- `categories`: cây danh mục qua `parent_id`.
- `products`: thông tin chung của sản phẩm.
- `product_categories`: many-to-many.
- `product_variants`: SKU, barcode, price, cost và inventory flags.
- `product_media`: R2/Stream metadata, ordering và alt text.

### Inventory

- `inventory_locations`.
- `inventory_balances`.
- `inventory_movements`.

### Sales

- `sales_orders`, `sales_order_items`.
- `invoices`, `invoice_items`.
- `payments`.

### Costs and operations

- `expense_categories`, `expenses`.
- `import_jobs`, `import_job_rows`.
- `audit_log`, `app_settings`.

## 2. Quy tắc dữ liệu quan trọng

- SKU unique không phân biệt case theo quy trình import/app.
- Barcode unique khi có giá trị.
- Slug unique.
- Ảnh tối đa 10 mỗi product được enforce bằng trigger.
- Chỉ một primary image mỗi product qua partial unique index.
- Price/cost/amount không âm.
- Không cho inventory xuống âm mặc định.
- Invoice/order item luôn snapshot tên, SKU, price và cost.
- `updated_at` được trigger tự động.

## 3. Search

- GIN full-text index cho product name/description.
- Trigram index cho `ILIKE`/fuzzy name search.
- B-tree index cho category, status, timestamps, foreign keys và report date fields.
- Search admin dùng product name, SKU, barcode; customer dùng name, company, email, phone.

## 4. RLS

- Public chỉ đọc catalog projection/cột an toàn; không đọc giá vốn.
- Authenticated customer chỉ đọc/update dữ liệu của chính mình.
- Staff/manager/admin dùng helper function kiểm tra role.
- Service role chỉ nằm server; không đưa vào browser hoặc public environment variables.
- Mọi table trong exposed schema phải bật RLS.
- Reporting views là owner-rights projection có explicit role gate; customer không nhận dữ liệu cost/profit toàn công ty.

## 5. Reporting

Migration tạo các view mẫu:

- `v_inventory_detail`
- `v_inventory_by_category`
- `v_monthly_business_performance`
- `v_yearly_business_performance`
- `v_customer_sales_summary`

Các view là nền tảng; trước production cần kiểm thử lại với quy tắc revenue recognition, returns và cost method thực tế.

## 6. Migration strategy

- Không sửa migration đã chạy production.
- Mỗi thay đổi schema tạo migration mới.
- Seed chỉ dùng demo/local; không chạy seed giả trên production.
- Generate TypeScript database types sau mỗi migration.

## 7. Database smoke test

Sau migrations, chạy `database/tests/001_smoke_test.sql` trong Supabase SQL Editor. Test tạo dữ liệu tạm, kiểm tra các trigger/view quan trọng rồi `ROLLBACK`; không để lại row test.
