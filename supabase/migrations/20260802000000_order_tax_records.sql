-- Per-order sales tax snapshot for CDTFA (California) filing and reporting.
-- One immutable row per sales order, written at checkout. payment_status /
-- refund_amount / net_taxable_sales are derived at report time (join invoices +
-- payments) so refunds stay current — they are NOT stored here.

create table if not exists public.order_tax_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.sales_orders(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,

  -- Order
  order_number text,
  order_date date,
  placed_at timestamptz,
  fulfillment_method text,

  -- Customer / ship-to (tax situs)
  country_code text,
  state_code text,
  county text,
  city text,
  zip text,
  shipping_address text,

  -- Tax basis
  gross_sales numeric(12,2) not null default 0,
  taxable_subtotal numeric(12,2) not null default 0,
  shipping_amount numeric(12,2) not null default 0,
  shipping_taxable_amount numeric(12,2) not null default 0,
  tax_exempt_amount numeric(12,2) not null default 0,
  total_taxable_amount numeric(12,2) not null default 0,

  -- Tax
  sales_tax_collected numeric(12,2) not null default 0,
  tax_rate numeric(6,5) not null default 0,
  state_tax numeric(12,2) not null default 0,
  district_tax numeric(12,2) not null default 0,
  tax_jurisdiction_code text,
  jurisdiction_id uuid references public.tax_jurisdictions(id) on delete set null,
  jurisdiction_label text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists order_tax_records_geo_idx
  on public.order_tax_records (state_code, county, city, zip);
create index if not exists order_tax_records_date_idx
  on public.order_tax_records (order_date);
create index if not exists order_tax_records_rate_idx
  on public.order_tax_records (tax_rate);

alter table public.order_tax_records enable row level security;

-- Staff/admin read. Inserts/updates run through the service_role (admin client),
-- which bypasses RLS, so no write policy is granted to authenticated users.
drop policy if exists order_tax_records_staff_read on public.order_tax_records;
create policy order_tax_records_staff_read on public.order_tax_records
  for select to authenticated
  using ((select private.is_staff()));

grant select on public.order_tax_records to authenticated;
grant all on public.order_tax_records to service_role;

-- Backfill existing orders as historical gross sales with $0 tax (fully exempt),
-- so CDTFA gross-sales totals are complete. Address from the order snapshots.
insert into public.order_tax_records (
  order_id, invoice_id, customer_id, order_number, order_date, placed_at, fulfillment_method,
  country_code, state_code, county, city, zip, shipping_address,
  gross_sales, taxable_subtotal, shipping_amount, shipping_taxable_amount,
  tax_exempt_amount, total_taxable_amount, sales_tax_collected, tax_rate,
  state_tax, district_tax, jurisdiction_label
)
select
  o.id,
  (select inv.id from public.invoices inv where inv.order_id = o.id order by inv.created_at limit 1),
  o.customer_id,
  o.order_number,
  (o.placed_at)::date,
  o.placed_at,
  o.fulfillment_method::text,
  coalesce(a.addr->>'country_code', 'US'),
  upper(coalesce(a.addr->>'state_region', '')),
  nullif(a.addr->>'county', ''),
  coalesce(a.addr->>'city', ''),
  coalesce(a.addr->>'postal_code', ''),
  nullif(concat_ws(', ', a.addr->>'line1', a.addr->>'line2', a.addr->>'city',
                   a.addr->>'state_region', a.addr->>'postal_code'), ''),
  coalesce(o.subtotal, 0),
  0,
  coalesce(o.shipping_amount, 0),
  0,
  coalesce(o.subtotal, 0),
  0,
  coalesce(o.tax_amount, 0),
  0,
  0,
  0,
  null
from public.sales_orders o
cross join lateral (
  select coalesce(o.shipping_address_snapshot, o.billing_address_snapshot) as addr
) a
on conflict (order_id) do nothing;

notify pgrst, 'reload schema';
