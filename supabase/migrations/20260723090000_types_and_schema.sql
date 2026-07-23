-- Food commerce core schema for Supabase/Postgres.
-- Run once as a migration. All money fields are exact numeric values in USD by default.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create type public.app_role as enum ('customer', 'staff', 'manager', 'admin');
create type public.account_status as enum ('active', 'disabled');
create type public.customer_type as enum ('retail', 'wholesale', 'guest');
create type public.customer_status as enum ('active', 'inactive', 'blocked');
create type public.tax_exempt_status as enum ('not_requested', 'pending', 'approved', 'rejected', 'expired');
create type public.address_type as enum ('billing', 'shipping', 'other');
create type public.product_status as enum ('draft', 'active', 'archived');
create type public.media_type as enum ('image', 'video');
create type public.media_provider as enum ('r2', 'stream', 'external');
create type public.media_status as enum ('pending', 'uploaded', 'processing', 'ready', 'failed');
create type public.inventory_movement_type as enum (
  'opening', 'purchase', 'sale', 'return_in', 'return_out',
  'adjustment', 'waste', 'transfer_in', 'transfer_out', 'reserve', 'release', 'reversal'
);
create type public.sales_channel as enum ('web', 'admin', 'phone', 'walk_in', 'other');
create type public.sales_order_status as enum ('draft', 'confirmed', 'fulfilled', 'cancelled');
create type public.invoice_status as enum ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void');
create type public.payment_kind as enum ('payment', 'refund');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'cancelled');
create type public.import_status as enum ('uploaded', 'validating', 'ready', 'committing', 'completed', 'failed', 'cancelled');
create type public.import_row_status as enum ('valid', 'warning', 'error', 'committed', 'skipped');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  avatar_url text,
  role public.app_role not null default 'customer',
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_lower_uidx on public.profiles (lower(email))
  where email is not null;
create index profiles_role_idx on public.profiles (role);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  customer_number text unique,
  customer_type public.customer_type not null default 'retail',
  status public.customer_status not null default 'active',
  first_name text,
  last_name text,
  company_name text,
  email text,
  phone text,
  notes text,
  tax_exempt_status public.tax_exempt_status not null default 'not_requested',
  tax_exempt_reason text,
  tax_exempt_certificate_number text,
  tax_exempt_issuing_state text,
  tax_exempt_effective_at date,
  tax_exempt_expires_at date,
  tax_exempt_document_key text,
  tax_exempt_verified_by uuid references public.profiles(id) on delete set null,
  tax_exempt_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_wholesale_company_check check (
    customer_type <> 'wholesale' or nullif(btrim(company_name), '') is not null
  )
);

create index customers_auth_user_idx on public.customers (auth_user_id);
create index customers_type_status_idx on public.customers (customer_type, status);
create index customers_name_trgm_idx on public.customers using gin (
  (coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(company_name, '')) gin_trgm_ops
);
create index customers_email_lower_idx on public.customers (lower(email));

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  address_type public.address_type not null,
  label text,
  recipient_name text,
  company_name text,
  line1 text not null,
  line2 text,
  city text not null,
  state_region text not null,
  postal_code text not null,
  country_code char(2) not null default 'US',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_addresses_customer_idx on public.customer_addresses (customer_id);
create unique index customer_addresses_one_default_uidx
  on public.customer_addresses (customer_id, address_type)
  where is_default;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete restrict,
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_not_self_parent check (parent_id is null or parent_id <> id)
);

create index categories_parent_sort_idx on public.categories (parent_id, sort_order, name);
create index categories_active_idx on public.categories (is_active);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  product_handle text not null unique,
  name text not null,
  slug text not null unique,
  short_description text,
  description text,
  status public.product_status not null default 'draft',
  featured boolean not null default false,
  seo_title text,
  seo_description text,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(name, '') || ' ' || coalesce(product_handle, '') || ' ' ||
      coalesce(short_description, '') || ' ' || coalesce(description, '')
    )
  ) stored
);

create index products_status_published_idx on public.products (status, published_at desc);
create index products_featured_idx on public.products (featured) where status = 'active';
create index products_search_gin_idx on public.products using gin (search_document);
create index products_name_trgm_idx on public.products using gin (name gin_trgm_ops);

create table public.product_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (product_id, category_id)
);

create index product_categories_category_idx on public.product_categories (category_id, product_id);
create unique index product_categories_one_primary_uidx
  on public.product_categories (product_id)
  where is_primary;

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_name text not null default 'Default',
  sku text not null,
  barcode text,
  attributes jsonb not null default '{}'::jsonb,
  retail_price numeric(14,2) not null default 0,
  wholesale_price numeric(14,2),
  cost_price numeric(14,4) not null default 0,
  currency char(3) not null default 'USD',
  taxable boolean not null default true,
  track_inventory boolean not null default true,
  allow_backorder boolean not null default false,
  unit text not null default 'each',
  weight_oz numeric(12,3),
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_price_check check (
    retail_price >= 0 and
    (wholesale_price is null or wholesale_price >= 0) and
    cost_price >= 0
  ),
  constraint product_variants_weight_check check (weight_oz is null or weight_oz >= 0),
  constraint product_variants_attributes_object_check check (jsonb_typeof(attributes) = 'object')
);

