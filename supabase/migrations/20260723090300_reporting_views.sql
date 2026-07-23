-- Reporting and catalog views.
-- Public/account views are curated owner-rights projections with explicit caller filters.
-- Management views are owner-rights projections gated by private.can_view_staff_data()/can_view_manager_data().
-- This prevents customer accounts from receiving internal cost or company-wide reporting data.

create or replace view public.v_product_listing
with (security_barrier = true)
as
select
  p.id as product_id,
  p.product_handle,
  p.name,
  p.slug,
  p.short_description,
  p.featured,
  p.published_at,
  price.min_retail_price,
  price.max_retail_price,
  stock.available_quantity,
  media.primary_image_url,
  media.primary_image_alt,
  cat.primary_category_id,
  cat.primary_category_name,
  cat.primary_category_slug
from public.products p
left join lateral (
  select
    min(pv.retail_price) filter (where pv.is_active) as min_retail_price,
    max(pv.retail_price) filter (where pv.is_active) as max_retail_price
  from public.product_variants pv
  where pv.product_id = p.id
) price on true
left join lateral (
  select coalesce(sum(ib.available_quantity) filter (where il.id is not null), 0)::numeric(14,3) as available_quantity
  from public.product_variants pv
  left join public.inventory_balances ib on ib.variant_id = pv.id
  left join public.inventory_locations il on il.id = ib.location_id and il.is_active
  where pv.product_id = p.id
    and pv.is_active
) stock on true
left join lateral (
  select
    coalesce(pm.public_url, pm.playback_url) as primary_image_url,
    pm.alt_text as primary_image_alt
  from public.product_media pm
  where pm.product_id = p.id
    and pm.media_type = 'image'
    and pm.status = 'ready'
  order by pm.is_primary desc, pm.position asc, pm.created_at asc
  limit 1
) media on true
left join lateral (
  select
    c.id as primary_category_id,
    c.name as primary_category_name,
    c.slug as primary_category_slug
  from public.product_categories pc
  join public.categories c on c.id = pc.category_id
  where pc.product_id = p.id
    and c.is_active
  order by pc.is_primary desc, c.sort_order asc, c.name asc
  limit 1
) cat on true
where p.status = 'active';

-- Wholesale pricing is separate from tax exemption. A customer receives this projection only
-- after staff has assigned customer_type = wholesale; tax-exempt eligibility is evaluated later.
create or replace view public.v_account_price_list
with (security_barrier = true)
as
select
  p.id as product_id,
  p.name as product_name,
  p.slug as product_slug,
  pv.id as variant_id,
  pv.variant_name,
  pv.sku,
  pv.retail_price,
  coalesce(pv.wholesale_price, pv.retail_price) as account_price,
  pv.currency,
  pv.unit,
  pv.is_default
from public.products p
join public.product_variants pv on pv.product_id = p.id
where p.status = 'active'
  and pv.is_active
  and exists (
    select 1
    from public.customers c
    where c.auth_user_id = (select auth.uid())
      and c.customer_type = 'wholesale'
      and c.status = 'active'
  );

create or replace view public.v_inventory_detail
with (security_barrier = true)
as
select
  p.id as product_id,
  p.name as product_name,
  p.status as product_status,
  pv.id as variant_id,
  pv.variant_name,
  pv.sku,
  pv.barcode,
  pv.unit,
  pv.cost_price,
  pv.retail_price,
  pv.wholesale_price,
  il.id as location_id,
  il.code as location_code,
  il.name as location_name,
  ib.quantity_on_hand,
  ib.quantity_reserved,
  ib.available_quantity,
  ib.reorder_point,
  round(ib.quantity_on_hand * pv.cost_price, 2) as inventory_value,
  case
    when ib.available_quantity <= 0 then 'out_of_stock'
    when ib.available_quantity <= ib.reorder_point then 'low_stock'
    else 'in_stock'
  end as stock_status,
  cat.primary_category_id,
  cat.primary_category_name,
  ib.last_counted_at,
  ib.updated_at
from public.inventory_balances ib
join public.product_variants pv on pv.id = ib.variant_id
join public.products p on p.id = pv.product_id
join public.inventory_locations il on il.id = ib.location_id
left join lateral (
  select c.id as primary_category_id, c.name as primary_category_name
  from public.product_categories pc
  join public.categories c on c.id = pc.category_id
  where pc.product_id = p.id
  order by pc.is_primary desc, c.sort_order asc, c.name asc
  limit 1
) cat on true
where (select private.can_view_staff_data());

