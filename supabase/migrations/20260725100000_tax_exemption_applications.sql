-- Đơn xin miễn thuế do khách tự nộp + tài liệu chứng minh đính kèm.
--
-- Bảng customers đã có sẵn các cột tax_exempt_* (trạng thái, người duyệt, thời
-- điểm duyệt) nên chúng là "nguồn sự thật" cuối cùng. Bảng dưới đây lưu bản
-- thân ĐƠN: ai nộp, nộp gì, giấy tờ nào, ai duyệt — để có lịch sử và hàng đợi
-- chờ duyệt cho admin.

create table public.tax_exemption_applications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  contact_name text not null,
  business_name text not null,
  email text not null,
  phone text not null,
  -- Dùng lại enum sẵn có; đơn chỉ sống ở pending/approved/rejected.
  status public.tax_exempt_status not null default 'pending',
  review_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tax_exemption_applications_status_check
    check (status in ('pending', 'approved', 'rejected')),
  constraint tax_exemption_applications_reviewed_check
    check ((status = 'pending') = (reviewed_at is null)),
  constraint tax_exemption_applications_contact_check
    check (btrim(contact_name) <> '' and btrim(business_name) <> ''
       and btrim(email) <> '' and btrim(phone) <> '')
);

create index tax_exemption_applications_customer_idx
  on public.tax_exemption_applications (customer_id, created_at desc);
-- Hàng đợi chờ duyệt cho admin.
create index tax_exemption_applications_pending_idx
  on public.tax_exemption_applications (created_at desc)
  where status = 'pending';
-- Mỗi khách chỉ có tối đa MỘT đơn đang chờ duyệt (chặn spam nộp trùng).
create unique index tax_exemption_applications_one_pending_uidx
  on public.tax_exemption_applications (customer_id)
  where status = 'pending';

create table public.tax_exemption_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.tax_exemption_applications(id) on delete cascade,
  -- Khoá object trong bucket R2 RIÊNG (private). Không có public_url: file chỉ
  -- được xem qua presigned URL ngắn hạn do server admin phát hành.
  object_key text not null unique,
  content_type text not null,
  bytes bigint not null,
  original_filename text,
  created_at timestamptz not null default now(),
  constraint tax_exemption_documents_bytes_check check (bytes > 0 and bytes <= 5 * 1024 * 1024),
  constraint tax_exemption_documents_type_check
    check (content_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  -- Khoá phải nằm đúng trong tiền tố của tính năng này.
  constraint tax_exemption_documents_key_check
    check (object_key ~ '^tax-exemptions/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$')
);

create index tax_exemption_documents_application_idx
  on public.tax_exemption_documents (application_id, created_at);

create trigger tax_exemption_applications_set_updated_at
  before update on public.tax_exemption_applications
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.tax_exemption_applications enable row level security;
alter table public.tax_exemption_documents enable row level security;

-- Khách xem đơn của chính mình.
create policy tax_exemption_applications_own_read
  on public.tax_exemption_applications for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = tax_exemption_applications.customer_id
        and c.auth_user_id = (select auth.uid())
    )
  );

-- Khách tự nộp đơn cho chính mình, và luôn ở trạng thái pending.
create policy tax_exemption_applications_own_insert
  on public.tax_exemption_applications for insert to authenticated
  with check (
    status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and exists (
      select 1 from public.customers c
      where c.id = tax_exemption_applications.customer_id
        and c.auth_user_id = (select auth.uid())
    )
  );

create policy tax_exemption_applications_staff_read
  on public.tax_exemption_applications for select to authenticated
  using ((select private.is_staff()));

-- Quyết định duyệt/từ chối là thao tác nhạy cảm → chỉ manager/admin.
create policy tax_exemption_applications_manager_update
  on public.tax_exemption_applications for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

create policy tax_exemption_documents_own_read
  on public.tax_exemption_documents for select to authenticated
  using (
    exists (
      select 1
      from public.tax_exemption_applications a
      join public.customers c on c.id = a.customer_id
      where a.id = tax_exemption_documents.application_id
        and c.auth_user_id = (select auth.uid())
    )
  );

create policy tax_exemption_documents_own_insert
  on public.tax_exemption_documents for insert to authenticated
  with check (
    exists (
      select 1
      from public.tax_exemption_applications a
      join public.customers c on c.id = a.customer_id
      where a.id = tax_exemption_documents.application_id
        and c.auth_user_id = (select auth.uid())
        and a.status = 'pending'
    )
  );

create policy tax_exemption_documents_staff_read
  on public.tax_exemption_documents for select to authenticated
  using ((select private.is_staff()));

-- ---------------------------------------------------------------------------
-- Grants (migration 20260724120000 đã thu hồi default privileges nên phải cấp
-- tường minh; anon KHÔNG có quyền gì trên hai bảng này).
-- ---------------------------------------------------------------------------
grant select, insert on public.tax_exemption_applications to authenticated;
grant update on public.tax_exemption_applications to authenticated;
grant select, insert on public.tax_exemption_documents to authenticated;
grant all on public.tax_exemption_applications to service_role;
grant all on public.tax_exemption_documents to service_role;
