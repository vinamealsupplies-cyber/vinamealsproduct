import { SetupNotice } from "@/components/setup-notice";

// Trước đây component này còn hai cảnh báo đã hết đúng và bị gỡ (31/7):
//   - "Sample data": mọi trang admin nay đọc/ghi Supabase thật.
//   - "Not saved yet" ở /admin/products/new: form đã ghi vào database.
// Chỉ giữ lại cảnh báo demo mode. Không còn cần usePathname nên bỏ luôn
// "use client" — component chạy được ở phía server.

export function AdminScaffoldNotice({ demo }: { demo: boolean }) {
  if (!demo) return null;

  return (
    <SetupNotice title="Demo mode">
      Admin demo mode is active. Configure Supabase and set APP_DEMO_MODE to false before deployment.
    </SetupNotice>
  );
}
