import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Cấu hình tối thiểu: chưa bật incremental cache / tag cache vì trang còn chạy
// trên dữ liệu mẫu. Khi nối Supabase và có traffic thật thì thêm R2 cache ở đây.
export default defineCloudflareConfig();