create unique index product_variants_sku_lower_uidx on public.product_variants (lower(sku));
create unique index product_variants_barcode_uidx on public.product_variants (barcode) where barcode is not null;
create unique index product_variants_one_default_uidx on public.product_variants (product_id) where is_default;
create index product_variants_product_active_idx on public.product_variants (product_id, is_active);
create index product_variants_sku_trgm_idx on public.product_variants using gin (sku gin_trgm_ops);

create table public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  media_type public.media_type not null,
  provider public.media_provider not null,
  status public.media_status not null default 'pending',
  object_key text,
  public_url text,
  stream_uid text,
  playback_url text,
  poster_url text,
  alt_text text,
  content_type text,
  bytes bigint,
  width integer,
  height integer,
  duration_seconds numeric(12,3),
  position smallint not null default 1,
  is_primary boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_media_position_check check (position between 1 and 100),
  constraint product_media_bytes_check check (bytes is null or bytes >= 0),
  constraint product_media_dimensions_check check (
    (width is null or width > 0) and (height is null or height > 0)
  ),
  constraint product_media_provider_reference_check check (
    (provider = 'r2' and object_key is not null) or
    (provider = 'stream' and stream_uid is not null) or
    (provider = 'external' and public_url is not null)
  )
);

create index product_media_product_order_idx on public.product_media (product_id, media_type, position);
create unique index product_media_image_position_uidx
  on public.product_media (product_id, position)
  where media_type = 'image';
create unique index product_media_one_video_uidx
  on public.product_media (product_id)
  where media_type = 'video';
create unique index product_media_one_primary_image_uidx
  on public.product_media (product_id)
  where media_type = 'image' and is_primary;
create unique index product_media_provider_object_uidx
  on public.product_media (provider, object_key)
  where object_key is not null;
create unique index product_media_stream_uid_uidx
  on public.product_media (stream_uid)
  where stream_uid is not null;

create table public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true,
  address jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_balances (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  location_id uuid not null references public.inventory_locations(id) on delete restrict,
  quantity_on_hand numeric(14,3) not null default 0,
  quantity_reserved numeric(14,3) not null default 0,
  reorder_point numeric(14,3) not null default 0,
  last_counted_at timestamptz,
  updated_at timestamptz not null default now(),
  available_quantity numeric(14,3) generated always as (quantity_on_hand - quantity_reserved) stored,
  constraint inventory_balances_quantity_check check (
    quantity_on_hand >= 0 and quantity_reserved >= 0 and reorder_point >= 0 and
    quantity_reserved <= quantity_on_hand
  ),
  unique (variant_id, location_id)
);

create index inventory_balances_location_idx on public.inventory_balances (location_id, variant_id);
create index inventory_balances_low_stock_idx on public.inventory_balances (available_quantity, reorder_point);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  location_id uuid not null references public.inventory_locations(id) on delete restrict,
  movement_type public.inventory_movement_type not null,
  quantity_change numeric(14,3) not null default 0,
  quantity_reserved_change numeric(14,3) not null default 0,
  unit_cost numeric(14,4),
  source_type text,
  source_id uuid,
  reference text,
  reason text,
  reversal_of uuid references public.inventory_movements(id) on delete restrict,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint inventory_movements_nonzero_check check (
    quantity_change <> 0 or quantity_reserved_change <> 0
  ),
  constraint inventory_movements_cost_check check (unit_cost is null or unit_cost >= 0)
);

create index inventory_movements_variant_date_idx on public.inventory_movements (variant_id, created_at desc);
create index inventory_movements_location_date_idx on public.inventory_movements (location_id, created_at desc);
create index inventory_movements_source_idx on public.inventory_movements (source_type, source_id);
create unique index inventory_movements_one_reversal_uidx
  on public.inventory_movements (reversal_of)
  where reversal_of is not null;

create table public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique,
  customer_id uuid references public.customers(id) on delete restrict,
  channel public.sales_channel not null default 'web',
  status public.sales_order_status not null default 'draft',
  currency char(3) not null default 'USD',
  subtotal numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  shipping_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  tax_exempt_snapshot boolean not null default false,
  tax_exempt_reason_snapshot text,
  billing_address_snapshot jsonb,
  shipping_address_snapshot jsonb,
  notes text,
  placed_at timestamptz,
  fulfilled_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_orders_amounts_check check (
    subtotal >= 0 and discount_amount >= 0 and tax_amount >= 0 and
    shipping_amount >= 0 and total_amount >= 0
  )
);

create index sales_orders_customer_date_idx on public.sales_orders (customer_id, created_at desc);
create index sales_orders_status_date_idx on public.sales_orders (status, created_at desc);

