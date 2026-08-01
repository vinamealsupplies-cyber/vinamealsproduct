"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  CircleDollarSign,
  FileSpreadsheet,
  FileText,
  FolderTree,
  LayoutDashboard,
  type LucideIcon,
  Menu,
  PackagePlus,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  UserCog,
  UsersRound,
  X
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Hiện với role seller (seller chỉ quản lý inventory/orders/invoices/payments). */
  seller?: boolean;
  /** Chỉ hiện với role admin (quản lý tài khoản / role). */
  adminOnly?: boolean;
};

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: "Operate",
    items: [
      // Dashboard: staff = tài chính; seller = giao dịch hằng ngày (cùng /admin).
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, seller: true },
      { href: "/admin/products", label: "Products", icon: ShoppingBasket, seller: true },
      { href: "/admin/categories", label: "Categories", icon: FolderTree },
      { href: "/admin/inventory", label: "Inventory", icon: Boxes, seller: true },
      { href: "/admin/imports", label: "Imports", icon: FileSpreadsheet }
    ]
  },
  {
    label: "Sell",
    items: [
      { href: "/admin/orders", label: "Orders", icon: PackagePlus, seller: true },
      { href: "/admin/customers", label: "Customers", icon: UsersRound, seller: true },
      { href: "/admin/invoices", label: "Invoices", icon: FileText, seller: true },
      { href: "/admin/payments", label: "Payments", icon: CircleDollarSign, seller: true },
      { href: "/admin/business-applications", label: "Business apps", icon: ShieldCheck },
      { href: "/admin/tax-exemptions", label: "Tax exemptions", icon: FileText }
    ]
  },
  {
    label: "Measure",
    items: [
      { href: "/admin/expenses", label: "Expenses", icon: ReceiptText },
      { href: "/admin/reports", label: "Reports", icon: BarChart3 },
      { href: "/admin/accounts", label: "Accounts", icon: UserCog, adminOnly: true },
      { href: "/admin/settings", label: "Settings", icon: Settings }
    ]
  }
];

export function AdminNav({
  isSeller = false,
  isAdmin = false,
  openOrdersCount = 0
}: {
  isSeller?: boolean;
  isAdmin?: boolean;
  /** Số đơn confirmed chưa xử lý (chờ pickup/ship) — badge đỏ cạnh Orders. */
  openOrdersCount?: number;
}) {
  const pathname = usePathname();
  const openCount = Math.max(0, Math.floor(openOrdersCount));
  // Mobile: menu gập lại thành icon, bấm mới mở (dọc). Desktop: luôn hiện.
  const [open, setOpen] = useState(false);

  // Seller chỉ thấy các mục fulfillment; Accounts chỉ admin; nhóm rỗng thì ẩn.
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (isSeller) return Boolean(item.seller);
        if (item.adminOnly && !isAdmin) return false;
        return true;
      })
    }))
    .filter((group) => group.items.length > 0);

  // Nhãn trang hiện tại để hiện trên nút hamburger (mobile).
  const activeItem = visibleGroups
    .flatMap((group) => group.items)
    .find((item) =>
      item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href)
    );
  const activeLabel = activeItem?.label ?? "Menu";

  return (
    <aside className={open ? "admin-sidebar is-open" : "admin-sidebar"}>
      <button
        type="button"
        className="admin-nav-toggle"
        aria-expanded={open}
        aria-controls="admin-nav-groups"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        <span className="admin-nav-toggle-label">{activeLabel}</span>
        <span className="admin-nav-toggle-hint">{open ? "Close" : "Menu"}</span>
      </button>

      <div className="admin-sidebar-title">
        {isSeller ? "Seller — giao dịch hằng ngày" : "Store administration"}
      </div>

      <div className="admin-nav-groups" id="admin-nav-groups">
        {visibleGroups.map((group) => (
          <nav key={group.label} aria-label={`${group.label} administration`}>
            <span className="admin-nav-label">
              {isSeller && group.label === "Operate"
                ? "Hôm nay"
                : isSeller && group.label === "Sell"
                  ? "Bán hàng"
                  : group.label}
            </span>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
              const showOrdersBadge = item.href === "/admin/orders" && openCount > 0;
              return (
                <Link
                  className={active ? "active" : ""}
                  href={item.href}
                  key={item.href}
                  onClick={() => setOpen(false)}
                  aria-label={
                    showOrdersBadge
                      ? `Orders, ${openCount} đơn chưa xử lý`
                      : undefined
                  }
                >
                  <Icon size={18} aria-hidden="true" />
                  <span className="admin-nav-label-text">{item.label}</span>
                  {showOrdersBadge ? (
                    <span className="admin-nav-order-badge" aria-hidden="true">
                      {openCount > 99 ? "99+" : openCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        ))}
      </div>
    </aside>
  );
}
