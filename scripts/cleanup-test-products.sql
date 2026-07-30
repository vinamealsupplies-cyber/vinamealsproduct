-- Xoá sạch 50 sản phẩm TEST đã seed (product_handle bắt đầu 'test-', SKU 'TEST-%').
-- KHÔNG đụng tới sản phẩm thật.
--
-- Chạy:
--   set -a && source .env.local && set +a
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f scripts/cleanup-test-products.sql
--
-- Lưu ý: inventory_movements có trigger chặn DELETE (ledger bất biến), nên phải
-- xoá movements trước bằng cách hạ trigger trong cùng transaction — hoặc chỉ
-- archive nếu đã có đơn hàng tham chiếu.

begin;

create temp table _doomed on commit drop as
select p.id as product_id, v.id as variant_id
from products p
join product_variants v on v.product_id = p.id
where p.product_handle like 'test-%'
  and v.sku like 'TEST-%';

-- Chặn xoá nhầm nếu sản phẩm test đã bị đặt hàng thật.
do $$
declare n int;
begin
  select count(*) into n
  from sales_order_items i
  where i.variant_id in (select variant_id from _doomed);
  if n > 0 then
    raise exception 'Có % dòng đơn hàng tham chiếu sản phẩm test — dừng lại, archive thủ công thay vì xoá.', n;
  end if;
end $$;

alter table inventory_movements disable trigger inventory_movements_immutable_delete;

delete from inventory_movements where variant_id in (select variant_id from _doomed);
delete from inventory_balances  where variant_id in (select variant_id from _doomed);

alter table inventory_movements enable trigger inventory_movements_immutable_delete;

-- product_media / product_categories / product_variants cascade theo products.
delete from products where id in (select product_id from _doomed);

commit;

-- Kiểm tra lại: phải trả 0
-- select count(*) from products where product_handle like 'test-%';
