"use client";

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
  PackagePlus,
  Percent,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  UserCog,
  UsersRound
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
      { href: "/admin/products", label: "Products", icon: ShoppingBasket },
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
      { href: "/admin/tax-exemptions", label: "Tax exemptions", icon: ShieldCheck }
    ]
  },
  {
    label: "Measure",
    items: [
      { href: "/admin/expenses", label: "Expenses", icon: ReceiptText },
      { href: "/admin/reports", label: "Reports", icon: BarChart3 },
      { href: "/admin/tax", label: "Sales tax", icon: Percent },
      { href: "/admin/accounts", label: "Accounts", icon: UserCog, adminOnly: true },
      { href: "/admin/settings", label: "Settings", icon: Settings }
    ]
  }
];

export function AdminNav({
  isSeller = false,
  isAdmin = false
}: {
  isSeller?: boolean;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();

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

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-title">
        {isSeller ? "Seller — giao dịch hằng ngày" : "Store administration"}
      </div>
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
            return (
              <Link className={active ? "active" : ""} href={item.href} key={item.href}>
                <Icon size={18} aria-hidden="true" /> {item.label}
              </Link>
            );
          })}
        </nav>
      ))}
    </aside>
  );
}
