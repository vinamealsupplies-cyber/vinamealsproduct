# 10. Bảo mật và lưu ý sales tax tại Mỹ

## 1. Security baseline

- RLS bật trên mọi table ở exposed schema.
- Service role key chỉ dùng server-side.
- Server route luôn verify identity/role; không tin role từ request body.
- Validate input bằng schema; encode output; tránh raw HTML.
- Rate limit login, search abuse, upload và admin mutations.
- CSRF strategy cho cookie-auth mutations; dùng SameSite cookies và origin checks phù hợp.
- Security headers: CSP, HSTS ở production, frame restrictions, Referrer-Policy.
- Secret rotation, least-privilege Cloudflare tokens và separate staging/production.
- Dependency scanning và CI build/typecheck.
- Không cấp customer/anon quyền đọc `cost_price`, invoice/order cost snapshots, expenses hoặc management profit views.

## 2. Upload security

- Allowlist MIME/extension.
- Giới hạn size/count.
- Random object key.
- Tài liệu tax-exempt/receipt phải private.
- Verify uploaded file sau PUT; production nên quét malware/document safety.

## 3. Data privacy

- Chỉ thu dữ liệu cần thiết.
- Có retention policy cho documents và audit logs.
- Hỗ trợ export/delete request theo chính sách áp dụng; không xóa accounting records trái nghĩa vụ lưu trữ.
- Không log PII không cần thiết.

## 4. Wholesale và sales tax

“Business” không đồng nghĩa tự động “no sales tax”. Quy tắc resale/tax exemption phụ thuộc state, loại giao dịch và certificate hợp lệ.

Thiết kế đề xuất:

- `customer_type = wholesale` quyết định pricing/terms.
- `tax_exempt_status = approved` mới quyết định exemption eligibility.
- Lưu certificate number, issuing state, reason, effective/expiration dates và verifier.
- Database không chấp nhận trạng thái đã review (`approved`, `rejected`, `expired`) nếu thiếu verifier; approval/rejection phải đi qua server route có audit.
- Invoice snapshot exemption reason/certificate reference.
- Khi module tax được bật, dùng tax engine hoặc tax professional để cấu hình nexus, sourcing, product taxability và filing.

Đây là thiết kế phần mềm, không phải tư vấn pháp lý hoặc thuế. Trước khi bán thật tại Mỹ, cần CPA/sales-tax professional xác nhận quy trình theo các bang liên quan.

## 5. Payment scope

Payment gateway chưa triển khai trong blueprint. Schema manual payment/refund đã có và bắt buộc payment currency khớp invoice. Khi tích hợp provider, dùng hosted fields/checkout để giảm phạm vi PCI; không lưu card number/CVV trong Supabase.

## 6. Backups and recovery

- Kiểm tra Supabase backup/PITR phù hợp plan.
- R2 versioning/lifecycle nếu phù hợp.
- Có export định kỳ cho catalog, inventory và accounting data.
- Test restore, không chỉ bật backup.
