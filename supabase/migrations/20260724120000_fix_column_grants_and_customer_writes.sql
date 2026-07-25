-- Vá bảo mật (security review 2026-07-24).
--
-- #1 NGHIÊM TRỌNG — Grant theo cột trong 20260723090200 không có tác dụng.
--   Supabase cấp sẵn SELECT TOÀN BẢNG cho anon/authenticated qua default
--   privileges của schema public. Migration cũ chỉ CỘNG THÊM grant theo cột
--   mà không thu hồi quyền bảng, nên cost_price / wholesale_price /
--   search_document / object_key vẫn đọc được bằng publishable key.
--   Cách sửa: REVOKE sạch trước, rồi cấp lại đúng những cột an toàn.
--
-- #8 — public.customers thiếu grant INSERT/DELETE dù policy customers_staff_all
--   (FOR ALL) giả định có. Màn hình quản lý khách hàng sẽ lỗi 42501 nếu thiếu.

-- ---------------------------------------------------------------------------
-- 1. Thu hồi toàn bộ quyền bảng của anon/authenticated rồi cấp lại có chủ đích.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

-- Chặn tận gốc: bảng/view tạo về sau không tự động được cấp quyền nữa.
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Catalog công khai — chỉ những cột khách được phép thấy.
--    KHÔNG có: cost_price, wholesale_price (giá vốn/giá sỉ),
--    search_document, created_by, updated_by, object_key, stream_uid.
-- ---------------------------------------------------------------------------
grant select (
  id, parent_id, name, slug, description, image_url, sort_order, is_active, created_at, updated_at
) on public.categories to anon, authenticated;

grant select (
  id, product_handle, name, slug, short_description, description, status, featured,
  seo_title, seo_description, published_at, created_at, updated_at
) on public.products to anon, authenticated;

grant select (product_id, category_id, is_primary, created_at)
  on public.product_categories to anon, authenticated;

grant select (
  id, product_id, variant_id, media_type, provider, status, public_url, playback_url,
  poster_url, alt_text, content_type, bytes, width, height, duration_seconds,
  position, is_primary, created_at, updated_at
) on public.product_media to anon, authenticated;

grant select (
  id, product_id, variant_name, sku, barcode, attributes, retail_price, currency, taxable,
  track_inventory, allow_backorder, unit, weight_oz, is_default, is_active, created_at, updated_at
) on public.product_variants to anon, authenticated;

grant select (key, value, is_public, description, updated_at)
  on public.app_settings to anon, authenticated;

-- Thuế theo thành phố (20260723090600): khách chỉ thấy thuế suất, không thấy
-- ghi chú nội bộ / người xác minh.
grant select (
  id, country_code, state_code, city, county, zip,
  general_rate, grocery_rate, prepared_food_rate,
  effective_from, effective_to, is_active
) on public.tax_jurisdictions to anon, authenticated;

grant insert, update, delete on public.tax_jurisdictions to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Dữ liệu của chính khách hàng (RLS lọc theo dòng; anon không có quyền).
-- ---------------------------------------------------------------------------
grant select on public.profiles, public.customers, public.customer_addresses,
  public.inventory_locations, public.inventory_balances, public.inventory_movements,
  public.sales_orders, public.invoices, public.payments, public.expense_categories,
  public.expenses, public.import_jobs, public.import_job_rows, public.audit_log
  to authenticated;

grant select (
  id, order_id, product_id, variant_id, product_name_snapshot, variant_name_snapshot,
  sku_snapshot, quantity, unit_price, discount_amount, tax_rate_snapshot, tax_amount,
  line_subtotal, line_total, created_at, updated_at
) on public.sales_order_items to authenticated;

grant select (
  id, invoice_id, product_id, variant_id, product_name_snapshot, variant_name_snapshot,
  sku_snapshot, quantity, unit_price, discount_amount, tax_rate_snapshot, tax_amount,
  line_subtotal, line_total, created_at, updated_at
) on public.invoice_items to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Quyền ghi (RLS vẫn là lớp quyết định ai được đụng dòng nào).
-- ---------------------------------------------------------------------------
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;
grant update (first_name, last_name, company_name, email, phone) on public.customers to authenticated;
grant insert, update, delete on public.customer_addresses to authenticated;

-- #8: bổ sung customers vào danh sách insert/delete cho khớp policy staff.
grant insert, delete on public.customers to authenticated;

grant insert, update, delete on public.categories, public.products, public.product_categories,
  public.product_variants, public.product_media, public.inventory_locations,
  public.sales_orders, public.sales_order_items, public.invoices, public.invoice_items,
  public.payments, public.expense_categories, public.expenses, public.import_jobs,
  public.import_job_rows to authenticated;

grant insert on public.inventory_movements to authenticated;

-- ---------------------------------------------------------------------------
-- 5. View báo cáo: cấp lại đúng như 20260723090300 (bước revoke ở trên đã xoá).
-- ---------------------------------------------------------------------------
grant select on public.v_product_listing to anon, authenticated;
grant select on public.v_account_price_list to authenticated;
grant select on public.v_inventory_detail, public.v_inventory_by_category,
  public.v_monthly_business_performance, public.v_yearly_business_performance,
  public.v_sales_by_product_month, public.v_customer_sales_summary,
  public.v_tax_jurisdiction_status to authenticated;

-- Service role không bị ảnh hưởng, nhưng cấp lại cho chắc sau lệnh revoke.
grant all on all tables in schema public to service_role;
