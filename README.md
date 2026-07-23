# Vinameals

Website bán thực phẩm cho thị trường Mỹ — bán lẻ và bán sỉ, nhận tại cửa hàng hoặc giao hàng.

Giao diện khách hàng bằng tiếng Anh. Tài liệu kỹ thuật trong `docs/` bằng tiếng Việt.

## Stack

| Lớp | Công nghệ |
|---|---|
| Web | Next.js 16 (App Router) + React 19 + TypeScript |
| Dữ liệu | Supabase (Postgres, Auth, Row Level Security) |
| Ảnh / video | Cloudflare R2 và Cloudflare Stream |
| Mã nguồn / CI | GitHub Actions |

## Chạy tại máy

```bash
nvm use
cp .env.example .env.local   # điền biến môi trường
npm install
npm run dev
```

Xem giao diện mà chưa cần Supabase:

```bash
APP_DEMO_MODE=true npm run dev
```

Chế độ này tự động tắt khi `NODE_ENV=production`.

## Kiểm tra trước khi push

```bash
npm run check
```

Chạy lần lượt `lint`, `typecheck` và `build`. Cả ba phải sạch.

## Database

Migration nằm trong `supabase/migrations/`, chạy theo thứ tự tên file:

```bash
supabase db push --linked
```

Sau đó chạy `supabase/tests/001_smoke_test.sql` trong SQL Editor để kiểm tra —
script tự `ROLLBACK`, không để lại dữ liệu test. Chỉ chạy `supabase/seed/` ở
môi trường dev.

## Hai điểm cần biết trước khi sửa

**Sales tax theo thành phố.** Bảng `tax_jurisdictions` lưu thuế suất theo
bang/thành phố/ZIP. Mỗi vùng có **hai** mức: `general_rate` cho hàng thường và
`grocery_rate` cho hàng tạp hoá, vì phần lớn các bang miễn hoặc giảm thuế cho
thực phẩm. Hàm `calculate_sales_tax` tra theo thứ tự ZIP → thành phố → mặc định
của bang, và trả `no_jurisdiction` thay vì 0 khi không có dữ liệu, để checkout
biết đường dừng lại. Chi tiết: `docs/17-sales-tax-and-fulfillment-vn.md`.

> Toàn bộ thuế suất đang là **ước lượng khởi điểm chưa xác minh**. Phải đối
> chiếu với cơ quan thuế từng bang trước khi bán thật.

**Pickup hoặc Ship.** Áp dụng cho cả khách lẻ lẫn khách sỉ, không phân biệt.
Đơn pickup không được có phí vận chuyển và phải có địa điểm lấy hàng khi đã
chốt; đơn ship phải có địa chỉ trước khi đánh dấu đã giao. Các luật này được
ràng buộc ở tầng database, không chỉ ở giao diện.

## Phạm vi hiện tại

Đây là nền tảng đang phát triển, **chưa nhận thanh toán thật**. Phần chưa làm:
checkout và cổng thanh toán, email giao dịch, vận chuyển thật, commit import
Excel, và phần lớn màn admin còn chạy trên dữ liệu mẫu.

Không commit `.env*`, khoá dịch vụ, hay thông tin tài khoản.