create or replace view public.v_inventory_by_category
with (security_barrier = true)
as
select
  coalesce(primary_category_id::text, 'uncategorized') as category_key,
  coalesce(primary_category_name, 'Uncategorized') as category_name,
  count(distinct variant_id) as sku_count,
  sum(quantity_on_hand)::numeric(18,3) as quantity_on_hand,
  sum(quantity_reserved)::numeric(18,3) as quantity_reserved,
  sum(available_quantity)::numeric(18,3) as available_quantity,
  sum(inventory_value)::numeric(18,2) as inventory_value,
  count(*) filter (where stock_status = 'low_stock') as low_stock_sku_count,
  count(*) filter (where stock_status = 'out_of_stock') as out_of_stock_sku_count
from public.v_inventory_detail
where (select private.can_view_staff_data())
group by primary_category_id, primary_category_name;

create or replace view public.v_monthly_business_performance
with (security_barrier = true)
as
with invoice_cogs as (
  select
    ii.invoice_id,
    coalesce(sum(ii.quantity * ii.unit_cost_snapshot), 0)::numeric(18,2) as cogs,
    coalesce(sum(ii.quantity), 0)::numeric(18,3) as units_sold
  from public.invoice_items ii
  group by ii.invoice_id
),
invoice_monthly as (
  select
    date_trunc('month', i.issue_date::timestamp)::date as month_start,
    sum(i.subtotal)::numeric(18,2) as gross_merchandise_sales,
    sum(i.discount_amount)::numeric(18,2) as discounts,
    sum(i.subtotal - i.discount_amount)::numeric(18,2) as net_sales,
    sum(i.shipping_amount)::numeric(18,2) as shipping_revenue,
    sum(i.tax_amount)::numeric(18,2) as tax_collected,
    sum(i.total_amount)::numeric(18,2) as amount_invoiced,
    sum(i.balance_due)::numeric(18,2) as current_balance_due,
    sum(coalesce(ic.cogs, 0))::numeric(18,2) as cogs,
    sum(coalesce(ic.units_sold, 0))::numeric(18,3) as units_sold,
    count(*) as invoice_count
  from public.invoices i
  left join invoice_cogs ic on ic.invoice_id = i.id
  where i.status in ('issued', 'partially_paid', 'paid', 'overdue')
  group by date_trunc('month', i.issue_date::timestamp)::date
),
payment_monthly as (
  select
    date_trunc('month', p.received_at)::date as month_start,
    sum(
      case
        when p.payment_kind = 'payment' then p.amount
        when p.payment_kind = 'refund' then -p.amount
        else 0
      end
    )::numeric(18,2) as amount_received
  from public.payments p
  where p.status = 'succeeded'
    and p.received_at is not null
  group by date_trunc('month', p.received_at)::date
),
expense_monthly as (
  select
    date_trunc('month', e.expense_date::timestamp)::date as month_start,
    sum(e.amount + e.tax_amount)::numeric(18,2) as operating_expenses
  from public.expenses e
  group by date_trunc('month', e.expense_date::timestamp)::date
),
months as (
  select month_start from invoice_monthly
  union
  select month_start from payment_monthly
  union
  select month_start from expense_monthly
)
select
  m.month_start,
  coalesce(i.invoice_count, 0) as invoice_count,
  coalesce(i.units_sold, 0)::numeric(18,3) as units_sold,
  coalesce(i.gross_merchandise_sales, 0)::numeric(18,2) as gross_merchandise_sales,
  coalesce(i.discounts, 0)::numeric(18,2) as discounts,
  coalesce(i.net_sales, 0)::numeric(18,2) as net_sales,
  coalesce(i.shipping_revenue, 0)::numeric(18,2) as shipping_revenue,
  coalesce(i.tax_collected, 0)::numeric(18,2) as tax_collected,
  coalesce(i.amount_invoiced, 0)::numeric(18,2) as amount_invoiced,
  coalesce(p.amount_received, 0)::numeric(18,2) as amount_received,
  coalesce(i.current_balance_due, 0)::numeric(18,2) as current_balance_due,
  coalesce(i.cogs, 0)::numeric(18,2) as cogs,
  (coalesce(i.net_sales, 0) - coalesce(i.cogs, 0))::numeric(18,2) as gross_profit,
  coalesce(e.operating_expenses, 0)::numeric(18,2) as operating_expenses,
  (
    coalesce(i.net_sales, 0) + coalesce(i.shipping_revenue, 0)
      - coalesce(i.cogs, 0) - coalesce(e.operating_expenses, 0)
  )::numeric(18,2) as operating_profit
from months m
left join invoice_monthly i using (month_start)
left join payment_monthly p using (month_start)
left join expense_monthly e using (month_start)
where (select private.can_view_manager_data());

