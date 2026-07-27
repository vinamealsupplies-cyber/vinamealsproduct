-- Số điện thoại liên hệ giao hàng trên customer_addresses.
-- Nullable để địa chỉ cũ / billing vẫn hợp lệ; form shipping app bắt buộc nhập.

alter table public.customer_addresses
  add column if not exists phone text;

comment on column public.customer_addresses.phone is
  'Contact phone for delivery (E.164-ish or US local). Required by app for shipping addresses.';
