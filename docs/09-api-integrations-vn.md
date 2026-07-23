# 09. API và integration contracts

## 1. Storefront data access

- Product/category listing có thể query Supabase trực tiếp dưới RLS hoặc qua server components.
- Dữ liệu có cost, customer, inventory detail và reports chỉ qua server/admin endpoints.
- Search parameters được validate và giới hạn page size.

## 2. Endpoint skeleton

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/api/catalog/products` | Search/filter/sort products | Public |
| GET | `/api/catalog/products/:slug` | Product detail/media | Public |
| POST | `/api/admin/media/presign` | R2 image upload URL | Staff+ |
| POST | `/api/admin/media/complete` | Save media metadata | Staff+ |
| POST | `/api/admin/video/direct-upload` | Stream upload URL | Staff+ |
| POST | `/api/admin/imports/products/preview` | Parse/validate workbook | Manager+ |
| POST | `/api/admin/imports/products/commit` | Atomic import | Manager+ |
| GET | `/api/admin/reports/summary` | KPI by range | Manager+ |
| POST | `/api/admin/inventory/adjust` | Inventory movement | Staff+ |

## 3. Standard response

Success:

```json
{
  "data": {},
  "meta": { "requestId": "..." }
}
```

Validation error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted fields.",
    "fields": { "sku": "SKU already exists." }
  },
  "meta": { "requestId": "..." }
}
```

## 4. Idempotency

- Import commit, future payment creation và inventory receipt cần `Idempotency-Key`.
- Server lưu key/result trong table hoặc metadata để retry không tạo bản ghi trùng.

## 5. Payment extension point

Khi bổ sung payment:

- Tạo provider adapter: `createIntent`, `capture`, `refund`, `webhook`.
- Không tin trạng thái do browser gửi; webhook/provider API là nguồn xác nhận.
- `payments` lưu provider, external ID, status, amount và raw event reference.
- Webhook signature verification bắt buộc.
- Checkout totals phải được tính lại server-side từ database.

## 6. Observability

- Mỗi request admin có request ID.
- Log không chứa password, token, full card data hoặc certificate content.
- Error tracking phân biệt environment.
- Audit record dùng entity type/id, action, before/after tối giản và actor.
