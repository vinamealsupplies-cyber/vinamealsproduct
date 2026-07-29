-- Giỏ hàng CHỈ theo tài khoản (auth user). Không session/trình duyệt/máy.
-- Mỗi user tối đa 1 dòng / product. Guest phải đăng nhập mới có giỏ.

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_items_quantity_positive check (quantity > 0),
  constraint cart_items_note_len check (note is null or char_length(note) <= 300),
  constraint cart_items_user_product_uidx unique (user_id, product_id)
);

create index cart_items_user_idx on public.cart_items (user_id);
create index cart_items_product_idx on public.cart_items (product_id);

comment on table public.cart_items is
  'Storefront cart lines keyed by signed-in user (cross-device).';

create trigger cart_items_updated_at
  before update on public.cart_items
  for each row execute function public.set_updated_at();

alter table public.cart_items enable row level security;

-- Khách chỉ CRUD giỏ của chính mình.
create policy cart_items_own_all
  on public.cart_items for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Staff có thể đọc (hỗ trợ CS) — không ghi giùm.
create policy cart_items_staff_read
  on public.cart_items for select to authenticated
  using ((select private.is_staff()));

-- Quyền tường minh (default privileges đã revoke all).
grant select, insert, update, delete on public.cart_items to authenticated;
