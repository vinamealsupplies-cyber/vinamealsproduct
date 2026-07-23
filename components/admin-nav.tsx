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
  PackagePlus,
  Percent,
  ReceiptText,
  Settings,
  ShoppingBasket,
  UsersRound
} from "lucide-react";

const groups = [
  {
    label: "Operate",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/products", label: "Products", icon: ShoppingBasket },
      { href: "/admin/categories", label: "Categories", icon: FolderTree },
      { href: "/admin/inventory", label: "Inventory", icon: Boxes },
      { href: "/admin/imports", label: "Imports", icon: FileSpreadsheet }
    ]
  },
  {
    label: "Sell",
    items: [
      { href: "/admin/orders", label: "Orders", icon: PackagePlus },
      { href: "/admin/invoices", label: "Invoices", icon: FileText },
      { href: "/admin/customers", label: "Customers", icon: UsersRound },
      { href: "/admin/payments", label: "Payments", icon: CircleDollarSign }
    ]
  },
  {
    label: "Measure",
    items: [
      { href: "/admin/expenses", label: "Expenses", icon: ReceiptText },
      { href: "/admin/reports", label: "Reports", icon: BarChart3 },
      { href: "/admin/tax", label: "Sales tax", icon: Percent },
      { href: "/admin/settings", label: "Settings", icon: Settings }
    ]
  }
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-title">Store administration</div>
      {groups.map((group) => (
        <nav key={group.label} aria-label={`${group.label} administration`}>
          <span className="admin-nav-label">{group.label}</span>
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