create or replace view public.v_yearly_business_performance
with (security_barrier = true)
as
select
  date_trunc('year', month_start::timestamp)::date as year_start,
  sum(invoice_count)::bigint as invoice_count,
  sum(units_sold)::numeric(18,3) as units_sold,
  sum(gross_merchandise_sales)::numeric(18,2) as gross_merchandise_sales,
  sum(discounts)::numeric(18,2) as discounts,
  sum(net_sales)::numeric(18,2) as net_sales,
  sum(shipping_revenue)::numeric(18,2) as shipping_revenue,
  sum(tax_collected)::numeric(18,2) as tax_collected,
  sum(amount_invoiced)::numeric(18,2) as amount_invoiced,
  sum(amount_received)::numeric(18,2) as amount_received,
  sum(current_balance_due)::numeric(18,2) as current_balance_due,
  sum(cogs)::numeric(18,2) as cogs,
  sum(gross_profit)::numeric(18,2) as gross_profit,
  sum(operating_expenses)::numeric(18,2) as operating_expenses,
  sum(operating_profit)::numeric(18,2) as operating_profit
from public.v_monthly_business_performance
where (select private.can_view_manager_data())
group by date_trunc('year', month_start::timestamp)::date;

create or replace view public.v_sales_by_product_month
with (security_barrier = true)
as
select
  date_trunc('month', i.issue_date::timestamp)::date as month_start,
  ii.product_id,
  ii.variant_id,
  ii.product_name_snapshot,
  ii.variant_name_snapshot,
  ii.sku_snapshot,
  sum(ii.quantity)::numeric(18,3) as units_sold,
  sum(ii.line_subtotal - ii.discount_amount)::numeric(18,2) as net_product_sales,
  sum(ii.quantity * ii.unit_cost_snapshot)::numeric(18,2) as cogs,
  sum((ii.line_subtotal - ii.discount_amount) - (ii.quantity * ii.unit_cost_snapshot))::numeric(18,2) as gross_profit
from public.invoice_items ii
join public.invoices i on i.id = ii.invoice_id
where i.status in ('issued', 'partially_paid', 'paid', 'overdue')
  and (select private.can_view_manager_data())
group by
  date_trunc('month', i.issue_date::timestamp)::date,
  ii.product_id,
  ii.variant_id,
  ii.product_name_snapshot,
  ii.variant_name_snapshot,
  ii.sku_snapshot;

create or replace view public.v_customer_sales_summary
with (security_barrier = true)
as
with invoice_summary as (
  select
    i.customer_id,
    count(*) filter (where i.status in ('issued', 'partially_paid', 'paid', 'overdue')) as invoice_count,
    sum(i.subtotal - i.discount_amount)
      filter (where i.status in ('issued', 'partially_paid', 'paid', 'overdue')) as net_sales,
    sum(i.balance_due)
      filter (where i.status in ('issued', 'partially_paid', 'paid', 'overdue')) as balance_due,
    max(i.issue_date)
      filter (where i.status in ('issued', 'partially_paid', 'paid', 'overdue')) as last_invoice_date
  from public.invoices i
  group by i.customer_id
),
payment_summary as (
  select
    i.customer_id,
    sum(
      case
        when p.payment_kind = 'payment' then p.amount
        when p.payment_kind = 'refund' then -p.amount
        else 0
      end
    ) filter (where p.status = 'succeeded') as amount_received
  from public.invoices i
  join public.payments p on p.invoice_id = i.id
  group by i.customer_id
)
select
  c.id as customer_id,
  c.customer_number,
  c.customer_type,
  c.status,
  c.first_name,
  c.last_name,
  c.company_name,
  c.email,
  c.phone,
  c.tax_exempt_status,
  coalesce(i.invoice_count, 0) as invoice_count,
  coalesce(i.net_sales, 0)::numeric(18,2) as net_sales,
  coalesce(p.amount_received, 0)::numeric(18,2) as amount_received,
  coalesce(i.balance_due, 0)::numeric(18,2) as balance_due,
  i.last_invoice_date
from public.customers c
left join invoice_summary i on i.customer_id = c.id
left join payment_summary p on p.customer_id = c.id
where (select private.can_view_staff_data());

revoke all on public.v_product_listing, public.v_account_price_list,
  public.v_inventory_detail, public.v_inventory_by_category,
  public.v_monthly_business_performance, public.v_yearly_business_performance,
  public.v_sales_by_product_month, public.v_customer_sales_summary from public;

grant select on public.v_product_listing to anon, authenticated, service_role;
grant select on public.v_account_price_list to authenticated, service_role;
grant select on public.v_inventory_detail, public.v_inventory_by_category,
  public.v_monthly_business_performance, public.v_yearly_business_performance,
  public.v_sales_by_product_month, public.v_customer_sales_summary to authenticated, service_role;
