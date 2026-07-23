# 17. Sales tax theo thành phố và Pickup/Ship

Bổ sung so với blueprint gốc. Cả hai đã được kiểm chứng bằng cách chạy thật trên
PostgreSQL 17 (xem mục 4).

---

## 1. Sales tax theo thành phố Mỹ

### 1.1 Vì sao phải có HAI mức thuế cho mỗi vùng

Đây là điểm dễ làm sai nhất với cửa hàng thực phẩm: **phần lớn các bang Mỹ miễn
hoặc giảm mạnh thuế cho hàng tạp hoá**, nhưng vẫn thu đủ với đồ ăn chế biến sẵn.

Nếu chỉ lưu một thuế suất cho mỗi thành phố thì hoặc là thu thừa của khách mua
hàng khô, hoặc là thu thiếu của khách mua đồ ăn nóng — cả hai đều là vấn đề khi
quyết toán.

Vì vậy `tax_jurisdictions` lưu:

| Cột | Áp cho |
|---|---|
| `general_rate` | Hàng hoá thường (đồ dùng, quà tặng) |
| `grocery_rate` | Hàng tạp hoá đủ điều kiện miễn/giảm |
| `prepared_food_rate` | Đồ ăn sẵn; để `null` thì dùng `general_rate` |

Mỗi biến thể sản phẩm có `product_variants.tax_category` với ba giá trị
`grocery` / `prepared_food` / `general`, mặc định là `grocery`.

Ví dụ thật ở Los Angeles, CA với đơn 100 USD:

| Nhóm hàng | Thuế suất | Tiền thuế |
|---|---:|---:|
| Grocery | 0% | $0.00 |
| Prepared food | 9.5% | $9.50 |
| General | 9.5% | $9.50 |

### 1.2 Thứ tự tra cứu

`public.calculate_sales_tax(amount, state, city, zip, tax_category, on_date)`
gọi `resolve_tax_jurisdiction` và lấy dòng khớp nhất theo thứ tự:

1. **ZIP** khớp chính xác
2. **Thành phố** khớp tên (không phân biệt hoa thường, bỏ khoảng trắng thừa)
3. **Mặc định của bang** — dòng có `city = '*'`

Nếu bang không có dữ liệu nào, hàm trả `matched_on = 'no_jurisdiction'` **chứ
không trả 0**. Đây là chủ ý: thu thiếu thuế âm thầm nguy hiểm hơn là dừng
checkout và báo lỗi.

### 1.3 Hiệu lực theo thời gian

Mỗi dòng có `effective_from` / `effective_to`. Muốn đổi thuế suất từ đầu quý
sau thì thêm dòng mới với ngày hiệu lực tương lai, **không sửa đè dòng cũ** —
hoá đơn đã xuất vẫn tra ra đúng thuế suất tại thời điểm bán.

### 1.4 Dữ liệu hiện có

132 dòng: 51 mức mặc định (50 bang + DC) và 81 thành phố lớn.

> **Cảnh báo bắt buộc đọc.** Toàn bộ 132 dòng đang mang `source =
> 'seed_estimate'` và `verified_at = null`. Thuế suất Mỹ thay đổi theo quý và
> theo từng đặc khu. Phải đối chiếu từng dòng với cơ quan thuế của bang rồi
> đánh dấu đã xác minh trước khi bán thật.
>
> Riêng việc **bạn có nghĩa vụ thu thuế ở bang nào (nexus)** là câu hỏi cho kế
> toán, không phải cho phần mềm.

Trang `Admin > Sales tax` hiện số dòng chưa xác minh ngay đầu trang và có ô
nhập địa chỉ để tra thử thuế suất.

### 1.5 Đồng bộ dữ liệu giữa database và giao diện

Nguồn chân lý là SQL trong `supabase/migrations/`. File
`lib/tax/jurisdictions.generated.ts` chỉ để giao diện chạy được khi chưa nối
Supabase, và được **sinh ra từ SQL**:

```bash
node scripts/sync-tax-data.mjs
```

Sửa seed thuế trong SQL thì chạy lại lệnh trên, đừng sửa tay file `.generated.ts`.

Khi đã nối Supabase, việc tính tiền thật phải gọi hàm trong database — vì bảng
đó sửa được từ trang Admin, còn file TS thì không.

---

## 2. Pickup hoặc Ship

Áp dụng cho **cả khách lẻ và khách sỉ**, không phân biệt loại khách.

### 2.1 Cột mới

| Bảng | Cột |
|---|---|
| `sales_orders` | `fulfillment_method`, `pickup_location_id`, `pickup_ready_at`, `picked_up_at` |
| `invoices` | `fulfillment_method`, `pickup_location_snapshot` |
| `inventory_locations` | `is_pickup_location`, `pickup_instructions`, `pickup_hours` |

### 2.2 Luật được ràng buộc ở tầng database

1. Đơn `pickup` **không được** có phí vận chuyển.
2. Đơn `pickup` đã chốt (khác `draft`) **phải** có địa điểm lấy hàng — nói được
   với khách ngay khi xác nhận.
3. Đơn `ship` **phải** có địa chỉ trước khi chuyển sang `fulfilled`.
   Cố ý chỉ chặn ở bước cuối: đơn qua điện thoại hay tại quầy thường được chốt
   trước rồi mới lấy địa chỉ. Tầng checkout tự siết sớm hơn.
4. `picked_up_at` không được sớm hơn `pickup_ready_at`.
5. Hoá đơn gắn vào đơn hàng **phải khớp** `fulfillment_method` với đơn đó.

### 2.3 Thuế của đơn pickup

Đơn nhận tại cửa hàng tính thuế theo **địa chỉ cửa hàng**, không phải địa chỉ
khách. Xem `components/fulfillment-picker.tsx` — hằng số `STORE`.

---

## 3. Còn phải làm

- Nối `tax_jurisdictions` vào luồng tạo hoá đơn thật (hiện mới có hàm và giao diện).
- Nút xác minh thuế suất trong Admin (ghi `verified_at` / `verified_by`).
- Nhập thuế suất hàng loạt bằng file.
- Phí vận chuyển thật theo carrier, thay cho mức phẳng đang hardcode.
- Chọn địa điểm pickup khi có nhiều hơn một cửa hàng.

---

## 4. Đã kiểm chứng những gì

Chạy trên PostgreSQL 17 local với stub tối thiểu cho `auth.users` / `auth.uid()`
và ba role `anon` / `authenticated` / `service_role`:

- 7/7 migration chạy sạch.
- `supabase/tests/001_smoke_test.sql` báo *"All food-store database smoke tests
  passed"* và rollback sạch.
- 9 test riêng cho hai tính năng này đều đạt: tra thuế theo thành phố, đổi nhóm
  hàng, lùi về mặc định bang, bang không có dữ liệu, chặn phí ship trên đơn
  pickup, chặn pickup thiếu địa điểm, chặn giao hàng thiếu địa chỉ, và chặn hoá
  đơn lệch phương thức với đơn hàng.

Chưa chạy trên Supabase remote tại thời điểm viết tài liệu này.
