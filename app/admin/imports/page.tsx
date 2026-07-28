import { AdminPageHeader } from "@/components/admin-page-header";
import { ProductImportForm } from "@/components/product-import-form";
import { requireStaffPage } from "@/lib/auth";

export default async function ImportsPage() {
  await requireStaffPage();
  return (
    <>
      <AdminPageHeader
        eyebrow="Bulk operations"
        title="Import products from Excel"
        description="Minimal columns: product name, retail price, and inventory. IDs and SKUs are generated automatically. Category and media can be added later."
      />
      <ProductImportForm />
    </>
  );
}
