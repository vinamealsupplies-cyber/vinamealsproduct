# 02. Vai trò và phân quyền

## 1. Role model

| Role | Storefront | Own account | Products | Inventory | Customers | Invoices/payments | Expenses/reports | Roles/settings |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Visitor | Read | No | No | No | No | No | No | No |
| Customer | Read | Own only | No | No | Own only | Own only | No | No |
| Staff | Read | Own | Create/update | Operate | Read limited | Operate | Read limited | No |
| Manager | Read | Own | Full | Full | Full | Full | Full | No |
| Admin | Full | Full | Full | Full | Full | Full | Full | Full |

## 2. Cách xác định quyền

- Supabase Auth xác thực user.
- `profiles.role` là nguồn dữ liệu role phía database.
- RLS là lớp bảo vệ chính; ẩn nút trên UI chỉ là trải nghiệm, không phải security.
- Server routes dùng user identity đã verify và kiểm tra role trước khi dùng service credentials.
- Không lưu role trong `user_metadata` do user có thể chỉnh; nếu thêm JWT custom claim thì claim phải lấy từ dữ liệu do hệ thống quản lý.

## 3. Quy tắc hiển thị Admin link

1. Header server component lấy user identity.
2. Query `profiles.role` cho user hiện tại.
3. Hiển thị `Admin` khi role là `staff`, `manager` hoặc `admin` theo phạm vi route.
4. `/admin` vẫn phải kiểm tra role ở server layout; không dựa vào việc link có hiện hay không.

## 4. Customer ownership

- `customers.auth_user_id` liên kết một customer với một Supabase user.
- Guest/manual customer có thể không có `auth_user_id` và chỉ admin/staff được truy cập.
- Customer chỉ đọc/update hồ sơ được liên kết với chính họ.
- Customer chỉ xem orders, invoices và payments thuộc customer record của mình.
- Customer-facing grants dùng danh sách cột an toàn; không cấp `cost_price`, wholesale cost internals hoặc `unit_cost_snapshot`.
- Account wholesale chỉ đọc `v_account_price_list` khi chính customer record đang active và được staff gán `customer_type = wholesale`.

## 5. Tax-exempt approval

- Customer có thể nộp thông tin certificate nhưng không tự đặt `approved`.
- Chỉ manager/admin có thể đổi trạng thái tax exemption.
- Mọi approval/rejection cần `verified_by`, `verified_at` và note.
- Khi tạo invoice, hệ thống chụp snapshot exemption status/reason; thay đổi sau đó không sửa invoice lịch sử.

## 6. Hành động cần audit

- Thay đổi role.
- Duyệt/reject tax-exempt.
- Inventory adjustment, write-off hoặc waste.
- Sửa giá/cost.
- Void invoice, refund, xóa payment.
- Import hàng loạt.
- Thay đổi business settings.

## 7. Reporting và service role

- Management views có caller gate riêng: staff cho operational views, manager/admin cho profit/cost views.
- Service-role request được nhận diện riêng để server jobs có thể đọc view, nhưng key vẫn chỉ tồn tại server-side.
- Browser không query trực tiếp bảng/view chứa giá vốn; server route phải verify role trước khi trả projection cần thiết.
