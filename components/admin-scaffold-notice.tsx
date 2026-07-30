"use client";

import { usePathname } from "next/navigation";
import { SetupNotice } from "@/components/setup-notice";

// Banner cũ nói "toàn bộ admin dùng dữ liệu mẫu" — không còn đúng sau khi
// Products và Categories đã nối Supabase. Banner giờ hiện theo từng trang:
// trang đã chạy dữ liệu thật thì không cảnh báo gì.

/** Đọc/ghi dữ liệu thật từ Supabase — không cần cảnh báo. */
const LIVE_PATHS = [
  "/admin",
  "/admin/categories",
  "/admin/products",
  "/admin/tax-exemptions",
  "/admin/customers",
  "/admin/accounts",
  "/admin/activity",
  "/admin/expenses",
  "/admin/inventory",
  "/admin/reports",
  "/admin/orders",
  "/admin/invoices",
  "/admin/payments"
];

export function AdminScaffoldNotice({ demo }: { demo: boolean }) {
  const pathname = usePathname();

  if (demo) {
    return (
      <SetupNotice title="Demo mode">
        Admin demo mode is active. Configure Supabase and set APP_DEMO_MODE to false before deployment.
      </SetupNotice>
    );
  }

  // Form thêm sản phẩm mới chỉ kiểm tra dữ liệu nhập, chưa ghi vào database.
  if (pathname === "/admin/products/new") {
    return (
      <SetupNotice title="Not saved yet">
        This form validates your input but does not create the product in the database yet. Categories load
        from Supabase, so anything you add under Categories appears here right away.
      </SetupNotice>
    );
  }

  // "/admin" là tiền tố của mọi trang con nên phải so khớp tuyệt đối cho nó.
  const isLive = LIVE_PATHS.some((live) =>
    live === "/admin" ? pathname === "/admin" : pathname === live || pathname.startsWith(`${live}/`)
  );
  if (isLive) return null;

  return (
    <SetupNotice title="Sample data">
      This page still shows placeholder data. Products and Categories already read from Supabase — the
      remaining admin sections are connected next.
    </SetupNotice>
  );
}
