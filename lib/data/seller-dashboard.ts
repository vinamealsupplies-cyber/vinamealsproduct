import "server-only";

import { getOrdersForStaff, type StaffOrder } from "@/lib/data/orders";
import { createAdminClient } from "@/lib/supabase/admin";
import { getInvoices, type InvoiceRow } from "@/lib/data/reporting";

export type SellerDashboard = {
  awaitingPickup: number;
  openOrders: number;
  unpaidInvoices: number;
  lowStockSkus: number;
  todayOrderCount: number;
  todayOrderTotal: number;
  outstandingBalance: number;
  recentAwaiting: StaffOrder[];
  recentUnpaid: InvoiceRow[];
};

function isSameUtcDay(iso: string, now = new Date()) {
  const d = new Date(iso);
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

/** Số liệu hằng ngày cho workspace seller (đơn, pickup, công nợ, kho). */
export async function getSellerDashboard(): Promise<SellerDashboard> {
  const supabase = createAdminClient();
  const [orders, invoices, inventory] = await Promise.all([
    getOrdersForStaff(),
    getInvoices(),
    supabase.from("v_inventory_detail").select("stock_status")
  ]);

  const awaiting = orders.filter((o) => o.awaitingPickup);
  const openOrders = orders.filter((o) => o.status === "confirmed").length;
  const unpaid = invoices.filter((inv) => inv.balanceDue > 0);
  const inventoryRows = (inventory.data ?? []) as { stock_status: string }[];
  const lowStockSkus = inventoryRows.filter((row) => row.stock_status !== "in_stock").length;

  const todayOrders = orders.filter((o) => isSameUtcDay(o.createdAt));
  const todayOrderTotal = todayOrders.reduce((sum, o) => sum + o.total, 0);
  const outstandingBalance = unpaid.reduce((sum, inv) => sum + inv.balanceDue, 0);

  return {
    awaitingPickup: awaiting.length,
    openOrders,
    unpaidInvoices: unpaid.length,
    lowStockSkus,
    todayOrderCount: todayOrders.length,
    todayOrderTotal,
    outstandingBalance,
    recentAwaiting: awaiting.slice(0, 8),
    recentUnpaid: unpaid.slice(0, 8)
  };
}
