import { AdminPageHeader } from "@/components/admin-page-header";
import { InventoryManager } from "@/components/inventory-manager";
import { requireAdminAccessPage } from "@/lib/auth";
import { getInventoryForStaff, getRecentMovements } from "@/lib/data/inventory";

export const metadata = { title: "Inventory" };

export default async function InventoryPage() {
  const viewer = await requireAdminAccessPage();
  const [rows, movements] = await Promise.all([getInventoryForStaff(), getRecentMovements()]);

  return (
    <>
      <AdminPageHeader
        eyebrow="Inventory"
        title="Inventory detail"
        description={
          viewer.isSeller
            ? "Xem tồn kho theo SKU, điều chỉnh số lượng và giá bán. Giá nhập (cost) chỉ admin/staff thấy."
            : "See quantity by SKU and location. Adjust stock, set unit cost (giá nhập) and retail price (giá bán), and inventory value."
        }
      />
      <InventoryManager rows={rows} movements={movements} isSeller={viewer.isSeller} />
      {!viewer.isSeller ? (
        <section className="ledger-explainer">
          <h2>Inventory movement ledger</h2>
          <p>
            Opening balances, purchases, sales, returns, adjustments, transfers, reservations, and releases each
            create an immutable movement. Balances are derived from those movements, so every quantity can be
            explained and audited — that is why a correction posts an adjustment instead of overwriting the number.
          </p>
        </section>
      ) : null}
    </>
  );
}
