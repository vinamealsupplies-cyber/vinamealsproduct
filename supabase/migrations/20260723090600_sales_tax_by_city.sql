-- =========================================================================
-- Sales tax theo thành phố Mỹ
--
-- Nhập địa chỉ (state + city, hoặc ZIP) -> tra ra thuế suất -> tính tiền thuế.
--
-- QUAN TRỌNG cho ngành thực phẩm: phần lớn các bang MIỄN hoặc GIẢM thuế cho
-- hàng tạp hoá (grocery) nhưng vẫn thu đủ với đồ ăn chế biến sẵn (prepared
-- food). Vì vậy mỗi vùng lưu HAI thuế suất riêng, không phải một.
--
-- Toàn bộ số liệu seed ở cuối file là ƯỚC LƯỢNG KHỞI ĐIỂM (source =
-- 'seed_estimate', verified_at = null). Thuế suất Mỹ đổi theo từng quý và theo
-- từng đặc khu. Phải đối chiếu với nguồn chính thức của bang rồi bấm xác minh
-- trong Admin > Sales tax trước khi bán thật.
-- =========================================================================

create type public.tax_category as enum ('grocery', 'prepared_food', 'general');

-- Mặt hàng thuộc nhóm thuế nào. Mặc định 'grocery' vì đây là cửa hàng thực phẩm.
alter table public.product_variants
  add column tax_category public.tax_category not null default 'grocery';

comment on column public.product_variants.tax_category is
  'Nhóm thuế: grocery (tạp hoá, thường được miễn/giảm), prepared_food (đồ ăn sẵn), general (hàng thường).';

-- ---------------------------------------------------------------------------
-- 1. Bảng thuế suất theo vùng
-- ---------------------------------------------------------------------------

create table public.tax_jurisdictions (
  id uuid primary key default gen_random_uuid(),
  country_code char(2) not null default 'US',
  state_code char(2) not null,
  -- '*' = mức mặc định của cả bang, dùng khi không khớp thành phố nào.
  city text not null default '*',
  county text,
  zip text,

  -- Thuế suất dạng thập phân: 0.09500 = 9.5%
  general_rate numeric(7,5) not null,
  grocery_rate numeric(7,5) not null default 0,
  prepared_food_rate numeric(7,5),

  -- Tách chi tiết để đối chiếu với báo cáo của bang (không bắt buộc).
  state_rate numeric(7,5),
  county_rate numeric(7,5),
  city_rate numeric(7,5),
  special_rate numeric(7,5),

  effective_from date not null default current_date,
  effective_to date,
  is_active boolean not null default true,

  source text not null default 'seed_estimate',
  source_url text,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tax_jurisdictions_rates_check check (
    general_rate >= 0 and general_rate <= 0.25 and
    grocery_rate >= 0 and grocery_rate <= 0.25 and
    (prepared_food_rate is null or (prepared_food_rate >= 0 and prepared_food_rate <= 0.25))
  ),
  constraint tax_jurisdictions_period_check check (
    effective_to is null or effective_to > effective_from
  ),
  constraint tax_jurisdictions_zip_format check (
    zip is null or zip ~ '^[0-9]{5}$'
  ),
  constraint tax_jurisdictions_state_default_no_zip check (
    city <> '*' or zip is null
  ),
  constraint tax_jurisdictions_verified_pair check (
    (verified_at is null) = (verified_by is null)
  )
);

comment on table public.tax_jurisdictions is
  'Thuế suất bán hàng theo bang/thành phố/ZIP của Mỹ. city = ''*'' là mức mặc định của bang.';

-- Một vùng chỉ có một dòng hiệu lực tại một thời điểm bắt đầu.
create unique index tax_jurisdictions_unique_period_idx
  on public.tax_jurisdictions (
    country_code, state_code, lower(city), coalesce(zip, ''), effective_from
  );

create index tax_jurisdictions_lookup_idx
  on public.tax_jurisdictions (state_code, lower(city))
  where is_active;

create index tax_jurisdictions_zip_idx
  on public.tax_jurisdictions (zip)
  where zip is not null and is_active;

create index tax_jurisdictions_unverified_idx
  on public.tax_jurisdictions (state_code)
  where verified_at is null and is_active;

create trigger tax_jurisdictions_set_updated_at
  before update on public.tax_jurisdictions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Tra vùng thuế theo địa chỉ
--    Thứ tự ưu tiên: ZIP khớp chính xác > thành phố > mặc định của bang.
-- ---------------------------------------------------------------------------