create table public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sales_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name_snapshot text not null,
  variant_name_snapshot text,
  sku_snapshot text not null,
  quantity numeric(14,3) not null,
  unit_price numeric(14,2) not null,
  unit_cost_snapshot numeric(14,4) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  tax_rate_snapshot numeric(9,6) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  line_subtotal numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
  line_total numeric(14,2) generated always as (round(quantity * unit_price, 2) - discount_amount + tax_amount) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_order_items_quantity_check check (quantity > 0),
  constraint sales_order_items_amounts_check check (
    unit_price >= 0 and unit_cost_snapshot >= 0 and discount_amount >= 0 and
    discount_amount <= round(quantity * unit_price, 2) and
    tax_rate_snapshot between 0 and 1 and tax_amount >= 0
  )
);

create index sales_order_items_order_idx on public.sales_order_items (order_id);
create index sales_order_items_variant_idx on public.sales_order_items (variant_id);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique,
  order_id uuid references public.sales_orders(id) on delete set null,
  customer_id uuid references public.customers(id) on delete restrict,
  status public.invoice_status not null default 'draft',
  currency char(3) not null default 'USD',
  issue_date date not null default current_date,
  due_date date,
  subtotal numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  shipping_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0,
  balance_due numeric(14,2) generated always as (greatest(total_amount - amount_paid, 0)) stored,
  tax_exempt_snapshot boolean not null default false,
  tax_exempt_reason_snapshot text,
  tax_exempt_certificate_snapshot text,
  billing_address_snapshot jsonb,
  notes text,
  pdf_object_key text,
  issued_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_dates_check check (due_date is null or due_date >= issue_date),
  constraint invoices_amounts_check check (
    subtotal >= 0 and discount_amount >= 0 and tax_amount >= 0 and
    shipping_amount >= 0 and total_amount >= 0 and amount_paid >= 0
  )
);

create index invoices_customer_issue_idx on public.invoices (customer_id, issue_date desc);
create index invoices_status_due_idx on public.invoices (status, due_date);
create index invoices_order_idx on public.invoices (order_id);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name_snapshot text not null,
  variant_name_snapshot text,
  sku_snapshot text not null,
  quantity numeric(14,3) not null,
  unit_price numeric(14,2) not null,
  unit_cost_snapshot numeric(14,4) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  tax_rate_snapshot numeric(9,6) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  line_subtotal numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
  line_total numeric(14,2) generated always as (round(quantity * unit_price, 2) - discount_amount + tax_amount) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_items_quantity_check check (quantity > 0),
  constraint invoice_items_amounts_check check (
    unit_price >= 0 and unit_cost_snapshot >= 0 and discount_amount >= 0 and
    discount_amount <= round(quantity * unit_price, 2) and
    tax_rate_snapshot between 0 and 1 and tax_amount >= 0
  )
);

create index invoice_items_invoice_idx on public.invoice_items (invoice_id);
create index invoice_items_variant_idx on public.invoice_items (variant_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  payment_kind public.payment_kind not null default 'payment',
  status public.payment_status not null default 'pending',
  amount numeric(14,2) not null,
  currency char(3) not null default 'USD',
  payment_method text not null,
  provider text,
  provider_payment_id text,
  reference text,
  received_at timestamptz,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_amount_check check (amount > 0)
);

create index payments_invoice_status_idx on public.payments (invoice_id, status);
create index payments_received_idx on public.payments (received_at desc) where status = 'succeeded';
create unique index payments_provider_id_uidx
  on public.payments (provider, provider_payment_id)
  where provider is not null and provider_payment_id is not null;

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_category_id uuid not null references public.expense_categories(id) on delete restrict,
  expense_date date not null default current_date,
  vendor_name text,
  description text not null,
  amount numeric(14,2) not null,
  tax_amount numeric(14,2) not null default 0,
  currency char(3) not null default 'USD',
  payment_method text,
  receipt_object_key text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_amount_check check (amount > 0 and tax_amount >= 0)
);

create index expenses_date_category_idx on public.expenses (expense_date desc, expense_category_id);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  import_type text not null default 'products',
  original_filename text not null,
  file_object_key text,
  file_hash text,
  idempotency_key text unique,
  status public.import_status not null default 'uploaded',
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  warning_rows integer not null default 0,
  error_rows integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  committed_at timestamptz,
  constraint import_jobs_counts_check check (
    total_rows >= 0 and valid_rows >= 0 and warning_rows >= 0 and error_rows >= 0
  )
);

create index import_jobs_created_idx on public.import_jobs (created_at desc);

create table public.import_job_rows (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references public.import_jobs(id) on delete cascade,
  row_number integer not null,
  status public.import_row_status not null,
  row_data jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  entity_id uuid,
  created_at timestamptz not null default now(),
  unique (import_job_id, row_number),
  constraint import_job_rows_number_check check (row_number > 0)
);

create index import_job_rows_job_status_idx on public.import_job_rows (import_job_id, status, row_number);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  request_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log (entity_type, entity_id, created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_user_id, created_at desc);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  description text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
