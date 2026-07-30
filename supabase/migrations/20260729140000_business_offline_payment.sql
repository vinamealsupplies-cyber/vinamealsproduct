-- Business discount orders: offline payment (check / Zelle / bank transfer).
-- Admin confirms payment later. Removes reliance on wholesale unit prices.

alter table public.sales_orders
  add column if not exists payment_method text,
  add column if not exists payment_reference text,
  add column if not exists payment_confirmed_at timestamptz,
  add column if not exists payment_confirmed_by uuid references public.profiles(id) on delete set null;

alter table public.sales_orders
  drop constraint if exists sales_orders_payment_method_check;

alter table public.sales_orders
  add constraint sales_orders_payment_method_check check (
    payment_method is null
    or payment_method in ('check', 'zelle', 'bank_transfer', 'card', 'test_checkout', 'other')
  );

create index if not exists sales_orders_payment_method_idx
  on public.sales_orders (payment_method)
  where payment_method is not null;

-- Business account discount % (applied at checkout as order discount_amount).
-- Replaces SKU wholesale_price list pricing for web orders.
alter table public.customers
  add column if not exists business_discount_percent numeric(5,2);

alter table public.customers
  drop constraint if exists customers_business_discount_percent_check;

alter table public.customers
  add constraint customers_business_discount_percent_check check (
    business_discount_percent is null
    or (business_discount_percent >= 0 and business_discount_percent <= 100)
  );

comment on column public.sales_orders.payment_method is
  'Customer-selected method at checkout: check | zelle | bank_transfer | card…';
comment on column public.customers.business_discount_percent is
  'Optional order-level discount % for approved business accounts (not SKU wholesale prices).';
