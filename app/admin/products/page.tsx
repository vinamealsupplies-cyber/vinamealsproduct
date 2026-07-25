import Link from "next/link";
import { FileSpreadsheet, Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { SearchableTable } from "@/components/searchable-table";
import { getAdminProducts } from "@/lib/data/products";

export default async function AdminProductsPage() {
  // Bảng admin cần giá sỉ → đọc bằng service role (anon/authenticated không
  // còn quyền trên cột wholesale_price sau bản vá bảo mật).
  const products = await getAdminProducts();
  const rows = products.map((product) => ({ id: product.id, name: product.name, sku: product.sku, category: product.category, retailPrice: product.price, wholesalePrice: product.wholesalePrice, stock: product.stock, status: "Active" }));
  return (
    <>
      <AdminPageHeader eyebrow="Catalog" title="Products" description="Add, search, sort, price, categorize, and maintain every sellable product." action={<div className="button-row"><Link className="button secondary" href="/admin/imports"><FileSpreadsheet size={17} /> Import Excel</Link><Link className="button primary" href="/admin/products/new"><Plus size={17} /> Add product</Link></div>} />
      <SearchableTable columns={[
        { key: "name", label: "Product" }, { key: "sku", label: "SKU" }, { key: "category", label: "Category" },
        { key: "retailPrice", label: "Retail", kind: "currency", align: "right" }, { key: "wholesalePrice", label: "Wholesale", kind: "currency", align: "right" },
        { key: "stock", label: "On hand", kind: "integer", align: "right" }, { key: "status", label: "Status", kind: "status" }
      ]} rows={rows} searchPlaceholder="Search product name, SKU, or category" defaultSortKey="name" />
    </>
  );
}
