# 11. Roadmap triển khai

## Phase 0 — Foundation

- Chốt brand name/domain, business timezone, currency USD và fulfillment model.
- Tạo GitHub repo, branch protection và environments.
- Tạo Supabase dev/staging/prod strategy.
- Tạo R2 buckets và CDN domain; quyết định Stream hay R2 video.
- Chạy database migrations và seed local.

**Exit:** local app chạy, CI pass, database types generate được.

## Phase 1 — Catalog storefront

- Header/dropdown/search.
- Home, product listing, category và product detail.
- Product hover, gallery 10 ảnh, video component.
- Responsive/accessibility basics.
- SEO metadata cơ bản.

**Exit:** visitor browse/search/sort được toàn bộ catalog demo.

## Phase 2 — Auth and accounts

- Sign up/login/confirmation/reset.
- Profile và addresses.
- Retail/wholesale onboarding.
- Tax-exempt submission metadata/document private upload.
- Account invoices/orders read-only.

**Exit:** RLS tests chứng minh customer chỉ thấy dữ liệu của mình.

## Phase 3 — Admin catalog and media

- Admin guard/link/navigation.
- Products, variants, categories CRUD.
- R2 presigned image upload và 10-image limit.
- Stream direct upload hoặc R2 video.
- Draft/publish workflow.

**Exit:** admin publish product mới từ UI, media hoạt động end-to-end.

## Phase 4 — Inventory

- Locations, balances, movement service.
- Receive/adjust/waste/return UI.
- Inventory detail search/filter/sort.
- Low-stock alerts.

**Exit:** balance chỉ thay đổi qua movement; concurrency tests pass.

## Phase 5 — Sales, invoices and customers

- Admin order/invoice creation.
- Customer assignment, retail/wholesale price logic.
- Manual payments, outstanding balance.
- Invoice PDF/email ở subphase.

**Exit:** end-to-end sale tạo invoice, payment và inventory movement đúng.

## Phase 6 — Expenses and reports

- Expense CRUD/receipt.
- Monthly/yearly KPI.
- Sales, units, COGS, gross profit, operating profit, inventory, amount received.
- CSV/XLSX export.

**Exit:** dashboard đối chiếu được sample ledger/test cases.

## Phase 7 — Excel import

- Preview parser.
- Validation/error report.
- Atomic commit RPC.
- Media ingestion queue.
- Import audit/idempotency.

**Exit:** import create/update/upsert test file không tạo duplicate.

## Phase 8 — Payment and tax

- Chọn provider và tax approach.
- Server-calculated checkout.
- Webhooks/idempotency/refunds.
- Tax-exempt snapshot và tax reporting.
- Security/PCI review.

**Exit:** sandbox reconciliation pass; production checklist được phê duyệt.

## Suggested GitHub epics

1. Foundation & DevOps
2. Storefront Catalog
3. Authentication & Accounts
4. Admin Catalog & Media
5. Inventory
6. Sales & Invoicing
7. Customers & Wholesale
8. Expenses & Reporting
9. Excel Import
10. Payment & Tax
11. Security, Accessibility & Launch
