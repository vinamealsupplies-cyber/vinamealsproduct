-- Mã vận đơn (tracking) cho đơn ship — FedEx / USPS / UPS / DHL / khác.
alter table public.sales_orders
  add column if not exists shipping_carrier text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists shipped_at timestamptz;

comment on column public.sales_orders.shipping_carrier is
  'Carrier code: usps | fedex | ups | dhl | other';
comment on column public.sales_orders.tracking_number is
  'Shipment tracking number from the carrier.';
comment on column public.sales_orders.tracking_url is
  'Optional override URL; if null, built from carrier + tracking_number.';
comment on column public.sales_orders.shipped_at is
  'When the package was handed to the carrier / tracking was recorded.';

create index if not exists sales_orders_tracking_idx
  on public.sales_orders (tracking_number)
  where tracking_number is not null;
