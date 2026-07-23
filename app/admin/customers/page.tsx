import { Download, UserPlus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { SearchableTable } from "@/components/searchable-table";
import { customerRows } from "@/lib/admin-sample-data";

export default function CustomersPage() {
  return (
    <>
      <AdminPageHeader eyebrow="Relationships" title="Customers" description="Manage guest, retail, and wholesale customers, balances, price levels, and exemption review." action={<div className="button-row"><button className="button secondary" type="button"><Download size={17} /> Export</button><button className="button primary" type="button"><UserPlus size={17} /> Add customer</button></div>} />
      <SearchableTable columns={[
        { key: "number", label: "Customer no." }, { key: "name", label: "Name" }, { key: "company", label: "Company" }, { key: "type", label: "Type", kind: "status" }, { key: "email", label: "Email" },
        { key: "exempt", label: "Exemption", kind: "status" }, { key: "sales", label: "Lifetime sales", kind: "currency", align: "right" }, { key: "balance", label: "Balance", kind: "currency", align: "right" }
      ]} rows={customerRows} searchPlaceholder="Search customer name, company, email, or number" defaultSortKey="name" />
      <div className="legal-callout compact"><h2>Wholesale is not the same as tax exempt</h2><p>Keep price level and exemption approval in separate fields. Only authorized staff should approve tax-exempt status after validating the required documents and jurisdiction.</p></div>
    </>
  );
}
