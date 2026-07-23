-- Functions, numbering, derived totals and immutable inventory ledger.

create sequence public.customer_number_seq start 1000;
create sequence public.sales_order_number_seq start 1000;
create sequence public.invoice_number_seq start 1000;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_customer_number()
returns trigger
language plpgsql
as $$
begin
  if new.customer_number is null or btrim(new.customer_number) = '' then
    new.customer_number := 'CUS-' || lpad(nextval('public.customer_number_seq')::text, 7, '0');
  end if;
  return new;
end;
$$;

create or replace function public.set_sales_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null or btrim(new.order_number) = '' then
    new.order_number := 'SO-' || to_char(current_date, 'YYYY') || '-' ||
      lpad(nextval('public.sales_order_number_seq')::text, 7, '0');
  end if;
  return new;
end;
$$;

create or replace function public.set_invoice_number()
returns trigger
language plpgsql
as $$
begin
  if new.invoice_number is null or btrim(new.invoice_number) = '' then
    new.invoice_number := 'INV-' || to_char(current_date, 'YYYY') || '-' ||
      lpad(nextval('public.invoice_number_seq')::text, 7, '0');
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_full_name text;
  v_first_name text;
  v_last_name text;
begin
  v_full_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  v_first_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'first_name', '')), '');
  v_last_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'last_name', '')), '');

  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, v_full_name)
  on conflict (id) do nothing;

  insert into public.customers (
    auth_user_id,
    customer_type,
    first_name,
    last_name,
    email
  )
  values (
    new.id,
    'retail',
    v_first_name,
    v_last_name,
    new.email
  )
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;

create or replace function public.sync_auth_user_email()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email, updated_at = now() where id = new.id;
    update public.customers set email = new.email, updated_at = now() where auth_user_id = new.id;
  end if;
  return new;
end;
$$;

create or replace function public.prevent_category_cycle()
returns trigger
language plpgsql
as $$
declare
  v_cycle_found boolean;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'A category cannot be its own parent.';
  end if;

  with recursive ancestors as (
    select c.id, c.parent_id
    from public.categories c
    where c.id = new.parent_id

    union

    select c.id, c.parent_id
    from public.categories c
    join ancestors a on c.id = a.parent_id
  )
  select exists (select 1 from ancestors where id = new.id)
    into v_cycle_found;

  if v_cycle_found then
    raise exception 'Category hierarchy cannot contain a cycle.';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_product_media_limits()
returns trigger
language plpgsql
as $$
declare
  v_image_count integer;
begin
  if new.media_type = 'image' then
    if new.position < 1 or new.position > 10 then
      raise exception 'Product image position must be between 1 and 10.';
    end if;

    select count(*)
      into v_image_count
    from public.product_media pm
    where pm.product_id = new.product_id
      and pm.media_type = 'image'
      and pm.id <> new.id;

    if v_image_count >= 10 then
      raise exception 'A product can have at most 10 images.';
    end if;
  end if;

  if new.variant_id is not null and not exists (
    select 1
    from public.product_variants pv
    where pv.id = new.variant_id
      and pv.product_id = new.product_id
  ) then
    raise exception 'Media variant must belong to the same product.';
  end if;

  return new;
end;
$$;

create or replace function public.validate_inventory_movement()
returns trigger
language plpgsql
as $$
declare
  v_original public.inventory_movements%rowtype;
