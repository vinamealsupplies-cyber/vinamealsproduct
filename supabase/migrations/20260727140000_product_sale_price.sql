-- Sale price on product_variants (optional). When set and below retail_price,
-- storefront shows retail struck-through and charges the sale price.

alter table public.product_variants
  add column if not exists sale_price numeric(14,2);

comment on column public.product_variants.sale_price is
  'Optional promotional retail price. When set and lower than retail_price, customers pay this amount.';

-- Drop old check and re-add with sale_price rules.
alter table public.product_variants drop constraint if exists product_variants_price_check;

alter table public.product_variants
  add constraint product_variants_price_check check (
    retail_price >= 0
    and (wholesale_price is null or wholesale_price >= 0)
    and cost_price >= 0
    and (sale_price is null or (sale_price >= 0 and sale_price < retail_price))
  );

-- Public catalog may see sale_price (not cost/wholesale).
grant select (
  id, product_id, variant_name, sku, barcode, attributes, retail_price, sale_price, currency, taxable,
  track_inventory, allow_backorder, unit, weight_oz, is_default, is_active, created_at, updated_at
) on public.product_variants to anon, authenticated;
