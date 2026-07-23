# 12. Test plan và acceptance criteria

## 1. Catalog

- Search exact/partial product name; không phân biệt hoa thường.
- Category filter kết hợp search và sort.
- Inactive product không xuất hiện public.
- Product card hover không làm layout shift.
- Mobile gallery hoạt động với 1, 10 ảnh và video.
- Upload ảnh thứ 11 bị chặn ở UI và database.

## 2. Auth/RLS

- Anonymous không đọc customer/invoice/inventory private tables.
- Customer A không đọc/update Customer B.
- Customer không tự đổi role hoặc tax-exempt status.
- Staff không quản lý roles/settings.
- Admin route trả redirect/403 khi không đủ quyền.
- Service key không xuất hiện trong client bundle.

## 3. Inventory

- Opening/purchase tăng tồn; sale/waste giảm tồn; sai dấu theo movement type bị từ chối.
- Ledger không cho tồn âm kể cả SKU bật `allow_backorder`; backorder được quản lý ở order workflow.
- Hai adjustment đồng thời không làm lost update.
- Xóa/sửa movement sau posting bị từ chối; reversal phải cùng SKU/location, ngược số lượng chính xác và không reverse hai lần.
- Inventory detail totals khớp movements.

## 4. Sales/invoice/payment

- Line subtotal/discount/tax/total chính xác với rounding policy.
- Amount paid = successful payments - refunds.
- Payment khác currency với invoice bị từ chối; invoice liên kết order khác customer/currency bị từ chối.
- Invoice status chuyển partial/paid đúng.
- Void invoice không tính vào sales report.
- COGS dùng snapshot, không đổi khi current cost thay đổi.
- Tax-exempt chỉ áp dụng khi approved và có snapshot; reviewed status không có verifier bị từ chối.

## 5. Reports

- Monthly và yearly tổng bằng source transactions.
- Net sales không bao gồm shipping hoặc sales tax; shipping revenue và tax collected hiển thị riêng.
- Amount received theo payment date, không invoice date.
- Payment refund giảm cash received; return/credit note phải giảm net sales/COGS bằng module riêng trước production.
- Expense theo expense date.
- Date range sử dụng business timezone đúng ở boundary.

## 6. Import

- Sai/missing/duplicate header, `image_url_11+`, duplicate SKU/barcode, invalid JSON/URL/slug, negative price và opening inventory sai đều bị báo rõ.
- Preview không thay đổi database.
- Commit lỗi rollback batch.
- Retry cùng idempotency key không import lại.
- Opening quantity tạo inventory movement.

## 7. Media

- Presigned upload chỉ cho admin/staff.
- Content type không hợp lệ bị từ chối.
- Private documents không mở bằng public URL.
- Delete/reorder/primary image cập nhật đúng.
- Video chưa ready không publish.

## 8. Non-functional

- Responsive 360px–desktop.
- Keyboard navigation cho header, dropdown, gallery và forms.
- Focus states rõ ràng.
- Core pages có loading/empty/error states.
- Build/typecheck/lint pass trong CI.
- Backup restore drill có tài liệu.

## 9. Smoke test có sẵn

`database/tests/001_smoke_test.sql` tự kiểm tra category cycle, giới hạn 10 ảnh, dấu/reversal/balance/immutability của inventory, tax verifier, customer/currency consistency, order/invoice totals, payment status, storefront projection và monthly report tách sales/shipping/tax/cash. Chạy sau migrations ở dev/staging.
