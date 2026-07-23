# 07. Lưu ảnh và video trên Cloudflare

## 1. Kiến trúc khuyến nghị

### Images

- Lưu original image trong Cloudflare R2.
- Browser upload trực tiếp bằng presigned PUT URL do server tạo.
- Public delivery qua custom CDN domain, ví dụ `media.example.com`.
- Có thể thêm Cloudflare Image Resizing/Images để tạo thumbnail/WebP/AVIF; metadata vẫn nằm Supabase.

### Video

- Khuyến nghị Cloudflare Stream cho product video vì có encode và adaptive playback.
- Có thể lưu original tạm thời/backup trong R2 nếu quy trình cần.
- MVP chi phí thấp có thể phát MP4 từ R2, nhưng thiếu adaptive bitrate/transcoding và sẽ kém tối ưu hơn.

## 2. Upload flow ảnh

1. Admin chọn file trong Product Media Manager.
2. Client kiểm tra type/size/count.
3. Gọi server endpoint tạo presigned URL; server kiểm tra admin role.
4. Client PUT trực tiếp tới R2 với đúng `Content-Type`.
5. Client gọi complete endpoint; server HEAD object rồi gọi service-role RPC để đổi primary image và insert `product_media` trong cùng transaction.
6. Worker/background phase sau tạo derivative/metadata; UI cập nhật status.

## 3. Upload flow video

- Với Stream: server tạo direct upload URL một lần; browser upload trực tiếp; webhook cập nhật `ready` và `stream_uid`.
- Với file lớn/kết nối không ổn định: dùng resumable upload.
- UI chỉ publish video khi trạng thái ready.

## 4. Quy tắc file đề xuất

### Images

- Allowed: JPEG, PNG, WebP, AVIF.
- App limit đề xuất: 8 MB/file.
- Max 10 images/product.
- Resize source hợp lý trước upload; primary product image nên có tỷ lệ nhất quán.
- Alt text bắt buộc trước publish.

### Video

- Allowed app-level: MP4, MOV, WebM.
- App limit đề xuất tùy ngân sách, ví dụ 500 MB/video.
- Không autoplay có âm thanh.
- Tối ưu poster/thumbnail.

## 5. Object keys

- `products/{product_id}/images/{uuid}-{sanitized-name}`
- `products/{product_id}/videos/{uuid}-{sanitized-name}`
- `customers/{customer_id}/tax-exempt/{uuid}.pdf`
- `expenses/{expense_id}/receipts/{uuid}-{sanitized-name}`

Không dựa vào original filename làm unique key.

## 6. Security

- R2 API secret và Stream API token chỉ ở server.
- Presigned URL sống ngắn, bind method/object/content type.
- Bucket CORS chỉ cho production/staging domains.
- Verify file metadata sau upload; quét malware cho tài liệu khách upload ở phase production.
- Private certificate/receipt không để public URL; dùng signed access hoặc server proxy.
- Object key và Stream UID có unique index để tránh metadata trùng.
- Khi xóa product, nên soft-delete media record trước rồi cleanup object bằng job có retry.
