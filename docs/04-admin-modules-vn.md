# 04. Đặc tả các module Admin

## 1. Dashboard

### KPI cards

- Net Sales: doanh thu trước sales tax, sau discount/returns theo kỳ.
- Amount Received: payment đã nhận trừ refund theo kỳ.
- Gross Profit: Net Sales trừ COGS.
- Inventory Value: on-hand quantity nhân cost theo phương pháp đã chọn.
- Low Stock: số SKU có available quantity <= reorder point.

### Widgets

- Sales by month.
- Top products by quantity/revenue.
- Low-stock list.
- Recent invoices/payments.
- Outstanding balance aging.
- Wholesale applications pending.

## 2. Products

### List columns

- Image, product name, SKU count, primary category, retail price range, wholesale price range, on hand, status, updated date.

### Controls

- Search name/SKU/barcode.
- Filter category, active/draft/archived, stock status.
- Sort each meaningful column.
- Bulk activate/archive/category assignment.

### Product form sections

1. Basic: name, slug, short/full description, status.
2. Categories: primary and additional categories.
3. Variants: SKU, barcode, variant name, attributes, retail/wholesale price, cost, taxable, unit, weight.
4. Inventory: location, opening quantity, reorder point, allow backorder setting.
5. Media: drag/drop, max 10 images, reorder, primary image, alt text, video upload/link.
6. SEO: title, meta description, social image.

## 3. Categories

- Name, slug, parent category, description, image, sort order, active.
- Tree view và drag/reorder phase sau.
- Không xóa category đang gán sản phẩm; cho archive hoặc yêu cầu reassign.

## 4. Inventory

### Detail table

- Product, variant, SKU, barcode, category, location.
- On hand, reserved, available.
- Reorder point, stock status.
- Cost per unit, inventory value.
- Last movement, last counted date.

### Actions

- Receive stock.
- Adjustment increase/decrease.
- Record waste/damage.
- Customer return/restock.
- Transfer location ở phase sau.
- Cycle count; chênh lệch phải tạo movement.

## 5. Customers

### Columns

- Customer number, name/company, type, email, phone, tax-exempt status, total sales, balance due, last order.

### Detail

- Contact and addresses.
- Retail/wholesale status.
- Certificate metadata/document.
- Orders, invoices, payments.
- Notes và internal tags.
- Audit trail.

## 6. Orders/Invoices/Payments

- Draft order có thể tạo từ admin cho phone/walk-in/wholesale customer.
- Order item phải snapshot name, SKU, unit price, unit cost và tax treatment.
- Invoice có status: draft, issued, partially paid, paid, overdue, void.
- Payment có method, amount, received date, reference và status.
- Không hard-delete invoice/payment đã phát hành; dùng void/refund với audit.

## 7. Expenses

- Expense date, category, vendor, description, amount, tax, method, receipt, notes.
- Filter theo date/category/vendor.
- Expense ảnh hưởng operating profit, không trừ trực tiếp vào gross profit.

## 8. Reports

- Date range presets: this month, last month, YTD, last year, custom.
- Sales monthly/yearly.
- Quantity sold by product/category.
- COGS, gross profit, expenses, operating profit.
- Amount invoiced, amount received, balance outstanding.
- Inventory quantity/value and low stock.
- Export CSV/XLSX phase sau.

## 9. Imports

- Upload `.xlsx` hoặc `.csv` trong giới hạn dung lượng.
- Preview tối thiểu 20 rows.
- Validate required headers, data types, duplicate SKU/barcode, category existence, numeric ranges và image count.
- Mode: create only, update only, upsert.
- Commit bằng transaction/RPC; nếu lỗi nghiêm trọng thì rollback toàn batch.
- Download error report theo row/column/message.
