-- Row Level Security and grants.
-- Admin role changes and sensitive approvals should go through verified server routes using service_role.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.status = 'active'
  limit 1;
$$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select coalesce(private.current_app_role() in ('staff', 'manager', 'admin'), false);
$$;

create or replace function private.is_manager()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select coalesce(private.current_app_role() in ('manager', 'admin'), false);
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select coalesce(private.current_app_role() = 'admin', false);
$$;

-- Service-role API requests bypass RLS at the table level, but owner-rights reporting
-- views still need an explicit caller check so their WHERE gates do not return zero rows.
create or replace function private.is_service_role()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select coalesce((select auth.role()) = 'service_role', false);
$$;

create or replace function private.can_view_staff_data()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select private.is_staff() or private.is_service_role();
$$;

create or replace function private.can_view_manager_data()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select private.is_manager() or private.is_service_role();
$$;

revoke all on function private.current_app_role() from public;
revoke all on function private.is_staff() from public;
revoke all on function private.is_manager() from public;
revoke all on function private.is_admin() from public;
revoke all on function private.is_service_role() from public;
revoke all on function private.can_view_staff_data() from public;
revoke all on function private.can_view_manager_data() from public;
grant execute on function private.current_app_role() to anon, authenticated;
grant execute on function private.is_staff() to anon, authenticated;
grant execute on function private.is_manager() to anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;
grant execute on function private.is_service_role() to anon, authenticated, service_role;
grant execute on function private.can_view_staff_data() to anon, authenticated, service_role;
grant execute on function private.can_view_manager_data() to anon, authenticated, service_role;

-- Reduce directly callable public RPC surface.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
grant execute on function public.recalculate_sales_order_totals(uuid) to authenticated;
grant execute on function public.recalculate_invoice_totals(uuid) to authenticated;
grant execute on function public.recalculate_invoice_payment_state(uuid) to authenticated;

-- Enable RLS on every table in the exposed public schema.
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_media enable row level security;
alter table public.inventory_locations enable row level security;
alter table public.inventory_balances enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.import_jobs enable row level security;
alter table public.import_job_rows enable row level security;
alter table public.audit_log enable row level security;
alter table public.app_settings enable row level security;

-- Base grants. RLS still decides which rows are visible/mutable.
revoke create on schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant usage, select on sequence public.customer_number_seq to authenticated;
grant usage, select on sequence public.sales_order_number_seq to authenticated;
grant usage, select on sequence public.invoice_number_seq to authenticated;

-- Anonymous storefront access is column-scoped so internal user IDs, object keys and costs
-- cannot be requested by bypassing the curated catalog view.
grant select (
  id, parent_id, name, slug, description, image_url, sort_order, is_active, created_at, updated_at
) on public.categories to anon;

grant select (
  id, product_handle, name, slug, short_description, description, status, featured,
  seo_title, seo_description, published_at, created_at, updated_at
) on public.products to anon;

grant select (product_id, category_id, is_primary, created_at)
  on public.product_categories to anon;

grant select (
  id, product_id, variant_id, media_type, provider, status, public_url, playback_url,
  poster_url, alt_text, content_type, bytes, width, height, duration_seconds,
  position, is_primary, created_at, updated_at
) on public.product_media to anon;

grant select (key, value, is_public, description, updated_at)
  on public.app_settings to anon;

grant select (
  id, product_id, variant_name, sku, barcode, attributes, retail_price, currency, taxable,
  track_inventory, allow_backorder, unit, weight_oz, is_default, is_active, created_at, updated_at
) on public.product_variants to anon;

grant select on public.profiles, public.customers, public.customer_addresses,
  public.inventory_locations, public.inventory_balances, public.inventory_movements,
  public.sales_orders, public.invoices, public.payments, public.expense_categories,
  public.expenses, public.import_jobs, public.import_job_rows, public.audit_log
  to authenticated;

-- Authenticated customer catalog access is the same safe projection as anonymous access.
-- Admin screens needing object keys, wholesale/cost fields or creator IDs must use verified
-- server routes/service-role projections rather than exposing those columns to every login.
grant select (
  id, parent_id, name, slug, description, image_url, sort_order, is_active, created_at, updated_at
) on public.categories to authenticated;

grant select (
  id, product_handle, name, slug, short_description, description, status, featured,
  seo_title, seo_description, published_at, created_at, updated_at
) on public.products to authenticated;

grant select (product_id, category_id, is_primary, created_at)
  on public.product_categories to authenticated;

grant select (
  id, product_id, variant_id, media_type, provider, status, public_url, playback_url,
  poster_url, alt_text, content_type, bytes, width, height, duration_seconds,
  position, is_primary, created_at, updated_at
) on public.product_media to authenticated;

grant select (key, value, is_public, description, updated_at)
  on public.app_settings to authenticated;

grant select (
  id, product_id, variant_name, sku, barcode, attributes, retail_price, currency, taxable,
  track_inventory, allow_backorder, unit, weight_oz, is_default, is_active, created_at, updated_at
) on public.product_variants to authenticated;

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

grant update (full_name, phone, avatar_url) on public.profiles to authenticated;
grant update (first_name, last_name, company_name, email, phone) on public.customers to authenticated;
grant insert, update, delete on public.customer_addresses to authenticated;

