# 03. Kiến trúc thông tin và UI/UX

## 1. Storefront sitemap

- `/` Home
- `/products` All Products
- `/products?category=...` Category listing
- `/products/[slug]` Product Detail
- `/search?q=...` Có thể gộp vào `/products?q=...`
- `/login`, `/forgot-password`, `/auth/confirm`
- `/account`
- `/account/profile`
- `/account/addresses`
- `/account/orders`
- `/account/invoices`
- `/wholesale` Wholesale application/benefits
- `/about`, `/contact`, `/faq`, `/policies/*`

## 2. Admin sitemap

- `/admin` Dashboard
- `/admin/products`
- `/admin/products/new`
- `/admin/products/[id]`
- `/admin/categories`
- `/admin/inventory`
- `/admin/inventory/movements`
- `/admin/customers`
- `/admin/customers/[id]`
- `/admin/orders`
- `/admin/invoices`
- `/admin/payments`
- `/admin/expenses`
- `/admin/reports`
- `/admin/imports`
- `/admin/users`
- `/admin/settings`
- `/admin/audit-log`

## 3. Header desktop

- Trái: logo.
- Giữa: `Shop` dropdown nhiều cấp, `New Arrivals`, `Wholesale`, search field.
- Phải: account, cart placeholder.
- Khi user có quyền: link `Admin` nổi bật trước account hoặc trong top utility bar.

## 4. Header mobile

- Hamburger mở drawer.
- Search full width ngay dưới hàng logo.
- Categories dùng accordion.
- Account/Admin nằm cuối drawer.

## 5. Product card

Thông tin tối thiểu:

- Primary image.
- Category/eyebrow.
- Product name.
- Retail price; wholesale price chỉ hiện khi được phép.
- Stock badge: `In stock`, `Low stock`, `Out of stock`.
- Hover: card nâng 4–8px, shadow tăng, ảnh scale nhẹ, quick action hiện dần.
- Không dùng animation quá mạnh; tôn trọng `prefers-reduced-motion`.

## 6. Product detail

- Desktop: gallery trái, information/purchase panel phải.
- Mobile: gallery trên, information dưới.
- Tối đa 10 ảnh; thumbnail scroll ngang/dọc.
- Click thumbnail đổi ảnh chính; click ảnh chính mở lightbox/zoom ở phase tiếp theo.
- Video hiển thị như media item, có poster, controls và không autoplay có âm thanh.
- Alt text bắt buộc cho ảnh chính; video cần caption/transcript khi nội dung có lời nói quan trọng.

## 7. Product listing controls

- Search by product name/SKU.
- Category dropdown hoặc sidebar.
- Stock status.
- Price range ở phase sau.
- Sort: Featured, Newest, Name A–Z, Name Z–A, Price Low–High, Price High–Low.
- Query state nằm trong URL để share/back hoạt động đúng.

## 8. Visual direction

- Nền sáng, nhiều khoảng trắng, card bo góc vừa phải.
- Màu chính mang cảm giác tươi: citrus/orange kết hợp leaf green và neutral cream.
- Dùng một hệ spacing nhất quán 4/8px.
- Typography rõ ràng, body tối thiểu 16px.
- Contrast đạt WCAG AA cho text/control quan trọng.
- Không đưa quá nhiều màu vào cùng một card; ưu tiên ảnh sản phẩm.

## 9. Empty/error/loading states

Mỗi module cần có:

- Skeleton loading.
- Empty state có hành động rõ ràng.
- Inline validation error.
- Toast chỉ dùng cho kết quả ngắn; lỗi quan trọng phải hiện gần form.
- Retry cho network error.
