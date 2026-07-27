-- Archived products always report as out_of_stock in inventory views,
-- even if quantity_on_hand > 0 (they are not sellable on the storefront).

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
    -- Hàng archive không bán → inventory hiện Out of stock.
    when p.status = 'archived' then 'out_of_stock'
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

grant select on public.v_inventory_detail to authenticated, service_role;
