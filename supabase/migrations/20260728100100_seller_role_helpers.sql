-- Helper nhận diện role seller (mirror style private.is_staff/is_manager).
--
-- Lưu ý kiến trúc: khu /admin đọc/ghi dữ liệu nghiệp vụ bằng SERVICE ROLE (xem
-- lib/data/*.ts, lib/supabase/admin.ts) và cổng phân quyền nằm ở tầng app
-- (lib/auth.ts + app/admin/layout.tsx + guard từng trang). Vì service role bỏ
-- qua RLS nên seller KHÔNG cần được thêm vào các policy is_staff() để dùng khu
-- admin — giữ nguyên RLS hiện tại, tránh nới lỏng ngoài ý muốn.
--
-- Helper này để dành cho RLS/định tuyến tương lai (vd. nếu sau này seller truy
-- vấn bằng JWT của chính họ) và để tài liệu hoá vai trò trong DB.
create or replace function private.is_seller()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select coalesce(private.current_app_role() = 'seller', false);
$$;

revoke all on function private.is_seller() from public;
grant execute on function private.is_seller() to anon, authenticated;