grant insert, update, delete on public.categories, public.products, public.product_categories,
  public.product_variants, public.product_media, public.inventory_locations,
  public.sales_orders, public.sales_order_items, public.invoices, public.invoice_items,
  public.payments, public.expense_categories, public.expenses, public.import_jobs,
  public.import_job_rows to authenticated;

grant insert on public.inventory_movements to authenticated;

-- Profiles.
create policy profiles_own_read
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy profiles_staff_read
  on public.profiles for select to authenticated
  using ((select private.is_staff()));

create policy profiles_own_update
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Customers.
create policy customers_own_read
  on public.customers for select to authenticated
  using (auth_user_id = (select auth.uid()));

create policy customers_staff_read
  on public.customers for select to authenticated
  using ((select private.is_staff()));

create policy customers_own_update
  on public.customers for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

create policy customers_staff_all
  on public.customers for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

-- Customer addresses.
create policy customer_addresses_own_all
  on public.customer_addresses for all to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_addresses.customer_id
        and c.auth_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.customers c
      where c.id = customer_addresses.customer_id
        and c.auth_user_id = (select auth.uid())
    )
  );

create policy customer_addresses_staff_all
  on public.customer_addresses for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

-- Public catalog.
create policy categories_public_read
  on public.categories for select to anon, authenticated
  using (is_active or (select private.is_staff()));

create policy categories_staff_all
  on public.categories for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

create policy products_public_read
  on public.products for select to anon, authenticated
  using (status = 'active' or (select private.is_staff()));

create policy products_staff_all
  on public.products for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

create policy product_categories_public_read
  on public.product_categories for select to anon, authenticated
  using (
    (select private.is_staff()) or
    (
      exists (
        select 1 from public.products p
        where p.id = product_categories.product_id and p.status = 'active'
      )
      and exists (
        select 1 from public.categories c
        where c.id = product_categories.category_id and c.is_active
      )
    )
  );

create policy product_categories_staff_all
  on public.product_categories for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

create policy product_variants_public_read
  on public.product_variants for select to anon, authenticated
  using (
    (select private.is_staff()) or
    (
      is_active and exists (
        select 1 from public.products p
        where p.id = product_variants.product_id and p.status = 'active'
      )
    )
  );

create policy product_variants_staff_all
  on public.product_variants for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

create policy product_media_public_read
  on public.product_media for select to anon, authenticated
  using (
    (select private.is_staff()) or
    (
      status = 'ready' and exists (
        select 1 from public.products p
        where p.id = product_media.product_id and p.status = 'active'
      )
    )
  );

create policy product_media_staff_all
  on public.product_media for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

-- Inventory.
create policy inventory_locations_staff_all
  on public.inventory_locations for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

create policy inventory_balances_staff_read
  on public.inventory_balances for select to authenticated
  using ((select private.is_staff()));

create policy inventory_movements_staff_read
  on public.inventory_movements for select to authenticated
  using ((select private.is_staff()));

create policy inventory_movements_staff_insert
  on public.inventory_movements for insert to authenticated
  with check ((select private.is_staff()));

-- Sales orders.
create policy sales_orders_customer_read
  on public.sales_orders for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = sales_orders.customer_id
        and c.auth_user_id = (select auth.uid())
    )
  );

create policy sales_orders_staff_all
  on public.sales_orders for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

create policy sales_order_items_customer_read
  on public.sales_order_items for select to authenticated
  using (
    exists (
      select 1
      from public.sales_orders so
      join public.customers c on c.id = so.customer_id
      where so.id = sales_order_items.order_id
        and c.auth_user_id = (select auth.uid())
    )
  );

create policy sales_order_items_staff_all
  on public.sales_order_items for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

-- Invoices and payments.
create policy invoices_customer_read
  on public.invoices for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = invoices.customer_id
        and c.auth_user_id = (select auth.uid())
    )
  );

create policy invoices_staff_all
  on public.invoices for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

create policy invoice_items_customer_read
  on public.invoice_items for select to authenticated
  using (
    exists (
      select 1
      from public.invoices i
      join public.customers c on c.id = i.customer_id
      where i.id = invoice_items.invoice_id
        and c.auth_user_id = (select auth.uid())
    )
  );

create policy invoice_items_staff_all
  on public.invoice_items for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

create policy payments_customer_read
  on public.payments for select to authenticated
  using (
    exists (
      select 1
      from public.invoices i
      join public.customers c on c.id = i.customer_id
      where i.id = payments.invoice_id
        and c.auth_user_id = (select auth.uid())
    )
  );

create policy payments_staff_all
  on public.payments for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

-- Expenses and reports source data.
create policy expense_categories_staff_all
  on public.expense_categories for all to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

create policy expenses_staff_all
  on public.expenses for all to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

-- Imports.
create policy import_jobs_manager_all
  on public.import_jobs for all to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

create policy import_job_rows_manager_all
  on public.import_job_rows for all to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

-- Audit and settings.
create policy audit_log_admin_read
  on public.audit_log for select to authenticated
  using ((select private.is_admin()));

create policy app_settings_public_read
  on public.app_settings for select to anon, authenticated
  using (is_public or (select private.is_staff()));
