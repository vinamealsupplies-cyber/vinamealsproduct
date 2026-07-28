-- Ghi nhận ai xác nhận pickup (kiểm tra / audit).
alter table public.sales_orders
  add column if not exists picked_up_by uuid references public.profiles(id) on delete set null,
  add column if not exists picked_up_by_name text;

comment on column public.sales_orders.picked_up_by is
  'Staff/seller profile who confirmed customer pickup.';
comment on column public.sales_orders.picked_up_by_name is
  'Display name snapshot of the person who confirmed pickup.';

create index if not exists sales_orders_picked_up_by_idx
  on public.sales_orders (picked_up_by)
  where picked_up_by is not null;
