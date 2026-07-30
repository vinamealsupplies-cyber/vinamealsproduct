-- Wholesale & Resale Account Application
-- Dual independent review tracks: wholesale_status vs tax_exemption_status.
-- customers.customer_type / tax_exempt_* remain the runtime sources of truth
-- after approval; this schema stores the full application + audit history.

-- ---------------------------------------------------------------------------
-- Status enums (application-level; richer than legacy tax_exempt_status)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.ba_wholesale_status as enum (
    'not_requested',
    'pending_review',
    'under_review',
    'approved',
    'rejected',
    'suspended'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ba_tax_status as enum (
    'not_requested',
    'pending_review',
    'under_review',
    'more_info_required',
    'approved',
    'rejected',
    'expired',
    'suspended',
    'revoked'
  );
exception when duplicate_object then null;
end $$;

-- Runtime wholesale workflow on customers (alongside customer_type).
alter table public.customers
  add column if not exists wholesale_status public.ba_wholesale_status
    not null default 'not_requested';

alter table public.customers
  add column if not exists wholesale_approved_at timestamptz,
  add column if not exists wholesale_approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists wholesale_application_id uuid;

create index if not exists customers_wholesale_status_idx
  on public.customers (wholesale_status)
  where wholesale_status <> 'not_requested';

-- Application number sequence → BUS-2026-000001
create sequence if not exists public.business_application_number_seq;

create or replace function public.next_business_application_number()
returns text
language plpgsql
as $$
declare
  n bigint;
  y text := to_char(timezone('utc', now()), 'YYYY');
begin
  n := nextval('public.business_application_number_seq');
  return 'BUS-' || y || '-' || lpad(n::text, 6, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- business_applications
-- ---------------------------------------------------------------------------
create table if not exists public.business_applications (
  id uuid primary key default gen_random_uuid(),
  application_number text not null unique default public.next_business_application_number(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,

  -- Applicant
  applicant_full_name text not null,
  applicant_job_title text not null,
  applicant_email text not null,
  applicant_phone text not null,
  preferred_contact_method text,

  -- Business
  legal_business_name text not null,
  dba_name text,
  entity_type text not null,
  business_category text not null,
  business_description text not null,
  website_url text,
  social_media_url text,
  years_in_business integer,
  estimated_monthly_volume text,

  -- Addresses
  business_street text not null,
  business_address_line_2 text,
  business_city text not null,
  business_state text not null,
  business_zip text not null,
  business_country text not null default 'US',
  mailing_same_as_business boolean not null default true,
  mailing_address_json jsonb,
  shipping_same_as_business boolean not null default true,
  shipping_address_json jsonb,

  -- Tracks requested + status (independent)
  wholesale_requested boolean not null default false,
  tax_exemption_requested boolean not null default false,
  wholesale_status public.ba_wholesale_status not null default 'not_requested',
  tax_exemption_status public.ba_tax_status not null default 'not_requested',

  -- Wholesale details
  products_interested_json jsonb not null default '[]'::jsonb,
  intended_use text,
  sales_channels_json jsonb not null default '[]'::jsonb,
  expected_first_order_amount numeric(14,2),
  wholesale_notes text,

  -- Tax / resale details
  exemption_type text,
  issuing_state text,
  permit_number text,
  certificate_effective_date date,
  certificate_expiration_date date,
  certificate_business_name text,
  certificate_same_as_business boolean,
  certificate_address_json jsonb,
  resale_product_description text,
  no_permit_reason text,
  verification_reference text,

  -- Signature / audit of submission
  signer_name text not null,
  signer_title text not null,
  electronic_signature text not null,
  signed_at timestamptz not null,
  submitted_at timestamptz not null default now(),
  ip_address text,
  user_agent text,

  -- Admin workflow
  assigned_reviewer_id uuid references public.profiles(id) on delete set null,
  risk_flag text,
  internal_notes text,
  customer_visible_message text,
  wholesale_decided_by uuid references public.profiles(id) on delete set null,
  wholesale_decided_at timestamptz,
  wholesale_decision_reason text,
  tax_decided_by uuid references public.profiles(id) on delete set null,
  tax_decided_at timestamptz,
  tax_decision_reason text,
  tax_verification_source text,
  tax_verification_date date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint business_applications_request_check check (
    wholesale_requested or tax_exemption_requested
  ),
  constraint business_applications_wholesale_status_check check (
    (wholesale_requested and wholesale_status <> 'not_requested')
    or (not wholesale_requested and wholesale_status = 'not_requested')
  ),
  constraint business_applications_tax_status_check check (
    (tax_exemption_requested and tax_exemption_status <> 'not_requested')
    or (not tax_exemption_requested and tax_exemption_status = 'not_requested')
  ),
  constraint business_applications_years_check check (
    years_in_business is null or years_in_business >= 0
  ),
  constraint business_applications_order_amount_check check (
    expected_first_order_amount is null or expected_first_order_amount >= 0
  ),
  constraint business_applications_cert_dates_check check (
    certificate_expiration_date is null
    or certificate_effective_date is null
    or certificate_expiration_date >= certificate_effective_date
  )
);

create index if not exists business_applications_customer_idx
  on public.business_applications (customer_id, submitted_at desc);
create index if not exists business_applications_wholesale_status_idx
  on public.business_applications (wholesale_status, submitted_at desc);
create index if not exists business_applications_tax_status_idx
  on public.business_applications (tax_exemption_status, submitted_at desc);
create index if not exists business_applications_reviewer_idx
  on public.business_applications (assigned_reviewer_id)
  where assigned_reviewer_id is not null;
create index if not exists business_applications_search_idx
  on public.business_applications
  using gin (
    to_tsvector(
      'simple',
      coalesce(application_number, '') || ' ' ||
      coalesce(legal_business_name, '') || ' ' ||
      coalesce(dba_name, '') || ' ' ||
      coalesce(applicant_full_name, '') || ' ' ||
      coalesce(applicant_email, '') || ' ' ||
      coalesce(applicant_phone, '') || ' ' ||
      coalesce(permit_number, '')
    )
  );

-- At most one open application per customer (pending / under_review / more_info).
create unique index if not exists business_applications_one_open_uidx
  on public.business_applications (customer_id)
  where (
    wholesale_status in ('pending_review', 'under_review')
    or tax_exemption_status in ('pending_review', 'under_review', 'more_info_required')
  );

create trigger business_applications_set_updated_at
  before update on public.business_applications
  for each row execute function public.set_updated_at();

-- Link customers.wholesale_application_id after table exists
do $$ begin
  alter table public.customers
    add constraint customers_wholesale_application_fk
    foreign key (wholesale_application_id)
    references public.business_applications(id) on delete set null;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- application_documents
-- ---------------------------------------------------------------------------
create table if not exists public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.business_applications(id) on delete cascade,
  document_type text not null,
  original_filename text,
  storage_path text not null unique,
  mime_type text not null,
  file_size bigint not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  status text not null default 'active'
    check (status in ('active', 'superseded', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint application_documents_bytes_check
    check (file_size > 0 and file_size <= 10 * 1024 * 1024),
  constraint application_documents_type_check
    check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  constraint application_documents_path_check
    check (storage_path ~ '^business-applications/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$')
);

create index if not exists application_documents_application_idx
  on public.application_documents (application_id, uploaded_at desc);

create trigger application_documents_set_updated_at
  before update on public.application_documents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- application_reviews
-- ---------------------------------------------------------------------------
create table if not exists public.application_reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.business_applications(id) on delete cascade,
  reviewer_id uuid references public.profiles(id) on delete set null,
  review_type text not null
    check (review_type in ('wholesale', 'tax_exemption', 'general', 'more_info', 'assignment')),
  previous_status text,
  new_status text,
  decision text,
  reason text,
  internal_note text,
  verification_source text,
  created_at timestamptz not null default now()
);

create index if not exists application_reviews_application_idx
  on public.application_reviews (application_id, created_at desc);

-- ---------------------------------------------------------------------------
-- application_messages (admin ↔ customer)
-- ---------------------------------------------------------------------------
create table if not exists public.application_messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.business_applications(id) on delete cascade,
  sender_type text not null check (sender_type in ('customer', 'staff', 'system')),
  sender_id uuid,
  subject text,
  message text not null,
  sent_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists application_messages_application_idx
  on public.application_messages (application_id, sent_at desc);

-- ---------------------------------------------------------------------------
-- application_audit_logs
-- ---------------------------------------------------------------------------
create table if not exists public.application_audit_logs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.business_applications(id) on delete cascade,
  actor_id uuid,
  actor_type text not null check (actor_type in ('customer', 'staff', 'system')),
  action text not null,
  old_value_json jsonb,
  new_value_json jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists application_audit_logs_application_idx
  on public.application_audit_logs (application_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS — app uses service role for writes after authz; policies for defense
-- ---------------------------------------------------------------------------
alter table public.business_applications enable row level security;
alter table public.application_documents enable row level security;
alter table public.application_reviews enable row level security;
alter table public.application_messages enable row level security;
alter table public.application_audit_logs enable row level security;

create policy business_applications_own_read
  on public.business_applications for select to authenticated
  using (auth_user_id = (select auth.uid()));

create policy business_applications_staff_read
  on public.business_applications for select to authenticated
  using ((select private.is_staff()));

create policy business_applications_own_insert
  on public.business_applications for insert to authenticated
  with check (
    auth_user_id = (select auth.uid())
    and wholesale_status in ('not_requested', 'pending_review')
    and tax_exemption_status in ('not_requested', 'pending_review')
  );

create policy business_applications_manager_update
  on public.business_applications for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

create policy application_documents_own_read
  on public.application_documents for select to authenticated
  using (
    exists (
      select 1 from public.business_applications a
      where a.id = application_documents.application_id
        and a.auth_user_id = (select auth.uid())
    )
  );

create policy application_documents_staff_read
  on public.application_documents for select to authenticated
  using ((select private.is_staff()));

create policy application_documents_own_insert
  on public.application_documents for insert to authenticated
  with check (
    exists (
      select 1 from public.business_applications a
      where a.id = application_documents.application_id
        and a.auth_user_id = (select auth.uid())
        and (
          a.wholesale_status in ('pending_review', 'under_review')
          or a.tax_exemption_status in ('pending_review', 'under_review', 'more_info_required')
        )
    )
  );

create policy application_reviews_staff_read
  on public.application_reviews for select to authenticated
  using ((select private.is_staff()));

create policy application_messages_own_read
  on public.application_messages for select to authenticated
  using (
    exists (
      select 1 from public.business_applications a
      where a.id = application_messages.application_id
        and a.auth_user_id = (select auth.uid())
    )
    or (select private.is_staff())
  );

create policy application_messages_own_insert
  on public.application_messages for insert to authenticated
  with check (
    sender_type = 'customer'
    and exists (
      select 1 from public.business_applications a
      where a.id = application_messages.application_id
        and a.auth_user_id = (select auth.uid())
    )
  );

create policy application_messages_staff_insert
  on public.application_messages for insert to authenticated
  with check (
    sender_type in ('staff', 'system')
    and (select private.is_staff())
  );

create policy application_audit_logs_staff_read
  on public.application_audit_logs for select to authenticated
  using ((select private.is_manager()));

grant select, insert on public.business_applications to authenticated;
grant update on public.business_applications to authenticated;
grant select, insert on public.application_documents to authenticated;
grant select on public.application_reviews to authenticated;
grant select, insert on public.application_messages to authenticated;
grant select on public.application_audit_logs to authenticated;

grant all on public.business_applications to service_role;
grant all on public.application_documents to service_role;
grant all on public.application_reviews to service_role;
grant all on public.application_messages to service_role;
grant all on public.application_audit_logs to service_role;
grant usage, select on sequence public.business_application_number_seq to service_role;
grant usage, select on sequence public.business_application_number_seq to authenticated;

comment on table public.business_applications is
  'Wholesale and/or resale tax-exemption applications; dual independent status tracks.';
