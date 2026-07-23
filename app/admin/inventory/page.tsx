import { Boxes, Download, SlidersHorizontal } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { SearchableTable } from "@/components/searchable-table";
import { inventoryRows } from "@/lib/admin-sample-data";

export default function InventoryPage() {
  const rows = inventoryRows.map((row) => ({ ...row, available: row.onHand - row.reserved, inventoryValue: row.onHand * row.cost, status: row.onHand - row.reserved <= row.reorder ? "Low stock" : "Healthy" }));
  return (
    <>
      <AdminPageHeader eyebrow="Inventory" title="Inventory detail" description="See quantity by SKU, category, and location, including reserved, available, reorder point, unit cost, and inventory value." action={<div className="button-row"><button className="button secondary" type="button"><Download size={17} /> Export</button><button className="button primary" type="button"><Boxes size={17} /> Adjust inventory</button></div>} />
      <div className="filter-chip-row"><span><SlidersHorizontal size={15} /> All categories</span><span>Location: MAIN</span><span>Include active SKUs</span></div>
      <SearchableTable columns={[
        { key: "product", label: "Product" }, { key: "variant", label: "Variant" }, { key: "sku", label: "SKU" }, { key: "category", label: "Category" }, { key: "location", label: "Location" },
        { key: "onHand", label: "On hand", kind: "integer", align: "right" }, { key: "reserved", label: "Reserved", kind: "integer", align: "right" }, { key: "available", label: "Available", kind: "integer", align: "right" },
        { key: "reorder", label: "Reorder", kind: "integer", align: "right" }, { key: "cost", label: "Unit cost", kind: "currency", align: "right" }, { key: "inventoryValue", label: "Value", kind: "currency", align: "right" }, { key: "status", label: "Status", kind: "status" }
      ]} rows={rows} searchPlaceholder="Search product name, SKU, category, or location" defaultSortKey="product" />
      <section className="ledger-explainer"><h2>Inventory movement ledger</h2><p>Opening balances, purchases, sales, returns, adjustments, transfers, reservations, and releases should each create an immutable movement. The balance table is updated from those movements so every quantity can be explained and audited.</p></section>
    </>
  );
}
