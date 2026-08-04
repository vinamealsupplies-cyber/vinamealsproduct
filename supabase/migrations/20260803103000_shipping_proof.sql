-- Shipping proof: PDF/image upload as alternative (or addition) to tracking number.
alter table public.sales_orders
  add column if not exists shipping_proof_object_key text,
  add column if not exists shipping_proof_filename text,
  add column if not exists shipping_proof_content_type text;

comment on column public.sales_orders.shipping_proof_object_key is
  'Private R2 key for shipping label / receipt proof (PDF or image).';
comment on column public.sales_orders.shipping_proof_filename is
  'Original filename of shipping proof upload.';
comment on column public.sales_orders.shipping_proof_content_type is
  'MIME type of shipping proof (application/pdf, image/jpeg, image/png, image/webp).';
