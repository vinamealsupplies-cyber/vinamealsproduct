-- Hard-delete product: purge inventory movements + balances, then product.
--
-- inventory_movements.variant_id is ON DELETE RESTRICT and rows are normally
-- immutable (prevent_inventory_movement_mutation). Delete-forever must:
--   1) allow a one-shot purge flag for service_role admin RPC only
--   2) clear reversal_of self-FKs, delete movements + balances
--   3) delete the product (cascades variants, media, category links)

create or replace function public.prevent_inventory_movement_mutation()
returns trigger
language plpgsql
as $$
begin
  -- Cho phép purge có kiểm soát khi admin xoá vĩnh viễn sản phẩm (transaction-local).
  if current_setting('vinameals.allow_inventory_purge', true) = 'on' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  raise exception 'Posted inventory movements are immutable. Create a reversal movement instead.';
end;
$$;

create or replace function public.admin_delete_product_forever(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_status text;
  v_variant_ids uuid[];
begin
  if not private.is_service_role() then
    raise exception 'This operation requires the service role.';
  end if;

  if p_product_id is null then
    raise exception 'Missing product id.';
  end if;

  select p.status
    into v_status
  from public.products p
  where p.id = p_product_id
  for update;

  if not found then
    raise exception 'Product not found.';
  end if;

  if v_status is distinct from 'archived' then
    raise exception 'Archive the product first, then delete it forever.';
  end if;

  select coalesce(array_agg(pv.id), array[]::uuid[])
    into v_variant_ids
  from public.product_variants pv
  where pv.product_id = p_product_id;

  -- Transaction-local: only this RPC can mutate/delete movement rows.
  perform set_config('vinameals.allow_inventory_purge', 'on', true);

  if cardinality(v_variant_ids) > 0 then
    -- Self-FK reversal_of is ON DELETE RESTRICT — clear links first.
    update public.inventory_movements
    set reversal_of = null
    where variant_id = any (v_variant_ids)
      and reversal_of is not null;

    delete from public.inventory_movements
    where variant_id = any (v_variant_ids);

    delete from public.inventory_balances
    where variant_id = any (v_variant_ids);
  end if;

  -- Cascades: product_variants, product_media, product_categories.
  -- sales_order_items / invoice_items keep snapshots (product_id/variant_id set null).
  delete from public.products
  where id = p_product_id;
end;
$$;

revoke all on function public.admin_delete_product_forever(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_product_forever(uuid) to service_role;

comment on function public.admin_delete_product_forever(uuid) is
  'Service-role only. Permanently deletes an archived product and its inventory movements/balances.';
