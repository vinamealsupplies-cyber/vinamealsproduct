# vinameals-inbound-email

Cloudflare **Email Worker** nhận thư gửi tới `support@vinamealsupplies.com` và
đẩy vào hộp thư hỗ trợ trong app (`/admin/inbox`).

## Luồng

```
Khách gửi mail → support@vinamealsupplies.com
   → Cloudflare Email Routing (MX đã trỏ route*.mx.cloudflare.net)
   → Worker này (email() handler)
   → parse MIME bằng postal-mime
   → POST Supabase RPC ingest_inbound_email (service role)
   → INSERT email_threads / email_messages (direction=inbound)
   → hiện trong /admin/inbox, badge chưa đọc
```

Worker **tách riêng** khỏi app OpenNext vì OpenNext worker chỉ export `fetch`,
không có `email()` handler.

## Đã cấu hình

- Deploy: `vinameals-inbound-email` (Cloudflare Workers).
- `SUPABASE_URL`: biến công khai trong `wrangler.jsonc`.
- `SUPABASE_SERVICE_ROLE_KEY`: đã set bằng `wrangler secret put`.
- RPC `ingest_inbound_email`: migration `20260731160000_inbound_email_ingest.sql`
  (đã áp dụng; test qua PostgREST OK).

## ⚠️ Việc CÒN LẠI — bật routing rule (cần dashboard Cloudflare)

Token wrangler chỉ có quyền `zone read` nên **không tạo được routing rule bằng CLI**.
Làm trong dashboard:

1. Cloudflare → **Email** → **Email Routing** → tab **Routing rules**.
2. Ở **Custom addresses**, thêm/sửa địa chỉ `support@vinamealsupplies.com`.
3. Action = **Send to a Worker** → chọn `vinameals-inbound-email` → Save.
   (Nếu muốn vừa vào app vừa forward về Gmail cá nhân thì tạo thêm rule forward —
   nhưng một địa chỉ chỉ gắn được một action, cân nhắc dùng catch-all.)

## Deploy lại

```bash
cd email-worker
npm install
npx wrangler deploy
```

## Test sau khi bật routing

- Gửi một email thật tới `support@vinamealsupplies.com`.
- Xem log worker: `npx wrangler tail vinameals-inbound-email`.
- Mở `/admin/inbox` → thư phải xuất hiện, thread có dấu chưa đọc.

## Giới hạn hiện tại

- **Attachment chưa lưu** (chỉ text/html body). Muốn có thì thêm bước upload
  `parsed.attachments` lên R2 + insert `email_attachments`.
- Threading nối theo **địa chỉ khách** (thread đang mở). Nối theo `In-Reply-To`
  chỉ hoạt động khi thư outbound có lưu `rfc_message_id` — hiện app chưa lưu, nên
  reply của khách gộp theo địa chỉ (vẫn đúng cho phần lớn trường hợp).
- Lỗi thì worker **log rồi bỏ qua**, không bao giờ bounce thư khách.
