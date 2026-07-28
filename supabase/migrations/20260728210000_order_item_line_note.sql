-- Ghi chú yêu cầu đặc biệt theo từng dòng hàng (khách nhập lúc đặt).
alter table public.sales_order_items
  add column if not exists line_note text;

comment on column public.sales_order_items.line_note is
  'Special request / note from customer for this line item (e.g. ripe fruit, no ice).';
