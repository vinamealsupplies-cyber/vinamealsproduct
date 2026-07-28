-- Role "seller": phụ trách fulfillment — inventory, orders, invoices, payments.
--
-- ADD VALUE phải nằm ở migration RIÊNG so với chỗ DÙNG giá trị đó. Postgres cấm
-- dùng một enum value mới trong CÙNG transaction vừa thêm nó (kể cả khi
-- check_function_bodies parse literal 'seller' lúc CREATE FUNCTION). `supabase db
-- push` chạy mỗi file migration trong 1 transaction, nên helper tham chiếu
-- 'seller' để ở file kế tiếp (20260728100100) mới an toàn.
alter type public.app_role add value if not exists 'seller';
