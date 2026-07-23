-- Pickup hoặc Ship — áp dụng cho CẢ khách lẻ (retail) và khách sỉ (wholesale).
-- Không ràng buộc theo customer_type: mọi đơn đều chọn được một trong hai.

create type public.fulfillment_method as enum ('pickup', 'ship');

-- ---------------------------------------------------------------------------
-- 1. Địa điểm nhận hàng
-- ---------------------------------------------------------------------------

alter table public.inventory_locations
  add column if not exists is_pickup_location boolean not null default false,
  add column if not exists pickup_instructions text,
  add column if not exists pickup_hours jsonb;

comment on column public.inventory_locations.is_pickup_location is
  'Khách có thể tới lấy hàng tại địa điểm này.';

-- ---------------------------------------------------------------------------
-- 2. Đơn hàng
-- ---------------------------------------------------------------------------

alter table public.sales_orders
  add column fulfillment_method public.fulfillment_method not null default 'ship',
  add column pickup_location_id uuid references public.inventory_locations(id) on delete restrict,
  add column pickup_ready_at timestamptz,
  add column picked_up_at timestamptz;

alter table public.sales_orders
  -- Nhận tại cửa hàng thì không có phí vận chuyển.
  add constraint sales_orders_pickup_no_shipping_fee check (
    fulfillment_method <> 'pickup' or shipping_amount = 0
  ),
  -- Đơn pickup đã chốt phải biết khách tới lấy ở đâu (nói được với khách ngay
  -- khi xác nhận đơn).
  add constraint sales_orders_pickup_location_required check (
    fulfillment_method <> 'pickup' or status = 'draft' or pickup_location_id is not null
  ),
  -- Đơn ship phải có địa chỉ TRƯỚC KHI GIAO, không phải trước khi chốt đơn:
  -- đơn qua điện thoại / tại quầy thường được chốt trước rồi mới lấy địa chỉ.
  -- DB chỉ chặn ở bước cuối; tầng checkout tự siết sớm hơn.
  add constraint sales_orders_ship_address_required check (
    fulfillment_method <> 'ship' or status <> 'fulfilled' or shipping_address_snapshot is not null
  ),
  -- Mốc thời gian pickup chỉ có nghĩa với đơn pickup.
  add constraint sales_orders_pickup_timeline check (
    (pickup_ready_at is null and picked_up_at is null) or fulfillment_method = 'pickup'
  ),
  add constraint sales_orders_pickup_order check (
    picked_up_at is null or pickup_ready_at is null or picked_up_at >= pickup_ready_at
  );

create index sales_orders_fulfillment_idx
  on public.sales_orders (fulfillment_method, status);

create index sales_orders_pickup_location_idx
  on public.sales_orders (pickup_location_id)
  where pickup_location_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Hoá đơn — snapshot lại phương thức tại thời điểm xuất
-- ---------------------------------------------------------------------------

alter table public.invoices
  add column fulfillment_method public.fulfillment_method not null default 'ship',
  add column pickup_location_snapshot jsonb;

alter table public.invoices
  add constraint invoices_pickup_no_shipping_fee check (
    fulfillment_method <> 'pickup' or shipping_amount = 0
  );

-- ---------------------------------------------------------------------------
-- 4. Hoá đơn phải khớp phương thức với đơn hàng gốc
-- ---------------------------------------------------------------------------

create or replace function public.ensure_invoice_order_consistency()
returns trigger
language plpgsql
as $$
declare
  v_order_customer_id uuid;
  v_order_currency char(3);
  v_order_fulfillment public.fulfillment_method;
begin
  if new.order_id is null then
    return new;
  end if;

  select customer_id, currency, fulfillment_method
    into v_order_customer_id, v_order_currency, v_order_fulfillment
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

  if new.fulfillment_method is distinct from v_order_fulfillment then
    raise exception 'Invoice fulfillment method must match the referenced sales order.';
  end if;

  return new;
end;
$$;

drop trigger if exists invoices_validate_order_consistency on public.invoices;
create trigger invoices_validate_order_consistency
  before insert or update of order_id, customer_id, currency, fulfillment_method on public.invoices
  for each row execute function public.ensure_invoice_order_consistency();

-- ---------------------------------------------------------------------------
-- 5. Địa điểm nhận hàng mặc định
-- ---------------------------------------------------------------------------

insert into public.inventory_locations (code, name, is_active, is_pickup_location, pickup_instructions)
values (
  'STORE-PICKUP',
  'Vinameals store pickup',
  true,
  true,
  'Bring your order number and a photo ID to the pickup counter.'
)
on conflict (code) do update
  set is_pickup_location = true;