begin
  case new.movement_type
    when 'opening', 'purchase', 'return_in', 'transfer_in' then
      if new.quantity_change <= 0 or new.quantity_reserved_change <> 0 then
        raise exception '% requires a positive on-hand change and zero reserved change.', new.movement_type;
      end if;
    when 'sale', 'return_out', 'waste', 'transfer_out' then
      if new.quantity_change >= 0 or new.quantity_reserved_change <> 0 then
        raise exception '% requires a negative on-hand change and zero reserved change.', new.movement_type;
      end if;
    when 'reserve' then
      if new.quantity_change <> 0 or new.quantity_reserved_change <= 0 then
        raise exception 'reserve requires zero on-hand change and a positive reserved change.';
      end if;
    when 'release' then
      if new.quantity_change <> 0 or new.quantity_reserved_change >= 0 then
        raise exception 'release requires zero on-hand change and a negative reserved change.';
      end if;
    when 'adjustment' then
      if new.quantity_change = 0 or new.quantity_reserved_change <> 0 then
        raise exception 'adjustment requires a non-zero on-hand change and zero reserved change.';
      end if;
    when 'reversal' then
      if new.reversal_of is null then
        raise exception 'reversal requires reversal_of.';
      end if;

      select * into v_original
      from public.inventory_movements
      where id = new.reversal_of;

      if not found then
        raise exception 'The original inventory movement does not exist.';
      end if;

      if v_original.movement_type = 'reversal' then
        raise exception 'A reversal movement cannot be reversed again.';
      end if;

      if new.variant_id is distinct from v_original.variant_id
        or new.location_id is distinct from v_original.location_id
        or new.quantity_change <> -v_original.quantity_change
        or new.quantity_reserved_change <> -v_original.quantity_reserved_change then
        raise exception 'A reversal must use the same SKU/location and exact opposite quantities.';
      end if;
  end case;

  if new.movement_type <> 'reversal' and new.reversal_of is not null then
    raise exception 'Only reversal movements may set reversal_of.';
  end if;

  return new;
end;
$$;

create or replace function public.apply_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_current_on_hand numeric(14,3);
  v_current_reserved numeric(14,3);
  v_new_on_hand numeric(14,3);
  v_new_reserved numeric(14,3);
  v_track_inventory boolean;
begin
  select track_inventory
    into v_track_inventory
  from public.product_variants
  where id = new.variant_id;

  if coalesce(v_track_inventory, false) = false then
    raise exception 'Inventory movement cannot be posted for a non-tracked variant.';
  end if;

  insert into public.inventory_balances (
    variant_id,
    location_id,
    quantity_on_hand,
    quantity_reserved,
    reorder_point
  )
  values (new.variant_id, new.location_id, 0, 0, 0)
  on conflict (variant_id, location_id) do nothing;

  select quantity_on_hand, quantity_reserved
    into v_current_on_hand, v_current_reserved
  from public.inventory_balances
  where variant_id = new.variant_id
    and location_id = new.location_id
  for update;

  v_new_on_hand := v_current_on_hand + new.quantity_change;
  v_new_reserved := v_current_reserved + new.quantity_reserved_change;

  if v_new_on_hand < 0 then
    raise exception 'Inventory on hand cannot become negative. Current: %, requested change: %.',
      v_current_on_hand, new.quantity_change;
  end if;

  if v_new_reserved < 0 then
    raise exception 'Reserved inventory cannot become negative. Current: %, requested change: %.',
      v_current_reserved, new.quantity_reserved_change;
  end if;

  if v_new_reserved > v_new_on_hand then
    raise exception 'Reserved inventory (%) cannot exceed on-hand inventory (%).',
      v_new_reserved, v_new_on_hand;
  end if;

  update public.inventory_balances
  set quantity_on_hand = v_new_on_hand,
      quantity_reserved = v_new_reserved,
      updated_at = now()
  where variant_id = new.variant_id
    and location_id = new.location_id;

  return new;
end;
$$;

create or replace function public.prevent_inventory_movement_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Posted inventory movements are immutable. Create a reversal movement instead.';
end;
$$;

create or replace function public.recalculate_sales_order_totals(p_order_id uuid)
returns void
language plpgsql
as $$
declare
  v_subtotal numeric(14,2);
  v_discount numeric(14,2);
  v_tax numeric(14,2);
  v_shipping numeric(14,2);