create or replace function public.resolve_tax_jurisdiction(
  p_state_code text,
  p_city text default null,
  p_zip text default null,
  p_on_date date default current_date
)
returns public.tax_jurisdictions
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select j.*
  from public.tax_jurisdictions j
  where j.is_active
    and j.country_code = 'US'
    and j.state_code = upper(btrim(p_state_code))
    and j.effective_from <= p_on_date
    and (j.effective_to is null or j.effective_to > p_on_date)
    and (
      (j.zip is not null and p_zip is not null and j.zip = btrim(p_zip))
      or (j.zip is null and j.city <> '*' and p_city is not null
          and lower(j.city) = lower(btrim(p_city)))
      or (j.zip is null and j.city = '*')
    )
  order by
    case
      when j.zip is not null then 0
      when j.city <> '*' then 1
      else 2
    end,
    j.effective_from desc
  limit 1;
$$;

comment on function public.resolve_tax_jurisdiction is
  'Trả về dòng thuế khớp nhất với địa chỉ. Ưu tiên ZIP > thành phố > mặc định bang.';

-- ---------------------------------------------------------------------------
-- 3. Tính tiền thuế
-- ---------------------------------------------------------------------------

create or replace function public.calculate_sales_tax(
  p_amount numeric,
  p_state_code text,
  p_city text default null,
  p_zip text default null,
  p_tax_category public.tax_category default 'grocery',
  p_on_date date default current_date
)
returns table (
  tax_amount numeric,
  rate numeric,
  jurisdiction_id uuid,
  jurisdiction_label text,
  matched_on text,
  is_verified boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.tax_jurisdictions;
  v_rate numeric(7,5);
begin
  if p_amount is null or p_amount <= 0 or p_state_code is null then
    return query select 0::numeric, 0::numeric, null::uuid, null::text, 'no_amount'::text, false;
    return;
  end if;

  v_row := public.resolve_tax_jurisdiction(p_state_code, p_city, p_zip, p_on_date);

  if v_row.id is null then
    -- Không có dữ liệu cho bang này: trả 0 và báo rõ để tầng trên chặn checkout.
    return query select 0::numeric, 0::numeric, null::uuid, null::text, 'no_jurisdiction'::text, false;
    return;
  end if;

  v_rate := case p_tax_category
    when 'grocery' then v_row.grocery_rate
    when 'prepared_food' then coalesce(v_row.prepared_food_rate, v_row.general_rate)
    else v_row.general_rate
  end;

  return query select
    round(p_amount * v_rate, 2),
    v_rate::numeric,
    v_row.id,
    case when v_row.city = '*'
      then v_row.state_code || ' (state default)'
      else v_row.city || ', ' || v_row.state_code
    end,
    case
      when v_row.zip is not null then 'zip'
      when v_row.city <> '*' then 'city'
      else 'state_default'
    end,
    v_row.verified_at is not null;
end;
$$;

comment on function public.calculate_sales_tax is
  'Tính tiền thuế cho một khoản tiền theo địa chỉ và nhóm thuế của mặt hàng.';

-- ---------------------------------------------------------------------------
-- 4. RLS và quyền
--    Thuế suất là thông tin công khai -> khách xem được để hiện ở checkout.
--    Chỉ manager/admin được sửa.
-- ---------------------------------------------------------------------------

alter table public.tax_jurisdictions enable row level security;

create policy tax_jurisdictions_public_read
  on public.tax_jurisdictions for select to anon, authenticated
  using (
    is_active
    and effective_from <= current_date
    and (effective_to is null or effective_to > current_date)
  );

create policy tax_jurisdictions_staff_read
  on public.tax_jurisdictions for select to authenticated
  using ((select private.is_staff()));

create policy tax_jurisdictions_manager_insert
  on public.tax_jurisdictions for insert to authenticated
  with check ((select private.is_manager()));

create policy tax_jurisdictions_manager_update
  on public.tax_jurisdictions for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

create policy tax_jurisdictions_admin_delete
  on public.tax_jurisdictions for delete to authenticated
  using ((select private.is_admin()));

-- Khách chỉ thấy cột thuế suất, không thấy ai xác minh hay ghi chú nội bộ.
grant select (
  id, country_code, state_code, city, county, zip,
  general_rate, grocery_rate, prepared_food_rate,
  effective_from, effective_to, is_active
) on public.tax_jurisdictions to anon, authenticated;

grant insert, update, delete on public.tax_jurisdictions to authenticated;

grant execute on function public.resolve_tax_jurisdiction(text, text, text, date)
  to anon, authenticated, service_role;
grant execute on function public.calculate_sales_tax(numeric, text, text, text, public.tax_category, date)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Seed — ƯỚC LƯỢNG KHỞI ĐIỂM, CHƯA XÁC MINH
--
--    general_rate  = thuế hàng hoá thường (state + county + city + district)
--    grocery_rate  = thuế áp cho hàng tạp hoá đủ điều kiện
--    prepared_food_rate = null nghĩa là dùng general_rate
-- ---------------------------------------------------------------------------

-- 5a. Mức mặc định của từng bang (city = '*')
insert into public.tax_jurisdictions
  (state_code, city, general_rate, grocery_rate, notes)
values
  ('AL', '*', 0.04000, 0.02000, 'Bang đánh thuế tạp hoá ở mức giảm.'),
  ('AK', '*', 0.00000, 0.00000, 'Không có thuế cấp bang; một số địa phương có thuế riêng.'),
  ('AZ', '*', 0.05600, 0.00000, 'Bang miễn tạp hoá; nhiều thành phố vẫn thu.'),
  ('AR', '*', 0.06500, 0.00125, 'Tạp hoá ở mức giảm rất thấp.'),
  ('CA', '*', 0.07250, 0.00000, 'Miễn thuế phần lớn thực phẩm chưa chế biến.'),
  ('CO', '*', 0.02900, 0.00000, 'Bang miễn tạp hoá.'),
  ('CT', '*', 0.06350, 0.00000, 'Bang miễn tạp hoá.'),
  ('DE', '*', 0.00000, 0.00000, 'Không có thuế bán hàng.'),
  ('DC', '*', 0.06000, 0.00000, 'Miễn tạp hoá.'),
  ('FL', '*', 0.06000, 0.00000, 'Miễn tạp hoá.'),
  ('GA', '*', 0.04000, 0.00000, 'Bang miễn tạp hoá; địa phương có thể thu.'),
  ('HI', '*', 0.04000, 0.04000, 'General Excise Tax áp cho gần như mọi thứ.'),
  ('ID', '*', 0.06000, 0.06000, 'Đánh thuế tạp hoá, bù bằng tín thuế cuối năm.'),
  ('IL', '*', 0.06250, 0.01000, 'Tạp hoá mức giảm 1%.'),
  ('IN', '*', 0.07000, 0.00000, 'Miễn tạp hoá.'),
  ('IA', '*', 0.06000, 0.00000, 'Miễn tạp hoá.'),
  ('KS', '*', 0.06500, 0.00000, 'Bang đã bỏ thuế tạp hoá; địa phương có thể còn.'),
  ('KY', '*', 0.06000, 0.00000, 'Miễn tạp hoá.'),
  ('LA', '*', 0.05000, 0.00000, 'Bang miễn tạp hoá; địa phương thu nhiều.'),
  ('ME', '*', 0.05500, 0.00000, 'Miễn tạp hoá.'),
  ('MD', '*', 0.06000, 0.00000, 'Miễn tạp hoá.'),
  ('MA', '*', 0.06250, 0.00000, 'Miễn tạp hoá.'),
  ('MI', '*', 0.06000, 0.00000, 'Miễn tạp hoá.'),
  ('MN', '*', 0.06875, 0.00000, 'Miễn tạp hoá.'),
  ('MS', '*', 0.07000, 0.07000, 'Đánh thuế tạp hoá đầy đủ.'),
  ('MO', '*', 0.04225, 0.01225, 'Tạp hoá mức giảm.'),
  ('MT', '*', 0.00000, 0.00000, 'Không có thuế bán hàng.'),
  ('NE', '*', 0.05500, 0.00000, 'Miễn tạp hoá.'),
  ('NV', '*', 0.06850, 0.00000, 'Miễn tạp hoá.'),
  ('NH', '*', 0.00000, 0.00000, 'Không có thuế bán hàng.'),
  ('NJ', '*', 0.06625, 0.00000, 'Miễn tạp hoá.'),
  ('NM', '*', 0.04875, 0.00000, 'Miễn tạp hoá.'),
  ('NY', '*', 0.04000, 0.00000, 'Miễn phần lớn thực phẩm.'),
  ('NC', '*', 0.04750, 0.02000, 'Tạp hoá chịu thuế địa phương 2%.'),
  ('ND', '*', 0.05000, 0.00000, 'Miễn tạp hoá.'),
  ('OH', '*', 0.05750, 0.00000, 'Miễn thực phẩm mang về.'),
  ('OK', '*', 0.04500, 0.00000, 'Bang đã bỏ thuế tạp hoá; địa phương còn thu.'),
  ('OR', '*', 0.00000, 0.00000, 'Không có thuế bán hàng.'),
  ('PA', '*', 0.06000, 0.00000, 'Miễn tạp hoá.'),
  ('RI', '*', 0.07000, 0.00000, 'Miễn tạp hoá.'),
  ('SC', '*', 0.06000, 0.00000, 'Bang miễn tạp hoá.'),
  ('SD', '*', 0.04200, 0.04200, 'Đánh thuế tạp hoá đầy đủ.'),
  ('TN', '*', 0.07000, 0.04000, 'Tạp hoá mức giảm 4%.'),
  ('TX', '*', 0.06250, 0.00000, 'Miễn thực phẩm cơ bản.'),
  ('UT', '*', 0.04850, 0.01750, 'Tạp hoá mức giảm.'),
  ('VT', '*', 0.06000, 0.00000, 'Miễn tạp hoá.'),
  ('VA', '*', 0.05300, 0.01000, 'Tạp hoá chỉ chịu phần địa phương 1%.'),
  ('WA', '*', 0.06500, 0.00000, 'Miễn tạp hoá.'),
  ('WV', '*', 0.06000, 0.00000, 'Miễn tạp hoá.'),
  ('WI', '*', 0.05000, 0.00000, 'Miễn tạp hoá.'),
  ('WY', '*', 0.04000, 0.00000, 'Miễn tạp hoá.');

-- 5b. Các thành phố lớn — thuế gộp (bang + quận + thành phố + đặc khu).
--     grocery_rate lấy theo quy định miễn/giảm của bang tương ứng.
insert into public.tax_jurisdictions
  (state_code, city, general_rate, grocery_rate)
values
  -- California — miễn tạp hoá
  ('CA', 'Los Angeles',    0.09500, 0.00000),
  ('CA', 'Long Beach',     0.10250, 0.00000),
  ('CA', 'Oakland',        0.10250, 0.00000),
  ('CA', 'San Francisco',  0.08625, 0.00000),
  ('CA', 'San Jose',       0.09375, 0.00000),
  ('CA', 'San Diego',      0.07750, 0.00000),
  ('CA', 'Sacramento',     0.08750, 0.00000),
  ('CA', 'Fresno',         0.08350, 0.00000),
  ('CA', 'Anaheim',        0.07750, 0.00000),
  ('CA', 'Santa Ana',      0.09250, 0.00000),
  ('CA', 'Riverside',      0.08750, 0.00000),
  ('CA', 'Bakersfield',    0.08250, 0.00000),
  ('CA', 'Stockton',       0.09000, 0.00000),
  ('CA', 'Irvine',         0.07750, 0.00000),
  ('CA', 'Garden Grove',   0.08750, 0.00000),
  ('CA', 'Westminster',    0.08750, 0.00000),
  ('CA', 'San Bernardino', 0.08750, 0.00000),
  -- Texas — miễn thực phẩm cơ bản
  ('TX', 'Houston',        0.08250, 0.00000),
  ('TX', 'Dallas',         0.08250, 0.00000),
  ('TX', 'San Antonio',    0.08250, 0.00000),
  ('TX', 'Austin',         0.08250, 0.00000),
  ('TX', 'Fort Worth',     0.08250, 0.00000),
  ('TX', 'El Paso',        0.08250, 0.00000),
  ('TX', 'Arlington',      0.08250, 0.00000),
  ('TX', 'Plano',          0.08250, 0.00000),
  -- New York
  ('NY', 'New York',       0.08875, 0.00000),
  ('NY', 'Buffalo',        0.08750, 0.00000),
  ('NY', 'Rochester',      0.08000, 0.00000),
  ('NY', 'Yonkers',        0.08875, 0.00000),
  -- Florida
  ('FL', 'Miami',          0.07000, 0.00000),
  ('FL', 'Orlando',        0.06500, 0.00000),
  ('FL', 'Tampa',          0.07500, 0.00000),
  ('FL', 'Jacksonville',   0.07500, 0.00000),
  ('FL', 'Fort Lauderdale',0.07000, 0.00000),
  -- Washington
  ('WA', 'Seattle',        0.10250, 0.00000),
  ('WA', 'Tacoma',         0.10300, 0.00000),
  ('WA', 'Spokane',        0.09000, 0.00000),
  ('WA', 'Bellevue',       0.10300, 0.00000),
  -- Illinois — tạp hoá 1%
  ('IL', 'Chicago',        0.10250, 0.01000),
  ('IL', 'Aurora',         0.08250, 0.01000),
  -- Georgia
  ('GA', 'Atlanta',        0.08900, 0.04000),
  ('GA', 'Savannah',       0.07000, 0.03000),
  -- Arizona
  ('AZ', 'Phoenix',        0.08600, 0.02300),
  ('AZ', 'Tucson',         0.08700, 0.02600),
  ('AZ', 'Mesa',           0.08300, 0.02000),
  -- Nevada
  ('NV', 'Las Vegas',      0.08375, 0.00000),
  ('NV', 'Reno',           0.08265, 0.00000),
  -- Colorado
  ('CO', 'Denver',         0.08810, 0.00000),
  ('CO', 'Colorado Springs', 0.08200, 0.00000),
  -- Massachusetts / Pennsylvania / Ohio / Michigan
  ('MA', 'Boston',         0.06250, 0.00000),
  ('PA', 'Philadelphia',   0.08000, 0.00000),
  ('PA', 'Pittsburgh',     0.07000, 0.00000),
  ('OH', 'Columbus',       0.07500, 0.00000),
  ('OH', 'Cleveland',      0.08000, 0.00000),
  ('OH', 'Cincinnati',     0.07800, 0.00000),
  ('MI', 'Detroit',        0.06000, 0.00000),
  -- North Carolina — tạp hoá 2%
  ('NC', 'Charlotte',      0.07250, 0.02000),
  ('NC', 'Raleigh',        0.07250, 0.02000),
  -- Tennessee — tạp hoá 4% + địa phương
  ('TN', 'Nashville',      0.09250, 0.06250),
  ('TN', 'Memphis',        0.09750, 0.06750),
  -- Louisiana
  ('LA', 'New Orleans',    0.09450, 0.05000),
  ('LA', 'Baton Rouge',    0.09950, 0.05500),
  -- Missouri — tạp hoá mức giảm
  ('MO', 'Kansas City',    0.08600, 0.05600),
  ('MO', 'St. Louis',      0.09679, 0.06679),
  -- Minnesota / Wisconsin / Indiana / Oklahoma
  ('MN', 'Minneapolis',    0.08025, 0.00000),
  ('MN', 'St. Paul',       0.07875, 0.00000),
  ('WI', 'Milwaukee',      0.07900, 0.00000),
  ('IN', 'Indianapolis',   0.07000, 0.00000),
  ('OK', 'Oklahoma City',  0.08625, 0.04125),
  ('OK', 'Tulsa',          0.08517, 0.04017),
  -- Utah / New Mexico / Oregon
  ('UT', 'Salt Lake City', 0.07750, 0.03000),
  ('NM', 'Albuquerque',    0.07625, 0.00000),
  ('OR', 'Portland',       0.00000, 0.00000),
  -- Maryland / Virginia / DC
  ('MD', 'Baltimore',      0.06000, 0.00000),
  ('VA', 'Virginia Beach', 0.06000, 0.01000),
  ('VA', 'Richmond',       0.06000, 0.01000),
  ('DC', 'Washington',     0.06000, 0.00000),
  -- New Jersey / Connecticut
  ('NJ', 'Newark',         0.06625, 0.00000),
  ('NJ', 'Jersey City',    0.06625, 0.00000),
  ('CT', 'Hartford',       0.06350, 0.00000),
  -- Hawaii — GET áp cả tạp hoá
  ('HI', 'Honolulu',       0.04712, 0.04712);

-- ---------------------------------------------------------------------------
-- 6. View theo dõi dòng chưa xác minh — dùng cho cảnh báo trong Admin
-- ---------------------------------------------------------------------------

create or replace view public.v_tax_jurisdiction_status
with (security_invoker = true) as
select
  state_code,
  count(*) filter (where city = '*') as state_default_rows,
  count(*) filter (where city <> '*') as city_rows,
  count(*) filter (where verified_at is null) as unverified_rows,
  count(*) as total_rows,
  max(updated_at) as last_updated_at
from public.tax_jurisdictions
where is_active
group by state_code;

grant select on public.v_tax_jurisdiction_status to authenticated;
