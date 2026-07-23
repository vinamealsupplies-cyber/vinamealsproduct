import { AdminPageHeader } from "@/components/admin-page-header";
import { ProductImportForm } from "@/components/product-import-form";

export default function ImportsPage() {
  return (
    <>
      <AdminPageHeader eyebrow="Bulk operations" title="Import products from Excel" description="Validate rows before committing products, variants, prices, categories, opening inventory, and media URLs." />
      <ProductImportForm />
    </>
  );
}
