-- Ghi nhận ai huỷ / sửa đơn + note bắt buộc (audit hiển thị trên đơn).

-- Snapshot nhanh trên đơn (lần huỷ + lần staff action gần nhất).
alter table public.sales_orders
  add column if not exists cancelled_by uuid references public.profiles(id) on delete set null,
  add column if not exists cancelled_by_name text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_note text,
  add column if not exists last_staff_action text,
  add column if not exists last_staff_actor_id uuid references public.profiles(id) on delete set null,
  add column if not exists last_staff_actor_name text,
  add column if not exists last_staff_note text,
  add column if not exists last_staff_at timestamptz;

comment on column public.sales_orders.cancelled_by_name is
  'Tên nhân viên huỷ đơn (snapshot).';
comment on column public.sales_orders.cancel_note is
  'Lý do / note khi huỷ đơn.';
comment on column public.sales_orders.last_staff_actor_name is
  'Tên nhân viên thao tác gần nhất (huỷ/sửa).';
comment on column public.sales_orders.last_staff_note is
  'Note của thao tác staff gần nhất.';

-- Lịch sử đầy đủ mọi huỷ / sửa (nhiều dòng / đơn).
create table if not exists public.sales_order_staff_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sales_orders(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_name text not null,
  action text not null,
  note text not null,
  created_at timestamptz not null default now(),
  constraint sales_order_staff_events_note_len check (char_length(btrim(note)) between 1 and 500),
  constraint sales_order_staff_events_action_len check (char_length(action) between 1 and 64)
);

create index if not exists sales_order_staff_events_order_idx
  on public.sales_order_staff_events (order_id, created_at desc);

create index if not exists sales_order_staff_events_actor_idx
  on public.sales_order_staff_events (actor_user_id, created_at desc)
  where actor_user_id is not null;

comment on table public.sales_order_staff_events is
  'Staff/seller cancel or edit events with required note and actor name.';

alter table public.sales_order_staff_events enable row level security;

-- Staff đọc log; ghi qua service role (app admin actions).
create policy sales_order_staff_events_staff_read
  on public.sales_order_staff_events for select to authenticated
  using ((select private.is_staff()) or (select private.is_seller()));

grant select on public.sales_order_staff_events to authenticated;
