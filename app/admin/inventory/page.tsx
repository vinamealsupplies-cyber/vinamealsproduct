import { AdminPageHeader } from "@/components/admin-page-header";
import { InventoryManager } from "@/components/inventory-manager";
import { requireAdminAccessPage } from "@/lib/auth";
import { getInventoryForStaff, getRecentMovements } from "@/lib/data/inventory";

export const metadata = { title: "Inventory" };

export default async function InventoryPage() {
  await requireAdminAccessPage();
  const [rows, movements] = await Promise.all([getInventoryForStaff(), getRecentMovements()]);

  return (
    <>
      <AdminPageHeader
        eyebrow="Inventory"
        title="Inventory detail"
        description="See quantity by SKU and location. Adjust stock, set unit cost (giá nhập) and retail price (giá bán), and inventory value."
      />
      <InventoryManager rows={rows} movements={movements} />
      <section className="ledger-explainer">
        <h2>Inventory movement ledger</h2>
        <p>
          Opening balances, purchases, sales, returns, adjustments, transfers, reservations, and releases each
          create an immutable movement. Balances are derived from those movements, so every quantity can be
          explained and audited — that is why a correction posts an adjustment instead of overwriting the number.
        </p>
      </section>
    </>
  );
}
