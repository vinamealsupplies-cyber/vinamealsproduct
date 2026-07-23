import { Download, Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { SearchableTable } from "@/components/searchable-table";
import { expenseRows } from "@/lib/admin-sample-data";

export default function ExpensesPage() {
  return (
    <>
      <AdminPageHeader eyebrow="Costs" title="Expenses" description="Record operating costs separately from product cost of goods sold for complete profit reporting." action={<div className="button-row"><button className="button secondary" type="button"><Download size={17} /> Export</button><button className="button primary" type="button"><Plus size={17} /> Add expense</button></div>} />
      <SearchableTable columns={[
        { key: "date", label: "Date", kind: "date" }, { key: "category", label: "Category" }, { key: "vendor", label: "Vendor" }, { key: "description", label: "Description" }, { key: "amount", label: "Amount", kind: "currency", align: "right" }
      ]} rows={expenseRows} searchPlaceholder="Search vendor, description, or category" defaultSortKey="date" />
    </>
  );
}
