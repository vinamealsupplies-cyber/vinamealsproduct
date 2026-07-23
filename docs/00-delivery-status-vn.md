# 00. Trạng thái bàn giao

## Bản chất của bộ ZIP

Đây là **engineering blueprint + Next.js starter** để bắt đầu phát triển có kiểm soát. Bộ mã đã bao phủ kiến trúc, UI mẫu, schema dữ liệu, quyền truy cập, media upload, Excel preview và backlog; chưa phải website production có thể nhận đơn/thanh toán ngay.

## Ma trận hoàn thành

| Hạng mục | Trạng thái trong ZIP | Việc còn lại trước production |
|---|---|---|
| Storefront English UI | Có giao diện responsive, home/catalog/detail/cart placeholder | Kết nối query thật, cart state và checkout |
| Search/category/sort | Có trải nghiệm UI với demo data | Chuyển query sang Supabase, pagination và caching |
| Product hover/gallery | Có hover, modal/gallery, tối đa 10 ảnh và video placeholder | Accessibility QA trên browser thật |
| Account/Auth | Có Supabase SSR utilities, sign-up/sign-in/sign-out | Email templates, recovery, account CRUD |
| Admin navigation | Có guard theo role và đầy đủ màn hình khung | Kết nối từng bảng với database |
| Product/media admin | Có form, uploader, R2 presign/complete, atomic image-complete RPC và Stream direct-upload route | Product mutation transaction, delete/reorder, Stream webhook |
| Inventory | Có schema ledger, balance trigger, views và UI chi tiết mẫu | CRUD/movement routes, receiving/fulfillment workflow |
| Customers | Có retail/wholesale/guest và tax-exempt review model | Admin mutations, certificate upload/review workflow |
| Orders/invoices/payments | Có schema, snapshot, totals/payment triggers và UI mẫu | Invoice CRUD/PDF/email, manual payment form |
| Reports | Có monthly/yearly/product/customer views; tách net sales, shipping, tax, cash received, COGS và expense | Date filters, exports, returns/credit notes và reconciliation với dữ liệu thật |
| Excel import | Có XLSX template, CSV example và preview parser | Atomic commit RPC, idempotency và media queue |
| Payment gateway | Chưa triển khai theo yêu cầu | Chọn provider, checkout, webhook, refund, reconciliation |
| Automated sales tax | Chưa triển khai | Chọn tax engine/quy trình chuyên môn và nexus rules |
| Shipping/fulfillment | Chưa triển khai | Chốt pickup/delivery/shipping và workflow |

## Quy tắc dữ liệu đã được enforce

- Mỗi product có tối đa 10 ảnh và tối đa một video.
- Một primary image cho mỗi product; vị trí ảnh không trùng.
- Category không được tự tham chiếu hoặc tạo vòng lặp.
- Inventory balance chỉ thay đổi bằng movement; movement đã post không sửa/xóa.
- Movement type bị kiểm tra đúng dấu; reversal phải cùng SKU/location, ngược dấu chính xác và mỗi movement chỉ được reverse một lần.
- Reserved quantity không âm và không vượt on-hand; `allow_backorder` không cho phép ledger âm.
- Invoice/order item snapshot tên, SKU, giá bán, giá vốn và tax data.
- Invoice liên kết order phải khớp customer/currency; payment phải cùng currency với invoice.
- Payment thành công/refund tự cập nhật `amount_paid`, `balance_due` và invoice status.
- Trạng thái tax-exempt đã review phải có người xác minh và timestamp.
- Wholesale pricing và tax exemption là hai trạng thái độc lập.
- Customer-facing grants không mở `cost_price` hoặc `unit_cost_snapshot`.

## Kiểm tra đi kèm

- `database/tests/001_smoke_test.sql`: smoke test có rollback cho catalog, media, inventory, order, invoice, payment và reporting.
- `import-templates/product-import-template.xlsx`: workbook có validation/dropdown, hướng dẫn và dữ liệu mẫu.
- `starter/package.json`: dependency được pin theo phiên bản thay vì dùng `latest`.
- `checklists/admin-acceptance-checklist.md` và `checklists/launch-checklist.md`: tiêu chí nghiệm thu và go-live.

## Blocker trước khi bán thật

Không bật production checkout trước khi hoàn tất: server mutations, payment/tax, shipping, rate limiting, email, logging/monitoring, backup-restore test, accessibility/security review và đối chiếu báo cáo với dữ liệu thật.
