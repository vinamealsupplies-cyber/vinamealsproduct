# 01. Phạm vi sản phẩm

## 1. Tầm nhìn

Xây dựng một cửa hàng thực phẩm online cho thị trường Mỹ, ưu tiên trải nghiệm mua nhanh, hình ảnh tươi sáng và quản trị vận hành rõ ràng. Hệ thống cần phù hợp cả bán lẻ và bán sỉ, nhưng không tự động coi mọi doanh nghiệp là tax-exempt.

## 2. Nhóm người dùng

### Visitor

- Xem trang chủ, danh mục, sản phẩm và video.
- Tìm kiếm theo tên sản phẩm.
- Lọc theo danh mục, trạng thái còn hàng và khoảng giá.
- Sắp xếp theo featured, mới nhất, tên và giá.
- Tạo tài khoản hoặc đăng nhập.

### Retail customer

- Quản lý hồ sơ, địa chỉ và lịch sử invoice/order.
- Mua theo retail price.
- Thông thường chịu sales tax khi module tax được bật.

### Wholesale customer

- Có business name, contact, billing/shipping address và wholesale price.
- Có thể nộp resale/tax-exempt certificate.
- Chỉ được miễn tax sau khi admin duyệt trạng thái `approved`; không miễn tự động chỉ vì chọn “Business”.

### Staff / Manager / Admin

- Staff: vận hành sản phẩm, inventory, order/invoice theo quyền được giao.
- Manager: thêm báo cáo, customer approval, expenses và adjustments.
- Admin: toàn quyền, bao gồm user roles, settings, audit và import.

## 3. Tính năng storefront bắt buộc

- Header có logo, dropdown categories, search, account và cart placeholder.
- Trang chủ có hero, category cards, featured products, wholesale CTA.
- Product listing có search, filter, sort, pagination/infinite loading.
- Product card có hover nâng card, zoom ảnh và quick action.
- Product detail có gallery tối đa 10 ảnh, thumbnail, ảnh chính, video và thông tin tồn kho.
- Responsive cho mobile, tablet và desktop.
- Toàn bộ copy hiển thị cho khách bằng tiếng Anh.
- SEO cơ bản: title, description, canonical, Open Graph, structured data sau MVP.

## 4. Tính năng account bắt buộc

- Sign up, sign in, sign out, email confirmation và reset password.
- Profile, địa chỉ, company info và customer type.
- Retail/wholesale status.
- Tax-exempt application status: not requested, pending, approved, rejected, expired.
- Danh sách order/invoice và số dư còn phải trả nếu bán theo terms.

## 5. Tính năng admin bắt buộc

- Admin link xuất hiện trên header chỉ khi role phù hợp.
- Dashboard KPI: net sales, amount received, gross profit, inventory value, low-stock count.
- CRUD sản phẩm, variants/SKU, tối đa 10 ảnh và video.
- CRUD categories và category hierarchy cho dropdown menu.
- Inventory theo SKU, category và location; movements, adjustments, waste, sales, returns.
- Customer search theo name, email, phone, company; retail/wholesale/tax-exempt filters.
- Invoice/order/payment manual records.
- Expense records và receipt attachment.
- Monthly/yearly sales, COGS, gross profit, expenses, operating profit, inventory và cash received.
- Import product bằng Excel với preview, validation, error report và atomic commit.
- Audit log cho thay đổi nhạy cảm.

## 6. Ngoài phạm vi MVP nhưng kiến trúc phải hỗ trợ

- Card/ACH payment gateway.
- Sales-tax engine theo state/address/nexus.
- Shipping carrier rates và label.
- Promotions/coupons, loyalty, subscriptions.
- Multi-warehouse transfer workflow nâng cao.
- Purchase orders và vendor receiving đầy đủ.
- Native mobile app.

## 7. Tiêu chí thành công MVP

- Admin tạo sản phẩm có 1–10 ảnh, video tùy chọn và gán danh mục thành công.
- Khách tìm sản phẩm theo tên trong không quá 2 giây ở dataset mục tiêu ban đầu.
- Mọi thay đổi inventory tạo movement có dấu vết.
- Dashboard đối chiếu được invoice, payment, COGS và expense theo cùng kỳ.
- Customer không thể truy cập dữ liệu của customer khác; non-admin không vào được admin routes.
- Import Excel trả lỗi theo từng dòng trước khi ghi dữ liệu.
