-- Ngưỡng giá sỉ theo từng khách: số lượng tối thiểu HOẶC số tiền tối thiểu.
-- Chỉ customer_type = wholesale mới được áp wholesale; phải đạt threshold mới dùng giá sỉ.

alter table public.customers
  add column if not exists wholesale_min_kind text,
  add column if not exists wholesale_min_value numeric(14,2);

alter table public.customers
  drop constraint if exists customers_wholesale_min_kind_check;

alter table public.customers
  add constraint customers_wholesale_min_kind_check check (
    wholesale_min_kind is null
    or wholesale_min_kind in ('quantity', 'amount')
  );

alter table public.customers
  drop constraint if exists customers_wholesale_min_value_check;

alter table public.customers
  add constraint customers_wholesale_min_value_check check (
    wholesale_min_value is null or wholesale_min_value >= 0
  );

-- Wholesale nên có threshold; nếu kind set thì value bắt buộc > 0.
alter table public.customers
  drop constraint if exists customers_wholesale_min_pair_check;

alter table public.customers
  add constraint customers_wholesale_min_pair_check check (
    (wholesale_min_kind is null and wholesale_min_value is null)
    or (
      wholesale_min_kind is not null
      and wholesale_min_value is not null
      and wholesale_min_value > 0
    )
  );

comment on column public.customers.wholesale_min_kind is
  'quantity = min units in cart; amount = min order subtotal (USD) to unlock wholesale price.';
comment on column public.customers.wholesale_min_value is
  'Threshold value for wholesale_min_kind.';
