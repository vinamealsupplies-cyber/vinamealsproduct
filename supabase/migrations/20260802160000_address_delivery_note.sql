-- Ghi chú giao hàng cho địa chỉ của khách (vd mã cổng, để trước cửa, gọi trước).
-- Đơn ship snapshot lại note này (hoặc note khách nhập riêng ở checkout).
alter table public.customer_addresses
  add column if not exists note text;

comment on column public.customer_addresses.note is
  'Ghi chú giao hàng do khách nhập (mã cổng, chỉ dẫn giao…).';

-- customer_addresses dùng column-level grants → phải cấp quyền cho cột mới.
grant select (note), insert (note), update (note)
  on public.customer_addresses to authenticated;

notify pgrst, 'reload schema';
