-- Hộp thư hỗ trợ dùng chung trong khu /admin (seller + manager + admin).
--
-- Nhận: Cloudflare Email Worker parse thư gửi vào support@vinamealsupplies.com
-- rồi ghi vào đây bằng service role. Gửi: server action gọi Resend.
--
-- Kiến trúc quyền GIỐNG phần còn lại của khu admin (xem
-- 20260728100100_seller_role_helpers.sql): dữ liệu đọc/ghi bằng SERVICE ROLE,
-- cổng phân quyền nằm ở tầng app (viewer.canAccessAdmin = isStaff || isSeller).
-- RLS ở đây là lớp phòng thủ thứ hai, cố ý giữ chặt — KHÔNG cấp cho
-- anon/authenticated. Default privileges đã bị revoke ở
-- 20260724120000_fix_column_grants_and_customer_writes.sql nên bảng mới không
-- tự có quyền nào cho anon/authenticated.

-- ---------------------------------------------------------------------------
-- 1. Enum
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.email_direction as enum ('inbound', 'outbound');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.email_thread_status as enum ('open', 'closed');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Bảng
-- ---------------------------------------------------------------------------
create table if not exists public.email_threads (
  id uuid primary key default gen_random_uuid(),
  subject text not null default '(no subject)',
  -- Địa chỉ của khách trong hội thoại — dùng để gộp thư và để nối sang customers.
  contact_address text not null,
  contact_name text,
  customer_id uuid references public.customers (id) on delete set null,
  status public.email_thread_status not null default 'open',
  message_count integer not null default 0,
  -- Có thư đến chưa đọc? Đặt true khi worker ghi inbound, false khi staff mở.
  has_unread boolean not null default false,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.email_threads (id) on delete cascade,
  direction public.email_direction not null,

  from_address text not null,
  from_name text,
  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  subject text not null default '(no subject)',

  -- Thân thư. html_body của thư ĐẾN là dữ liệu KHÔNG đáng tin — phải sanitize
  -- trước khi render (xem lib/email/sanitize.ts), không bao giờ dangerouslySet.
  text_body text,
  html_body text,

  -- Header RFC 5322 để gộp luồng hội thoại bên phía khách.
  rfc_message_id text,
  in_reply_to text,

  -- AI GỬI — nguồn sự thật cho dòng "Sent by ...".
  -- Lấy từ getViewer() ở server, KHÔNG nhận từ form. Lưu cả id (truy vết) lẫn
  -- tên tại thời điểm gửi (snapshot: đổi tên profile sau này không viết lại
  -- lịch sử thư đã gửi).
  sent_by uuid references public.profiles (id) on delete set null,
  sent_by_name text,

  -- Id bên Resend, để đối chiếu khi cần tra cứu.
  provider_id text,

  created_at timestamptz not null default now(),

  -- Thư gửi đi BẮT BUỘC có người gửi; thư đến thì không.
  constraint email_messages_sender_attribution check (
    (direction = 'outbound' and sent_by_name is not null and length(trim(sent_by_name)) > 0)
    or (direction = 'inbound' and sent_by is null and sent_by_name is null)
  )
);

create table if not exists public.email_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.email_messages (id) on delete cascade,
  filename text not null,
  content_type text not null,
  bytes integer not null,
  -- Key trong R2 (bucket tài liệu riêng, không public). Tên do server sinh bằng
  -- UUID, không giữ tên gốc của người gửi.
  object_key text not null,
  created_at timestamptz not null default now(),

  constraint email_attachments_bytes_sane check (bytes > 0 and bytes <= 26214400),
  constraint email_attachments_key_shape check (object_key ~ '^inbox/[0-9a-f-]{36}/[0-9a-f-]{36}\.[A-Za-z0-9]{1,10}$')
);

-- ---------------------------------------------------------------------------
-- 3. Index
-- ---------------------------------------------------------------------------
create index if not exists email_threads_recent_idx
  on public.email_threads (last_message_at desc);
create index if not exists email_threads_contact_idx
  on public.email_threads (lower(contact_address));
create index if not exists email_threads_customer_idx
  on public.email_threads (customer_id) where customer_id is not null;

create index if not exists email_messages_thread_idx
  on public.email_messages (thread_id, created_at);
-- Chống ghi trùng khi Cloudflare thử lại cùng một thư.
create unique index if not exists email_messages_rfc_id_uidx
  on public.email_messages (rfc_message_id) where rfc_message_id is not null;

create index if not exists email_attachments_message_idx
  on public.email_attachments (message_id);

-- ---------------------------------------------------------------------------
-- 4. Giữ thread luôn khớp với message (thay vì tin app cập nhật đúng)
-- ---------------------------------------------------------------------------
create or replace function public.touch_email_thread()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  update public.email_threads
     set message_count   = message_count + 1,
         last_message_at = new.created_at,
         -- Thư đến -> đánh dấu chưa đọc; staff trả lời -> coi như đã xử lý.
         has_unread      = (new.direction = 'inbound')
   where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists email_messages_touch_thread on public.email_messages;
create trigger email_messages_touch_thread
  after insert on public.email_messages
  for each row execute function public.touch_email_thread();

-- ---------------------------------------------------------------------------
-- 5. RLS — chặt, chỉ staff. Seller vào khu admin bằng service role (tầng app).
-- ---------------------------------------------------------------------------
alter table public.email_threads enable row level security;
alter table public.email_messages enable row level security;
alter table public.email_attachments enable row level security;

create policy email_threads_staff_all
  on public.email_threads for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

create policy email_messages_staff_all
  on public.email_messages for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

create policy email_attachments_staff_all
  on public.email_attachments for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

-- Cố ý KHÔNG `grant` cho anon/authenticated: nội dung thư của khách là dữ liệu
-- nhạy cảm, chỉ đi qua service role trong khu admin.

-- ---------------------------------------------------------------------------
-- 6. Chữ ký riêng của từng nhân viên
-- ---------------------------------------------------------------------------
-- Đây là phần nhân viên TỰ soạn (chức danh, số điện thoại, lời chào cuối thư).
-- Nó KHÔNG thay thế dòng xác nhận "Sent by <họ tên>" — dòng đó do server chèn
-- từ phiên đăng nhập và không sửa được, nằm DƯỚI chữ ký này.
alter table public.profiles
  add column if not exists email_signature text;

comment on column public.profiles.email_signature is
  'Chữ ký cuối thư do nhân viên tự soạn (plain text). Không thay thế dòng "Sent by <tên>" bất biến do server chèn.';

comment on column public.email_messages.sent_by_name is
  'Tên người gửi tại thời điểm gửi, lấy từ phiên đăng nhập ở server. Người dùng KHÔNG sửa được — dùng để xác nhận thư do ai gửi.';
comment on column public.email_messages.html_body is
  'Thư đến: HTML thô, KHÔNG đáng tin. Phải sanitize trước khi render.';
