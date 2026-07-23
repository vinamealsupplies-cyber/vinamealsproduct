# 15. Giả định và quyết định kiến trúc

## Giả định đã dùng

- Một business/entity, currency USD, English-only storefront trong MVP.
- Một inventory location mặc định, schema vẫn hỗ trợ nhiều location.
- Product có variants/SKU để hỗ trợ size/flavor/pack.
- Wholesale pricing nằm ở variant.
- Payment gateway và automated tax calculation làm sau.
- Manual invoices/payments cần có trước payment gateway.
- Frontend hosting chưa bị khóa; starter là Next.js Node-compatible.

## Quyết định chính

### Next.js App Router + TypeScript

Phù hợp storefront SEO, server rendering, route handlers và admin trong cùng repo.

### Supabase Postgres/Auth/RLS

Database quan hệ phù hợp inventory, invoice và reporting; RLS bảo vệ data theo user/role.

### Cloudflare R2 for images/files

Object storage tách khỏi database; browser direct upload giảm tải app server.

### Cloudflare Stream optional for video

Tốt hơn raw MP4 khi cần encode/adaptive playback; R2-only vẫn là lựa chọn tiết kiệm cho video ngắn.

### Inventory movement ledger

Không cho sửa balance tùy ý; mọi thay đổi có movement để audit và reconciliation.

### Invoice/item snapshots

Giá, cost, tên, SKU và tax treatment được snapshot để báo cáo lịch sử không đổi khi catalog được sửa.

### Wholesale != tax exempt

Pricing tier và tax exemption là hai trạng thái độc lập.

## Các quyết định cần business owner xác nhận trước Phase 5

- Checkout có cho guest hay bắt buộc account.
- Fulfillment: pickup, local delivery, shipping hay kết hợp.
- Bán hàng theo unit hay weight; quy tắc decimal quantity.
- Invoice payment terms cho wholesale.
- Chính sách returns/refunds.
- Cost method dùng cho báo cáo/kế toán.
- Bang có nexus và quy trình certificate.
- Frontend deployment provider.
- Video dùng Stream hay R2-only.