begin
  select
    coalesce(sum(line_subtotal), 0),
    coalesce(sum(discount_amount), 0),
    coalesce(sum(tax_amount), 0)
  into v_subtotal, v_discount, v_tax
  from public.sales_order_items
  where order_id = p_order_id;

  select shipping_amount
    into v_shipping
  from public.sales_orders
  where id = p_order_id;

  update public.sales_orders
  set subtotal = v_subtotal,
      discount_amount = v_discount,
      tax_amount = v_tax,
      total_amount = greatest(v_subtotal - v_discount + v_tax + coalesce(v_shipping, 0), 0),
      updated_at = now()
  where id = p_order_id;
end;
$$;

create or replace function public.sales_order_items_recalculate_trigger()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_sales_order_totals(old.order_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.order_id is distinct from new.order_id then
    perform public.recalculate_sales_order_totals(old.order_id);
  end if;

  perform public.recalculate_sales_order_totals(new.order_id);
  return new;
end;
$$;

create or replace function public.recalculate_invoice_totals(p_invoice_id uuid)
returns void
language plpgsql
as $$
declare
  v_subtotal numeric(14,2);
  v_discount numeric(14,2);
  v_tax numeric(14,2);
  v_shipping numeric(14,2);
begin
  select
    coalesce(sum(line_subtotal), 0),
    coalesce(sum(discount_amount), 0),
    coalesce(sum(tax_amount), 0)
  into v_subtotal, v_discount, v_tax
  from public.invoice_items
  where invoice_id = p_invoice_id;

  select shipping_amount
    into v_shipping
  from public.invoices
  where id = p_invoice_id;

  update public.invoices
  set subtotal = v_subtotal,
      discount_amount = v_discount,
      tax_amount = v_tax,
      total_amount = greatest(v_subtotal - v_discount + v_tax + coalesce(v_shipping, 0), 0),
      updated_at = now()
  where id = p_invoice_id;
end;
$$;

create or replace function public.invoice_items_recalculate_trigger()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_invoice_totals(old.invoice_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.invoice_id is distinct from new.invoice_id then
    perform public.recalculate_invoice_totals(old.invoice_id);
  end if;

  perform public.recalculate_invoice_totals(new.invoice_id);
  return new;
end;
$$;

create or replace function public.recalculate_invoice_payment_state(p_invoice_id uuid)
returns void
language plpgsql
as $$
declare
  v_net_received numeric(14,2);
  v_total numeric(14,2);
  v_status public.invoice_status;
begin
  select coalesce(sum(
    case
      when payment_kind = 'payment' then amount
      when payment_kind = 'refund' then -amount
      else 0
    end
  ), 0)
  into v_net_received
  from public.payments
  where invoice_id = p_invoice_id
    and status = 'succeeded';

  select total_amount, status
    into v_total, v_status
  from public.invoices
  where id = p_invoice_id
  for update;

  update public.invoices
  set amount_paid = greatest(v_net_received, 0),
      status = case
        when v_status = 'void' then 'void'::public.invoice_status
        when v_total > 0 and v_net_received >= v_total then 'paid'::public.invoice_status
        when v_net_received > 0 then 'partially_paid'::public.invoice_status
        when v_status in ('paid', 'partially_paid') then 'issued'::public.invoice_status
        else v_status
      end,
      updated_at = now()
  where id = p_invoice_id;
end;
$$;

create or replace function public.payments_recalculate_trigger()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_invoice_payment_state(old.invoice_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.invoice_id is distinct from new.invoice_id then
    perform public.recalculate_invoice_payment_state(old.invoice_id);
  end if;

  perform public.recalculate_invoice_payment_state(new.invoice_id);
  return new;
end;
$$;


create or replace function public.sync_sales_order_total_amount()
returns trigger
language plpgsql
as $$
begin
  new.total_amount := greatest(
    new.subtotal - new.discount_amount + new.tax_amount + new.shipping_amount,
    0
  );
  return new;
end;
$$;

create or replace function public.sync_invoice_total_amount()
returns trigger
language plpgsql
as $$
begin
  new.total_amount := greatest(
    new.subtotal - new.discount_amount + new.tax_amount + new.shipping_amount,
    0
  );
  return new;
end;
$$;

create or replace function public.invoice_total_recalculate_payment_trigger()
returns trigger
language plpgsql
as $$
begin
  perform public.recalculate_invoice_payment_state(new.id);
  return new;
end;
$$;

create or replace function public.ensure_invoice_order_consistency()
returns trigger
language plpgsql
as $$
declare
  v_order_customer_id uuid;
  v_order_currency char(3);
begin
  if new.order_id is null then
    return new;
  end if;

  select customer_id, currency
    into v_order_customer_id, v_order_currency
  from public.sales_orders
  where id = new.order_id;

  if not found then
    raise exception 'The referenced sales order does not exist.';
  end if;

  if v_order_customer_id is not null then
    if new.customer_id is null then
      new.customer_id := v_order_customer_id;
    elsif new.customer_id is distinct from v_order_customer_id then
      raise exception 'Invoice customer must match the referenced sales order.';
    end if;
  end if;

  if new.currency is distinct from v_order_currency then
    raise exception 'Invoice currency must match the referenced sales order.';
  end if;

  return new;
end;
$$;

create or replace function public.ensure_payment_currency_matches_invoice()
returns trigger
language plpgsql
as $$
declare
  v_invoice_currency char(3);
begin
  select currency into v_invoice_currency
  from public.invoices
  where id = new.invoice_id;

  if not found then
    raise exception 'The referenced invoice does not exist.';
  end if;

  if new.currency is distinct from v_invoice_currency then
    raise exception 'Payment currency must match the invoice currency.';
  end if;

  return new;
end;
$$;

create or replace function public.ensure_tax_exempt_audit_fields()
returns trigger
language plpgsql
as $$
declare
  v_status_changed boolean;
begin
  if tg_op = 'INSERT' then
    v_status_changed := true;
  else
    v_status_changed := old.tax_exempt_status is distinct from new.tax_exempt_status;
  end if;

  if new.tax_exempt_status in ('approved', 'rejected', 'expired')
    and new.tax_exempt_verified_by is null then
    raise exception 'A reviewed tax-exempt status requires a verifier.';
  end if;

  if v_status_changed and new.tax_exempt_status in ('approved', 'rejected', 'expired') then
    new.tax_exempt_verified_at := coalesce(new.tax_exempt_verified_at, now());
  elsif new.tax_exempt_status in ('not_requested', 'pending') then
    new.tax_exempt_verified_by := null;
    new.tax_exempt_verified_at := null;
  end if;

  return new;
end;
$$;

-- Auth lifecycle triggers.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_auth_user_email();

-- Numbering triggers.
create trigger customers_set_number
  before insert on public.customers
  for each row execute function public.set_customer_number();

create trigger sales_orders_set_number
  before insert on public.sales_orders
  for each row execute function public.set_sales_order_number();

create trigger invoices_set_number
  before insert on public.invoices
  for each row execute function public.set_invoice_number();

-- Category hierarchy integrity.
create trigger categories_prevent_cycle
  before insert or update of parent_id on public.categories
  for each row execute function public.prevent_category_cycle();

-- Media constraints.
create trigger product_media_enforce_limits
  before insert or update of product_id, variant_id, media_type, position
  on public.product_media
  for each row execute function public.enforce_product_media_limits();

-- Inventory ledger triggers.
create trigger inventory_movements_validate
  before insert on public.inventory_movements
  for each row execute function public.validate_inventory_movement();

create trigger inventory_movements_apply
  after insert on public.inventory_movements
  for each row execute function public.apply_inventory_movement();

create trigger inventory_movements_immutable_update
  before update on public.inventory_movements
  for each row execute function public.prevent_inventory_movement_mutation();

create trigger inventory_movements_immutable_delete
  before delete on public.inventory_movements
  for each row execute function public.prevent_inventory_movement_mutation();

-- Header total formulas. Line-item triggers own subtotal/discount/tax; header updates capture shipping changes.
create trigger sales_orders_sync_total_amount
  before insert or update of subtotal, discount_amount, tax_amount, shipping_amount
  on public.sales_orders
  for each row execute function public.sync_sales_order_total_amount();

create trigger invoices_sync_total_amount
  before insert or update of subtotal, discount_amount, tax_amount, shipping_amount
  on public.invoices
  for each row execute function public.sync_invoice_total_amount();

create trigger invoices_recalculate_payment_after_total_update
  after update of total_amount on public.invoices
  for each row
  when (old.total_amount is distinct from new.total_amount)
  execute function public.invoice_total_recalculate_payment_trigger();

-- Sales totals.
create trigger sales_order_items_recalculate_after_insert
  after insert on public.sales_order_items
  for each row execute function public.sales_order_items_recalculate_trigger();
create trigger sales_order_items_recalculate_after_update
  after update on public.sales_order_items
  for each row execute function public.sales_order_items_recalculate_trigger();
create trigger sales_order_items_recalculate_after_delete
  after delete on public.sales_order_items
  for each row execute function public.sales_order_items_recalculate_trigger();

create trigger invoice_items_recalculate_after_insert
  after insert on public.invoice_items
  for each row execute function public.invoice_items_recalculate_trigger();
create trigger invoice_items_recalculate_after_update
  after update on public.invoice_items
  for each row execute function public.invoice_items_recalculate_trigger();
create trigger invoice_items_recalculate_after_delete
  after delete on public.invoice_items
  for each row execute function public.invoice_items_recalculate_trigger();

create trigger invoices_validate_order_consistency
  before insert or update of order_id, customer_id, currency on public.invoices
  for each row execute function public.ensure_invoice_order_consistency();

create trigger payments_validate_currency
  before insert or update of invoice_id, currency on public.payments
  for each row execute function public.ensure_payment_currency_matches_invoice();

create trigger payments_recalculate_after_insert
  after insert on public.payments
  for each row execute function public.payments_recalculate_trigger();
create trigger payments_recalculate_after_update
  after update on public.payments
  for each row execute function public.payments_recalculate_trigger();
create trigger payments_recalculate_after_delete
  after delete on public.payments
  for each row execute function public.payments_recalculate_trigger();

create trigger customers_tax_exempt_audit_fields
  before insert or update of tax_exempt_status, tax_exempt_verified_by on public.customers
  for each row execute function public.ensure_tax_exempt_audit_fields();

-- updated_at triggers.
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
create trigger customer_addresses_updated_at before update on public.customer_addresses
  for each row execute function public.set_updated_at();
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger product_variants_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();
create trigger product_media_updated_at before update on public.product_media
  for each row execute function public.set_updated_at();
create trigger inventory_locations_updated_at before update on public.inventory_locations
  for each row execute function public.set_updated_at();
create trigger inventory_balances_updated_at before update on public.inventory_balances
  for each row execute function public.set_updated_at();
create trigger sales_orders_updated_at before update on public.sales_orders
  for each row execute function public.set_updated_at();
create trigger sales_order_items_updated_at before update on public.sales_order_items
  for each row execute function public.set_updated_at();
create trigger invoices_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();
create trigger invoice_items_updated_at before update on public.invoice_items
  for each row execute function public.set_updated_at();
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();
create trigger expense_categories_updated_at before update on public.expense_categories
  for each row execute function public.set_updated_at();
create trigger expenses_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();
create trigger import_jobs_updated_at before update on public.import_jobs
  for each row execute function public.set_updated_at();
create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();
