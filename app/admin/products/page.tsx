import Link from "next/link";
import { FileSpreadsheet, Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { ProductManager } from "@/components/product-manager";
import { getViewer, requireStaffPage } from "@/lib/auth";
import { getAdminProductList } from "@/lib/data/admin-products";

export const metadata = { title: "Products" };

export default async function AdminProductsPage() {
  await requireStaffPage();
  const [viewer, products] = await Promise.all([getViewer(), getAdminProductList()]);

  return (
    <>
      <AdminPageHeader
        eyebrow="Catalog"
        title="Products"
        description="Add, search, price, and maintain products. Archived items stay under the Archived tab — edit or restore anytime."
        action={
          <div className="button-row">
            <Link className="button secondary" href="/admin/imports"><FileSpreadsheet size={17} /> Import Excel</Link>
            <Link className="button primary" href="/admin/products/new"><Plus size={17} /> Add product</Link>
          </div>
        }
      />
      {/* Xoá vĩnh viễn là thao tác không hoàn tác được → chỉ manager/admin. */}
      <ProductManager products={products} canDeleteForever={Boolean(viewer?.isManager)} />
    </>
  );
}
