-- Special request hay dùng của từng tài khoản (cart line notes).
-- User chọn từ list hoặc gõ mới; khi dùng sẽ tăng use_count / last_used_at.

create table public.user_special_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  use_count integer not null default 1,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_special_requests_body_len check (
    char_length(btrim(body)) between 1 and 300
  ),
  constraint user_special_requests_use_count_positive check (use_count > 0)
);

-- Một text (không phân biệt hoa thường) / user.
create unique index user_special_requests_user_body_uidx
  on public.user_special_requests (user_id, lower(btrim(body)));

create index user_special_requests_user_recent_idx
  on public.user_special_requests (user_id, last_used_at desc);

comment on table public.user_special_requests is
  'Saved special-request phrases per signed-in user for cart line notes.';

create trigger user_special_requests_updated_at
  before update on public.user_special_requests
  for each row execute function public.set_updated_at();

alter table public.user_special_requests enable row level security;

create policy user_special_requests_own_all
  on public.user_special_requests for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.user_special_requests to authenticated;
