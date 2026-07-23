# 08. Import sản phẩm bằng Excel

## 1. Mô hình file

Mỗi dòng đại diện một SKU/variant. Các dòng có cùng `product_handle` thuộc cùng một product. Product-level data có thể lặp lại trên các dòng variant.

File mẫu: `import-templates/product-import-template.xlsx`.

## 2. Trường quan trọng

- `operation`: CREATE, UPDATE hoặc UPSERT.
- `product_handle`: khóa nhóm variants; ổn định giữa các lần import.
- `product_name`, `slug`, `description`, `short_description`.
- `category_path`: ví dụ `Frozen > Dumplings`.
- `variant_name`, `sku`, `barcode`, `attributes_json`.
- `retail_price`, `wholesale_price`, `cost_price`.
- `track_inventory`, `opening_quantity`, `reorder_point`, `location_code`.
- `taxable`, `unit`, `weight_oz`, `active`.
- `image_url_1` đến `image_url_10`, `video_url`.

## 3. Validation

### File-level

- Extension/mime hợp lệ.
- Có sheet `Products` hoặc lấy sheet đầu tiên.
- Header bắt buộc tồn tại, không trùng. Unknown columns được báo và bỏ qua; `image_url_11` trở lên bị từ chối.
- Không vượt 5.000 dòng hoặc 10 MB trong starter preview.

### Row-level

- `product_name`, `product_handle`, `sku` bắt buộc.
- Price/cost >= 0.
- Opening quantity/reorder point >= 0.
- Boolean phải là TRUE/FALSE hoặc YES/NO được normalize.
- SKU/barcode không trùng trong file hoặc database.
- Handle/SKU/slug đúng format và độ dài; các dòng chung `product_handle` được cảnh báo nếu name/slug/category không nhất quán.
- Category path không có segment rỗng; category phải tồn tại hoặc import mode cho phép tạo category.
- Tối đa 10 image URLs, mọi media URL phải dùng HTTPS.
- `opening_quantity > 0` chỉ hợp lệ khi `track_inventory = TRUE`; location trống phải được resolve bằng cấu hình mặc định trong commit step.
- `attributes_json` phải là JSON object hợp lệ.
- Giá bán thấp hơn giá vốn hoặc wholesale cao hơn retail được cảnh báo để admin review.

## 4. Import UX

1. Upload file.
2. Parse và preview, chưa ghi database.
3. Hiển thị summary: total rows, valid, warning, error, creates, updates.
4. Cho download error report.
5. Admin chọn commit.
6. Server gọi transaction/RPC.
7. Ghi `import_jobs` và `import_job_rows`.
8. Sau commit, queue download/copy media URL vào Cloudflare nếu cần.

## 5. Atomicity

- Product/variant/category/inventory records trong một batch nên commit atomically.
- Media fetch có thể async sau transaction; product ở trạng thái draft cho đến khi media hoàn tất.
- Không import opening inventory bằng update trực tiếp balance; tạo `opening` movement.

## 6. Idempotency

- Ưu tiên match variant bằng SKU.
- Match product bằng `product_handle` hoặc external ID, không chỉ tên.
- Mỗi import job có idempotency key/hash để tránh bấm commit hai lần.
- UPSERT không xóa dữ liệu không xuất hiện trong file trừ khi admin chọn explicit sync mode.
