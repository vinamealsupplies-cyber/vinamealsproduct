# 05. Inventory, sales và định nghĩa báo cáo

## 1. Đơn vị tồn kho

- Mỗi sellable SKU là một `product_variant`.
- Quantity dùng `numeric(14,3)` để hỗ trợ sản phẩm theo pound/weight, nhưng UI có thể làm tròn theo unit.
- `on_hand`: hàng vật lý ghi nhận.
- `reserved`: hàng đã giữ cho order chưa fulfill.
- `available = on_hand - reserved`.

## 2. Inventory movements

Mọi thay đổi phải là movement, không chỉnh trực tiếp balance.

| Type | Dấu quantity | Ví dụ |
|---|---:|---|
| opening | + | Số dư ban đầu |
| purchase | + | Nhập hàng |
| sale | - | Fulfill order |
| return_in | + | Khách trả và restock |
| return_out | - | Trả nhà cung cấp |
| adjustment | +/- | Kiểm kê chênh lệch |
| waste | - | Hư hỏng/hết hạn |
| transfer_in | + | Nhận từ location khác |
| transfer_out | - | Chuyển đi location khác |
| reserve | on-hand 0; reserved + | Giữ hàng cho order chưa fulfill |
| release | on-hand 0; reserved - | Hủy giữ hàng/cancel order |
| reversal | ngược chính xác movement gốc | Sửa sai bằng bút toán đảo, không sửa/xóa lịch sử |

Movement lưu source, user, timestamp, note và unit cost snapshot. `quantity_change` tác động on-hand; `quantity_reserved_change` tác động reserved. Khi fulfill, transaction thường release reserved và ghi sale để giảm on-hand. Database bắt buộc dấu theo movement type; reversal phải trỏ tới movement gốc, dùng cùng SKU/location và số lượng ngược chính xác.

`allow_backorder` chỉ là cờ nghiệp vụ để storefront/admin có thể nhận order chưa reserve đủ hàng. Ledger vẫn không cho `on_hand`, `reserved` hoặc `available` âm; backorder phải được theo dõi ở order/fulfillment workflow thay vì tạo tồn kho âm.

## 3. Cost method

MVP dùng `current cost` trên SKU để tính inventory value và snapshot cost khi bán. Để báo cáo kế toán chính xác hơn, phase sau nên dùng weighted average hoặc FIFO cost layers.

- COGS trên invoice item = quantity x `unit_cost_snapshot`.
- Sửa cost hiện tại không làm thay đổi invoice lịch sử.
- Inventory value MVP = on hand x current cost.

## 4. Sales definitions

- Gross merchandise sales: tổng `quantity x unit_price` trước discount.
- Net sales: gross merchandise sales - discounts; không gồm shipping hoặc sales tax.
- Shipping revenue: phí vận chuyển được invoice, hiển thị riêng.
- Tax collected: số thu hộ cơ quan thuế, không coi là revenue.
- Amount invoiced: invoice total gồm net sales + shipping + tax theo cấu hình.
- Amount received: successful payments - refunds.
- Balance due: invoice total - amount received.

## 5. Profit definitions

- Gross profit = net sales - COGS.
- Operating profit (internal management view) = product gross profit + shipping revenue - operating expenses. Shipping cost phải nằm trong expense/COGS policy phù hợp để tránh double count.
- Payment timing và revenue timing khác nhau; dashboard phải hiển thị cả `Sales` và `Cash received`.

## 6. Monthly/yearly logic

- Sales grouped by invoice issue date hoặc fulfillment date; chọn một basis và giữ nhất quán. Blueprint mặc định dùng invoice issue date.
- Payments grouped by received date.
- Expenses grouped by expense date.
- Refund payment làm giảm `amount_received`; không tự làm giảm `net_sales`.
- Blueprint hiện chưa có credit-note/return-sales module hoàn chỉnh. Trước production phải thêm return/credit-note records để net sales và COGS đảo đúng khi hàng bị trả.
- Timezone business phải lưu trong settings; database timestamps lưu UTC.

## 7. Reconciliation

Mỗi tháng cần đối chiếu:

1. Invoice totals với invoice items.
2. Invoice amount paid với payment records.
3. Inventory decrement với sold/fulfilled quantities.
4. COGS snapshots với sold quantities.
5. Expense totals với receipts/bank records.
6. Tax collected với tax report khi module tax được bật.
